-- Paid sessions that have not received credits after the retry window.
SELECT id, stripe_session_id, user_id, package_id, credits_granted,
       status, payment_confirmed_at, fulfillment_attempted_at, failure_reason
FROM orders
WHERE status = 'pending'
  AND payment_confirmed_at IS NOT NULL
  AND payment_confirmed_at < datetime('now', '-15 minutes')
ORDER BY payment_confirmed_at;

-- Orders and verified Stripe events that require an operator decision.
SELECT 'order' AS source, id, stripe_session_id, status, failure_reason AS reason, updated_at
FROM orders
WHERE status = 'needs_review'
UNION ALL
SELECT 'event' AS source, id, stripe_session_id, status, reason, updated_at
FROM billing_events
WHERE status = 'needs_review'
ORDER BY updated_at;

-- Order/ledger invariants. This result must be empty before and after release.
SELECT o.id, o.stripe_session_id, o.status, o.credits_granted,
       t.id AS transaction_id, t.amount AS transaction_amount,
       t.status AS transaction_status
FROM orders o
LEFT JOIN credit_transactions t
  ON t.related_order_id = o.id AND t.type = 'topup'
WHERE (o.status = 'completed' AND (
  t.id IS NULL OR t.status != 'succeeded' OR t.amount != o.credits_granted
)) OR (o.status = 'pending' AND t.id IS NOT NULL)
ORDER BY o.updated_at;

-- Provider requests that retained a reservation beyond the normal call window.
SELECT id, user_id, provider, cost_credits, status, reserved_at, created_at
FROM generation_requests
WHERE status = 'pending'
  AND reserved_at IS NOT NULL
  AND reserved_at < datetime('now', '-30 minutes')
ORDER BY reserved_at;
