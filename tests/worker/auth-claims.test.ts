import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAuthClaims } from '../../worker/auth';

const now = 1_700_000_000;
const strictOptions = {
  expectedIssuer: 'https://clerk.example.com',
  expectedAudience: 'poem-to-image',
  allowedAuthorizedParties: ['https://app.example.com'],
  allowedTokenUses: ['session_token'],
};

function makePayload(overrides: Partial<Parameters<typeof validateAuthClaims>[0]> = {}) {
  return {
    sub: 'user_123',
    exp: now + 60,
    nbf: now - 60,
    iss: 'https://clerk.example.com',
    aud: 'poem-to-image',
    azp: 'https://app.example.com',
    token_use: 'session_token',
    ...overrides,
  };
}

function makeRequest(origin = 'https://app.example.com') {
  return new Request('https://api.example.com/api/me', {
    headers: { Origin: origin },
  });
}

test('validateAuthClaims accepts valid issuer/audience/azp/token_use', () => {
  const valid = validateAuthClaims(
    makePayload(),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, true);
});

test('validateAuthClaims rejects invalid audience', () => {
  const valid = validateAuthClaims(
    makePayload({ aud: 'other-app' }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects invalid authorized party', () => {
  const valid = validateAuthClaims(
    makePayload({ azp: 'https://other.example.com' }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects tokens without azp claim', () => {
  const valid = validateAuthClaims(
    makePayload({ azp: undefined }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects disallowed token_use', () => {
  const valid = validateAuthClaims(
    makePayload({ token_use: 'id_token' }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects expired tokens', () => {
  const valid = validateAuthClaims(
    makePayload({ exp: now - 1 }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects tokens without exp claim', () => {
  const valid = validateAuthClaims(
    makePayload({ exp: undefined }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects tokens without token_use claim', () => {
  const valid = validateAuthClaims(
    makePayload({ token_use: undefined }),
    makeRequest(),
    strictOptions,
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects when expectedIssuer is missing', () => {
  const valid = validateAuthClaims(
    makePayload(),
    makeRequest(),
    { ...strictOptions, expectedIssuer: undefined },
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects when expectedAudience is missing', () => {
  const valid = validateAuthClaims(
    makePayload(),
    makeRequest(),
    { ...strictOptions, expectedAudience: undefined },
    now,
  );

  assert.equal(valid, false);
});

test('validateAuthClaims rejects when allowedAuthorizedParties are missing', () => {
  const valid = validateAuthClaims(
    makePayload(),
    makeRequest(),
    { ...strictOptions, allowedAuthorizedParties: undefined },
    now,
  );

  assert.equal(valid, false);
});
