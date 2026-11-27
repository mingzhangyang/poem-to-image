-- A share is tied to an account when a signed-in creator claims it with the
-- share's private removal key (right after publishing, or later from the
-- browser that published it). NULL means an anonymous share: only the key
-- held by the publishing browser can revoke it.
ALTER TABLE shared_artworks ADD COLUMN owner_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_shared_artworks_owner
  ON shared_artworks(owner_user_id, published_at)
  WHERE owner_user_id IS NOT NULL;
