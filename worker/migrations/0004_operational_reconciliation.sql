-- Record payment confirmation separately from credit fulfillment so a paid,
-- interrupted order is visible to scheduled reconciliation.
ALTER TABLE orders ADD COLUMN payment_confirmed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_paid_pending
  ON orders(status, payment_confirmed_at);
