import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { runOperationalChecks } from '../../worker/maintenance';
import { GALLERY_REPORT_HIDE_THRESHOLD } from '../../worker/gallery';
import { routeAccountShares } from '../../worker/accountShares';
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

const USER = 'user_gallery_owner';

function account(path: string, method: string, body?: unknown, userId = USER) {
  const request = new Request(ORIGIN + path, {
    method,
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return routeAccountShares(request, env as unknown as WorkerEnv, userId, path);
}

async function claim(shares: Share[], userId = USER): Promise<string[]> {
  const response = await account('/api/me/shares/claim', 'POST', { shares }, userId);
  expect(response.status).toBe(200);
  return (await response.json() as { claimed: string[] }).claimed;
}

function gallery(share: Share, method: 'PUT' | 'DELETE', userId = USER) {
  return account('/api/me/shares/' + share.id + '/gallery', method, undefined, userId);
}

interface AccountShare { id: string; title: string; permanent: boolean; galleryStatus: string; imageUrl: string }

async function accountShares(userId = USER): Promise<AccountShare[]> {
  const response = await account('/api/me/shares', 'GET', undefined, userId);
  expect(response.status).toBe(200);
  return (await response.json() as { shares: AccountShare[] }).shares;
}

/** Publish, claim for USER and submit to the gallery. */
async function submitted(title: string): Promise<Share> {
  const share = await publish(title);
  expect(await claim([share])).toEqual([share.id]);
  expect((await gallery(share, 'PUT')).status).toBe(200);
  return share;
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

  it('lists a permanent share only after its account owner submits it and a maintainer approves', async () => {
    const share = await publish('Quiet night');
    // An anonymous share cannot be submitted: it has no account yet.
    expect((await gallery(share, 'PUT')).status).toBe(404);

    expect(await claim([share])).toEqual([share.id]);
    expect(await accountShares()).toEqual([expect.objectContaining({ id: share.id, permanent: true, galleryStatus: 'none' })]);

    const requested = await gallery(share, 'PUT');
    expect(await requested.json()).toEqual({ status: 'pending', eligible: true });
    expect((await listedIds()).ids).toEqual([]);

    await review(sql.approve([share.id]));
    expect((await accountShares())[0]).toMatchObject({ galleryStatus: 'listed' });
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
    // Another account cannot change it.
    expect((await gallery(share, 'DELETE', 'user_someone_else')).status).toBe(404);
  });

  it('refuses expiring shares, and the review script refuses shares without an owner', async () => {
    const expiring = await publish('One week', '7d');
    await claim([expiring]);
    const refused = await gallery(expiring, 'PUT');
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: 'SHARE_NOT_PERMANENT' });
    expect((await accountShares())[0]).toMatchObject({ permanent: false, galleryStatus: 'none' });
    await env.DB.prepare("UPDATE shared_artworks SET gallery_status = 'pending' WHERE id = ?").bind(expiring.id).run();
    await review(sql.approve([expiring.id]));
    expect((await listedIds()).ids).toEqual([]);

    const anonymous = await publish('Anonymous');
    await env.DB.prepare("UPDATE shared_artworks SET gallery_status = 'pending' WHERE id = ?").bind(anonymous.id).run();
    await review(sql.approve([anonymous.id]));
    expect((await listedIds()).ids).toEqual([]);
  });

  it('lets the owner withdraw, but a rejected share cannot be resubmitted', async () => {
    const share = await submitted('Withdrawn');
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
    const share = await submitted('Revoked');
    await review(sql.approve([share.id]));
    expect((await listedIds()).ids).toEqual([share.id]);

    const revoked = await SELF.fetch(ORIGIN + '/api/shares/' + share.id, {
      method: 'DELETE', headers: { Origin: ORIGIN, 'X-Share-Delete-Token': share.deleteToken },
    });
    expect(revoked.status).toBe(200);
    expect((await listedIds()).ids).toEqual([]);
    expect(await accountShares()).toEqual([]);
  });

  it('takes a share down entirely with the review script', async () => {
    const share = await submitted('Taken down');
    await review(sql.approve([share.id]));
    await review(sql.remove([share.id]));
    expect((await listedIds()).ids).toEqual([]);
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + share.id)).status).toBe(404);
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
      shares.push(await submitted('Poem ' + i));
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
    const share = await submitted('Reported');
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

    const pending = (await env.DB.prepare(sql.pending()).all<{
      id: string; report_count: number; gallery_listed_at: string | null; owner_user_id: string;
    }>()).results;
    expect(pending).toEqual([expect.objectContaining({
      id: share.id, report_count: GALLERY_REPORT_HIDE_THRESHOLD, owner_user_id: USER,
    })]);
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

describe('shares owned by an account', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits'),
      env.DB.prepare('DELETE FROM shared_artworks'),
    ]);
  });

  it('requires a signed-in user', async () => {
    expect((await SELF.fetch(ORIGIN + '/api/me/shares')).status).toBe(401);
    const claimAttempt = await SELF.fetch(ORIGIN + '/api/me/shares/claim', {
      method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{"shares":[]}',
    });
    expect(claimAttempt.status).toBe(401);
  });

  it('claims shares only with their removal key and only once', async () => {
    const first = await publish('First');
    const second = await publish('Second');
    expect(await claim([{ id: first.id, deleteToken: 'f'.repeat(64) }])).toEqual([]);
    expect(await claim([first, second])).toEqual([first.id, second.id]);
    // Claiming again is harmless; another account cannot take them over.
    expect(await claim([first])).toEqual([first.id]);
    expect(await claim([first], 'user_someone_else')).toEqual([]);
    expect(await accountShares('user_someone_else')).toEqual([]);
    expect((await accountShares()).map((share) => share.id).sort()).toEqual([first.id, second.id].sort());

    expect((await account('/api/me/shares/claim', 'POST', { shares: [] })).status).toBe(400);
    expect((await account('/api/me/shares/claim', 'POST', { shares: [{ id: 'bad', deleteToken: first.deleteToken }] })).status).toBe(400);
    const tooMany = Array.from({ length: 51 }, () => first);
    expect((await account('/api/me/shares/claim', 'POST', { shares: tooMany })).status).toBe(400);
  });

  it('lets the owner revoke a share from any device without its removal key', async () => {
    const share = await publish('Mine');
    await claim([share]);
    expect((await account('/api/me/shares/' + share.id, 'DELETE', undefined, 'user_someone_else')).status).toBe(404);

    const revoked = await account('/api/me/shares/' + share.id, 'DELETE');
    expect(revoked.status).toBe(200);
    expect(await accountShares()).toEqual([]);
    expect((await SELF.fetch(ORIGIN + '/api/shares/' + share.id)).status).toBe(404);
    const row = await env.DB.prepare('SELECT title, assets_deleted_at FROM shared_artworks WHERE id = ?')
      .bind(share.id).first<{ title: string; assets_deleted_at: string | null }>();
    expect(row?.title).toBe('');
    expect(row?.assets_deleted_at).not.toBeNull();
    // A revoked share can no longer be claimed or revoked again.
    expect(await claim([share])).toEqual([]);
    expect((await account('/api/me/shares/' + share.id, 'DELETE')).status).toBe(404);
  });

  it('rejects cross-origin mutations and unknown routes', async () => {
    const share = await publish('Origin');
    await claim([share]);
    const path = '/api/me/shares/' + share.id;
    const crossOrigin = await routeAccountShares(new Request(ORIGIN + path, {
      method: 'DELETE', headers: { Origin: 'https://evil.test' },
    }), env as unknown as WorkerEnv, USER, path);
    expect(crossOrigin.status).toBe(403);
    expect((await account('/api/me/shares', 'POST')).status).toBe(405);
    expect((await account('/api/me/shares/' + share.id + '/gallery', 'GET')).status).toBe(405);
    expect((await account('/api/me/shares/nope/extra', 'GET')).status).toBe(404);
  });
});
