// SQL for the public-gallery review script (scripts/gallery-review.mjs).
// Kept free of Node APIs so the Worker runtime tests can run these exact
// statements against the migrated D1 schema.

const SHARE_ID = /^[A-Za-z0-9_-]{12}$/;

/** @param {string} id */
export function isShareId(id) {
  return SHARE_ID.test(id);
}

/**
 * Share IDs are the only values interpolated into SQL, and only after this
 * check, because `wrangler d1 execute --command` takes no bound parameters.
 * @param {string[]} ids
 */
function idList(ids) {
  if (ids.length === 0) throw new Error('No share ID given.');
  for (const id of ids) {
    if (!isShareId(id)) throw new Error('Not a share ID: ' + JSON.stringify(id));
  }
  return ids.map((id) => "'" + id + "'").join(', ');
}

/** @param {number} limit */
function rowLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Limit must be 1–500.');
  return limit;
}

const LIVE = 'published_at IS NOT NULL AND revoked_at IS NULL';
const PERMANENT = "expiry_policy = 'never' AND expires_at IS NULL";
const OWNER = 'owner_user_id, (SELECT u.email FROM users u WHERE u.id = s.owner_user_id) AS owner_email';
// A review (approve, reject, remove or dismiss) sets gallery_reviewed_at and
// so resolves every report filed before it; reports are never deleted here.
// Keep this in step with the report threshold in worker/gallery.ts.
const OPEN_REPORT = 'r.share_id = s.id AND (s.gallery_reviewed_at IS NULL OR r.created_at >= s.gallery_reviewed_at)';
const REPORT_COUNT = `(SELECT COUNT(*) FROM share_reports r WHERE ${OPEN_REPORT})`;
const REPORT_REASONS = `(SELECT GROUP_CONCAT(DISTINCT r.reason) FROM share_reports r WHERE ${OPEN_REPORT})`;
// Every write ends in RETURNING: local wrangler does not report
// meta.changes, so the review script counts the returned rows.

export const sql = {
  /** Submissions waiting for review, oldest first. */
  pending(limit = 50) {
    return `SELECT id, title, author, image_type, published_at, gallery_requested_at, gallery_listed_at, ${OWNER},
      ${REPORT_COUNT} AS report_count, ${REPORT_REASONS} AS report_reasons
      FROM shared_artworks s
      WHERE gallery_status = 'pending' AND ${LIVE}
      ORDER BY gallery_requested_at, id LIMIT ${rowLimit(limit)}`;
  },

  /** Artworks currently shown in the gallery, newest first. */
  listed(limit = 50) {
    return `SELECT id, title, author, image_type, gallery_listed_at, ${OWNER},
      ${REPORT_COUNT} AS report_count, ${REPORT_REASONS} AS report_reasons
      FROM shared_artworks s
      WHERE gallery_status = 'listed' AND ${LIVE}
      ORDER BY gallery_listed_at DESC, id DESC LIMIT ${rowLimit(limit)}`;
  },

  /** Live shares with visitor reports, most reported first. */
  reports(limit = 50) {
    return `SELECT id, title, author, image_type, gallery_status, ${OWNER},
      ${REPORT_COUNT} AS report_count, ${REPORT_REASONS} AS report_reasons,
      (SELECT MAX(r.created_at) FROM share_reports r WHERE ${OPEN_REPORT}) AS last_report_at
      FROM shared_artworks s
      WHERE ${LIVE} AND EXISTS (SELECT 1 FROM share_reports r WHERE ${OPEN_REPORT})
      ORDER BY report_count DESC, last_report_at DESC LIMIT ${rowLimit(limit)}`;
  },

  /** One share with its gallery and report state. */
  show(id) {
    return `SELECT id, title, author, image_type, published_at, revoked_at, expiry_policy, expires_at, ${OWNER},
      gallery_status, gallery_requested_at, gallery_listed_at, gallery_reviewed_at,
      ${REPORT_COUNT} AS report_count, ${REPORT_REASONS} AS report_reasons
      FROM shared_artworks s WHERE id IN (${idList([id])})`;
  },

  /**
   * List pending submissions. Only account-owned shares can be listed. An artwork that came back into review after
   * reports keeps its original place in the gallery. Approving resolves the
   * reports filed so far, and only for the rows this statement approves: an
   * ID that is not pending is left untouched, along with its reports.
   * @param {string[]} ids
   */
  approve(ids) {
    return [
      `UPDATE shared_artworks
       SET gallery_status = 'listed',
           gallery_listed_at = COALESCE(gallery_listed_at, CURRENT_TIMESTAMP),
           gallery_reviewed_at = CURRENT_TIMESTAMP
       WHERE id IN (${idList(ids)}) AND gallery_status = 'pending' AND ${LIVE} AND ${PERMANENT}
         AND owner_user_id IS NOT NULL
       RETURNING id`,
    ];
  },

  /**
   * Keep pending or listed artworks out of the gallery. The share link stays
   * up, and the creator cannot resubmit.
   * @param {string[]} ids
   */
  reject(ids) {
    return [
      `UPDATE shared_artworks
       SET gallery_status = 'rejected', gallery_listed_at = NULL,
           gallery_reviewed_at = CURRENT_TIMESTAMP
       WHERE id IN (${idList(ids)}) AND gallery_status IN ('pending', 'listed') AND ${LIVE}
       RETURNING id`,
    ];
  },

  /**
   * Take a share down entirely: revoke it the same way the creator's DELETE
   * does. The hourly maintenance cron then deletes its R2 images.
   * @param {string[]} ids
   */
  remove(ids) {
    return [
      `UPDATE shared_artworks
       SET revoked_at = CURRENT_TIMESTAMP, title = '', author = '',
           gallery_status = NULL, gallery_listed_at = NULL,
           gallery_reviewed_at = CURRENT_TIMESTAMP,
           assets_deleted_at = CASE WHEN image_key IS NULL AND card_key IS NULL
             THEN CURRENT_TIMESTAMP ELSE assets_deleted_at END
       WHERE id IN (${idList(ids)}) AND revoked_at IS NULL
       RETURNING id`,
    ];
  },

  /**
   * Resolve reports judged unfounded without changing the listing.
   * @param {string[]} ids
   */
  dismissReports(ids) {
    return [
      `UPDATE shared_artworks SET gallery_reviewed_at = CURRENT_TIMESTAMP
       WHERE id IN (${idList(ids)}) AND ${LIVE}
         AND EXISTS (SELECT 1 FROM share_reports r WHERE r.share_id = shared_artworks.id
           AND (shared_artworks.gallery_reviewed_at IS NULL OR r.created_at >= shared_artworks.gallery_reviewed_at))
       RETURNING id`,
    ];
  },
};
