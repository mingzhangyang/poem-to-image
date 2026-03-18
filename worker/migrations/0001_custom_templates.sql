-- Migration: add custom_templates table for cloud-synced user templates
CREATE TABLE IF NOT EXISTS custom_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_custom_templates_user_id ON custom_templates(user_id);
