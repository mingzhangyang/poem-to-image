// Client for the public gallery (worker/gallery.ts). Owner requests carry the
// private removal key in a header, never in the URL.

export type GalleryStatus = 'none' | 'pending' | 'listed' | 'rejected';
export type ReportReason = 'copyright' | 'privacy' | 'inappropriate' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['copyright', 'privacy', 'inappropriate', 'other'];

export interface GalleryOwnerState {
  status: GalleryStatus;
  /** Only permanent shares can be listed. */
  eligible: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  author: string;
  listedAt: string;
  url: string;
  imageUrl: string;
  cardUrl: string;
}

export interface GalleryPage {
  items: GalleryItem[];
  nextCursor: string | null;
}

const STATUSES: readonly GalleryStatus[] = ['none', 'pending', 'listed', 'rejected'];

/** Error codes: NOT_PERMANENT, NOT_FOUND, RATE_LIMITED, or HTTP_<status>. */
export class GalleryRequestError extends Error {}

async function ownerRequest(id: string, deleteToken: string, method: 'GET' | 'PUT' | 'DELETE'): Promise<GalleryOwnerState> {
  const response = await fetch('/api/shares/' + encodeURIComponent(id) + '/gallery', {
    method,
    headers: { 'X-Share-Delete-Token': deleteToken },
  });
  if (response.status === 409) throw new GalleryRequestError('NOT_PERMANENT');
  if (response.status === 404) throw new GalleryRequestError('NOT_FOUND');
  if (!response.ok) throw new GalleryRequestError('HTTP_' + response.status);
  const body = await response.json() as Partial<GalleryOwnerState>;
  if (!STATUSES.includes(body.status as GalleryStatus) || typeof body.eligible !== 'boolean') {
    throw new GalleryRequestError('MALFORMED_RESPONSE');
  }
  return { status: body.status as GalleryStatus, eligible: body.eligible };
}

export function getGalleryStatus(id: string, deleteToken: string): Promise<GalleryOwnerState> {
  return ownerRequest(id, deleteToken, 'GET');
}

export function requestGalleryListing(id: string, deleteToken: string): Promise<GalleryOwnerState> {
  return ownerRequest(id, deleteToken, 'PUT');
}

export function withdrawGalleryListing(id: string, deleteToken: string): Promise<GalleryOwnerState> {
  return ownerRequest(id, deleteToken, 'DELETE');
}

export async function fetchGalleryPage(cursor: string | null, signal?: AbortSignal): Promise<GalleryPage> {
  const query = cursor ? '?cursor=' + encodeURIComponent(cursor) : '';
  const response = await fetch('/api/gallery' + query, { signal });
  if (!response.ok) throw new GalleryRequestError('HTTP_' + response.status);
  const body = await response.json() as Partial<GalleryPage>;
  if (!Array.isArray(body.items)) throw new GalleryRequestError('MALFORMED_RESPONSE');
  // Only follow same-origin share paths, whatever the response says.
  const items = body.items.filter((item): item is GalleryItem =>
    !!item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{12}$/.test(item.id)
    && typeof item.title === 'string' && typeof item.author === 'string')
    .map((item) => ({
      ...item,
      url: '/s/' + item.id,
      imageUrl: item.imageUrl === '/s/' + item.id + '/image.png' ? item.imageUrl : '/s/' + item.id + '/image.jpg',
      cardUrl: '/s/' + item.id + '/card.jpg',
    }));
  return { items, nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null };
}

export async function reportShare(id: string, reason: ReportReason): Promise<void> {
  const response = await fetch('/api/shares/' + encodeURIComponent(id) + '/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (response.status === 429) throw new GalleryRequestError('RATE_LIMITED');
  if (!response.ok) throw new GalleryRequestError('HTTP_' + response.status);
}
