import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pinDraftAssetSnapshot,
  registerDraftAssetObjectUrl,
  releaseEditorDraftAssets,
  retainEditorDraftAssets,
  type EditorDraftState,
} from '../../src/editorDraftStore';

function sceneWith(url: string): EditorDraftState {
  // Only image fields are inspected by the asset pin helper.
  return {
    background: { backgroundImage: url },
    decorations: { logos: [] },
  } as unknown as EditorDraftState;
}

test('background Blob lives until both editor/history and detached save release it', () => {
  const originalRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  try {
    const url = `blob:https://inkpoem.test/${crypto.randomUUID()}`;
    registerDraftAssetObjectUrl(url, new Blob(['background']));
    retainEditorDraftAssets('test-editor', [url]);
    const finishSave = pinDraftAssetSnapshot(sceneWith(url));

    releaseEditorDraftAssets('test-editor');
    assert.deepEqual(revoked, [], 'pending write still owns the Blob');
    finishSave();
    assert.deepEqual(revoked, [url], 'last owner releases the object URL');
  } finally {
    URL.revokeObjectURL = originalRevoke;
    releaseEditorDraftAssets('test-editor');
  }
});

test('expired history references are evicted while current assets remain live', () => {
  const originalRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  try {
    const oldUrl = `blob:https://inkpoem.test/${crypto.randomUUID()}`;
    const currentUrl = `blob:https://inkpoem.test/${crypto.randomUUID()}`;
    registerDraftAssetObjectUrl(oldUrl, new Blob(['old']));
    registerDraftAssetObjectUrl(currentUrl, new Blob(['current']));
    retainEditorDraftAssets('test-history', [oldUrl, currentUrl]);
    retainEditorDraftAssets('test-history', [currentUrl]);
    assert.deepEqual(revoked, [oldUrl]);
    releaseEditorDraftAssets('test-history');
    assert.deepEqual(revoked, [oldUrl, currentUrl]);
  } finally {
    URL.revokeObjectURL = originalRevoke;
    releaseEditorDraftAssets('test-history');
  }
});
