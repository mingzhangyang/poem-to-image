-- Run before applying the reliability migrations to an existing database.
-- Both result sets must be empty because migrations 0002 and 0003 add the
-- corresponding unique indexes.

SELECT related_order_id, COUNT(*) AS topup_count
FROM credit_transactions
WHERE related_order_id IS NOT NULL
  AND type = 'topup'
GROUP BY related_order_id
HAVING COUNT(*) > 1;

SELECT related_request_id, COUNT(*) AS debit_count
FROM credit_transactions
WHERE related_request_id IS NOT NULL
  AND type = 'generate_debit'
GROUP BY related_request_id
HAVING COUNT(*) > 1;
