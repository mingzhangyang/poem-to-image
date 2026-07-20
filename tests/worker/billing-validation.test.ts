import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFulfillmentSession, type StripeCheckoutSession } from '../../worker/billing';
import type { Order } from '../../worker/db';

const order: Order = {
  id: 'order_1',
  user_id: 'user_1',
  stripe_session_id: 'cs_test_1',
  stripe_payment_intent_id: null,
  package_id: 'starter_20',
  amount_paid_cents: 199,
  currency: 'usd',
  credits_granted: 20,
  status: 'pending',
  fulfilled_at: null,
  fulfillment_attempted_at: null,
  fulfillment_token: null,
  failure_reason: null,
  payment_confirmed_at: null,
  created_at: '2026-07-20 00:00:00',
  updated_at: '2026-07-20 00:00:00',
};

function session(overrides: Partial<StripeCheckoutSession> = {}): StripeCheckoutSession {
  return {
    id: order.stripe_session_id,
    amount_total: order.amount_paid_cents,
    currency: order.currency,
    metadata: { userId: order.user_id, packageId: order.package_id },
    ...overrides,
  };
}

test('validateFulfillmentSession accepts the immutable stored order snapshot', () => {
  assert.deepEqual(validateFulfillmentSession(order, session()), { ok: true });
});

test('validateFulfillmentSession ignores credits metadata and trusts the order snapshot', () => {
  const value = session({ metadata: {
    userId: order.user_id,
    packageId: order.package_id,
    creditsGranted: '999999',
  } });
  assert.deepEqual(validateFulfillmentSession(order, value), { ok: true });
});

test('validateFulfillmentSession rejects session, user, package, amount, and currency mismatches', () => {
  const mismatches: StripeCheckoutSession[] = [
    session({ id: 'cs_other' }),
    session({ metadata: { userId: 'user_other', packageId: order.package_id } }),
    session({ metadata: { userId: order.user_id, packageId: 'other_package' } }),
    session({ amount_total: order.amount_paid_cents + 1 }),
    session({ currency: 'eur' }),
  ];

  for (const value of mismatches) {
    const result = validateFulfillmentSession(order, value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.length > 0);
  }
});
