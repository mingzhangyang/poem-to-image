import assert from 'node:assert/strict';
import test from 'node:test';
import { blockingFindings, DEV_ONLY_AUDIT_EXCEPTIONS } from '../../scripts/audit-full-policy.ts';

const picomatch = {
  severity: 'high',
  via: [{
    source: 1247710,
    name: 'picomatch',
    title: 'picomatch ReDoS',
    url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
    severity: 'high',
    range: '<=4.0.7',
  }],
};

const report = {
  vulnerabilities: {
    picomatch,
    fdir: { severity: 'high', via: ['picomatch'] },
    tinyglobby: { severity: 'high', via: ['fdir', 'picomatch'] },
    vite: { severity: 'high', via: ['picomatch', 'tinyglobby'] },
    minimatch: {
      severity: 'moderate',
      via: [{
        url: 'https://github.com/advisories/GHSA-g3hv-75wg-m249',
        severity: 'moderate',
      }],
    },
    '@typescript-eslint/typescript-estree': {
      severity: 'high',
      via: ['minimatch', 'tinyglobby'],
    },
  },
};

test('the current picomatch advisory is the only accepted dev-only exception', () => {
  assert.deepEqual(DEV_ONLY_AUDIT_EXCEPTIONS.map((entry) => entry.id), ['GHSA-fc5q-39xc-vjpf']);
  const result = blockingFindings(report, { today: '2026-11-17' });
  assert.deepEqual(result.blocking, []);
  assert.equal(result.acknowledged.length, 5);
});

test('any other high advisory still fails the full audit', () => {
  const mixed = {
    vulnerabilities: {
      ...report.vulnerabilities,
      leftpad: {
        severity: 'high',
        via: [{
          url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
          severity: 'high',
        }],
      },
    },
  };
  const result = blockingFindings(mixed, { today: '2026-11-17' });
  assert.deepEqual(result.blocking.map((finding) => finding.name), ['leftpad']);
});

test('the picomatch exception expires on its removal date', () => {
  const result = blockingFindings(report, { today: '2026-12-17' });
  assert.equal(result.blocking.length, 5);
  assert.ok(result.blocking.every((finding) => finding.expired.includes('GHSA-fc5q-39xc-vjpf')));
});
