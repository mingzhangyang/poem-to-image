export interface CreditAccount {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  related_order_id: string | null;
  related_request_id: string | null;
  provider: string | null;
  status: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  package_id: string;
  amount_paid_cents: number;
  currency: string;
  credits_granted: number;
  status: 'pending' | 'completed' | 'needs_review' | 'refunded';
  fulfilled_at: string | null;
  fulfillment_attempted_at: string | null;
  fulfillment_token: string | null;
  failure_reason: string | null;
  payment_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingStripeOrderInput {
  userId: string;
  stripeSessionId: string;
  packageId: string;
  amountPaidCents: number;
  currency: string;
  creditsGranted: number;
}

export type StripeFulfillmentResult =
  | { status: 'completed' | 'already_completed'; order: Order; balance: number }
  | { status: 'needs_review'; order: Order; reason: string }
  | { status: 'missing_order'; order: null; reason: string };

export interface GenerationRequest {
  id: string;
  user_id: string;
  provider: string;
  cost_credits: number;
  status: string;
  reservation_token: string | null;
  reserved_at: string | null;
}

export class DuplicateGenerationRequestError extends Error {
  constructor(public readonly requestStatus: string) {
    super('Duplicate generation request.');
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits.');
  }
}

function newId(): string {
  return crypto.randomUUID();
}

/** Ensure user + credit account exist; creates them if not. */
export async function ensureUser(db: D1Database, userId: string, email: string): Promise<void> {
  await db.batch([
    db
      .prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)')
      .bind(userId, email),
    db
      .prepare('INSERT OR IGNORE INTO credit_accounts (user_id, balance) VALUES (?, 0)')
      .bind(userId),
  ]);
}

export async function getBalance(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT balance FROM credit_accounts WHERE user_id = ?')
    .bind(userId)
    .first<{ balance: number }>();
  return row?.balance ?? 0;
}

const ORDER_COLUMNS = `
  id, user_id, stripe_session_id, stripe_payment_intent_id, package_id,
  amount_paid_cents, currency, credits_granted, status, fulfilled_at,
  fulfillment_attempted_at, fulfillment_token, failure_reason, payment_confirmed_at,
  created_at, updated_at
`;

export async function getStripeOrderBySessionId(
  db: D1Database,
  stripeSessionId: string,
): Promise<Order | null> {
  return db
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE stripe_session_id = ?`)
    .bind(stripeSessionId)
    .first<Order>();
}

export async function createPendingStripeOrder(
  db: D1Database,
  input: PendingStripeOrderInput,
): Promise<Order> {
  const orderId = newId();
  await db
    .prepare(
      `INSERT OR IGNORE INTO orders (
        id, user_id, stripe_session_id, package_id, amount_paid_cents,
        currency, credits_granted, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(
      orderId,
      input.userId,
      input.stripeSessionId,
      input.packageId,
      input.amountPaidCents,
      input.currency.toLowerCase(),
      input.creditsGranted,
    )
    .run();

  const order = await getStripeOrderBySessionId(db, input.stripeSessionId);
  if (!order) throw new Error('Failed to persist pending Stripe order.');

  const matchesSnapshot = order.user_id === input.userId
    && order.package_id === input.packageId
    && order.amount_paid_cents === input.amountPaidCents
    && order.currency.toLowerCase() === input.currency.toLowerCase()
    && order.credits_granted === input.creditsGranted;

  if (!matchesSnapshot) {
    await markStripeOrderNeedsReview(db, order.id, 'Duplicate session has a conflicting order snapshot.');
    throw new Error('Stripe session conflicts with an existing order.');
  }

  return order;
}

interface OrderTopupRow {
  id: string;
  amount: number;
  status: string;
}

async function getOrderTopup(db: D1Database, orderId: string): Promise<OrderTopupRow | null> {
  return db
    .prepare(
      `SELECT id, amount, status FROM credit_transactions
       WHERE related_order_id = ? AND type = 'topup'`,
    )
    .bind(orderId)
    .first<OrderTopupRow>();
}

export async function markStripeOrderNeedsReview(
  db: D1Database,
  orderId: string,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE orders
       SET status = 'needs_review', failure_reason = ?, fulfillment_token = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending', 'completed')`,
    )
    .bind(reason.slice(0, 500), orderId)
    .run();
}

export async function markStripeOrderPaymentConfirmed(
  db: D1Database,
  orderId: string,
  stripePaymentIntentId: string | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE orders
       SET payment_confirmed_at = COALESCE(payment_confirmed_at, CURRENT_TIMESTAMP),
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
    )
    .bind(stripePaymentIntentId, orderId)
    .run();
}

export async function recordBillingReview(
  db: D1Database,
  eventId: string,
  stripeSessionId: string | null,
  eventType: string,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO billing_events (id, stripe_session_id, event_type, status, reason)
       VALUES (?, ?, ?, 'needs_review', ?)
       ON CONFLICT(id) DO UPDATE SET
         stripe_session_id = excluded.stripe_session_id,
         event_type = excluded.event_type,
         status = 'needs_review',
         reason = excluded.reason,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(eventId, stripeSessionId, eventType, reason.slice(0, 500))
    .run();
}

/**
 * Grants the immutable order snapshot exactly once. A per-attempt claim prevents
 * concurrent batches from touching the same pending order. D1 executes batch()
 * transactionally, so SQL errors roll every statement back and leave the order
 * retryable.
 */
export async function fulfillStripeOrder(
  db: D1Database,
  stripeSessionId: string,
  stripePaymentIntentId: string | null,
): Promise<StripeFulfillmentResult> {
  let order = await getStripeOrderBySessionId(db, stripeSessionId);
  if (!order) {
    return {
      status: 'missing_order',
      order: null,
      reason: 'No pending order exists for this Stripe session.',
    };
  }

  const existingTopup = await getOrderTopup(db, order.id);
  if (order.status === 'completed') {
    if (existingTopup?.status === 'succeeded' && existingTopup.amount === order.credits_granted) {
      return { status: 'already_completed', order, balance: await getBalance(db, order.user_id) };
    }

    const reason = 'Completed order is missing its matching succeeded top-up transaction.';
    await markStripeOrderNeedsReview(db, order.id, reason);
    order = (await getStripeOrderBySessionId(db, stripeSessionId)) ?? order;
    return { status: 'needs_review', order, reason };
  }

  if (order.status === 'needs_review' || order.status === 'refunded') {
    return {
      status: 'needs_review',
      order,
      reason: order.failure_reason ?? `Order cannot be fulfilled from ${order.status} state.`,
    };
  }

  if (existingTopup) {
    const reason = 'Pending order already has a top-up transaction.';
    await markStripeOrderNeedsReview(db, order.id, reason);
    order = (await getStripeOrderBySessionId(db, stripeSessionId)) ?? order;
    return { status: 'needs_review', order, reason };
  }

  // A visible token can only come from a previously committed batch whose
  // conditional writes did not run. Clear it before making a fresh claim.
  if (order.fulfillment_token) {
    await db
      .prepare(
        `UPDATE orders SET fulfillment_token = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending' AND fulfillment_token = ?`,
      )
      .bind(order.id, order.fulfillment_token)
      .run();
  }

  const claimToken = crypto.randomUUID();
  const transactionId = crypto.randomUUID();
  const results = await db.batch([
    db
      .prepare(
        `UPDATE orders
         SET fulfillment_token = ?, fulfillment_attempted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending' AND fulfillment_token IS NULL`,
      )
      .bind(claimToken, order.id),
    db
      .prepare(
        `UPDATE credit_accounts
         SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND EXISTS (
           SELECT 1 FROM orders
           WHERE id = ? AND status = 'pending' AND fulfillment_token = ?
         )`,
      )
      .bind(order.credits_granted, order.user_id, order.id, claimToken),
    db
      .prepare(
        `INSERT INTO credit_transactions (
           id, user_id, type, amount, balance_after, related_order_id, status
         )
         SELECT ?, o.user_id, 'topup', o.credits_granted, a.balance, o.id, 'succeeded'
         FROM orders o
         JOIN credit_accounts a ON a.user_id = o.user_id
         WHERE o.id = ? AND o.status = 'pending' AND o.fulfillment_token = ?`,
      )
      .bind(transactionId, order.id, claimToken),
    db
      .prepare(
        `UPDATE orders
         SET status = 'completed', stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
             fulfilled_at = CURRENT_TIMESTAMP, failure_reason = NULL,
             fulfillment_token = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending' AND fulfillment_token = ?
           AND EXISTS (
             SELECT 1 FROM credit_transactions
             WHERE id = ? AND related_order_id = ? AND type = 'topup'
               AND status = 'succeeded'
           )`,
      )
      .bind(stripePaymentIntentId, order.id, claimToken, transactionId, order.id),
  ]);

  const changes = results.map((result) => result.meta.changes);
  if (changes.every((count) => count === 1)) {
    const completed = await getStripeOrderBySessionId(db, stripeSessionId);
    if (!completed || completed.status !== 'completed') {
      throw new Error('Stripe fulfillment committed without a completed order.');
    }
    return { status: 'completed', order: completed, balance: await getBalance(db, order.user_id) };
  }

  const current = await getStripeOrderBySessionId(db, stripeSessionId);
  const currentTopup = current ? await getOrderTopup(db, current.id) : null;
  if (
    current?.status === 'completed'
    && currentTopup?.status === 'succeeded'
    && currentTopup.amount === current.credits_granted
  ) {
    return { status: 'already_completed', order: current, balance: await getBalance(db, current.user_id) };
  }

  // A no-op batch is expected for a losing concurrent caller. If the order is
  // still pending, remove only this caller's claim so a later retry can resume.
  await db
    .prepare(
      `UPDATE orders SET fulfillment_token = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending' AND fulfillment_token = ?`,
    )
    .bind(order.id, claimToken)
    .run();

  throw new Error(`Stripe fulfillment did not commit all invariants (changes: ${changes.join(',')}).`);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface OperationalHealth {
  paidPendingOrders: number;
  reviewItems: number;
  billingInvariantFailures: number;
  staleGenerationReservations: number;
}

async function countQuery(db: D1Database, sql: string): Promise<number> {
  const row = await db.prepare(sql).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getOperationalHealth(db: D1Database): Promise<OperationalHealth> {
  const [paidPendingOrders, reviewOrders, reviewEvents, billingInvariantFailures, staleGenerationReservations] = await Promise.all([
    countQuery(
      db,
      `SELECT COUNT(*) AS count FROM orders
       WHERE status = 'pending' AND payment_confirmed_at IS NOT NULL
         AND payment_confirmed_at < datetime('now', '-15 minutes')`,
    ),
    countQuery(db, "SELECT COUNT(*) AS count FROM orders WHERE status = 'needs_review'"),
    countQuery(db, "SELECT COUNT(*) AS count FROM billing_events WHERE status = 'needs_review'"),
    countQuery(
      db,
      `SELECT COUNT(*) AS count
       FROM orders o
       LEFT JOIN credit_transactions t
         ON t.related_order_id = o.id AND t.type = 'topup'
       WHERE (o.status = 'completed' AND (
         t.id IS NULL OR t.status != 'succeeded' OR t.amount != o.credits_granted
       )) OR (o.status = 'pending' AND t.id IS NOT NULL)`,
    ),
    countQuery(
      db,
      `SELECT COUNT(*) AS count FROM generation_requests
       WHERE status = 'pending' AND reserved_at IS NOT NULL
         AND reserved_at < datetime('now', '-30 minutes')`,
    ),
  ]);

  return {
    paidPendingOrders,
    reviewItems: reviewOrders + reviewEvents,
    billingInvariantFailures,
    staleGenerationReservations,
  };
}

export async function pruneExpiredRateLimits(db: D1Database): Promise<number> {
  const result = await db
    .prepare('DELETE FROM rate_limits WHERE expires_at < ?')
    .bind(Math.floor(Date.now() / 1000))
    .run();
  return result.meta.changes;
}

export async function consumeRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
  nowMilliseconds = Date.now(),
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  const bucketStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const expiresAt = bucketStart + windowSeconds * 2;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, bucket_start, count, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(key, bucket_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, bucketStart, expiresAt)
    .first<{ count: number }>();

  const count = row?.count ?? limit + 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, bucketStart + windowSeconds - nowSeconds),
  };
}

/**
 * Reserve a pending generation: inserts generation_request + credit_transaction (both pending).
 * Returns the IDs for later finalization.
 */
export async function reserveGeneration(
  db: D1Database,
  userId: string,
  requestId: string,
  provider: string,
  promptLength: number,
  costCredits: number,
): Promise<{ requestId: string; transactionId: string; balance: number }> {
  const existing = await db
    .prepare(
      `SELECT r.user_id, r.provider, r.prompt_length, r.cost_credits, r.status,
              r.reservation_token, t.id AS transaction_id
       FROM generation_requests r
       LEFT JOIN credit_transactions t
         ON t.related_request_id = r.id AND t.type = 'generate_debit'
       WHERE r.id = ?`,
    )
    .bind(requestId)
    .first<{
      user_id: string;
      provider: string;
      prompt_length: number;
      cost_credits: number;
      status: string;
      reservation_token: string | null;
      transaction_id: string | null;
    }>();

  if (existing) {
    if (
      existing.user_id !== userId
      || existing.provider !== provider
      || existing.prompt_length !== promptLength
      || existing.cost_credits !== costCredits
    ) {
      throw new DuplicateGenerationRequestError('conflict');
    }
    if (existing.transaction_id || existing.status !== 'pending') {
      throw new DuplicateGenerationRequestError(existing.status);
    }

    // A token without a debit can only be left by an interrupted no-op claim.
    // The transactional reservation below never commits a debit without the
    // matching account update.
    if (existing.reservation_token) {
      await db
        .prepare(
          `UPDATE generation_requests SET reservation_token = NULL
           WHERE id = ? AND user_id = ? AND status = 'pending'
             AND reservation_token = ?
             AND NOT EXISTS (
               SELECT 1 FROM credit_transactions
               WHERE related_request_id = ? AND type = 'generate_debit'
             )`,
        )
        .bind(requestId, userId, existing.reservation_token, requestId)
        .run();
    }
  }

  await db
    .prepare(
      'INSERT OR IGNORE INTO generation_requests (id, user_id, provider, prompt_length, cost_credits, status) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(requestId, userId, provider, promptLength, costCredits, 'pending')
    .run();

  const claimToken = newId();
  const transactionId = newId();
  const results = await db.batch([
    db
      .prepare(
        `UPDATE generation_requests
         SET reservation_token = ?
         WHERE id = ? AND user_id = ? AND status = 'pending'
           AND reservation_token IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM credit_transactions
             WHERE related_request_id = ? AND type = 'generate_debit'
           )`,
      )
      .bind(claimToken, requestId, userId, requestId),
    db
      .prepare(
        `INSERT INTO credit_transactions (
           id, user_id, type, amount, balance_after, related_request_id, provider, status
         )
         SELECT ?, r.user_id, 'generate_debit', -r.cost_credits,
                a.balance - r.cost_credits, r.id, r.provider, 'pending'
         FROM generation_requests r
         JOIN credit_accounts a ON a.user_id = r.user_id
         WHERE r.id = ? AND r.user_id = ? AND r.status = 'pending'
           AND r.reservation_token = ? AND a.balance >= r.cost_credits`,
      )
      .bind(transactionId, requestId, userId, claimToken),
    db
      .prepare(
        `UPDATE credit_accounts
         SET balance = balance + (
           SELECT amount FROM credit_transactions
           WHERE id = ? AND related_request_id = ? AND user_id = ?
             AND type = 'generate_debit' AND status = 'pending'
         ), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND EXISTS (
           SELECT 1 FROM credit_transactions
           WHERE id = ? AND related_request_id = ? AND type = 'generate_debit'
             AND status = 'pending'
         )`,
      )
      .bind(transactionId, requestId, userId, userId, transactionId, requestId),
    db
      .prepare(
        `UPDATE generation_requests
         SET reservation_token = NULL, reserved_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND reservation_token = ?
           AND EXISTS (
             SELECT 1 FROM credit_transactions
             WHERE id = ? AND related_request_id = ? AND type = 'generate_debit'
               AND status = 'pending'
           )`,
      )
      .bind(requestId, userId, claimToken, transactionId, requestId),
  ]);

  if (results.every((result) => result.meta.changes === 1)) {
    return { requestId, transactionId, balance: await getBalance(db, userId) };
  }

  const current = await db
    .prepare(
      `SELECT r.user_id, r.status, a.balance, t.id AS transaction_id
       FROM generation_requests r
       JOIN credit_accounts a ON a.user_id = r.user_id
       LEFT JOIN credit_transactions t
         ON t.related_request_id = r.id AND t.type = 'generate_debit'
       WHERE r.id = ?`,
    )
    .bind(requestId)
    .first<{ user_id: string; status: string; balance: number; transaction_id: string | null }>();

  if (current?.transaction_id) {
    throw new DuplicateGenerationRequestError(current.user_id === userId ? current.status : 'conflict');
  }

  await db
    .prepare(
      `UPDATE generation_requests
       SET status = 'failed', error_message = 'Insufficient credits.',
           reservation_token = NULL, completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND status = 'pending'
         AND reservation_token = ?
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions
           WHERE related_request_id = ? AND type = 'generate_debit'
         )`,
    )
    .bind(requestId, userId, claimToken, requestId)
    .run();

  throw new InsufficientCreditsError();
}

/**
 * Finalize a successful generation. Credits were already deducted at reservation
 * time, so this only marks the generation request and its debit transaction as
 * succeeded. Returns the current balance.
 */
export async function finalizeGenerationSuccess(
  db: D1Database,
  userId: string,
  requestId: string,
  transactionId: string,
): Promise<number> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE generation_requests SET status = 'succeeded', completed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND status = 'pending'
           AND EXISTS (
             SELECT 1 FROM credit_transactions
             WHERE id = ? AND related_request_id = ? AND user_id = ?
               AND type = 'generate_debit' AND status = 'pending'
           )`,
      )
      .bind(requestId, userId, transactionId, requestId, userId),
    db
      .prepare(
        `UPDATE credit_transactions
         SET status = 'succeeded',
             balance_after = (SELECT balance FROM credit_accounts WHERE user_id = ?)
         WHERE id = ? AND related_request_id = ? AND user_id = ?
           AND type = 'generate_debit' AND status = 'pending'
           AND EXISTS (
             SELECT 1 FROM generation_requests
             WHERE id = ? AND user_id = ? AND status = 'succeeded'
           )`,
      )
      .bind(userId, transactionId, requestId, userId, requestId, userId),
  ]);

  if (results.every((result) => result.meta.changes === 1)) {
    return getBalance(db, userId);
  }

  const current = await db
    .prepare(
      `SELECT r.status AS request_status, t.status AS transaction_status
       FROM generation_requests r
       LEFT JOIN credit_transactions t ON t.id = ? AND t.related_request_id = r.id
       WHERE r.id = ? AND r.user_id = ?`,
    )
    .bind(transactionId, requestId, userId)
    .first<{ request_status: string; transaction_status: string | null }>();

  if (current?.request_status === 'succeeded' && current.transaction_status === 'succeeded') {
    return getBalance(db, userId);
  }
  throw new Error('Generation success could not be finalized from its current state.');
}

/** Finalize failed generation: mark both records failed, no balance change. */
export async function finalizeGenerationFailure(
  db: D1Database,
  userId: string,
  requestId: string,
  transactionId: string,
  errorMessage: string,
): Promise<void> {
  // Both statements are conditional and batched so a retry can never refund a
  // succeeded request or restore the same reservation twice.
  const results = await db.batch([
    db
      .prepare(
        `UPDATE credit_accounts
         SET balance = balance - (
           SELECT amount FROM credit_transactions
           WHERE id = ? AND related_request_id = ? AND user_id = ?
             AND type = 'generate_debit' AND status = 'pending' AND amount < 0
         ), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND EXISTS (
           SELECT 1 FROM generation_requests r
           JOIN credit_transactions t ON t.related_request_id = r.id
           WHERE r.id = ? AND r.user_id = ? AND r.status = 'pending'
             AND t.id = ? AND t.user_id = ? AND t.type = 'generate_debit'
             AND t.status = 'pending' AND t.amount < 0
         )`,
      )
      .bind(
        transactionId,
        requestId,
        userId,
        userId,
        requestId,
        userId,
        transactionId,
        userId,
      ),
    db
      .prepare(
        `UPDATE credit_transactions
         SET status = 'failed',
             balance_after = (SELECT balance FROM credit_accounts WHERE user_id = ?)
         WHERE id = ? AND related_request_id = ? AND user_id = ?
           AND type = 'generate_debit' AND status = 'pending'
           AND EXISTS (
             SELECT 1 FROM generation_requests
             WHERE id = ? AND user_id = ? AND status = 'pending'
           )`,
      )
      .bind(userId, transactionId, requestId, userId, requestId, userId),
    db
      .prepare(
        `UPDATE generation_requests
         SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND status = 'pending'
           AND EXISTS (
             SELECT 1 FROM credit_transactions
             WHERE id = ? AND related_request_id = ? AND user_id = ?
               AND type = 'generate_debit' AND status = 'failed'
           )`,
      )
      .bind(errorMessage.slice(0, 500), requestId, userId, transactionId, requestId, userId),
  ]);

  if (results.every((result) => result.meta.changes === 1)) {
    return;
  }

  const current = await db
    .prepare(
      `SELECT r.status AS request_status, t.status AS transaction_status
       FROM generation_requests r
       LEFT JOIN credit_transactions t ON t.id = ? AND t.related_request_id = r.id
       WHERE r.id = ? AND r.user_id = ?`,
    )
    .bind(transactionId, requestId, userId)
    .first<{ request_status: string; transaction_status: string | null }>();

  if (
    (current?.request_status === 'failed' && current.transaction_status === 'failed')
    || (current?.request_status === 'succeeded' && current.transaction_status === 'succeeded')
  ) {
    return;
  }

  throw new Error('Generation failure could not be finalized from its current state.');
}

const MAX_CUSTOM_TEMPLATES = 50;

export interface CloudTemplateRow {
  id: string;
  user_id: string;
  name: string;
  data: string; // JSON
  created_at: string;
}

export async function listUserTemplates(db: D1Database, userId: string): Promise<CloudTemplateRow[]> {
  const result = await db
    .prepare('SELECT id, user_id, name, data, created_at FROM custom_templates WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(userId, MAX_CUSTOM_TEMPLATES)
    .all<CloudTemplateRow>();
  return result.results;
}

export async function createUserTemplate(
  db: D1Database,
  userId: string,
  name: string,
  data: string,
): Promise<CloudTemplateRow> {
  const count = await db
    .prepare('SELECT COUNT(*) as n FROM custom_templates WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number }>();

  if ((count?.n ?? 0) >= MAX_CUSTOM_TEMPLATES) {
    throw new Error('Template limit reached.');
  }

  const id = newId();
  await db
    .prepare('INSERT INTO custom_templates (id, user_id, name, data) VALUES (?, ?, ?, ?)')
    .bind(id, userId, name, data)
    .run();

  const row = await db
    .prepare('SELECT id, user_id, name, data, created_at FROM custom_templates WHERE id = ?')
    .bind(id)
    .first<CloudTemplateRow>();

  if (!row) throw new Error('Failed to retrieve created template.');
  return row;
}

export async function deleteUserTemplate(
  db: D1Database,
  userId: string,
  templateId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM custom_templates WHERE id = ? AND user_id = ?')
    .bind(templateId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function renameUserTemplate(
  db: D1Database,
  userId: string,
  templateId: string,
  name: string,
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE custom_templates SET name = ? WHERE id = ? AND user_id = ?')
    .bind(name, templateId, userId)
    .run();
  return result.meta.changes > 0;
}

export interface TransactionHistoryItem {
  id: string;
  type: string;
  amount: number;
  status: string;
  provider: string | null;
  created_at: string;
}

/** Returns only succeeded transactions — pending/failed are internal bookkeeping. */
export async function getTransactionHistory(
  db: D1Database,
  userId: string,
  limit = 20,
): Promise<TransactionHistoryItem[]> {
  const result = await db
    .prepare(
      'SELECT id, type, amount, status, provider, created_at FROM credit_transactions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?',
    )
    .bind(userId, 'succeeded', limit)
    .all<TransactionHistoryItem>();
  return result.results;
}
