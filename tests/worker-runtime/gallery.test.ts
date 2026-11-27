import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { runOperationalChecks } from '../../worker/maintenance';
import { GALLERY_REPORT_HIDE_THRESHOLD } from '../../worker/gallery';
import { sql } from '../../scripts/gallery-review-sql.mjs';
import type { WorkerEnv } from '../../worker/env';

const ORIGIN = 'https://inkpoem.test';

function png() {
  const bytes = new Uint8Array(32);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(bytes.buffer).setUint32(16, 1080);
  new DataView(bytes.buffer).setUint32(20, 1350);
  return bytes;
}

const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0eiiivOOo/9k=';
function jpeg() {
  return Uint8Array.from(atob(JPEG_BASE64), (char) => char.charCodeAt(0));
}

interface Share { id: string; deleteToken: string }

function credentials(): Share {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
  const deleteToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')).join('');
  return { id, deleteToken };
}

async function publish(title: string, expiry: '7d' | '30d' | 'never' = 'never'): Promise<Share> {
  const share = credentials();
  const body = new FormData();
  body.append('id', share.id);
  body.append('deleteToken', share.deleteToken);
  body.append('artwork', new File([png()], 'artwork.png', { type: 'image/png' }));
  body.append('card', new File([jpeg()], 'card.jpg', { type: 'image/jpeg' }));
  body.append('title', title);
  body.append('author', 'Poet');
  body.append('expiry', expiry);
  const response = await SELF.fetch(ORIGIN + '/api/shares', { method: 'POST', headers: { Origin: ORIGIN }, body });
  expect(response.status).toBe(201);
  return share;
}

function gallery(share: Share, method: 'GET' | 'PUT' | 'DELETE', token = share.deleteToken) {
  return SELF.fetch(ORIGIN + '/api/shares/' + share.id + '/gallery', {
    method, headers: { Origin: ORIGIN, 'X-Share-Delete-Token': token },
  });
}

async function review(statements: string[]) {
  for (const statement of statements) await env.DB.prepare(statement).all();
}

async function listedIds(query = ''): Promise<{ ids: string[]; nextCursor: string | null }> {
  const response = await SELF.fetch(ORIGIN + '/api/gallery' + query);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const body = await response.json() as { items: { id: string }[]; nextCursor: string | null };
  return { ids: body.items.map((item) => item.id), nextCursor: body.nextCursor };
}

function report(id: string, reason: string, ip: string) {
  return SELF.fetch(ORIGIN + '/api/shares/' + id + '/report', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ reason }),
  });
}

describe('public gallery', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits'),
      env.DB.prepare('DELETE FROM share_reports'),
      env.DB.prepare('DELETE FROM shared_artworks'),
    ]);
  });

  it('lists a permanent share only after the creator opts in and a maintainer approves', async () => {
    const share = await publish('Quiet night');
    expect(await (await gallery(share, 'GET')).json()).toEqual({ status: 'none', eligible: true });
    expect((await listedIds()).ids).toEqual([]);

    const requested = await gallery(share, 'PUT');
    expect(requested.status).toBe(200);
    expect(await requested.json()).toEqual({ status: 'pending', eligible: true });
    expect((await listedIds()).ids).toEqual([]);

    await review(sql.approve([share.id]));
    expect(await (await gallery(share, 'GET')).json()).toEqual({ status: 'listed', eligible: true });
    const response = await SELF.fetch(ORIGIN + '/api/gallery');
    expect(await response.json()).toEqual({
      items: [expect.objectContaining({
        id: share.id, title: 'Quiet night', author: 'Poet',
        url: '/s/' + share.id, imageUrl: '/s/' + share.id + '/image.png', cardUrl: '/s/' + share.id + '/card.jpg',
      })],
      nextCursor: null,
    });

    // Asking again keeps the listing rather than resetting it to pending.
    expect(await (await gallery(share, 'PUT')).json()).toEqual({ status: 'listed', eligible: true });
  });

  it('refuses expiring shares and requests without the private removal key', async () => {
    const expiring = await publish('One week', '7d');
    const refused = await gallery(expiring, 'PUT');
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: 'SHARE_NOT_PERMANENT' });
    expect(await (await gallery(expiring, 'GET')).json()).toEqual({ status: 'none', eligible: false });

    // Even a maintainer cannot approve an expiring share.
    await env.DB.prepare("UPDATE shared_artworks SET gallery_status = 'pending' WHERE id = ?").bind(expiring.id).run();
    await review(sql.approve([expiring.id]));
    expect((await listedIds()).ids).toEqual([]);

    const permanent = await publish('Permanent');
    expect((await gallery(permanent, 'PUT', 'f'.repeat(64))).status).toBe(404);
    expect((await gallery(permanent, 'PUT', 'not-a-token')).status).toBe(404);
    const crossOrigin = await SELF.fetch(ORIGIN + '/api/shares/' + permanent.id + '/gallery', {
      method: 'PUT', headers: { Origin: 'https://evil.test', 'X-Share-Delete-Token': permanent.deleteToken },
    });
    expect(crossOrigin.status).toBe(403);
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + permanent.id + '/gallery', { method: 'POST' })).status).toBe(405);
  });

  it('lets the creator withdraw, but a rejected share cannot be resubmitted', async () => {
    const share = await publish('Withdrawn');
    await gallery(share, 'PUT');
    await review(sql.approve([share.id]));
    expect(await (await gallery(share, 'DELETE')).json()).toEqual({ status: 'none', eligible: true });
    expect((await listedIds()).ids).toEqual([]);

    await gallery(share, 'PUT');
    await review(sql.reject([share.id]));
    expect(await (await gallery(share, 'PUT')).json()).toEqual({ status: 'rejected', eligible: true });
    expect(await (await gallery(share, 'DELETE')).json()).toEqual({ status: 'rejected', eligible: true });
    expect((await listedIds()).ids).toEqual([]);
  });

  it('drops a listed share from the gallery as soon as it is revoked', async () => {
    const share = await publish('Revoked');
    await gallery(share, 'PUT');
    await review(sql.approve([share.id]));
    expect((await listedIds()).ids).toEqual([share.id]);

    const revoked = await SELF.fetch(ORIGIN + '/api/shares/' + share.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': share.deleteToken },
    });
    expect(revoked.status).toBe(200);
    expect((await listedIds()).ids).toEqual([]);
    expect((await gallery(share, 'GET')).status).toBe(404);
  });

  it('takes a share down entirely with the review script', async () => {
    const share = await publish('Taken down');
    await gallery(share, 'PUT');
    await review(sql.approve([share.id]));
    await review(sql.remove([share.id]));
    expect((await listedIds()).ids).toEqual([]);
    expect((await SELF.fetch(ORIGIN + '/s/' + share.id)).status).toBe(404);
    expect((await SELF.fetch(ORIGIN + '/s/' + share.id + '/card.jpg')).status).toBe(404);
    const row = await env.DB.prepare('SELECT title, author, revoked_at FROM shared_artworks WHERE id = ?')
      .bind(share.id).first<{ title: string; author: string; revoked_at: string | null }>();
    expect(row).toMatchObject({ title: '', author: '' });
    expect(row?.revoked_at).not.toBeNull();

    // The creator's own revoke still succeeds afterwards.
    const creatorRevoke = await SELF.fetch(ORIGIN + '/api/shares/' + share.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': share.deleteToken },
    });
    expect(creatorRevoke.status).toBe(200);
  });

  it('pages newest first with a stable cursor', async () => {
    const shares: Share[] = [];
    for (let i = 0; i < 5; i++) {
      await env.DB.prepare('DELETE FROM rate_limits').run();
      const share = await publish('Poem ' + i);
      await gallery(share, 'PUT');
      shares.push(share);
    }
    await review(sql.approve(shares.map((share) => share.id)));
    // Same-second approvals tie on listed_at and fall back to ID order.
    const expected = (await env.DB.prepare(
      "SELECT id FROM shared_artworks WHERE gallery_status = 'listed' ORDER BY gallery_listed_at DESC, id DESC",
    ).all<{ id: string }>()).results.map((row) => row.id);

    const first = await listedIds('?limit=2');
    expect(first.ids).toEqual(expected.slice(0, 2));
    const second = await listedIds('?limit=2&cursor=' + first.nextCursor);
    expect(second.ids).toEqual(expected.slice(2, 4));
    const third = await listedIds('?limit=2&cursor=' + second.nextCursor);
    expect(third).toEqual({ ids: expected.slice(4), nextCursor: null });

    expect((await SELF.fetch(ORIGIN + '/api/gallery?limit=0')).status).toBe(400);
    expect((await SELF.fetch(ORIGIN + '/api/gallery?limit=49')).status).toBe(400);
    expect((await SELF.fetch(ORIGIN + '/api/gallery?cursor=bogus')).status).toBe(400);
    expect((await SELF.fetch(ORIGIN + '/api/gallery', { method: 'POST' })).status).toBe(405);
  });

  it('returns a listed share to review once enough distinct visitors report it', async () => {
    const share = await publish('Reported');
    await gallery(share, 'PUT');
    await review(sql.approve([share.id]));

    for (let i = 1; i < GALLERY_REPORT_HIDE_THRESHOLD; i++) {
      expect((await report(share.id, 'copyright', '203.0.113.' + i)).status).toBe(202);
      // A repeated report from the same visitor does not count twice.
      expect((await report(share.id, 'other', '203.0.113.' + i)).status).toBe(202);
    }
    expect((await listedIds()).ids).toEqual([share.id]);

    expect((await report(share.id, 'privacy', '198.51.100.7')).status).toBe(202);
    expect((await listedIds()).ids).toEqual([]);
    // The link stays up while the maintainer reviews it.
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + share.id)).status).toBe(200);

    const pending = (await env.DB.prepare(sql.pending()).all<{ id: string; report_count: number; gallery_listed_at: string | null }>()).results;
    expect(pending).toEqual([expect.objectContaining({ id: share.id, report_count: GALLERY_REPORT_HIDE_THRESHOLD })]);
    expect(pending[0]!.gallery_listed_at).not.toBeNull();

    // Approving again clears the reports and restores the original position.
    await review(sql.approve([share.id]));
    expect((await listedIds()).ids).toEqual([share.id]);
    expect((await env.DB.prepare(sql.reports()).all()).results).toEqual([]);
  });

  it('validates reports and rate-limits each visitor', async () => {
    const share = await publish('Validated');
    expect((await report(share.id, 'spam', '192.0.2.1')).status).toBe(400);
    expect((await report('AAAAAAAAAAAA', 'other', '192.0.2.1')).status).toBe(404);
    const crossOrigin = await SELF.fetch(ORIGIN + '/api/shares/' + share.id + '/report', {
      method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'other' }),
    });
    expect(crossOrigin.status).toBe(403);

    for (let i = 0; i < 10; i++) expect((await report(share.id, 'other', '192.0.2.9')).status).toBe(202);
    expect((await report(share.id, 'other', '192.0.2.9')).status).toBe(429);
  });

  it('drops reports of revoked shares during maintenance', async () => {
    const share = await publish('Cleaned');
    await report(share.id, 'other', '192.0.2.50');
    await review(sql.remove([share.id]));
    await runOperationalChecks(env as unknown as WorkerEnv);
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM share_reports').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
