import assert from 'node:assert/strict';
import test from 'node:test';
import { templateReadReconciliationStatus } from '../../src/templateReadReconciliation';

test('uncertain mutations retain independent GET reconciliation outcomes', () => {
  assert.equal(templateReadReconciliationStatus(true, 'checking'), 'checking');
  assert.equal(templateReadReconciliationStatus(true, 'refreshed'), 'refreshed');
  assert.equal(templateReadReconciliationStatus(true, 'failed'), 'failed');
});

test('ordinary template loads do not masquerade as mutation reconciliation', () => {
  assert.equal(templateReadReconciliationStatus(false, 'checking'), 'idle');
  assert.equal(templateReadReconciliationStatus(false, 'refreshed'), 'idle');
  assert.equal(templateReadReconciliationStatus(false, 'failed'), 'idle');
});
