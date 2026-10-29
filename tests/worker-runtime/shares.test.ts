import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { getShareReadiness, pruneOrphanedShareAttempts, pruneRevokedShareAssets } from '../../worker/shares';
import type { WorkerEnv } from '../../worker/env';

const ORIGIN = 'https://inkpoem.test';

function png() {
  const bytes = new Uint8Array(32);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(bytes.buffer).setUint32(16, 1080);
  new DataView(bytes.buffer).setUint32(20, 1350);
  return bytes;
}

// A real baseline JPEG generated from a 16x16 image, rather than only a
// three-byte signature. Upload validation must find a valid SOF and SOS.
const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0eiiivOOo/9k=';
function jpeg(width = 16, height = 16) {
  const image = Uint8Array.from(atob(JPEG_BASE64), (char) => char.charCodeAt(0));
  const sof = image.findIndex((byte, i) => byte === 0xff && image[i + 1] === 0xc0);
  if (sof < 0) throw new Error('JPEG test fixture has no Start Of Frame');
  image[sof + 5] = height >> 8;
  image[sof + 6] = height & 0xff;
  image[sof + 7] = width >> 8;
  image[sof + 8] = width & 0xff;
  return image;
}

interface TestCredentials { id: string; deleteToken: string }

function makeCredentials(): TestCredentials {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
  const deleteToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')).join('');
  return { id, deleteToken };
}

function form(title = 'Moon & <Stars>', author = 'An author', creds = makeCredentials()) {
  const body = new FormData();
  body.append('id', creds.id);
  body.append('deleteToken', creds.deleteToken);
  body.append('artwork', new File([png()], 'artwork.png', { type: 'image/png' }));
  body.append('card', new File([jpeg()], 'card.jpg', { type: 'image/jpeg' }));
  body.append('title', title);
  body.append('author', author);
  return body;
}

async function publish(title?: string, author?: string, creds?: TestCredentials) {
  return SELF.fetch(ORIGIN + '/api/shares', {
    method: 'POST',
    headers: { Origin: ORIGIN },
    body: form(title, author, creds),
  });
}

describe('sharing production-readiness probe', () => {
  it('confirms both migrated D1 tables and R2 read access before announcing readiness', async () => {
    const response = await SELF.fetch(ORIGIN + '/api/health/sharing');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true });
  });

  it('does not treat a bound D1 database with missing migration as healthy', async () => {
    const broken = {
      ...env,
      DB: { prepare: () => { throw new Error('no such table: shared_artworks'); } },
    } as unknown as WorkerEnv;
    const response = await getShareReadiness(new Request(ORIGIN + '/api/health/sharing'), broken);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ready: false, code: 'SHARE_SCHEMA_UNAVAILABLE' });
  });

  it('returns a safe diagnostic when R2 is not bound or cannot be read', async () => {
    const request = new Request(ORIGIN + '/api/health/sharing');
    const missing = await getShareReadiness(request, { ...env, ARTWORKS: undefined } as unknown as WorkerEnv);
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ ready: false, code: 'SHARE_STORAGE_UNAVAILABLE' });
    const denied = await getShareReadiness(request, {
      ...env,
      ARTWORKS: { head: async () => { throw new Error('backend unavailable'); } },
    } as unknown as WorkerEnv);
    expect(denied.status).toBe(503);
    expect(await denied.json()).toEqual({ ready: false, code: 'SHARE_STORAGE_UNAVAILABLE' });
  });

  it('allows only read-only GET checks', async () => {
    const response = await SELF.fetch(ORIGIN + '/api/health/sharing', { method: 'POST' });
    expect(response.status).toBe(405);
  });
});

describe('anonymous artwork sharing', () => {
  // Rate limits are IP-scoped in production. Unit cases represent independent
  // visitors and must not exhaust a single anonymous test IP across cases.
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM rate_limits WHERE key LIKE 'publish:%'").run();
  });

  it('publishes a public snapshot, renders crawler metadata and revokes with its token', async () => {
    const response = await publish('Moon & <Stars>', 'Poet "A"');
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { id, url, deleteToken } = await response.json() as { id: string; url: string; deleteToken: string };
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(url).toBe(ORIGIN + '/s/' + id);
    expect(deleteToken).toMatch(/^[a-f0-9]{64}$/);
    // The deletion credential originates on the client, not in the Worker.
    const rowOwner = await env.DB.prepare('SELECT delete_token_hash, content_fingerprint FROM shared_artworks WHERE id = ?')
      .bind(id).first<{ delete_token_hash: string; content_fingerprint: string }>();
    expect(rowOwner?.delete_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rowOwner?.content_fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const publicResponse = await SELF.fetch(ORIGIN + '/api/shares/' + id);
    expect(publicResponse.status).toBe(200);
    const publicJson = await publicResponse.json() as Record<string, string>;
    expect(publicJson.title).toBe('Moon & <Stars>');
    expect(publicJson).not.toHaveProperty('deleteToken');
    expect(publicJson).not.toHaveProperty('delete_token_hash');
    expect(publicJson.imageUrl).toBe('/s/' + id + '/image.png');

    const page = await SELF.fetch(url);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(page.headers.get('cache-control')).toBe('no-store');
    const html = await page.text();
    expect(html).toContain('Moon &amp; &lt;Stars&gt;');
    expect(html).toContain('Poet &quot;A&quot;');
    expect(html).toContain('property="og:image"');
    expect(html).toContain(ORIGIN + '/s/' + id + '/card.jpg');
    expect(html).toContain('rel="canonical" href="' + url + '"');

    const image = await SELF.fetch(ORIGIN + publicJson.imageUrl);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('cache-control')).toBe('no-store');
    expect(new Uint8Array(await image.arrayBuffer()).slice(0, 4)).toEqual(png().slice(0, 4));
    const imageHead = await SELF.fetch(ORIGIN + publicJson.imageUrl, { method: 'HEAD' });
    expect(imageHead.status).toBe(200);
    expect(await imageHead.text()).toBe('');

    const card = await SELF.fetch(ORIGIN + publicJson.cardUrl);
    expect(card.status).toBe(200);
    expect(card.headers.get('content-type')).toBe('image/jpeg');

    const denied = await SELF.fetch(ORIGIN + '/api/shares/' + id, {
      method: 'DELETE', headers: { 'X-Share-Delete-Token': 'f'.repeat(64), Origin: ORIGIN },
    });
    expect(denied.status).toBe(404);
    expect((await SELF.fetch(url)).status).toBe(200);

    const revoked = await SELF.fetch(ORIGIN + '/api/shares/' + id, {
      method: 'DELETE', headers: { 'X-Share-Delete-Token': deleteToken, Origin: ORIGIN },
    });
    expect(revoked.status).toBe(200);
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + id)).status).toBe(404);
    expect((await SELF.fetch(ORIGIN + publicJson.imageUrl)).status).toBe(404);
    const missingPage = await SELF.fetch(url);
    expect(missingPage.status).toBe(404);
    expect(await missingPage.text()).toContain('noindex');
    expect((await SELF.fetch(url)).headers.get('cache-control')).toBe('no-store');

    const row = await env.DB.prepare('SELECT revoked_at, title, author, delete_token_hash FROM shared_artworks WHERE id = ?')
      .bind(id).first<{ revoked_at: string | null; title: string; author: string; delete_token_hash: string }>();
    expect(row?.revoked_at).toBeTruthy();
    expect(row?.title).toBe('');
    expect(row?.author).toBe('');
    // Tombstones retain only the hashed capability for idempotent DELETE and
    // to block delayed POST requests that still hold the original credentials.
    expect(row?.delete_token_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('safely recovers a lost publication response using the same client credentials', async () => {
    const credentials = makeCredentials();
    const first = await publish('Response was dropped', 'Poet', credentials);
    expect(first.status).toBe(201);
    // Simulate a lost response: never read its body before retrying.
    const second = await publish('Response was dropped', 'Poet', credentials);
    expect(second.status).toBe(200);
    const result = await second.json() as TestCredentials & { url: string };
    expect(result.id).toBe(credentials.id);
    expect(result.deleteToken).toBe(credentials.deleteToken);
    const rows = await env.DB.prepare('SELECT id FROM shared_artworks WHERE id = ?')
      .bind(credentials.id).all();
    expect(rows.results).toHaveLength(1);
    expect((await SELF.fetch(result.url)).status).toBe(200);
  });

  it('rejects mismatched publication content/credentials instead of overwriting snapshots', async () => {
    const credentials = makeCredentials();
    expect((await publish('Original', 'Poet', credentials)).status).toBe(201);
    const otherBody = await publish('Changed', 'Poet', credentials);
    expect(otherBody.status).toBe(409);
    expect(await otherBody.json()).toMatchObject({ code: 'SHARE_CONTENT_MISMATCH' });
    const otherToken = await publish('Original', 'Poet', { id: credentials.id, deleteToken: makeCredentials().deleteToken });
    expect(otherToken.status).toBe(409);
    const publicMetadata = await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id);
    expect(await publicMetadata.json()).toMatchObject({ title: 'Original' });
  });

  it('concurrent replays preserve the first immutable image without an orphaned public record', async () => {
    const credentials = makeCredentials();
    const [a, b] = await Promise.all([
      publish('Concurrent', 'Poet', credentials),
      publish('Concurrent', 'Poet', credentials),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const rows = await env.DB.prepare('SELECT id, image_key FROM shared_artworks WHERE id = ?')
      .bind(credentials.id).all<{ id: string; image_key: string }>();
    expect(rows.results).toHaveLength(1);
    expect(await env.ARTWORKS.head(rows.results[0].image_key)).not.toBeNull();
  });

  it('allows cancellation before publication reaches the Worker and blocks delayed uploads', async () => {
    const credentials = makeCredentials();
    const cancellation = await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': credentials.deleteToken },
    });
    expect(cancellation.status).toBe(200);
    expect(await cancellation.json()).toMatchObject({ revoked: true });
    const delayed = await publish('Would have been public', 'Poet', credentials);
    expect(delayed.status).toBe(409);
    expect(await delayed.json()).toMatchObject({ code: 'SHARE_CANCELLED' });
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id)).status).toBe(404);
    const tombstone = await env.DB.prepare('SELECT revoked_at, published_at, image_key FROM shared_artworks WHERE id = ?')
      .bind(credentials.id).first<{ revoked_at: string | null; published_at: string | null; image_key: string | null }>();
    expect(tombstone?.revoked_at).toBeTruthy();
    expect(tombstone?.published_at).toBeNull();
    expect(tombstone?.image_key).toBeNull();
    const repeated = await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': credentials.deleteToken },
    });
    expect(repeated.status).toBe(200);
  });

  it('can revoke an incomplete server reservation and prevents any later finalization', async () => {
    const credentials = makeCredentials();
    const subtle = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credentials.deleteToken));
    const tokenHash = Array.from(new Uint8Array(subtle), (byte) => byte.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare(
      "INSERT INTO shared_artworks (id, title, author, delete_token_hash, content_fingerprint) VALUES (?, 'Awaiting', 'Poet', ?, ?)",
    ).bind(credentials.id, tokenHash, 'b'.repeat(64)).run();
    const cancelled = await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': credentials.deleteToken },
    });
    expect(cancelled.status).toBe(200);
    const delayed = await publish('Awaiting', 'Poet', credentials);
    expect(delayed.status).toBe(409);
    expect(await delayed.json()).toMatchObject({ code: 'SHARE_CANCELLED' });
  });

  it('refuses an already revoked publication identifier on retry', async () => {
    const credentials = makeCredentials();
    expect((await publish('To be revoked', 'Poet', credentials)).status).toBe(201);
    const deleted = await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': credentials.deleteToken },
    });
    expect(deleted.status).toBe(200);
    expect((await publish('To be revoked', 'Poet', credentials)).status).toBe(409);
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + credentials.id)).status).toBe(404);
  });

  it('preserves JSON-LD with dollar replacement markers and HTML metacharacters', async () => {
    // Dollar sequences must survive string replacement as literal JSON content.
    const title = "Cost $$, suffix $', whole $&";
    const author = 'Poet $& <script>alert(1)</script>';
    const published = await publish(title, author);
    expect(published.status).toBe(201);
    const { url } = await published.json() as { url: string };
    const page = await SELF.fetch(url);
    expect(page.status).toBe(200);
    const html = await page.text();
    const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]) as Record<string, string>)
      .find((item) => item['@type'] === 'VisualArtwork');
    expect(data).toBeDefined();
    expect(data?.name).toBe(title);
    expect(data?.creator).toBe(author);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Cost $$');
  });

  it('rejects oversized or malformed JPEG frames for both artwork and social cards', async () => {
    for (const [name, payload] of [
      ['width over 4096', jpeg(4097, 16)],
      ['height over 4096', jpeg(16, 4097)],
      ['missing SOF', (() => {
        const image = jpeg();
        const sof = image.findIndex((byte, i) => byte === 0xff && image[i + 1] === 0xc0);
        image[sof + 1] = 0xe1;
        return image;
      })()],
      ['truncated header', jpeg().slice(0, 120)],
    ] as const) {
      const artwork = form(name);
      artwork.set('artwork', new File([payload], 'artwork.jpg', { type: 'image/jpeg' }));
      const rejectedArtwork = await SELF.fetch(ORIGIN + '/api/shares', { method: 'POST', body: artwork });
      expect(rejectedArtwork.status, name + ' artwork').toBe(400);

      const preview = form(name);
      preview.set('card', new File([payload], 'card.jpg', { type: 'image/jpeg' }));
      const rejectedCard = await SELF.fetch(ORIGIN + '/api/shares', { method: 'POST', body: preview });
      expect(rejectedCard.status, name + ' card').toBe(400);
    }

    const allowed = form('JPEG under limit');
    allowed.set('artwork', new File([jpeg(4096, 16)], 'artwork.jpg', { type: 'image/jpeg' }));
    expect((await SELF.fetch(ORIGIN + '/api/shares', { method: 'POST', body: allowed })).status).toBe(201);
  });

  it('durably retries orphan-attempt cleanup after R2 deletion fails', async () => {
    const id = 'OrphanRetry1';
    const attemptId = crypto.randomUUID();
    const imageKey = 'shares/' + id + '/' + attemptId + '/artwork.png';
    const cardKey = 'shares/' + id + '/' + attemptId + '/card.jpg';
    await env.ARTWORKS.put(imageKey, png());
    await env.ARTWORKS.put(cardKey, jpeg());
    await env.DB.prepare(
      "INSERT INTO shared_artwork_upload_attempts (attempt_id, share_id, image_key, card_key, created_at) VALUES (?, ?, ?, ?, datetime('now', '-2 hours'))",
    ).bind(attemptId, id, imageKey, cardKey).run();

    const failedEnv = {
      DB: env.DB,
      ARTWORKS: { delete: async () => { throw new Error('Simulated R2 outage'); } },
    } as unknown as WorkerEnv;
    expect(await pruneOrphanedShareAttempts(failedEnv)).toBe(0);
    const stillPending = await env.DB.prepare(
      'SELECT attempt_id FROM shared_artwork_upload_attempts WHERE attempt_id = ?',
    ).bind(attemptId).first();
    expect(stillPending).not.toBeNull();

    expect(await pruneOrphanedShareAttempts(env)).toBeGreaterThanOrEqual(1);
    expect(await env.ARTWORKS.head(imageKey)).toBeNull();
    expect(await env.ARTWORKS.head(cardKey)).toBeNull();
    expect(await env.DB.prepare(
      'SELECT attempt_id FROM shared_artwork_upload_attempts WHERE attempt_id = ?',
    ).bind(attemptId).first()).toBeNull();
  });

  it('does not delete canonical artwork while clearing a stale attempt record', async () => {
    const created = await publish('Canonical protected', 'Poet');
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const row = await env.DB.prepare(
      'SELECT image_key, card_key FROM shared_artworks WHERE id = ?',
    ).bind(id).first<{ image_key: string; card_key: string }>();
    expect(row).not.toBeNull();
    const attemptId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO shared_artwork_upload_attempts (attempt_id, share_id, image_key, card_key, created_at) VALUES (?, ?, ?, ?, datetime('now', '-2 hours'))",
    ).bind(attemptId, id, row!.image_key, row!.card_key).run();
    expect(await pruneOrphanedShareAttempts(env)).toBeGreaterThanOrEqual(1);
    expect(await env.ARTWORKS.head(row!.image_key)).not.toBeNull();
    expect(await env.ARTWORKS.head(row!.card_key)).not.toBeNull();
  });

  it('rejects malformed images and cross-origin submissions', async () => {
    const wrong = form('Invalid');
    wrong.set('artwork', new File(['not an image'], 'bad.png', { type: 'image/png' }));
    const invalid = await SELF.fetch(ORIGIN + '/api/shares', { method: 'POST', body: wrong });
    expect(invalid.status).toBe(400);

    const hostile = await SELF.fetch(ORIGIN + '/api/shares', {
      method: 'POST', headers: { Origin: 'https://evil.test' }, body: form(),
    });
    expect(hostile.status).toBe(403);
    const malformedOrigin = await SELF.fetch(ORIGIN + '/api/shares', {
      method: 'POST', headers: { Origin: 'not an origin' }, body: form(),
    });
    expect(malformedOrigin.status).toBe(403);
  });

  it('serves share HTML from the root app shell (not a redirected index.html)', async () => {
    const response = await publish('Live document', 'Author');
    const { url } = await response.json() as { url: string };
    const page = await SELF.fetch(url);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<div id="root"></div>');
  });

  it('uses the browser-facing loopback origin for development links', async () => {
    const response = await SELF.fetch('http://127.0.0.1:8787/api/shares', {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:3000' },
      body: form(),
    });
    expect(response.status).toBe(201);
    const data = await response.json() as { id: string; url: string };
    expect(data.url).toBe('http://127.0.0.1:3000/s/' + data.id);
    const metadata = await SELF.fetch('http://127.0.0.1:8787/api/shares/' + data.id);
    expect(metadata.status).toBe(200);
  });

  it('indexes pending cleanup rows without scanning the entire artwork table', async () => {
    const index = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_shared_artworks_cleanup_pending'",
    ).first<{ sql: string }>();
    expect(index?.sql).toContain('assets_deleted_at IS NULL');
  });

  it('returns 404 for malformed share IDs and never falls back to the editor', async () => {
    const response = await SELF.fetch(ORIGIN + '/s/invalid');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('noindex');
    expect((await SELF.fetch(ORIGIN + '/api/shares/invalid')).status).toBe(404);
  });

  it('retries R2 object cleanup of previously revoked records without exposing them', async () => {
    const id = 'CleanupTest1';
    const imageKey = 'shares/' + id + '/artwork.png';
    const cardKey = 'shares/' + id + '/card.jpg';
    await env.ARTWORKS.put(imageKey, png(), { httpMetadata: { contentType: 'image/png' } });
    await env.ARTWORKS.put(cardKey, jpeg(), { httpMetadata: { contentType: 'image/jpeg' } });
    await env.DB.prepare(
      `INSERT INTO shared_artworks
       (id, title, author, image_key, image_type, card_key, delete_token_hash, content_fingerprint, revoked_at)
       VALUES (?, '', '', ?, 'image/png', ?, '', '', CURRENT_TIMESTAMP)`,
    ).bind(id, imageKey, cardKey).run();

    expect((await SELF.fetch(ORIGIN + '/s/' + id)).status).toBe(404);
    expect(await pruneRevokedShareAssets(env)).toBeGreaterThanOrEqual(1);
    expect(await env.ARTWORKS.get(imageKey)).toBeNull();
    expect(await env.ARTWORKS.get(cardKey)).toBeNull();
    const row = await env.DB.prepare('SELECT assets_deleted_at FROM shared_artworks WHERE id = ?')
      .bind(id).first<{ assets_deleted_at: string | null }>();
    expect(row?.assets_deleted_at).toBeTruthy();
  });

  it('accepts an empty title and produces an immutable, separately addressable artwork', async () => {
    const response = await publish('', '');
    expect(response.status).toBe(201);
    const { id } = await response.json() as { id: string };
    const result = await SELF.fetch(ORIGIN + '/api/shares/' + id);
    expect(await result.json()).toMatchObject({ title: 'Untitled poem', author: '' });
  });
});
