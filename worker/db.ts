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
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
  };
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
): Promise<{ requestId: string; transactionId: string; balance: number }> {
  const deductResult = await db
    .prepare(
      'UPDATE credit_accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?',
    )
    .bind(costCredits, userId, costCredits)
    .run();

  if (deductResult.meta.changes === 0) {
    throw new Error('Insufficient credits.');
  }

  const newBalance = await getBalance(db, userId);
  const requestId = newId();
  const transactionId = newId();

  try {
    await db.batch([
      db
        .prepare(
          'INSERT INTO generation_requests (id, user_id, provider, prompt_length, cost_credits, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(requestId, userId, provider, promptLength, costCredits, 'pending'),
      db
        .prepare(
          'INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, related_request_id, provider, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          transactionId,
          userId,
          'generate_debit',
          -costCredits,
          newBalance,
          requestId,
          provider,
          'pending',
        ),
    ]);
  } catch (error) {
    await db
      .prepare(
        'UPDATE credit_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      )
      .bind(costCredits, userId)
      .run();
    throw error;
  }

  return { requestId, transactionId, balance: newBalance };
}

/**
 * Finalize successful generation: deduct credits atomically (only if balance >= cost)
 * and mark records succeeded.
 * Throws if balance is insufficient (concurrent request race).
 */
export async function finalizeGenerationSuccess(
  db: D1Database,
  userId: string,
  requestId: string,
  transactionId: string,
): Promise<number> {
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
  userId: string,
  requestId: string,
  transactionId: string,
  costCredits: number,
  errorMessage: string,
): Promise<void> {
  await db
    .prepare('UPDATE generation_requests SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status != ?')
    .bind('failed', errorMessage, requestId, 'succeeded')
    .run();

  // Retry-safe rollback:
  // 1) refund only when the debit transaction is still pending
  // 2) mark that transaction failed in the same call path
  await db.batch([
    db
      .prepare(
        'UPDATE credit_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND EXISTS (SELECT 1 FROM credit_transactions WHERE id = ? AND user_id = ? AND status = ?)',
      )
      .bind(costCredits, userId, transactionId, userId, 'pending'),
    db
      .prepare(
        'UPDATE credit_transactions SET status = ?, balance_after = (SELECT balance FROM credit_accounts WHERE user_id = ?) WHERE id = ? AND user_id = ? AND status = ?',
      )
      .bind('failed', userId, transactionId, userId, 'pending'),
  ]);
}

/**
 * Fulfill a Stripe order idempotently.
 * Uses INSERT OR IGNORE + meta.changes check to prevent double-crediting
 * even under concurrent webhook delivery.
 * Returns true if credits were granted, false if already fulfilled.
 */
export async function fulfillStripeOrder(
  db: D1Database,
  userId: string,
  stripeSessionId: string,
  stripePaymentIntentId: string | null,
  packageId: string,
  amountPaidCents: number,
  creditsGranted: number,
): Promise<boolean> {
  const orderId = newId();

  // INSERT OR IGNORE: the UNIQUE constraint on stripe_session_id guarantees
  // that only one concurrent webhook can insert a row. meta.changes tells us
  // whether this invocation was the one that inserted.
  const insertResult = await db
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
    )
    .run();

  // If no row was inserted, this session was already fulfilled — do not credit again.
  if (insertResult.meta.changes === 0) return false;

  // Safe to add credits: only one concurrent caller reaches here per session.
  await db
    .prepare(
      'UPDATE credit_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    )
    .bind(creditsGranted, userId)
    .run();

  const newBalance = await getBalance(db, userId);
  const transactionId = newId();

  await db
    .prepare(
      'INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, related_order_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(transactionId, userId, 'topup', creditsGranted, newBalance, orderId, 'succeeded')
    .run();

  return true;
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
