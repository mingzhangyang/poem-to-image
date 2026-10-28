CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_accounts (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  package_id TEXT NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  credits_granted INTEGER NOT NULL,
  status TEXT NOT NULL,
  fulfilled_at TEXT,
  fulfillment_attempted_at TEXT,
  fulfillment_token TEXT,
  failure_reason TEXT,
  payment_confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  related_order_id TEXT,
  related_request_id TEXT,
  provider TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS generation_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_length INTEGER NOT NULL,
  cost_credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  reservation_token TEXT,
  reserved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS custom_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  image_key TEXT NOT NULL UNIQUE,
  image_type TEXT NOT NULL,
  card_key TEXT NOT NULL UNIQUE,
  delete_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  assets_deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_requests_user_id ON generation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_requests_reconciliation ON generation_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_templates_user_id ON custom_templates(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_one_topup_per_order
  ON credit_transactions(related_order_id)
  WHERE related_order_id IS NOT NULL AND type = 'topup';
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_one_debit_per_request
  ON credit_transactions(related_request_id)
  WHERE related_request_id IS NOT NULL AND type = 'generate_debit';
CREATE INDEX IF NOT EXISTS idx_orders_reconciliation ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_paid_pending ON orders(status, payment_confirmed_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_reconciliation ON billing_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_artworks_created ON shared_artworks(created_at);
