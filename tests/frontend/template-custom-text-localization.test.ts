import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTemplateForLanguage } from '../../src/templates';
import { matchesTemplateCustomTexts } from '../../src/templates/templateCustomTextMatching';
import { CNS_SEAL_FONT_STACK } from '../../src/sealTypography';

test('unmodified localized template text boxes can change from zh-CN to zh-TW', () => {
  const cn = resolveTemplateForLanguage('japanese-magazine', 'zh-CN');
  const tw = resolveTemplateForLanguage('japanese-magazine', 'zh-TW');
  assert.ok(cn && tw);
  assert.equal(cn.decorations.customTexts[0].text, '刊首');
  assert.equal(cn.decorations.customTexts[0].id, 'mag-cn-tag');
  assert.equal(tw.decorations.customTexts[0].id, 'mag-tw-tag');
  assert.notDeepEqual(cn.decorations.customTexts, tw.decorations.customTexts);
  const editorTexts = cn.decorations.customTexts.map((text, index) => ({
    ...text, zIndex: text.zIndex ?? index,
  }));
  assert.equal(matchesTemplateCustomTexts(editorTexts, cn.decorations.customTexts), true);
});

test('an edited font prevents localization from replacing a custom text box', () => {
  const cn = resolveTemplateForLanguage('japanese-magazine', 'zh-CN');
  assert.ok(cn);
  const edited = cn.decorations.customTexts.map((text) => ({
    ...text, fontFamily: CNS_SEAL_FONT_STACK,
  }));
  assert.equal(matchesTemplateCustomTexts(edited, cn.decorations.customTexts), false);
});

test('other text-box edits and structural edits also prevent accidental replacement', () => {
  const cn = resolveTemplateForLanguage('japanese-magazine', 'zh-CN');
  assert.ok(cn);
  const initial = cn.decorations.customTexts;
  for (const edit of [
    { text: '我的题签' }, { color: '#123456' }, { positionX: 70 },
    { boxWidth: 45 }, { zIndex: 5 },
  ]) {
    assert.equal(matchesTemplateCustomTexts([{ ...initial[0], ...edit }], initial), false, JSON.stringify(edit));
  }
  assert.equal(matchesTemplateCustomTexts([], initial), false);
  assert.equal(matchesTemplateCustomTexts([{ ...initial[0], id: 'different-id' }], initial), false);
});

test('an editor-normalized absent z-index does not count as a user change', () => {
  const template = [{
    id: 'tag', text: '题签', fontSize: 20, color: '#111111',
    writingMode: 'vertical-rl' as const, rotation: 0, positionX: 10, positionY: 20,
  }];
  assert.equal(matchesTemplateCustomTexts([{ ...template[0], zIndex: 0 }], template), true);
});
