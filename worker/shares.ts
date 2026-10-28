import { consumeRateLimit } from './db';
import { applySecurityHeaders, bodyErrorResponse, jsonResponse, methodNotAllowed, readBoundedBytes } from './http';
import type { WorkerEnv } from './env';
import { logError } from './observability';

export const MAX_SHARE_REQUEST_BYTES = 9 * 1024 * 1024;
export const MAX_ARTWORK_BYTES = 6 * 1024 * 1024;
export const MAX_CARD_BYTES = 1_500_000;
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
const TITLE_LIMIT = 120;
const AUTHOR_LIMIT = 100;

interface ShareRecord {
  id: string;
  title: string;
  author: string;
  image_key: string;
  image_type: string;
  card_key: string;
  created_at: string;
}

function available(env: WorkerEnv): boolean {
  return !!(env.DB && env.ARTWORKS);
}

// Production requests must originate from this Worker host. When running Vite
// locally, the browser's :3000 origin differs from the proxied Worker's :8787.
function hasAllowedOrigin(request: Request): boolean {
  const rawOrigin = request.headers.get('origin');
  if (!rawOrigin) return true; // CLI clients do not always send Origin.
  const requestUrl = new URL(request.url);
  let browserOrigin: URL;
  try {
    browserOrigin = new URL(rawOrigin);
  } catch {
    return false;
  }
  if (browserOrigin.origin === requestUrl.origin) return true;
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  return requestUrl.protocol === 'http:' && browserOrigin.protocol === 'http:'
    && localHosts.has(requestUrl.hostname) && localHosts.has(browserOrigin.hostname);
}

export function isShareId(id: string): boolean {
  return SHARE_ID_PATTERN.test(id);
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function artworkUrl(request: Request, id: string): string {
  // Vite :3000 proxies /api to Worker :8787 with changeOrigin. In local
  // development only, use the browser's validated loopback Origin so the
  // creator's localStorage token and public viewer share the same origin.
  const origin = request.headers.get('origin');
  if (origin && hasAllowedOrigin(request)) {
    const frontend = new URL(origin);
    const worker = new URL(request.url);
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    if (frontend.protocol === 'http:' && worker.protocol === 'http:'
      && loopback.has(frontend.hostname) && loopback.has(worker.hostname)) {
      return new URL('/s/' + id, frontend).toString();
    }
  }
  return new URL('/s/' + id, request.url).toString();
}

function imagePath(id: string, mime: string): string {
  return '/s/' + id + '/image.' + (mime === 'image/png' ? 'png' : 'jpg');
}

function publicShare(request: Request, row: ShareRecord) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    createdAt: row.created_at,
    url: artworkUrl(request, row.id),
    imageUrl: imagePath(row.id, row.image_type),
    cardUrl: '/s/' + row.id + '/card.jpg',
  };
}

async function lookupShare(db: D1Database, id: string): Promise<ShareRecord | null> {
  if (!isShareId(id)) return null;
  return db.prepare(
    `SELECT id, title, author, image_key, image_type, card_key, created_at
     FROM shared_artworks WHERE id = ? AND published_at IS NOT NULL AND revoked_at IS NULL`,
  ).bind(id).first<ShareRecord>();
}

function notFound() {
  return jsonResponse({ error: 'Artwork not found.', code: 'NOT_FOUND' }, 404);
}

function isPng(file: File): boolean {
  return file.type === 'image/png';
}

function isJpeg(file: File): boolean {
  return file.type === 'image/jpeg';
}

async function validImage(file: File, kind: 'artwork' | 'card'): Promise<boolean> {
  const max = kind === 'card' ? MAX_CARD_BYTES : MAX_ARTWORK_BYTES;
  if (file.size < 16 || file.size > max) return false;
  const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  if (isJpeg(file)) {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (kind === 'card' || !isPng(file) || header.length < 24) return false;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => header[i] === b)) return false;
  if (String.fromCharCode(...header.slice(12, 16)) !== 'IHDR') return false;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 && width <= 4096 && height <= 4096;
}

async function publishLimit(request: Request, db: D1Database): Promise<Response | null> {
  // On Cloudflare, CF-Connecting-IP is set by the platform. Do not persist raw IPs.
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hash = await tokenHash('inkpoem-share:' + address);
  for (const [key, max, period] of [
    ['publish:hour:' + hash, 5, 3600],
    ['publish:day:' + hash, 20, 86400],
  ] as const) {
    const result = await consumeRateLimit(db, key, max, period);
    if (!result.allowed) {
      const response = jsonResponse({ error: 'Too many published artworks. Please try later.', code: 'RATE_LIMITED' }, 429);
      response.headers.set('Retry-After', String(result.retryAfterSeconds));
      return response;
    }
  }
  return null;
}

interface ExistingShare extends Omit<ShareRecord, 'image_key' | 'image_type' | 'card_key'> {
  image_key: string | null;
  image_type: string | null;
  card_key: string | null;
  delete_token_hash: string;
  content_fingerprint: string | null;
  published_at: string | null;
  revoked_at: string | null;
}

async function findShareById(db: D1Database, id: string): Promise<ExistingShare | null> {
  return db.prepare(
    'SELECT id, title, author, image_key, image_type, card_key, created_at, delete_token_hash, content_fingerprint, published_at, revoked_at FROM shared_artworks WHERE id = ?',
  ).bind(id).first<ExistingShare>();
}

function isIdempotentReplay(row: ExistingShare, hash: string, fingerprint: string): boolean {
  return !row.revoked_at && row.delete_token_hash === hash && row.content_fingerprint === fingerprint;
}

function shareConflict(row: ExistingShare, hash: string): Response {
  // A lost response followed by a changed canvas must NOT be treated as an
  // invalid or unrelated ID: the original snapshot is still public and its
  // deletion key must remain in the browser.
  if (!row.revoked_at && row.delete_token_hash === hash) {
    return jsonResponse({ error: 'The existing publication has different content.', code: 'SHARE_CONTENT_MISMATCH' }, 409);
  }
  return jsonResponse({ error: 'The publication identifier is already used.', code: 'SHARE_ID_CONFLICT' }, 409);
}

function successfulPublication(request: Request, id: string, deleteToken: string, status: number): Response {
  return jsonResponse({ id, url: artworkUrl(request, id), deleteToken }, status);
}

/**
 * The browser generates a random share identifier and deletion key, then saves
 * them BEFORE upload. Repeated requests with the same credentials and content
 * get the original snapshot rather than publishing another one. The D1
 * reservation is created before R2 upload; DELETE can durably cancel it and
 * prevent any delayed or in-flight POST from publishing after cancellation.
 */
export async function publishShare(request: Request, env: WorkerEnv): Promise<Response> {
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!hasAllowedOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return jsonResponse({ error: 'Expected multipart form upload.' }, 415);
  }

  let form: FormData;
  try {
    const bytes = await readBoundedBytes(request, MAX_SHARE_REQUEST_BYTES);
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    form = await new Response(body.buffer, { headers: { 'Content-Type': contentType } }).formData();
  } catch (error) {
    return bodyErrorResponse(error) ?? jsonResponse({ error: 'Invalid form upload.' }, 400);
  }

  const id = form.get('id');
  const deleteToken = form.get('deleteToken');
  const artwork = form.get('artwork');
  const card = form.get('card');
  const rawTitle = form.get('title');
  const rawAuthor = form.get('author');
  if (typeof id !== 'string' || !isShareId(id)
    || typeof deleteToken !== 'string' || !/^[a-f0-9]{64}$/.test(deleteToken)
    || !(artwork instanceof File) || !(card instanceof File)
    || typeof rawTitle !== 'string' || typeof rawAuthor !== 'string'
    || rawTitle.trim().length > TITLE_LIMIT || rawAuthor.trim().length > AUTHOR_LIMIT
    || !(await validImage(artwork, 'artwork')) || !(await validImage(card, 'card'))) {
    return jsonResponse({ error: 'Invalid artwork, identifier or social preview.', code: 'INVALID_SHARE' }, 400);
  }

  const title = rawTitle.trim() || 'Untitled poem';
  const author = rawAuthor.trim();
  const artworkBytes = await artwork.arrayBuffer();
  const cardBytes = await card.arrayBuffer();
  const deleteHash = await tokenHash(deleteToken);
  const imageDigest = await crypto.subtle.digest('SHA-256', artworkBytes);
  const cardDigest = await crypto.subtle.digest('SHA-256', cardBytes);
  const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const fingerprint = await tokenHash(JSON.stringify([
    title, author, artwork.type, toHex(imageDigest), toHex(cardDigest),
  ]));

  const existing = await findShareById(env.DB, id);
  if (!existing) {
    const limited = await publishLimit(request, env.DB);
    if (limited) return limited;
    // Reserve the ID in D1 BEFORE uploading to R2. A DELETE can now atomically
    // cancel this reservation, preventing any in-flight upload from publishing.
    await env.DB.prepare(
      'INSERT OR IGNORE INTO shared_artworks (id, title, author, delete_token_hash, content_fingerprint) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, title, author, deleteHash, fingerprint).run();
  }

  const reservation = await findShareById(env.DB, id);
  if (!reservation) return jsonResponse({ error: 'Reservation unavailable.', code: 'PUBLISH_UNCERTAIN' }, 503);
  if (reservation.revoked_at) {
    return jsonResponse({ error: 'This publication was cancelled.', code: 'SHARE_CANCELLED' }, 409);
  }
  if (!isIdempotentReplay(reservation, deleteHash, fingerprint)) {
    return shareConflict(reservation, deleteHash);
  }
  if (reservation.published_at) return successfulPublication(request, id, deleteToken, 200);

  // Two concurrent requests may share a reservation but must never write to
  // the same R2 key. Finalization is a conditional, single-row D1 UPDATE.
  const attempt = crypto.randomUUID();
  const prefix = 'shares/' + id + '/' + attempt + '/';
  const imageKey = prefix + 'artwork.' + (isPng(artwork) ? 'png' : 'jpg');
  const cardKey = prefix + 'card.jpg';
  let artworkUploaded = false;
  let cardUploaded = false;
  let finalizationAttempted = false;

  const cleanOwnUpload = async (): Promise<void> => {
    try {
      if (cardUploaded) await env.ARTWORKS.delete(cardKey);
      if (artworkUploaded) await env.ARTWORKS.delete(imageKey);
    } catch (error) {
      logError('share.orphan_cleanup_failed', error, { id, attempt });
    }
  };

  try {
    await env.ARTWORKS.put(imageKey, artworkBytes, { httpMetadata: { contentType: artwork.type } });
    artworkUploaded = true;
    await env.ARTWORKS.put(cardKey, cardBytes, { httpMetadata: { contentType: 'image/jpeg' } });
    cardUploaded = true;
    finalizationAttempted = true;
    const finalized = await env.DB.prepare(
      \`UPDATE shared_artworks
       SET image_key = ?, image_type = ?, card_key = ?, published_at = CURRENT_TIMESTAMP
       WHERE id = ? AND published_at IS NULL AND revoked_at IS NULL
         AND delete_token_hash = ? AND content_fingerprint = ?\`,
    ).bind(imageKey, artwork.type, cardKey, id, deleteHash, fingerprint).run();
    if (finalized.meta.changes === 1) {
      return successfulPublication(request, id, deleteToken, 201);
    }
    const winner = await findShareById(env.DB, id);
    await cleanOwnUpload();
    if (winner?.revoked_at) {
      return jsonResponse({ error: 'This publication was cancelled.', code: 'SHARE_CANCELLED' }, 409);
    }
    if (winner?.published_at && isIdempotentReplay(winner, deleteHash, fingerprint)) {
      return successfulPublication(request, id, deleteToken, 200);
    }
    return jsonResponse({ error: 'Could not finalize artwork.', code: 'PUBLISH_UNCERTAIN' }, 502);
  } catch (error) {
    logError('share.publish_failed', error, { id, attempt });
    let winner: ExistingShare | null = null;
    let didCheckDatabase = false;
    try {
      winner = await findShareById(env.DB, id);
      didCheckDatabase = true;
    } catch (lookupError) {
      logError('share.publish_reconciliation_failed', lookupError, { id });
    }

    if (winner?.image_key === imageKey && winner.published_at
      && isIdempotentReplay(winner, deleteHash, fingerprint)) {
      return successfulPublication(request, id, deleteToken, 200);
    }
    // If a D1 UPDATE may have committed but cannot be checked, do not delete
    // an image that might have become the canonical snapshot.
    if (!finalizationAttempted || didCheckDatabase) await cleanOwnUpload();
    if (winner?.revoked_at) {
      return jsonResponse({ error: 'This publication was cancelled.', code: 'SHARE_CANCELLED' }, 409);
    }
    if (winner?.published_at && isIdempotentReplay(winner, deleteHash, fingerprint)) {
      return successfulPublication(request, id, deleteToken, 200);
    }
    return jsonResponse({ error: 'Could not confirm artwork publication.', code: 'PUBLISH_UNCERTAIN' }, 502);
  }
}

export async function getShareApi(request: Request, env: WorkerEnv, id: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  const row = await lookupShare(env.DB, id);
  return row ? jsonResponse(publicShare(request, row)) : notFound();
}

export async function deleteShare(request: Request, env: WorkerEnv, id: string): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  if (!isShareId(id)) return notFound();
  if (!hasAllowedOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);
  const token = request.headers.get('X-Share-Delete-Token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return notFound();
  const hash = await tokenHash(token);

  // A cancellation must be durable even if the POST has not reached D1 yet.
  // First-writer-wins on the random ID: DELETE inserts a revocation tombstone
  // that blocks any delayed POST from creating a reservation and publishing.
  await env.DB.prepare(
    \`INSERT OR IGNORE INTO shared_artworks
     (id, title, author, delete_token_hash, revoked_at, assets_deleted_at)
     VALUES (?, '', '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\`,
  ).bind(id, hash).run();

  let row = await findShareById(env.DB, id);
  if (!row || row.delete_token_hash !== hash) return notFound();
  if (!row.revoked_at) {
    const result = await env.DB.prepare(
      \`UPDATE shared_artworks
       SET revoked_at = CURRENT_TIMESTAMP, title = '', author = ''
       WHERE id = ? AND delete_token_hash = ? AND revoked_at IS NULL\`,
    ).bind(id, hash).run();
    if (result.meta.changes !== 1) {
      row = await findShareById(env.DB, id);
      if (!row || row.delete_token_hash !== hash || !row.revoked_at) return notFound();
    }
  }

  // Re-read after the atomic revoke: publishing may have finalized between
  // our initial SELECT and UPDATE. Only the post-revocation row tells us which
  // R2 keys must be deleted.
  row = await findShareById(env.DB, id);
  if (!row || row.delete_token_hash !== hash || !row.revoked_at) return notFound();
  if (row.image_key && row.card_key) {
    try {
      await Promise.all([env.ARTWORKS.delete(row.image_key), env.ARTWORKS.delete(row.card_key)]);
      await env.DB.prepare(
        'UPDATE shared_artworks SET assets_deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).bind(id).run();
    } catch (error) {
      logError('share.cleanup_failed', error, { id });
      // The scheduled maintenance task retries failed object deletion.
    }
  } else {
    await env.DB.prepare(
      'UPDATE shared_artworks SET assets_deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).bind(id).run();
  }
  return jsonResponse({ revoked: true });
}

/** Retry failed R2 cleanup from earlier revocations in small bounded cron batches. */
export async function pruneRevokedShareAssets(env: WorkerEnv, maxBatch = 25): Promise<number> {
  if (!available(env)) return 0;
  const pending = await env.DB.prepare(
    `SELECT id, image_key, card_key FROM shared_artworks
     WHERE revoked_at IS NOT NULL AND assets_deleted_at IS NULL
     ORDER BY revoked_at LIMIT ?`,
  ).bind(maxBatch).all<Pick<ShareRecord, 'id' | 'image_key' | 'card_key'>>();
  let removed = 0;
  for (const row of pending.results) {
    try {
      await Promise.all([env.ARTWORKS.delete(row.image_key), env.ARTWORKS.delete(row.card_key)]);
      await env.DB.prepare('UPDATE shared_artworks SET assets_deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(row.id).run();
      removed++;
    } catch (error) {
      logError('share.cleanup_retry_failed', error, { id: row.id });
    }
  }
  return removed;
}

export async function getShareImage(request: Request, env: WorkerEnv, id: string, variant: 'image' | 'card'): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(['GET', 'HEAD']);
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  const row = await lookupShare(env.DB, id);
  if (!row) return notFound();
  const key = variant === 'card' ? row.card_key : row.image_key;
  const type = variant === 'card' ? 'image/jpeg' : row.image_type;
  const object = request.method === 'HEAD' ? await env.ARTWORKS.head(key) : await env.ARTWORKS.get(key);
  if (!object) return notFound();
  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Content-Disposition': 'inline',
  });
  return applySecurityHeaders(new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, { headers }));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]!);
}

function upsertMeta(html: string, kind: 'name' | 'property', key: string, value: string): string {
  const tag = '<meta ' + kind + '="' + key + '" content="' + escapeHtml(value) + '" />';
  const pattern = new RegExp('<meta\\s+' + kind + '="' + key + '"[^>]*>', 'i');
  if (pattern.test(html)) return html.replace(pattern, () => tag);
  return html.replace('</head>', tag + '\n</head>');
}

export async function getShareHtml(request: Request, env: WorkerEnv, id: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(['GET', 'HEAD']);
  if (!available(env)) return jsonResponse({ error: 'Sharing is not configured.' }, 503);
  const row = await lookupShare(env.DB, id);
  if (!row) {
    return applySecurityHeaders(new Response(
      '<!doctype html><html><head><meta name="robots" content="noindex"><title>Artwork unavailable · InkPoem</title></head><body><main><h1>Artwork unavailable</h1><a href="/">InkPoem</a></main></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    ));
  }
  const shell = await env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }));
  if (!shell.ok) return applySecurityHeaders(new Response('App shell unavailable', { status: 503 }));
  const url = artworkUrl(request, id);
  const title = row.title + ' · InkPoem';
  const description = row.author ? row.title + ' — ' + row.author + ' · InkPoem' : row.title + ' · Made with InkPoem';
  const cardUrl = new URL('/s/' + id + '/card.jpg', request.url).toString();
  let html = await shell.text();
  const head = [
    ['name', 'description', description],
    ['name', 'robots', 'index, follow'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', cardUrl],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:type', 'article'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', cardUrl],
  ] as const;
  for (const [kind, name, value] of head) html = upsertMeta(html, kind, name, value);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, () => '<title>' + escapeHtml(title) + '</title>');
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, () => '<link rel="canonical" href="' + escapeHtml(url) + '" />');
  // The stock app's WebApplication JSON-LD remains. Add this page's artwork data.
  const structured = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'VisualArtwork', name: row.title,
    creator: row.author, image: cardUrl, url,
  }).replace(/</g, '\\u003c');
  html = html.replace('</head>', () => '<script type="application/ld+json">' + structured + '</script>\n</head>');
  return applySecurityHeaders(new Response(request.method === 'HEAD' ? null : html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  }));
}
