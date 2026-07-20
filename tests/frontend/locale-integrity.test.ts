import assert from 'node:assert/strict';
import test from 'node:test';
import de from '../../src/i18n/locales/de';
import en from '../../src/i18n/locales/en';
import es from '../../src/i18n/locales/es';
import fr from '../../src/i18n/locales/fr';
import ja from '../../src/i18n/locales/ja';
import ko from '../../src/i18n/locales/ko';
import zhCN from '../../src/i18n/locales/zh-CN';
import zhTW from '../../src/i18n/locales/zh-TW';

const locales = { de, es, fr, ja, ko, 'zh-CN': zhCN, 'zh-TW': zhTW } as const;

const allowedEnglishMatches: Record<keyof typeof locales, ReadonlySet<string>> = {
  de: new Set([
    'appTitle', 'templateModernMinimal', 'templateCyberpunk', 'templateSeriesEditorial',
    'relativePosition', 'bgTransparent', 'horizontal', 'layout', 'logos', 'addTextShort',
    'horiz', 'vert', 'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp',
    'exportTargetStory', 'exportQualityStandard', 'exportQualityUltraHd', 'quickExport', 'credits',
  ]),
  es: new Set([
    'appTitle', 'templateCyberpunk', 'horizontal', 'vertical', 'borderDouble', 'borderFractal',
    'logos', 'horiz', 'vert', 'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp',
    'exportTargetStory', 'exportQualityStandard', 'exportQualityUltraHd', 'contact', 'signatureColor',
  ]),
  fr: new Set([
    'appTitle', 'templateCyberpunk', 'stylePanelTitle', 'bgTransparent', 'bgImage', 'horizontal',
    'vertical', 'borderDouble', 'borderFractal', 'logos', 'imageShort', 'horiz', 'vert', 'angle',
    'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp', 'exportTargetStory',
    'exportQualityStandard', 'exportQualityUltraHd', 'contact', 'signatures', 'addSignature',
    'signatureRotation',
  ]),
  ja: new Set(['appTitle', 'bgAI', 'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp', 'allRightsReserved']),
  ko: new Set(['appTitle', 'bgAI', 'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp', 'allRightsReserved']),
  'zh-CN': new Set(['appTitle', 'bgAI', 'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp']),
  'zh-TW': new Set(['appTitle', 'bgAI', 'exportFormatPng', 'exportFormatJpg', 'exportFormatWebp']),
};

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]!).sort();
}

test('all locales have exactly the English key set and matching placeholders', () => {
  const englishKeys = Object.keys(en).sort();

  for (const [localeName, messages] of Object.entries(locales)) {
    assert.deepEqual(Object.keys(messages).sort(), englishKeys, `${localeName} has a different key set`);
    for (const key of englishKeys) {
      const translation = messages[key as keyof typeof messages];
      assert.deepEqual(placeholders(translation), placeholders(en[key as keyof typeof en]), `${localeName}.${key} changed placeholders`);
    }
  }
});

test('Latin-script locales do not contain unrelated Han text', () => {
  const allowedHanKeys = new Set(['featureMultilingualDesc']);

  for (const [localeName, messages] of Object.entries({ de, es, fr })) {
    for (const [key, value] of Object.entries(messages)) {
      if (allowedHanKeys.has(key)) continue;
      assert.doesNotMatch(value, /\p{Script=Han}/u, `${localeName}.${key} contains Han characters`);
    }
  }
});

test('values identical to English are explicitly allowlisted', () => {
  for (const [localeName, messages] of Object.entries(locales) as Array<[keyof typeof locales, typeof de]>) {
    const unexpected = Object.keys(en).filter((key) => (
      messages[key as keyof typeof messages] === en[key as keyof typeof en]
      && !allowedEnglishMatches[localeName].has(key)
    ));
    assert.deepEqual(unexpected, [], `${localeName} has unreviewed English values`);
  }
});
