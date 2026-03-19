import type { Language } from './translations';
import type { EditorTemplateId } from './types';

export interface FontOption {
  value: string;
  label: string;
}

const FONT_OPTIONS: FontOption[] = [
  { value: '"Noto Serif SC", serif', label: 'Noto Serif SC (中文衬线)' },
  { value: '"Noto Sans SC", sans-serif', label: 'Noto Sans SC (中文黑体)' },
  { value: '"ZCOOL XiaoWei", serif', label: 'ZCOOL XiaoWei (小魏碑)' },
  { value: '"Ma Shan Zheng", cursive', label: 'Ma Shan Zheng (手写楷体)' },
  { value: '"Zhi Mang Xing", cursive', label: 'Zhi Mang Xing (手写行书)' },
  { value: '"Liu Jian Mao Cao", cursive', label: 'Liu Jian Mao Cao (手写草书)' },
  { value: '"Long Cang", cursive', label: 'Long Cang (行草)' },
  { value: '"ZCOOL QingKe HuangYou", cursive', label: 'ZCOOL QingKe HuangYou (黄油体)' },
  { value: '"Noto Serif TC", serif', label: 'Noto Serif TC (繁中衬线)' },
  { value: '"Noto Sans TC", sans-serif', label: 'Noto Sans TC (繁中黑体)' },
  { value: '"Noto Serif JP", serif', label: 'Noto Serif JP (和文明朝)' },
  { value: '"Noto Sans JP", sans-serif', label: 'Noto Sans JP (和文ゴシック)' },
  { value: '"Shippori Mincho", serif', label: 'Shippori Mincho (日系明朝)' },
  { value: '"Zen Kaku Gothic New", sans-serif', label: 'Zen Kaku Gothic New (角ゴシック)' },
  { value: '"Noto Serif KR", serif', label: 'Noto Serif KR (한글 명조)' },
  { value: '"Noto Sans KR", sans-serif', label: 'Noto Sans KR (한글 고딕)' },
  { value: '"Gowun Batang", serif', label: 'Gowun Batang (한글 바탕)' },
  { value: '"Black Han Sans", sans-serif', label: 'Black Han Sans (한글 디스플레이)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display (editorial serif)' },
  { value: '"Lora", serif', label: 'Lora (book serif)' },
  { value: '"Cormorant Garamond", serif', label: 'Cormorant Garamond (classic serif)' },
  { value: '"Spectral", serif', label: 'Spectral (literary serif)' },
  { value: '"Source Sans 3", sans-serif', label: 'Source Sans 3 (clean sans)' },
  { value: '"Space Mono", monospace', label: 'Space Mono (monospace)' },
  { value: 'monospace', label: 'Generic Monospace' },
  { value: 'system-ui, sans-serif', label: 'System UI (fallback)' },
];

const LANGUAGE_DEFAULT_FONTS: Record<Language, string> = {
  en: '"Playfair Display", serif',
  'zh-CN': '"Noto Serif SC", serif',
  'zh-TW': '"Noto Serif TC", serif',
  ja: '"Shippori Mincho", serif',
  ko: '"Gowun Batang", serif',
  es: '"Lora", serif',
  fr: '"Cormorant Garamond", serif',
  de: '"Spectral", serif',
};

const LANGUAGE_RECOMMENDED_FONTS: Record<Language, string[]> = {
  en: [
    '"Playfair Display", serif',
    '"Source Sans 3", sans-serif',
    '"Cormorant Garamond", serif',
    '"Space Mono", monospace',
  ],
  'zh-CN': [
    '"Noto Serif SC", serif',
    '"Noto Sans SC", sans-serif',
    '"ZCOOL XiaoWei", serif',
    '"Ma Shan Zheng", cursive',
    '"Zhi Mang Xing", cursive',
    '"ZCOOL QingKe HuangYou", cursive',
  ],
  'zh-TW': [
    '"Noto Serif TC", serif',
    '"Noto Sans TC", sans-serif',
    '"Noto Serif SC", serif',
    '"Ma Shan Zheng", cursive',
    '"ZCOOL XiaoWei", serif',
  ],
  ja: [
    '"Shippori Mincho", serif',
    '"Noto Serif JP", serif',
    '"Noto Sans JP", sans-serif',
    '"Zen Kaku Gothic New", sans-serif',
  ],
  ko: [
    '"Gowun Batang", serif',
    '"Noto Serif KR", serif',
    '"Noto Sans KR", sans-serif',
    '"Black Han Sans", sans-serif',
  ],
  es: [
    '"Lora", serif',
    '"Source Sans 3", sans-serif',
    '"Playfair Display", serif',
    '"Space Mono", monospace',
  ],
  fr: [
    '"Cormorant Garamond", serif',
    '"Source Sans 3", sans-serif',
    '"Playfair Display", serif',
    '"Space Mono", monospace',
  ],
  de: [
    '"Spectral", serif',
    '"Source Sans 3", sans-serif',
    '"Playfair Display", serif',
    '"Space Mono", monospace',
  ],
};

const TEMPLATE_FONTS: Record<EditorTemplateId, Record<Language, string>> = {
  'ink-wash': {
    en: '"Cormorant Garamond", serif',
    'zh-CN': '"ZCOOL XiaoWei", serif',
    'zh-TW': '"Noto Serif TC", serif',
    ja: '"Shippori Mincho", serif',
    ko: '"Gowun Batang", serif',
    es: '"Lora", serif',
    fr: '"Cormorant Garamond", serif',
    de: '"Spectral", serif',
  },
  'modern-minimal': {
    en: '"Source Sans 3", sans-serif',
    'zh-CN': '"Noto Sans SC", sans-serif',
    'zh-TW': '"Noto Sans TC", sans-serif',
    ja: '"Noto Sans JP", sans-serif',
    ko: '"Noto Sans KR", sans-serif',
    es: '"Source Sans 3", sans-serif',
    fr: '"Source Sans 3", sans-serif',
    de: '"Source Sans 3", sans-serif',
  },
  cyberpunk: {
    en: '"Space Mono", monospace',
    'zh-CN': '"Noto Sans SC", sans-serif',
    'zh-TW': '"Noto Sans TC", sans-serif',
    ja: '"Zen Kaku Gothic New", sans-serif',
    ko: '"Black Han Sans", sans-serif',
    es: '"Space Mono", monospace',
    fr: '"Space Mono", monospace',
    de: '"Space Mono", monospace',
  },
  'japanese-magazine': {
    en: '"Source Sans 3", sans-serif',
    'zh-CN': '"Noto Sans SC", sans-serif',
    'zh-TW': '"Noto Sans TC", sans-serif',
    ja: '"Noto Sans JP", sans-serif',
    ko: '"Noto Sans KR", sans-serif',
    es: '"Source Sans 3", sans-serif',
    fr: '"Source Sans 3", sans-serif',
    de: '"Source Sans 3", sans-serif',
  },
  'mountain-mist-photo': {
    en: '"Playfair Display", serif',
    'zh-CN': '"Noto Serif SC", serif',
    'zh-TW': '"Noto Serif TC", serif',
    ja: '"Shippori Mincho", serif',
    ko: '"Gowun Batang", serif',
    es: '"Lora", serif',
    fr: '"Cormorant Garamond", serif',
    de: '"Spectral", serif',
  },
  'ocean-dawn-photo': {
    en: '"Source Sans 3", sans-serif',
    'zh-CN': '"Noto Sans SC", sans-serif',
    'zh-TW': '"Noto Sans TC", sans-serif',
    ja: '"Noto Sans JP", sans-serif',
    ko: '"Noto Sans KR", sans-serif',
    es: '"Source Sans 3", sans-serif',
    fr: '"Source Sans 3", sans-serif',
    de: '"Source Sans 3", sans-serif',
  },
  'city-night-photo': {
    en: '"Space Mono", monospace',
    'zh-CN': '"Noto Sans SC", sans-serif',
    'zh-TW': '"Noto Sans TC", sans-serif',
    ja: '"Zen Kaku Gothic New", sans-serif',
    ko: '"Black Han Sans", sans-serif',
    es: '"Space Mono", monospace',
    fr: '"Space Mono", monospace',
    de: '"Space Mono", monospace',
  },
  'ink-pine-mist-photo': {
    en: '"Playfair Display", serif',
    'zh-CN': '"Noto Serif SC", serif',
    'zh-TW': '"Noto Serif TC", serif',
    ja: '"Shippori Mincho", serif',
    ko: '"Gowun Batang", serif',
    es: '"Lora", serif',
    fr: '"Cormorant Garamond", serif',
    de: '"Spectral", serif',
  },
  'colorblock-cyan-magenta': {
    en: '"Source Sans 3", sans-serif',
    'zh-CN': '"Noto Sans SC", sans-serif',
    'zh-TW': '"Noto Sans TC", sans-serif',
    ja: '"Noto Sans JP", sans-serif',
    ko: '"Noto Sans KR", sans-serif',
    es: '"Source Sans 3", sans-serif',
    fr: '"Source Sans 3", sans-serif',
    de: '"Source Sans 3", sans-serif',
  },
  'parchment-scroll': {
    en: '"Cormorant Garamond", serif',
    'zh-CN': '"Noto Serif SC", serif',
    'zh-TW': '"Noto Serif TC", serif',
    ja: '"Shippori Mincho", serif',
    ko: '"Gowun Batang", serif',
    es: '"Lora", serif',
    fr: '"Cormorant Garamond", serif',
    de: '"Spectral", serif',
  },
};

export interface StampFontOption {
  value: string;
  label: string;
  cjkOnly: boolean;
}

export const STAMP_FONT_OPTIONS: StampFontOption[] = [
  { value: '"Ma Shan Zheng", cursive', label: 'Ma Shan Zheng (楷书)', cjkOnly: true },
  { value: '"ZCOOL XiaoWei", serif', label: 'ZCOOL XiaoWei (魏碑)', cjkOnly: true },
  { value: '"Zhi Mang Xing", cursive', label: 'Zhi Mang Xing (行书)', cjkOnly: true },
  { value: '"Liu Jian Mao Cao", cursive', label: 'Liu Jian Mao Cao (草书)', cjkOnly: true },
  { value: '"Long Cang", cursive', label: 'Long Cang (行草)', cjkOnly: true },
];

export const DEFAULT_STAMP_FONT = '"Ma Shan Zheng", cursive';

export function getDefaultFontForLanguage(language: Language) {
  return LANGUAGE_DEFAULT_FONTS[language];
}

export function getRecommendedFontOptions(language: Language) {
  const recommendedFonts = new Set(LANGUAGE_RECOMMENDED_FONTS[language]);

  return FONT_OPTIONS.filter((option) => recommendedFonts.has(option.value));
}

export function getOtherFontOptions(language: Language) {
  const recommendedFonts = new Set(LANGUAGE_RECOMMENDED_FONTS[language]);

  return FONT_OPTIONS.filter((option) => !recommendedFonts.has(option.value));
}

export function getTemplateFontForLanguage(templateId: EditorTemplateId, language: Language) {
  return TEMPLATE_FONTS[templateId][language];
}
