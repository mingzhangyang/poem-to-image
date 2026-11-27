// Client for shares owned by the signed-in account (worker/accountShares.ts).
import type { GalleryStatus } from './galleryApi';

type GetToken = () => Promise<string | null>;

export interface AccountShare {
  id: string;
  title: string;
  author: string;
  publishedAt: string;
  expiresAt: string | null;
  /** Only permanent shares can be submitted to the gallery. */
  permanent: boolean;
  galleryStatus: GalleryStatus;
  url: string;
  imageUrl: string;
  cardUrl: string;
}

/** Codes: SIGNED_OUT, NOT_FOUND, NOT_PERMANENT, RATE_LIMITED, MALFORMED_RESPONSE or HTTP_<status>. */
export class AccountShareError extends Error {}

const STATUSES: readonly GalleryStatus[] = ['none', 'pending', 'listed', 'rejected'];
const SHARE_ID = /^[A-Za-z0-9_-]{12}$/;

async function request(getToken: GetToken, path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await getToken();
  if (!token) throw new AccountShareError('SIGNED_OUT');
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + token);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  if (response.status === 401) throw new AccountShareError('SIGNED_OUT');
  if (response.status === 404) throw new AccountShareError('NOT_FOUND');
  if (response.status === 409) throw new AccountShareError('NOT_PERMANENT');
  if (response.status === 429) throw new AccountShareError('RATE_LIMITED');
  if (!response.ok) throw new AccountShareError('HTTP_' + response.status);
  return response.json();
}

export async function fetchAccountShares(getToken: GetToken): Promise<AccountShare[]> {
  const body = await request(getToken, '/api/me/shares') as { shares?: unknown };
  if (!Array.isArray(body.shares)) throw new AccountShareError('MALFORMED_RESPONSE');
  return body.shares.filter((item): item is AccountShare =>
    !!item && typeof item === 'object'
    && SHARE_ID.test((item as AccountShare).id)
    && typeof (item as AccountShare).title === 'string'
    && STATUSES.includes((item as AccountShare).galleryStatus))
    .map((item) => ({
      ...item,
      // Only follow same-origin share paths, whatever the response says.
      url: '/s/' + item.id,
      imageUrl: item.imageUrl === '/s/' + item.id + '/image.png' ? item.imageUrl : '/s/' + item.id + '/image.jpg',
      cardUrl: '/s/' + item.id + '/card.jpg',
    }));
}

/**
 * Tie shares this browser published to the account. The removal keys prove
 * ownership; they travel in the request body, never in a URL.
 */
export async function claimShares(getToken: GetToken, shares: { id: string; deleteToken: string }[]): Promise<string[]> {
  const claimed: string[] = [];
  for (let start = 0; start < shares.length; start += 50) {
    const batch = shares.slice(start, start + 50).map(({ id, deleteToken }) => ({ id, deleteToken }));
    const body = await request(getToken, '/api/me/shares/claim', {
      method: 'POST', body: JSON.stringify({ shares: batch }),
    }) as { claimed?: unknown };
    if (!Array.isArray(body.claimed)) throw new AccountShareError('MALFORMED_RESPONSE');
    claimed.push(...body.claimed.filter((id): id is string => typeof id === 'string'));
  }
  return claimed;
}

export async function revokeAccountShare(getToken: GetToken, id: string): Promise<void> {
  await request(getToken, '/api/me/shares/' + encodeURIComponent(id), { method: 'DELETE' });
}

async function gallery(getToken: GetToken, id: string, method: 'PUT' | 'DELETE'): Promise<GalleryStatus> {
  const body = await request(getToken, '/api/me/shares/' + encodeURIComponent(id) + '/gallery', { method }) as { status?: unknown };
  if (!STATUSES.includes(body.status as GalleryStatus)) throw new AccountShareError('MALFORMED_RESPONSE');
  return body.status as GalleryStatus;
}

export function requestGalleryListing(getToken: GetToken, id: string): Promise<GalleryStatus> {
  return gallery(getToken, id, 'PUT');
}

export function withdrawGalleryListing(getToken: GetToken, id: string): Promise<GalleryStatus> {
  return gallery(getToken, id, 'DELETE');
}
