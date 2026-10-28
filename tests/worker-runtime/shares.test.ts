import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

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

function form(title = 'Moon & <Stars>', author = 'An author') {
  const body = new FormData();
  body.append('artwork', new File([png()], 'artwork.png', { type: 'image/png' }));
  body.append('card', new File([jpeg()], 'card.jpg', { type: 'image/jpeg' }));
  body.append('title', title);
  body.append('author', author);
  return body;
}

async function publish(title?: string, author?: string) {
  return SELF.fetch(ORIGIN + '/api/shares', {
    method: 'POST',
    headers: { Origin: ORIGIN },
    body: form(title, author),
  });
}

describe('anonymous artwork sharing', () => {
  it('publishes a public snapshot, renders crawler metadata and revokes with its token', async () => {
    const response = await publish('Moon & <Stars>', 'Poet "A"');
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { id, url, deleteToken } = await response.json() as { id: string; url: string; deleteToken: string };
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(url).toBe(ORIGIN + '/s/' + id);
    expect(deleteToken).toMatch(/^[a-f0-9]{64}$/);

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

  it('returns 404 for malformed share IDs and never falls back to the editor', async () => {
    const response = await SELF.fetch(ORIGIN + '/s/invalid');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('noindex');
    expect((await SELF.fetch(ORIGIN + '/api/shares/invalid')).status).toBe(404);
  });

  it('accepts an empty title and produces an immutable, separately addressable artwork', async () => {
    const response = await publish('', '');
    expect(response.status).toBe(201);
    const { id } = await response.json() as { id: string };
    const result = await SELF.fetch(ORIGIN + '/api/shares/' + id);
    expect(await result.json()).toMatchObject({ title: 'Untitled poem', author: '' });
  });
});
