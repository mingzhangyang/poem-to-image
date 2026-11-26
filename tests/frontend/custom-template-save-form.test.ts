import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomTemplateSaveForm } from '../../src/customTemplateSaveForm';
import { createTemplateScopeLifetime, trackTemplateMutation } from '../../src/templateScopeLifetime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('a pending save cannot be submitted twice and locks the typed name', async () => {
  const form = createCustomTemplateSaveForm();
  form.open();
  form.setName('  Autumn  ');
  const response = deferred<boolean>();
  const names: string[] = [];
  const save = (name: string) => { names.push(name); return response.promise; };

  const first = form.submit(save);
  assert.equal(form.getState().isSubmitting, true);
  // A remounted panel reads the same form: a retry is refused synchronously.
  assert.equal(await form.submit(save), false);
  form.setName('Changed');
  form.close();
  assert.deepEqual(form.getState(), { isOpen: true, name: '  Autumn  ', isSubmitting: true });

  response.resolve(true);
  assert.equal(await first, true);
  assert.deepEqual(names, ['Autumn']);
  assert.deepEqual(form.getState(), { isOpen: false, name: '', isSubmitting: false });
});

test('a save that is not confirmed keeps the open form and name for a deliberate retry', async () => {
  const form = createCustomTemplateSaveForm();
  form.open();
  form.setName('Winter');
  assert.equal(await form.submit(async () => false), false);
  assert.deepEqual(form.getState(), { isOpen: true, name: 'Winter', isSubmitting: false });

  await assert.rejects(form.submit(async () => { throw new Error('network'); }));
  assert.deepEqual(form.getState(), { isOpen: true, name: 'Winter', isSubmitting: false });

  assert.equal(await form.submit(async () => true), true);
  assert.equal(form.getState().isOpen, false);
});

test('subscribers are notified of each state change', async () => {
  const form = createCustomTemplateSaveForm();
  let notifications = 0;
  const unsubscribe = form.subscribe(() => { notifications += 1; });
  form.open();
  form.open();
  form.setName('A');
  await form.submit(async () => true);
  unsubscribe();
  form.open();
  // open, setName, submitting, settled; the repeated open is not a change.
  assert.equal(notifications, 4);
});

test('in-flight template writes are tracked per account lifetime until they settle', async () => {
  const lifetime = createTemplateScopeLifetime('account:a');
  const write = deferred<string>();
  const tracked = trackTemplateMutation(lifetime, 'create', write.promise);
  assert.equal(lifetime.inFlight.get('create'), tracked);
  // A later lifetime for the same account does not inherit the old write.
  assert.equal(createTemplateScopeLifetime('account:a').inFlight.has('create'), false);

  write.resolve('done');
  assert.equal(await tracked, 'done');
  await Promise.resolve();
  assert.equal(lifetime.inFlight.has('create'), false);

  const failed = trackTemplateMutation(lifetime, 'delete:x', Promise.reject(new Error('x')));
  await assert.rejects(failed);
  await Promise.resolve();
  assert.equal(lifetime.inFlight.has('delete:x'), false);
});
