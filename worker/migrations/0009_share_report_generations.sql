-- Report resolution by review generation instead of timestamps.
-- Every review of a share (approve, reject, remove, dismiss) increments its
-- gallery_review_generation in the same UPDATE. A report records the
-- generation current when it was filed; it is open while the two match.
-- Write order, not the one-second CURRENT_TIMESTAMP, decides which reports a
-- review resolved.
ALTER TABLE shared_artworks ADD COLUMN gallery_review_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_reports ADD COLUMN review_generation INTEGER NOT NULL DEFAULT 0;

-- Reports filed before an earlier timestamp-based review were resolved by it.
UPDATE share_reports SET review_generation = -1
WHERE created_at < (SELECT s.gallery_reviewed_at FROM shared_artworks s WHERE s.id = share_reports.share_id);
