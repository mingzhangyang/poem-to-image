import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncIntentGate, nextAsyncAccountOwner } from '../../src/asyncIntentGate';

test('a new image/template selection invalidates an older AI completion', () => {
  const gate = createAsyncIntentGate();
  const first = gate.begin();
  assert.equal(gate.isCurrent(first), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(first), false, 'first response can no longer change the background');

  const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

test('the image conversion commit must validate intent after its await', async () => {
  const gate = createAsyncIntentGate();
  let resolveImage!: () => void;
  const pendingImage = new Promise<void>((resolve) => { resolveImage = resolve; });
  const request = gate.begin();
  const applied: string[] = [];
  const finish = (async () => {
    await pendingImage; // models AI generation and image transcoding
    if (gate.isCurrent(request)) applied.push('older image');
  })();

  gate.invalidate();
  applied.push('new template');
  resolveImage();
  await finish;
  assert.deepEqual(applied, ['new template']);
});

test('two concurrent generations may only commit the latest epoch', async () => {
  const gate = createAsyncIntentGate();
  const first = gate.begin();
  const second = gate.begin();
  const applied: number[] = [];
  for (const epoch of [first, second]) {
    await Promise.resolve();
    if (gate.isCurrent(epoch)) applied.push(epoch);
  }
  assert.deepEqual(applied, [second]);
});

test('a deferred upload cannot commit after account A -> B -> A', async () => {
  let currentOwner = nextAsyncAccountOwner({ accountId: 'a' }, 'a');
  const uploadOwner = currentOwner;
  let conversionEpoch = 1;
  const uploadEpoch = conversionEpoch;
  const ownsUpload = () => currentOwner === uploadOwner && conversionEpoch === uploadEpoch;
  let finishConversion!: () => void;
  const pendingConversion = new Promise<void>((resolve) => { finishConversion = resolve; });
  const committed: string[] = [];
  const upload = (async () => {
    await pendingConversion;
    if (ownsUpload()) committed.push('stale image');
  })();
  currentOwner = nextAsyncAccountOwner(currentOwner, 'b');
  conversionEpoch += 1;
  currentOwner = nextAsyncAccountOwner(currentOwner, 'a');
  conversionEpoch += 1;
  assert.equal(ownsUpload(), false);
  finishConversion();
  await upload;
  assert.deepEqual(committed, []);
});


test('a confirmed save adds to the library without overriding a newer built-in selection', async () => {
  const gate = createAsyncIntentGate();
  const saveEpoch = gate.begin();
  const shouldActivate = () => gate.isCurrent(saveEpoch);
  let releaseSave!: () => void;
  const serverResponse = new Promise<void>((resolve) => { releaseSave = resolve; });
  const library: string[] = [];
  const selection = { builtIn: null as string | null, custom: null as string | null };
  const save = (async () => {
    await serverResponse;
    library.push('saved snapshot');
    // Mirrors the two separate async post-save commits: custom library
    // activation and clearing the built-in selection in the manager.
    if (shouldActivate()) selection.custom = 'saved snapshot';
    if (shouldActivate()) selection.builtIn = null;
  })();

  gate.invalidate(); // User applies another template while POST is pending.
  selection.builtIn = 'modern-minimal';
  selection.custom = null;
  releaseSave();
  await save;

  assert.deepEqual(library, ['saved snapshot'], 'the confirmed save is not discarded');
  assert.equal(selection.builtIn, 'modern-minimal', 'newer built-in remains selected');
  assert.equal(selection.custom, null, 'older cloud response cannot mark itself active');
});

test('the latest confirmed template save can become active when selection is unchanged', async () => {
  const gate = createAsyncIntentGate();
  const olderSave = gate.begin();
  const latestSave = gate.begin();
  assert.equal(gate.isCurrent(olderSave), false);
  assert.equal(gate.isCurrent(latestSave), true);
  let activeBuiltIn: string | null = 'graceful-whitespace';
  let activeCustom: string | null = null;
  if (gate.isCurrent(latestSave)) activeCustom = 'latest saved template';
  if (gate.isCurrent(latestSave)) activeBuiltIn = null;
  assert.equal(activeCustom, 'latest saved template');
  assert.equal(activeBuiltIn, null);
});
