import { consumeRateLimit } from './db';
import { bodyErrorResponse, jsonResponse, methodNotAllowed, readJsonBody } from './http';
import type { WorkerEnv } from './env';
import { hasAllowedOrigin, imagePath, isShareId, tokenHash } from './shares';

/**
 * Public gallery of shared artworks.
 *
 * A share is listed only when (1) it belongs to a signed-in account whose
 * owner submits it (`worker/accountShares.ts`), (2) it is permanent
 * (`expiry_policy = 'never'`), and (3) a maintainer approves it with
 * `scripts/gallery-review.mjs`. Revoking the share removes it from the
 * gallery, because every gallery query also requires a live, published row.
 */

export const GALLERY_PAGE_SIZE = 24;
const MAX_GALLERY_PAGE_SIZE = 48;
/** Distinct reporters needed to pull a listed artwork back into review. */
export const GALLERY_REPORT_HIDE_THRESHOLD = 3;
const REPORT_REASONS = ['copyright', 'privacy', 'inappropriate', 'other'] as const;
type ReportReason = (typeof REPORT_REASONS)[number];
const REPORT_BODY_LIMIT = 1024;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

interface GalleryRow {
  id: string;
  title: string;
  author: string;
  image_type: string;
  gallery_listed_at: string;
}

function available(env: WorkerEnv): boolean {
  return !!(env.DB && env.ARTWORKS);
}

function notFound(): Response {
  return jsonResponse({ error: 'Artwork not found.', code: 'NOT_FOUND' }, 404);
}

function encodeCursor(row: GalleryRow): string {
  return btoa(JSON.stringify([row.gallery_listed_at, row.id]))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(raw: string): [string, string] | null {
  if (raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const value = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))) as unknown;
    if (Array.isArray(value) && value.length === 2
      && typeof value[0] === 'string' && TIMESTAMP_PATTERN.test(value[0])
      && typeof value[1] === 'string' && isShareId(value[1])) {
      return [value[0], value[1]];
    }
  } catch {
    // Fall through: a malformed cursor is a client error.
  }
  return null;
}

/** `GET /api/gallery?cursor=&limit=`: approved artworks, newest first. */
export async function listGallery(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? GALLERY_PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GALLERY_PAGE_SIZE) {
    return jsonResponse({ error: 'Invalid page size.', code: 'INVALID_LIMIT' }, 400);
  }
  const rawCursor = params.get('cursor');
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return jsonResponse({ error: 'Invalid cursor.', code: 'INVALID_CURSOR' }, 400);

  const conditions = `gallery_status = 'listed' AND published_at IS NOT NULL AND revoked_at IS NULL
    AND expiry_policy = 'never' AND expires_at IS NULL AND gallery_listed_at IS NOT NULL`;
  const statement = cursor
    ? env.DB.prepare(
      `SELECT id, title, author, image_type, gallery_listed_at FROM shared_artworks
       WHERE ${conditions} AND (gallery_listed_at < ? OR (gallery_listed_at = ? AND id < ?))
       ORDER BY gallery_listed_at DESC, id DESC LIMIT ?`,
    ).bind(cursor[0], cursor[0], cursor[1], limit + 1)
    : env.DB.prepare(
      `SELECT id, title, author, image_type, gallery_listed_at FROM shared_artworks
       WHERE ${conditions}
       ORDER BY gallery_listed_at DESC, id DESC LIMIT ?`,
    ).bind(limit + 1);
  const { results } = await statement.all<GalleryRow>();
  const page = results.slice(0, limit);
  return jsonResponse({
    items: page.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      listedAt: row.gallery_listed_at,
      url: '/s/' + row.id,
      imageUrl: imagePath(row.id, row.image_type),
      cardUrl: '/s/' + row.id + '/card.jpg',
    })),
    nextCursor: results.length > limit ? encodeCursor(page[page.length - 1]!) : null,
  });
}

async function reportLimit(request: Request, db: D1Database): Promise<Response | null> {
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hash = await tokenHash('inkpoem-report:' + address);
  for (const [key, max, period] of [
    ['report:hour:' + hash, 10, 3600],
    ['report:day:' + hash, 30, 86400],
  ] as const) {
    const result = await consumeRateLimit(db, key, max, period);
    if (!result.allowed) {
      const response = jsonResponse({ error: 'Too many reports. Please try later.', code: 'RATE_LIMITED' }, 429);
      response.headers.set('Retry-After', String(result.retryAfterSeconds));
      return response;
    }
  }
  return null;
}

/**
 * `POST /api/shares/:id/report` with `{ "reason": ... }`. Any live share can be
 * reported. A listed artwork that reaches the report threshold returns to the
 * review queue; the share link itself stays up until a maintainer acts.
 */
export async function reportShare(request: Request, env: WorkerEnv, id: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  if (!isShareId(id)) return notFound();
  if (!hasAllowedOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);

  let body: unknown;
  try {
    body = await readJsonBody(request, REPORT_BODY_LIMIT);
  } catch (error) {
    return bodyErrorResponse(error) ?? jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }
  const reason = body && typeof body === 'object' ? (body as { reason?: unknown }).reason : undefined;
  if (!REPORT_REASONS.includes(reason as ReportReason)) {
    return jsonResponse({ error: 'Invalid report reason.', code: 'INVALID_REASON' }, 400);
  }

  const live = await env.DB.prepare(
    `SELECT id FROM shared_artworks WHERE id = ? AND published_at IS NOT NULL AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
  ).bind(id).first<{ id: string }>();
  if (!live) return notFound();

  const limited = await reportLimit(request, env.DB);
  if (limited) return limited;

  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const reporter = await tokenHash('inkpoem-report:' + id + ':' + address);
  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO share_reports (share_id, reporter_hash, reason) VALUES (?, ?, ?)',
  ).bind(id, reporter, reason).run();
  if (inserted.meta.changes === 1) {
    await env.DB.prepare(
      `UPDATE shared_artworks SET gallery_status = 'pending'
       WHERE id = ? AND gallery_status = 'listed'
         AND (SELECT COUNT(*) FROM share_reports WHERE share_id = ?) >= ?`,
    ).bind(id, id, GALLERY_REPORT_HIDE_THRESHOLD).run();
  }
  // The same answer for a first and a repeated report from one visitor.
  return jsonResponse({ received: true }, 202);
}
