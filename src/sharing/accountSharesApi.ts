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

/** Codes: SIGNED_OUT, NOT_FOUND, NOT_PERMANENT, RATE_LIMITED, TIMEOUT, MALFORMED_RESPONSE or HTTP_<status>. */
export class AccountShareError extends Error {}

const STATUSES: readonly GalleryStatus[] = ['none', 'pending', 'listed', 'rejected'];
const SHARE_ID = /^[A-Za-z0-9_-]{12}$/;

/** Default deadline for claiming a share and submitting it to the gallery. */
export const ACCOUNT_PUBLICATION_TIMEOUT_MS = 15_000;

export interface RequestOptions {
  /** Abort the request (token lookup included) after this many milliseconds;
   * it then fails with TIMEOUT. */
  timeoutMs?: number;
}

function withDeadline<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new AccountShareError('TIMEOUT'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

async function request(getToken: GetToken, path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<unknown> {
  const signal = options.timeoutMs === undefined ? undefined : AbortSignal.timeout(options.timeoutMs);
  const token = await withDeadline(getToken(), signal);
  if (!token) throw new AccountShareError('SIGNED_OUT');
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + token);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: 'no-store', signal });
  } catch (caught) {
    if (signal?.aborted) throw new AccountShareError('TIMEOUT');
    throw caught;
  }
  if (response.status === 401) throw new AccountShareError('SIGNED_OUT');
  if (response.status === 404) throw new AccountShareError('NOT_FOUND');
  if (response.status === 409) throw new AccountShareError('NOT_PERMANENT');
  if (response.status === 429) throw new AccountShareError('RATE_LIMITED');
  if (!response.ok) throw new AccountShareError('HTTP_' + response.status);
  try {
    return await withDeadline(response.json() as Promise<unknown>, signal);
  } catch (caught) {
    if (signal?.aborted) throw new AccountShareError('TIMEOUT');
    throw caught;
  }
}

export interface AccountSharePage {
  shares: AccountShare[];
  nextCursor: string | null;
}

/** One page of the account's shares, newest first. Pass `nextCursor` back for the next page. */
export async function fetchAccountShares(getToken: GetToken, cursor: string | null = null): Promise<AccountSharePage> {
  const path = '/api/me/shares' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
  const body = await request(getToken, path) as { shares?: unknown; nextCursor?: unknown };
  if (!Array.isArray(body.shares)) throw new AccountShareError('MALFORMED_RESPONSE');
  const shares = body.shares.filter((item): item is AccountShare =>
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
  return { shares, nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null };
}

/**
 * Which of these share IDs belong to the account, in any state. Used to tell
 * this browser's local shares apart without paging through the account.
 */
export async function fetchOwnedShareIds(getToken: GetToken, ids: string[]): Promise<Set<string>> {
  const owned = new Set<string>();
  for (let start = 0; start < ids.length; start += 500) {
    const body = await request(getToken, '/api/me/shares/owned', {
      method: 'POST', body: JSON.stringify({ ids: ids.slice(start, start + 500) }),
    }) as { owned?: unknown };
    if (!Array.isArray(body.owned)) throw new AccountShareError('MALFORMED_RESPONSE');
    for (const id of body.owned) if (typeof id === 'string') owned.add(id);
  }
  return owned;
}

export interface ClaimResult {
  /** Shares now tied to this account (including ones it already held). */
  claimed: string[];
  /** Shares whose key matched but that another account already holds. */
  ownedElsewhere: string[];
}

/**
 * Tie shares this browser published to the account. The removal keys prove
 * ownership; they travel in the request body, never in a URL.
 */
export async function claimShares(
  getToken: GetToken, shares: { id: string; deleteToken: string }[],
  options: RequestOptions = { timeoutMs: ACCOUNT_PUBLICATION_TIMEOUT_MS },
): Promise<ClaimResult> {
  const result: ClaimResult = { claimed: [], ownedElsewhere: [] };
  const ids = (value: unknown) => (Array.isArray(value) ? value : []).filter((id): id is string => typeof id === 'string');
  for (let start = 0; start < shares.length; start += 50) {
    const batch = shares.slice(start, start + 50).map(({ id, deleteToken }) => ({ id, deleteToken }));
    const body = await request(getToken, '/api/me/shares/claim', {
      method: 'POST', body: JSON.stringify({ shares: batch }),
    }, options) as { claimed?: unknown; ownedElsewhere?: unknown };
    if (!Array.isArray(body.claimed)) throw new AccountShareError('MALFORMED_RESPONSE');
    result.claimed.push(...ids(body.claimed));
    result.ownedElsewhere.push(...ids(body.ownedElsewhere));
  }
  return result;
}

const OWNED_ELSEWHERE_KEY = 'inkpoem:shares-owned-elsewhere';
const MAX_OWNED_ELSEWHERE = 500;

/**
 * Local shares known to belong to another account. The claim banner skips
 * them, so it does not keep offering a claim the server will always refuse.
 */
export function readOwnedElsewhere(): Set<string> {
  try {
    const value = JSON.parse(window.localStorage.getItem(OWNED_ELSEWHERE_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && SHARE_ID.test(id)) : []);
  } catch {
    return new Set();
  }
}

export function rememberOwnedElsewhere(ids: string[]): void {
  if (!ids.length) return;
  try {
    const merged = [...new Set([...readOwnedElsewhere(), ...ids])].slice(-MAX_OWNED_ELSEWHERE);
    window.localStorage.setItem(OWNED_ELSEWHERE_KEY, JSON.stringify(merged));
  } catch {
    // Storage may be unavailable; the banner then just offers them again.
  }
}

export async function revokeAccountShare(getToken: GetToken, id: string): Promise<void> {
  await request(getToken, '/api/me/shares/' + encodeURIComponent(id), { method: 'DELETE' });
}

async function gallery(getToken: GetToken, id: string, method: 'PUT' | 'DELETE', options: RequestOptions = {}): Promise<GalleryStatus> {
  const body = await request(getToken, '/api/me/shares/' + encodeURIComponent(id) + '/gallery', { method }, options) as { status?: unknown };
  if (!STATUSES.includes(body.status as GalleryStatus)) throw new AccountShareError('MALFORMED_RESPONSE');
  return body.status as GalleryStatus;
}

export function requestGalleryListing(
  getToken: GetToken, id: string, options: RequestOptions = { timeoutMs: ACCOUNT_PUBLICATION_TIMEOUT_MS },
): Promise<GalleryStatus> {
  return gallery(getToken, id, 'PUT', options);
}

export function withdrawGalleryListing(getToken: GetToken, id: string): Promise<GalleryStatus> {
  return gallery(getToken, id, 'DELETE');
}
