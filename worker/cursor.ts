import { isShareId } from './shares';

/**
 * Opaque keyset-pagination cursors for share lists ordered by
 * `(timestamp DESC, id DESC)`. A cursor is the last row's D1 timestamp and
 * share ID, base64url-encoded.
 */

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function encodeCursor(timestamp: string, id: string): string {
  return btoa(JSON.stringify([timestamp, id]))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns null for anything that is not a cursor this module produced. */
export function decodeCursor(raw: string): [string, string] | null {
  if (raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const value = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))) as unknown;
    if (Array.isArray(value) && value.length === 2
      && typeof value[0] === 'string' && TIMESTAMP_PATTERN.test(value[0])
      && typeof value[1] === 'string' && isShareId(value[1])) {
      return [value[0], value[1]];
    }
  } catch {
    // Fall through: a malformed cursor is a client error.
  }
  return null;
}

/** Parses `?limit=` as an integer in [1, max], or the default when absent. */
export function parseLimit(raw: string | null, fallback: number, max: number): number | null {
  if (raw === null) return fallback;
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 1 && limit <= max ? limit : null;
}
