-- Public gallery: a published, permanent share is listed only after its
-- creator opts in (pending) and a maintainer approves it (listed).
-- NULL means the creator never asked, or withdrew the request.
ALTER TABLE shared_artworks ADD COLUMN gallery_status TEXT
  CHECK (gallery_status IN ('pending', 'listed', 'rejected'));
ALTER TABLE shared_artworks ADD COLUMN gallery_requested_at TEXT;
ALTER TABLE shared_artworks ADD COLUMN gallery_listed_at TEXT;
ALTER TABLE shared_artworks ADD COLUMN gallery_reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_shared_artworks_gallery_listed
  ON shared_artworks(gallery_listed_at, id)
  WHERE gallery_status = 'listed';
CREATE INDEX IF NOT EXISTS idx_shared_artworks_gallery_pending
  ON shared_artworks(gallery_requested_at)
  WHERE gallery_status = 'pending';

-- Visitor reports about a public share. The reporter is a per-share salted
-- hash of the network address, so one visitor counts once per artwork.
CREATE TABLE IF NOT EXISTS share_reports (
  share_id TEXT NOT NULL,
  reporter_hash TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('copyright', 'privacy', 'inappropriate', 'other')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (share_id, reporter_hash)
);
