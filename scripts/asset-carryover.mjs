// Planning logic for carrying hashed assets over between deployments.
//
// Workers Static Assets serves only the files in the current deployment, and
// a missing file falls back to index.html. A tab opened before a deploy still
// runs the previous bundle and may request hashed files that the new build
// renamed or dropped (lazy JS chunks, template previews). Each deploy therefore
// re-ships files that left the build within the retention window.
//
// The deployed manifest (`/asset-manifest.json`) records which files are in
// the current build and when each carried-over file was retired:
//   { version: 1, current: [path, ...], retired: { path: 'YYYY-MM-DD' } }
// Pure functions only; scripts/carry-over-assets.mjs does the I/O.

export const MANIFEST_FILE = 'asset-manifest.json';
export const CARRYOVER_DIRECTORIES = ['assets', 'template-previews'];
export const RETENTION_DAYS = 30;

const CARRYOVER_PATH = /^\/(?:assets|template-previews)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Only flat files in the hashed directories may be listed or written. */
export function isCarryoverPath(value) {
  return typeof value === 'string' && CARRYOVER_PATH.test(value) && !value.includes('..');
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Validate a manifest fetched from a previous deployment. Throws if malformed. */
export function parseManifest(value) {
  if (typeof value !== 'object' || value === null || value.version !== 1) {
    throw new Error('Asset manifest must be an object with version 1.');
  }
  const { current, retired } = value;
  if (!Array.isArray(current) || typeof retired !== 'object' || retired === null || Array.isArray(retired)) {
    throw new Error('Asset manifest must have a current array and a retired map.');
  }
  for (const entry of current) {
    if (!isCarryoverPath(entry)) throw new Error(`Asset manifest lists an invalid path: ${String(entry)}`);
  }
  for (const [entry, date] of Object.entries(retired)) {
    if (!isCarryoverPath(entry)) throw new Error(`Asset manifest lists an invalid path: ${entry}`);
    if (typeof date !== 'string' || !ISO_DATE.test(date)) {
      throw new Error(`Asset manifest has an invalid retirement date for ${entry}.`);
    }
  }
  return { version: 1, current: [...current], retired: { ...retired } };
}

/**
 * Decide which files from the previous deployment to re-ship.
 *
 * - A file in the new build is current.
 * - A file that was current before but is not in the new build retires today.
 * - A file that was already retired keeps its date and is dropped once it is
 *   older than the retention window.
 */
export function planCarryover({ currentPaths, previous, today, retentionDays = RETENTION_DAYS }) {
  if (!ISO_DATE.test(today)) throw new Error(`Invalid date: ${today}`);
  const current = [...new Set(currentPaths)].sort();
  const currentSet = new Set(current);
  const retired = {};
  const expired = [];

  if (previous) {
    for (const entry of previous.current) {
      if (!currentSet.has(entry)) retired[entry] = today;
    }
    for (const [entry, date] of Object.entries(previous.retired)) {
      if (currentSet.has(entry) || entry in retired) continue;
      if (daysBetween(date, today) > retentionDays) expired.push(entry);
      else retired[entry] = date;
    }
  }

  const sortedRetired = Object.fromEntries(Object.entries(retired).sort(([a], [b]) => a.localeCompare(b)));
  return {
    manifest: { version: 1, current, retired: sortedRetired },
    download: Object.keys(sortedRetired),
    expired: expired.sort(),
  };
}
