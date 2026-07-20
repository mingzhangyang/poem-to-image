import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPendingStripeOrder,
  ensureUser,
  getOperationalHealth,
  markStripeOrderPaymentConfirmed,
  pruneExpiredRateLimits,
  recordBillingReview,
} from '../../worker/db';

const USER_ID = 'user_maintenance_test';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM rate_limits'),
    env.DB.prepare('DELETE FROM billing_events'),
    env.DB.prepare('DELETE FROM credit_transactions'),
    env.DB.prepare('DELETE FROM orders'),
    env.DB.prepare('DELETE FROM generation_requests'),
    env.DB.prepare('DELETE FROM credit_accounts'),
    env.DB.prepare('DELETE FROM users'),
  ]);
  await ensureUser(env.DB, USER_ID, 'maintenance@example.test');
});

describe('scheduled operational reconciliation', () => {
  it('surfaces paid pending orders and durable review items', async () => {
    const order = await createPendingStripeOrder(env.DB, {
      userId: USER_ID,
      stripeSessionId: 'cs_maintenance',
      packageId: 'starter_20',
      amountPaidCents: 199,
      currency: 'usd',
      creditsGranted: 20,
    });
    await markStripeOrderPaymentConfirmed(env.DB, order.id, 'pi_maintenance');
    await env.DB
      .prepare("UPDATE orders SET payment_confirmed_at = datetime('now', '-20 minutes') WHERE id = ?")
      .bind(order.id)
      .run();
    await recordBillingReview(env.DB, 'evt_maintenance', order.stripe_session_id, 'checkout.status', 'test review');

    const health = await getOperationalHealth(env.DB);
    expect(health.paidPendingOrders).toBe(1);
    expect(health.reviewItems).toBe(1);
    expect(health.billingInvariantFailures).toBe(0);
  });

  it('detects completed orders without a matching top-up ledger row', async () => {
    const order = await createPendingStripeOrder(env.DB, {
      userId: USER_ID,
      stripeSessionId: 'cs_invariant',
      packageId: 'starter_20',
      amountPaidCents: 199,
      currency: 'usd',
      creditsGranted: 20,
    });
    await env.DB.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").bind(order.id).run();

    expect((await getOperationalHealth(env.DB)).billingInvariantFailures).toBe(1);
  });

  it('prunes only expired rate-limit buckets', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO rate_limits (key, bucket_start, count, expires_at) VALUES (?, ?, ?, ?)')
        .bind('expired', now - 100, 1, now - 1),
      env.DB.prepare('INSERT INTO rate_limits (key, bucket_start, count, expires_at) VALUES (?, ?, ?, ?)')
        .bind('active', now, 1, now + 100),
    ]);

    expect(await pruneExpiredRateLimits(env.DB)).toBe(1);
    const remaining = await env.DB.prepare('SELECT key FROM rate_limits').first<{ key: string }>();
    expect(remaining?.key).toBe('active');
  });
});
