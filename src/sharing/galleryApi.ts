// Client for the public gallery and visitor reports (worker/gallery.ts).
// Submitting to the gallery goes through the account API (accountSharesApi.ts).

export type GalleryStatus = 'none' | 'pending' | 'listed' | 'rejected';
export type ReportReason = 'copyright' | 'privacy' | 'inappropriate' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['copyright', 'privacy', 'inappropriate', 'other'];

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

/** Error codes: RATE_LIMITED, MALFORMED_RESPONSE or HTTP_<status>. */
export class GalleryRequestError extends Error {}

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
