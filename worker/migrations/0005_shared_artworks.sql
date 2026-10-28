-- Published artworks are immutable snapshots; revocation keeps an audit tombstone.
CREATE TABLE IF NOT EXISTS shared_artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  image_key TEXT UNIQUE,
  image_type TEXT,
  card_key TEXT UNIQUE,
  delete_token_hash TEXT NOT NULL,
  content_fingerprint TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  revoked_at TEXT,
  assets_deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shared_artworks_created ON shared_artworks(created_at);
CREATE INDEX IF NOT EXISTS idx_shared_artworks_cleanup_pending ON shared_artworks(revoked_at)
  WHERE revoked_at IS NOT NULL AND assets_deleted_at IS NULL;
