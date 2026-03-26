import assert from 'node:assert/strict';
import test from 'node:test';
import { PACKAGES, validateFulfillmentSession } from '../../worker/billing';

test('validateFulfillmentSession accepts a package with matching amount and currency', () => {
  const pkg = PACKAGES[0];
  const result = validateFulfillmentSession({
    id: 'cs_test_1',
    amount_total: pkg.priceCents,
    currency: pkg.currency,
    metadata: {
      packageId: pkg.id,
      creditsGranted: '999999',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    // credits are derived from server package config, not metadata.
    assert.equal(result.pkg.credits, pkg.credits);
  }
});

test('validateFulfillmentSession rejects unknown package IDs', () => {
  const result = validateFulfillmentSession({
    id: 'cs_test_2',
    amount_total: 199,
    currency: 'usd',
    metadata: { packageId: 'does_not_exist' },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Unknown package/i);
  }
});

test('validateFulfillmentSession rejects amount mismatches', () => {
  const pkg = PACKAGES[1];
  const result = validateFulfillmentSession({
    id: 'cs_test_3',
    amount_total: pkg.priceCents + 1,
    currency: pkg.currency,
    metadata: { packageId: pkg.id },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /amount/i);
  }
});

test('validateFulfillmentSession rejects currency mismatches', () => {
  const pkg = PACKAGES[2];
  const result = validateFulfillmentSession({
    id: 'cs_test_4',
    amount_total: pkg.priceCents,
    currency: 'eur',
    metadata: { packageId: pkg.id },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /currency/i);
  }
});
