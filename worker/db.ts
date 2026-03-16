// Minimal D1 interfaces (provided by CF Workers runtime)
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
}

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
  package_id: string;
  credits_granted: number;
  status: string;
}

export interface GenerationRequest {
  id: string;
  user_id: string;
  provider: string;
  cost_credits: number;
  status: string;
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

/**
 * Reserve a pending generation: inserts generation_request + credit_transaction (both pending).
 * Returns the IDs for later finalization.
 */
export async function reserveGeneration(
  db: D1Database,
  userId: string,
  provider: string,
  promptLength: number,
  costCredits: number,
): Promise<{ requestId: string; transactionId: string }> {
  const requestId = newId();
  const transactionId = newId();

  await db.batch([
    db
      .prepare(
        'INSERT INTO generation_requests (id, user_id, provider, prompt_length, cost_credits, status) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(requestId, userId, provider, promptLength, costCredits, 'pending'),
    db
      .prepare(
        'INSERT INTO credit_transactions (id, user_id, type, amount, related_request_id, provider, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(transactionId, userId, 'generate_debit', -costCredits, requestId, provider, 'pending'),
  ]);

  return { requestId, transactionId };
}

/** Finalize successful generation: deduct credits and mark records succeeded. */
export async function finalizeGenerationSuccess(
  db: D1Database,
  userId: string,
  requestId: string,
  transactionId: string,
  costCredits: number,
): Promise<number> {
  // Deduct and get new balance
  await db
    .prepare(
      'UPDATE credit_accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    )
    .bind(costCredits, userId)
    .run();

  const newBalance = await getBalance(db, userId);

  await db.batch([
    db
      .prepare('UPDATE generation_requests SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind('succeeded', requestId),
    db
      .prepare('UPDATE credit_transactions SET status = ?, balance_after = ? WHERE id = ?')
      .bind('succeeded', newBalance, transactionId),
  ]);

  return newBalance;
}

/** Finalize failed generation: mark both records failed, no balance change. */
export async function finalizeGenerationFailure(
  db: D1Database,
  requestId: string,
  transactionId: string,
  errorMessage: string,
): Promise<void> {
  await db.batch([
    db
      .prepare('UPDATE generation_requests SET status = ?, error_message = ? WHERE id = ?')
      .bind('failed', errorMessage, requestId),
    db
      .prepare('UPDATE credit_transactions SET status = ? WHERE id = ?')
      .bind('failed', transactionId),
  ]);
}

/** Check if a requestId has already been processed (for idempotency). */
export async function isRequestAlreadyProcessed(
  db: D1Database,
  requestId: string,
): Promise<{ processed: boolean; imageDataUrl?: string }> {
  const row = await db
    .prepare('SELECT status FROM generation_requests WHERE id = ?')
    .bind(requestId)
    .first<{ status: string }>();

  if (!row) return { processed: false };
  if (row.status === 'succeeded') return { processed: true };
  if (row.status === 'failed') return { processed: true };

  return { processed: false };
}

/** Create order and credit account for Stripe checkout (idempotent by stripe_session_id). */
export async function fulfillStripeOrder(
  db: D1Database,
  userId: string,
  stripeSessionId: string,
  stripePaymentIntentId: string | null,
  packageId: string,
  amountPaidCents: number,
  creditsGranted: number,
): Promise<boolean> {
  // Check if already fulfilled
  const existing = await db
    .prepare('SELECT id FROM orders WHERE stripe_session_id = ? AND status = ?')
    .bind(stripeSessionId, 'completed')
    .first<{ id: string }>();

  if (existing) return false; // Already fulfilled

  const orderId = newId();
  const transactionId = newId();

  // Add credits and record order + transaction
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO orders (id, user_id, stripe_session_id, stripe_payment_intent_id, package_id, amount_paid_cents, credits_granted, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        orderId,
        userId,
        stripeSessionId,
        stripePaymentIntentId,
        packageId,
        amountPaidCents,
        creditsGranted,
        'completed',
      ),
    db
      .prepare(
        'UPDATE credit_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      )
      .bind(creditsGranted, userId),
  ]);

  const newBalance = await getBalance(db, userId);

  await db
    .prepare(
      'INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, related_order_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(transactionId, userId, 'topup', creditsGranted, newBalance, orderId, 'succeeded')
    .run();

  return true;
}

export interface TransactionHistoryItem {
  id: string;
  type: string;
  amount: number;
  status: string;
  provider: string | null;
  created_at: string;
}

export async function getTransactionHistory(
  db: D1Database,
  userId: string,
  limit = 20,
): Promise<TransactionHistoryItem[]> {
  const result = await db
    .prepare(
      'SELECT id, type, amount, status, provider, created_at FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .bind(userId, limit)
    .all<TransactionHistoryItem>();
  return result.results;
}
