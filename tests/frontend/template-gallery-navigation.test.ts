import assert from 'node:assert/strict';
import test from 'node:test';
import { editorTemplates } from '../../src/templates';
import { groupGalleryTemplates, matchesGallerySearch, TEMPLATE_GALLERY_CATEGORIES } from '../../src/templates/gallery';
import { LANGUAGES, loadTranslations } from '../../src/translations';
import type { EditorTemplateId } from '../../src/types';

test('every featured template belongs to exactly one navigable category', async () => {
  const assigned = TEMPLATE_GALLERY_CATEGORIES.flatMap((category) => category.ids);
  assert.equal(new Set(assigned).size, assigned.length, 'a template appears in multiple categories');
  assert.deepEqual(new Set(assigned), new Set(editorTemplates.map(({ id }) => id)));

  const groups = groupGalleryTemplates(editorTemplates);
  assert.equal(groups.length, TEMPLATE_GALLERY_CATEGORIES.length);
  assert.ok(groups.every(({ items }) => items.length > 0));
  assert.equal(groups.flatMap(({ items }) => items).length, editorTemplates.length);
  for (const language of LANGUAGES) {
    const translations = await loadTranslations(language);
    for (const group of groups) assert.ok(translations[group.key], `${language}: ${group.key}`);
  }
});

test('unclassified future templates remain visible without changing their original series', () => {
  const future = { ...editorTemplates[0], id: 'future-template' as EditorTemplateId };
  const groups = groupGalleryTemplates([...editorTemplates, future]);
  const other = groups.find(({ key }) => key === 'templateCategoryOther');
  assert.ok(other);
  assert.deepEqual(other.items.map(({ id }) => id), ['future-template']);
  assert.equal(other.items[0].seriesKey, future.seriesKey);
});

test('search matches all terms across localized names, series and categories', () => {
  assert.equal(matchesGallerySearch('  BLUE  bird ', ['Bluebird Manuscript', 'Blue Botanical Manuscripts']), true);
  assert.equal(matchesGallerySearch('ｂｌｕｅ', ['Bluebird Manuscript']), true);
  assert.equal(matchesGallerySearch('花鸟 青鸟', ['青鸟花枝', '青蓝花鸟手抄本']), true);
  assert.equal(matchesGallerySearch('blue butterfly', ['Bluebird Manuscript']), false);
  assert.equal(matchesGallerySearch('  ', []), true);
});
