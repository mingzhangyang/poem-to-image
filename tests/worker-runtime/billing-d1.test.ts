import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateFulfillmentSession } from '../../worker/billing';
import {
  createPendingStripeOrder,
  ensureUser,
  fulfillStripeOrder,
  getBalance,
  getStripeOrderBySessionId,
  recordBillingReview,
  type Order,
} from '../../worker/db';

const USER_ID = 'user_billing_test';
const SESSION_ID = 'cs_test_billing';

async function resetBillingData(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM billing_events'),
    env.DB.prepare('DELETE FROM credit_transactions'),
    env.DB.prepare('DELETE FROM orders'),
    env.DB.prepare('DELETE FROM credit_accounts'),
    env.DB.prepare('DELETE FROM users'),
  ]);
}

async function createOrder(
  overrides: Partial<Parameters<typeof createPendingStripeOrder>[1]> = {},
): Promise<Order> {
  const userId = overrides.userId ?? USER_ID;
  await ensureUser(env.DB, userId, 'billing@example.test');
  return createPendingStripeOrder(env.DB, {
    userId,
    stripeSessionId: SESSION_ID,
    packageId: 'starter_20',
    amountPaidCents: 199,
    currency: 'usd',
    creditsGranted: 20,
    ...overrides,
  });
}

async function topupCount(orderId: string): Promise<number> {
  const row = await env.DB
    .prepare("SELECT COUNT(*) AS count FROM credit_transactions WHERE related_order_id = ? AND type = 'topup'")
    .bind(orderId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

beforeEach(resetBillingData);

describe('Stripe fulfillment against D1', () => {
  it('grants the snapshotted credits exactly once under replay', async () => {
    const order = await createOrder();

    const first = await fulfillStripeOrder(env.DB, SESSION_ID, 'pi_test');
    const replay = await fulfillStripeOrder(env.DB, SESSION_ID, 'pi_test');

    expect(first.status).toBe('completed');
    expect(replay.status).toBe('already_completed');
    expect(await getBalance(env.DB, USER_ID)).toBe(20);
    expect(await topupCount(order.id)).toBe(1);
  });

  it('grants once when twenty fulfillment attempts race', async () => {
    const order = await createOrder();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => fulfillStripeOrder(env.DB, SESSION_ID, 'pi_race')),
    );

    expect(results.filter((result) => result.status === 'completed')).toHaveLength(1);
    expect(results.every((result) => (
      result.status === 'completed' || result.status === 'already_completed'
    ))).toBe(true);
    expect(await getBalance(env.DB, USER_ID)).toBe(20);
    expect(await topupCount(order.id)).toBe(1);
  });

  it('rolls the whole batch back on an injected ledger failure and then retries', async () => {
    const order = await createOrder();
    await env.DB
      .prepare(`
        CREATE TRIGGER fail_test_topup
        BEFORE INSERT ON credit_transactions
        WHEN NEW.type = 'topup'
        BEGIN
          SELECT RAISE(ABORT, 'injected topup failure');
        END
      `)
      .run();

    await expect(fulfillStripeOrder(env.DB, SESSION_ID, 'pi_failure')).rejects.toThrow();
    expect(await getBalance(env.DB, USER_ID)).toBe(0);
    expect((await getStripeOrderBySessionId(env.DB, SESSION_ID))?.status).toBe('pending');
    expect(await topupCount(order.id)).toBe(0);

    await env.DB.prepare('DROP TRIGGER fail_test_topup').run();
    const retry = await fulfillStripeOrder(env.DB, SESSION_ID, 'pi_failure');
    expect(retry.status).toBe('completed');
    expect(await getBalance(env.DB, USER_ID)).toBe(20);
  });

  it('resumes a pending order left with an interrupted claim token', async () => {
    await createOrder();
    await env.DB
      .prepare("UPDATE orders SET fulfillment_token = 'stale-token' WHERE stripe_session_id = ?")
      .bind(SESSION_ID)
      .run();

    const result = await fulfillStripeOrder(env.DB, SESSION_ID, 'pi_resume');
    expect(result.status).toBe('completed');
    expect(await getBalance(env.DB, USER_ID)).toBe(20);
  });

  it('uses the stored purchase snapshot even when package configuration changes', async () => {
    const order = await createOrder({ creditsGranted: 17, amountPaidCents: 250 });
    const result = await fulfillStripeOrder(env.DB, SESSION_ID, 'pi_snapshot');

    expect(result.status).toBe('completed');
    expect(await getBalance(env.DB, USER_ID)).toBe(17);
    const transaction = await env.DB
      .prepare('SELECT amount FROM credit_transactions WHERE related_order_id = ?')
      .bind(order.id)
      .first<{ amount: number }>();
    expect(transaction?.amount).toBe(17);
  });

  it('keeps completed orders readable with the additive schema', async () => {
    const order = await createOrder();
    await fulfillStripeOrder(env.DB, SESSION_ID, 'pi_existing');

    const stored = await getStripeOrderBySessionId(env.DB, SESSION_ID);
    expect(stored).toMatchObject({
      id: order.id,
      user_id: USER_ID,
      status: 'completed',
      credits_granted: 20,
      stripe_payment_intent_id: 'pi_existing',
    });
  });

  it('detects immutable session mismatches and keeps them queryable', async () => {
    const order = await createOrder();
    const validation = validateFulfillmentSession(order, {
      id: SESSION_ID,
      amount_total: 200,
      currency: 'usd',
      metadata: { userId: USER_ID, packageId: 'starter_20' },
    });
    expect(validation.ok).toBe(false);

    await recordBillingReview(env.DB, 'evt_mismatch', SESSION_ID, 'checkout.session.completed', 'Amount mismatch.');
    const review = await env.DB
      .prepare('SELECT status, reason FROM billing_events WHERE id = ?')
      .bind('evt_mismatch')
      .first<{ status: string; reason: string }>();
    expect(review).toEqual({ status: 'needs_review', reason: 'Amount mismatch.' });
  });
});
