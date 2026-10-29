-- Existing anonymous shares remain permanent unless explicitly revoked.
-- New shares choose a fixed server-enforced lifetime at reservation time.
ALTER TABLE shared_artworks ADD COLUMN expiry_policy TEXT NOT NULL DEFAULT 'never'
  CHECK (expiry_policy IN ('7d', '30d', 'never'));
ALTER TABLE shared_artworks ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_shared_artworks_expiration
  ON shared_artworks(expires_at)
  WHERE expires_at IS NOT NULL AND revoked_at IS NULL;
