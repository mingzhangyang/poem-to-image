import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncIntentGate } from '../../src/asyncIntentGate';
import {
  createTemplateScopeLifetime,
  enqueueTemplateMutation,
  isCurrentTemplateScopeLifetime,
} from '../../src/templateScopeLifetime';

test('a queued A write cannot run after switching A to B and back to A', async () => {
  const queue = { current: Promise.resolve() };
  const old = createTemplateScopeLifetime('account:a');
  let current = old;
  const ownsOld = () => isCurrentTemplateScopeLifetime(current, old);
  let releaseToken!: () => void;
  const token = new Promise<void>((resolve) => { releaseToken = resolve; });
  const dispatched: string[] = [];
  let reconciliations = 0;
  const first = enqueueTemplateMutation(queue, old, ownsOld, async () => {
    await token;
    // Models the check after getToken() and before the network POST.
    if (ownsOld()) dispatched.push('first');
  }, undefined, () => { reconciliations += 1; });
  const second = enqueueTemplateMutation(queue, old, ownsOld, async () => {
    dispatched.push('queued');
  }, undefined, () => { reconciliations += 1; });

  await Promise.resolve(); // first operation has entered the token wait
  old.active = false;
  current = createTemplateScopeLifetime('account:b');
  current.active = false;
  current = createTemplateScopeLifetime('account:a');
  assert.equal(ownsOld(), false, 'the scope string alone must not revive old work');

  releaseToken();
  await Promise.all([first, second]);
  assert.deepEqual(dispatched, []);
  assert.equal(reconciliations, 0, 'stale operations cannot refresh a new account');
});

test('reconciliation runs only once when all queued writes finish', async () => {
  const queue = { current: Promise.resolve() };
  const lifetime = createTemplateScopeLifetime('account:a');
  const owns = () => isCurrentTemplateScopeLifetime(lifetime, lifetime);
  const readGate = createAsyncIntentGate();
  let releaseFirst!: () => void;
  const waitForFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let releaseSecond!: () => void;
  const waitForSecond = new Promise<void>((resolve) => { releaseSecond = resolve; });
  const server: string[] = [];
  const snapshots: string[][] = [];
  const onIdle = () => { snapshots.push([...server]); };
  const first = enqueueTemplateMutation(queue, lifetime, owns, async () => {
    await waitForFirst;
    server.push('first');
    readGate.invalidate(); // server write was confirmed
  }, undefined, onIdle);
  const second = enqueueTemplateMutation(queue, lifetime, owns, async () => {
    await waitForSecond;
    server.push('second');
    readGate.invalidate(); // invalidate a read that observed pre-write data
  }, undefined, onIdle);

  assert.equal(lifetime.pendingMutations, 2);
  const staleRead = readGate.begin();
  releaseFirst();
  await first;
  assert.equal(snapshots.length, 0, 'a refetch after the first write is premature');
  releaseSecond();
  await second;
  assert.equal(readGate.isCurrent(staleRead), false);
  assert.deepEqual(snapshots, [['first', 'second']]);
  assert.equal(lifetime.pendingMutations, 0);
});
