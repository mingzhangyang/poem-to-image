import assert from 'node:assert/strict';
import test from 'node:test';
import { getTemplateSyncMessages } from '../../src/templateSyncMessages';
import type { Language } from '../../src/translations';

test('all localized mutation warnings require synchronization and inspection before retrying', () => {
  const expected: Array<[Language, string, string]> = [
    ['en', 'Retry sync', 'inspect'],
    ['zh-CN', '重试同步', '检查'],
    ['zh-TW', '重試同步', '查看'],
    ['ja', '同期を再試行', '確認'],
    ['ko', '동기화를 다시 시도', '확인'],
    ['es', 'Reintenta la sincronización', 'revisa'],
    ['fr', 'Relancez la synchronisation', 'vérifiez'],
    ['de', 'Synchronisieren Sie erneut', 'prüfen'],
  ];
  for (const [language, synchronize, inspect] of expected) {
    const copy = getTemplateSyncMessages(language);
    assert.ok(copy.mutationFailed.includes(synchronize), language);
    assert.ok(copy.mutationFailed.includes(inspect), language);
    assert.ok(copy.legacyImportBlocked.length > 20, language);
  }
  assert.match(getTemplateSyncMessages('en').mutationFailed, /may already have saved/);
  assert.match(getTemplateSyncMessages('en').mutationFailed, /duplicate templates/);
});
