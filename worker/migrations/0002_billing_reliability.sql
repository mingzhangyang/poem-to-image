-- Recoverable Stripe fulfillment and lightweight abuse controls.
ALTER TABLE orders ADD COLUMN fulfilled_at TEXT;
ALTER TABLE orders ADD COLUMN fulfillment_attempted_at TEXT;
ALTER TABLE orders ADD COLUMN fulfillment_token TEXT;
ALTER TABLE orders ADD COLUMN failure_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_one_topup_per_order
  ON credit_transactions(related_order_id)
  WHERE related_order_id IS NOT NULL AND type = 'topup';

CREATE INDEX IF NOT EXISTS idx_orders_reconciliation
  ON orders(status, created_at);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_events_reconciliation
  ON billing_events(status, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
