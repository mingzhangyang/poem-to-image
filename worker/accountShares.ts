import { consumeRateLimit } from './db';
import { bodyErrorResponse, jsonResponse, methodNotAllowed, readJsonBody } from './http';
import type { WorkerEnv } from './env';
import { deleteRevokedShareAssets, hasAllowedOrigin, imagePath, isShareId, tokenHash } from './shares';

/**
 * Shares tied to a signed-in account (`/api/me/shares`).
 *
 * Publishing itself stays anonymous: the browser holds a private removal key
 * for each share. A signed-in creator proves ownership with that key once
 * (`POST /api/me/shares/claim`), right after publishing or later for older
 * shares, and from then on manages the share from any device with their
 * account. Only account-owned shares can be submitted to the public gallery.
 *
 * Every handler here receives a `userId` the router has already verified.
 */

const MAX_CLAIMS_PER_REQUEST = 50;
const CLAIM_BODY_LIMIT = 16 * 1024;
const MAX_LISTED_SHARES = 200;

type GalleryState = 'pending' | 'listed' | 'rejected' | null;

interface AccountShareRow {
  id: string;
  title: string;
  author: string;
  image_type: string;
  published_at: string;
  expiry_policy: string;
  expires_at: string | null;
  gallery_status: GalleryState;
}

interface OwnedRow {
  expiry_policy: string;
  expires_at: string | null;
  gallery_status: GalleryState;
}

function notFound(): Response {
  return jsonResponse({ error: 'Artwork not found.', code: 'NOT_FOUND' }, 404);
}

function isPermanent(row: Pick<OwnedRow, 'expiry_policy' | 'expires_at'>): boolean {
  return row.expiry_policy === 'never' && row.expires_at === null;
}

async function accountLimit(db: D1Database, userId: string): Promise<Response | null> {
  const result = await consumeRateLimit(db, 'share-account:' + userId, 30, 60);
  if (result.allowed) return null;
  const response = jsonResponse({ error: 'Too many requests.', code: 'RATE_LIMITED' }, 429);
  response.headers.set('Retry-After', String(result.retryAfterSeconds));
  return response;
}

const LIVE_OWNED = `owner_user_id = ? AND published_at IS NOT NULL AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;

async function listShares(env: WorkerEnv, userId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, title, author, image_type, published_at, expiry_policy, expires_at, gallery_status
     FROM shared_artworks WHERE ${LIVE_OWNED}
     ORDER BY published_at DESC, id DESC LIMIT ?`,
  ).bind(userId, MAX_LISTED_SHARES).all<AccountShareRow>();
  return jsonResponse({
    shares: results.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
      permanent: isPermanent(row),
      galleryStatus: row.gallery_status ?? 'none',
      url: '/s/' + row.id,
      imageUrl: imagePath(row.id, row.image_type),
      cardUrl: '/s/' + row.id + '/card.jpg',
    })),
  });
}

async function claimShares(request: Request, env: WorkerEnv, userId: string): Promise<Response> {
  let body: unknown;
  try {
    body = await readJsonBody(request, CLAIM_BODY_LIMIT);
  } catch (error) {
    return bodyErrorResponse(error) ?? jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }
  const shares = body && typeof body === 'object' ? (body as { shares?: unknown }).shares : undefined;
  if (!Array.isArray(shares) || shares.length === 0 || shares.length > MAX_CLAIMS_PER_REQUEST) {
    return jsonResponse({ error: 'Invalid claim.', code: 'INVALID_CLAIM' }, 400);
  }
  const claims: { id: string; deleteToken: string }[] = [];
  for (const share of shares) {
    const { id, deleteToken } = (share ?? {}) as { id?: unknown; deleteToken?: unknown };
    if (typeof id !== 'string' || !isShareId(id)
      || typeof deleteToken !== 'string' || !/^[a-f0-9]{64}$/.test(deleteToken)) {
      return jsonResponse({ error: 'Invalid claim.', code: 'INVALID_CLAIM' }, 400);
    }
    claims.push({ id, deleteToken });
  }

  // The removal key proves ownership. A share already claimed by another
  // account is left alone; re-claiming one's own share is a no-op success.
  const statements = await Promise.all(claims.map(async ({ id, deleteToken }) => env.DB.prepare(
    `UPDATE shared_artworks SET owner_user_id = ?
     WHERE id = ? AND delete_token_hash = ? AND published_at IS NOT NULL AND revoked_at IS NULL
       AND (owner_user_id IS NULL OR owner_user_id = ?)
     RETURNING id`,
  ).bind(userId, id, await tokenHash(deleteToken), userId)));
  const results = await env.DB.batch<{ id: string }>(statements);
  return jsonResponse({ claimed: results.flatMap((result) => result.results.map((row) => row.id)) });
}

async function revokeShare(env: WorkerEnv, userId: string, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `UPDATE shared_artworks
     SET revoked_at = CURRENT_TIMESTAMP, title = '', author = '', gallery_status = NULL, gallery_listed_at = NULL
     WHERE id = ? AND owner_user_id = ? AND revoked_at IS NULL
     RETURNING id, image_key, card_key`,
  ).bind(id, userId).first<{ id: string; image_key: string | null; card_key: string | null }>();
  if (!row) return notFound();
  await deleteRevokedShareAssets(env, row);
  return jsonResponse({ revoked: true });
}

async function updateGallery(request: Request, env: WorkerEnv, userId: string, id: string): Promise<Response> {
  if (request.method === 'PUT') {
    // A rejected or already-listed artwork keeps its status: resubmitting
    // must not put a rejected artwork back into the review queue.
    await env.DB.prepare(
      `UPDATE shared_artworks
       SET gallery_status = 'pending', gallery_requested_at = CURRENT_TIMESTAMP
       WHERE id = ? AND ${LIVE_OWNED}
         AND expiry_policy = 'never' AND expires_at IS NULL AND gallery_status IS NULL`,
    ).bind(id, userId).run();
  } else {
    await env.DB.prepare(
      `UPDATE shared_artworks
       SET gallery_status = NULL, gallery_requested_at = NULL, gallery_listed_at = NULL
       WHERE id = ? AND ${LIVE_OWNED} AND gallery_status IN ('pending', 'listed')`,
    ).bind(id, userId).run();
  }
  const row = await env.DB.prepare(
    `SELECT expiry_policy, expires_at, gallery_status FROM shared_artworks WHERE id = ? AND ${LIVE_OWNED}`,
  ).bind(id, userId).first<OwnedRow>();
  if (!row) return notFound();
  if (request.method === 'PUT' && !isPermanent(row)) {
    return jsonResponse({
      error: 'Only permanent shares can be submitted to the gallery.',
      code: 'SHARE_NOT_PERMANENT',
    }, 409);
  }
  return jsonResponse({ status: row.gallery_status ?? 'none', eligible: isPermanent(row) });
}

/**
 * Routes `/api/me/shares`, `/api/me/shares/claim`, `/api/me/shares/:id` and
 * `/api/me/shares/:id/gallery` for an authenticated user.
 */
export async function routeAccountShares(
  request: Request,
  env: WorkerEnv,
  userId: string,
  pathname: string,
): Promise<Response> {
  if (!env.DB || !env.ARTWORKS) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  if (request.method !== 'GET' && !hasAllowedOrigin(request)) {
    return jsonResponse({ error: 'Invalid origin.' }, 403);
  }

  if (pathname === '/api/me/shares') {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    return listShares(env, userId);
  }
  if (pathname === '/api/me/shares/claim') {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    return (await accountLimit(env.DB, userId)) ?? claimShares(request, env, userId);
  }
  const gallery = /^\/api\/me\/shares\/([A-Za-z0-9_-]+)\/gallery$/.exec(pathname);
  if (gallery) {
    if (request.method !== 'PUT' && request.method !== 'DELETE') return methodNotAllowed(['PUT', 'DELETE']);
    if (!isShareId(gallery[1]!)) return notFound();
    return (await accountLimit(env.DB, userId)) ?? updateGallery(request, env, userId, gallery[1]!);
  }
  const share = /^\/api\/me\/shares\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (share) {
    if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
    if (!isShareId(share[1]!)) return notFound();
    return revokeShare(env, userId, share[1]!);
  }
  return jsonResponse({ error: 'API route not found.', code: 'NOT_FOUND' }, 404);
}
