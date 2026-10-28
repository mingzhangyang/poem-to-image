import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { pruneRevokedShareAssets } from '../../worker/shares';

const ORIGIN = 'https://inkpoem.test';

function png() {
  const bytes = new Uint8Array(32);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(bytes.buffer).setUint32(16, 1080);
  new DataView(bytes.buffer).setUint32(20, 1350);
  return bytes;
}

function jpeg() {
  return new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 0, 96, 0, 96, 255, 217]);
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
    expect(row?.delete_token_hash).toBe('');
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
