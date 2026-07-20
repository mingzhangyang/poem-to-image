-- Make generation-credit reservations atomic and retry-safe.
ALTER TABLE generation_requests ADD COLUMN reservation_token TEXT;
ALTER TABLE generation_requests ADD COLUMN reserved_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_one_debit_per_request
  ON credit_transactions(related_request_id)
  WHERE related_request_id IS NOT NULL AND type = 'generate_debit';

CREATE INDEX IF NOT EXISTS idx_generation_requests_reconciliation
  ON generation_requests(status, created_at);
