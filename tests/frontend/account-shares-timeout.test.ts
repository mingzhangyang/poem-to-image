import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  ACCOUNT_PUBLICATION_TIMEOUT_MS, AccountShareError, claimShares, requestGalleryListing,
} from '../../src/sharing/accountSharesApi';

const realFetch = globalThis.fetch;
// Node does not keep the process alive for AbortSignal.timeout; hold it open
// while a test waits for the deadline.
let keepAlive: ReturnType<typeof setInterval> | undefined;
beforeEach(() => { keepAlive = setInterval(() => {}, 1000); });
afterEach(() => { globalThis.fetch = realFetch; clearInterval(keepAlive); });

// A server that never answers, but honours the abort signal like real fetch.
function stallFetch(seen: (AbortSignal | null | undefined)[]) {
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(init?.signal);
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'TimeoutError')));
    });
  }) as typeof fetch;
}

const token = async () => 'account-a';
const share = { id: 'abcdefghijkl', deleteToken: 'a'.repeat(64) };

test('account publication requests default to a bounded deadline', () => {
  assert.equal(ACCOUNT_PUBLICATION_TIMEOUT_MS, 15_000);
});

test('a stalled claim fails with TIMEOUT instead of hanging', async () => {
  const seen: (AbortSignal | null | undefined)[] = [];
  stallFetch(seen);
  await assert.rejects(claimShares(token, [share], { timeoutMs: 20 }),
    (error: unknown) => error instanceof AccountShareError && error.message === 'TIMEOUT');
  assert.equal(seen.length, 1);
  assert.ok(seen[0]?.aborted);
});

test('a stalled gallery submission fails with TIMEOUT', async () => {
  stallFetch([]);
  await assert.rejects(requestGalleryListing(token, share.id, { timeoutMs: 20 }),
    (error: unknown) => error instanceof AccountShareError && error.message === 'TIMEOUT');
});

test('a stalled token lookup also counts against the deadline', async () => {
  let fetched = false;
  globalThis.fetch = (async () => { fetched = true; return new Response('{}'); }) as typeof fetch;
  const never = () => new Promise<string | null>(() => {});
  await assert.rejects(claimShares(never, [share], { timeoutMs: 20 }),
    (error: unknown) => error instanceof AccountShareError && error.message === 'TIMEOUT');
  assert.equal(fetched, false);
});

test('a prompt answer is returned normally', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ claimed: [share.id], ownedElsewhere: [] }),
    { headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  assert.deepEqual(await claimShares(token, [share]), { claimed: [share.id], ownedElsewhere: [] });
});
