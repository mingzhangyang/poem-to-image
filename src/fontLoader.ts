// On-demand loader for the editor's Google Fonts. Previously every family was
// pulled in via one render-blocking @import in index.css, including the heavy CJK
// families most users never touch. Instead we inject a stylesheet <link> for a
// family the first time it's actually used (selected as the poem/stamp font), with
// font-display: swap so text paints immediately in a fallback and swaps in once
// loaded. Signature fonts have their own equivalent loader in signatureRendering.ts.

// Maps a Google Font family name to its css2 `family=` query segment (weights match
// what the old monolithic @import requested).
const GOOGLE_FONT_SPECS: Record<string, string> = {
  'Noto Serif SC': 'Noto+Serif+SC:wght@400;500;700',
  'Noto Sans SC': 'Noto+Sans+SC:wght@400;500;700',
  'ZCOOL XiaoWei': 'ZCOOL+XiaoWei',
  'Ma Shan Zheng': 'Ma+Shan+Zheng',
  'Zhi Mang Xing': 'Zhi+Mang+Xing',
  'Liu Jian Mao Cao': 'Liu+Jian+Mao+Cao',
  'Long Cang': 'Long+Cang',
  'ZCOOL QingKe HuangYou': 'ZCOOL+QingKe+HuangYou',
  'Noto Serif TC': 'Noto+Serif+TC:wght@400;500;700',
  'Noto Sans TC': 'Noto+Sans+TC:wght@400;500;700',
  'Noto Serif JP': 'Noto+Serif+JP:wght@400;500;700',
  'Noto Sans JP': 'Noto+Sans+JP:wght@400;500;700',
  'Shippori Mincho': 'Shippori+Mincho:wght@400;500;700',
  'Zen Kaku Gothic New': 'Zen+Kaku+Gothic+New:wght@400;500;700',
  'Noto Serif KR': 'Noto+Serif+KR:wght@400;500;700',
  'Noto Sans KR': 'Noto+Sans+KR:wght@400;500;700',
  'Gowun Batang': 'Gowun+Batang:wght@400;700',
  'Black Han Sans': 'Black+Han+Sans',
  'Playfair Display': 'Playfair+Display:wght@400;500;700',
  Lora: 'Lora:wght@400;500;700',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
  Spectral: 'Spectral:wght@400;500;700',
  'Source Sans 3': 'Source+Sans+3:wght@400;500;700',
  'Space Mono': 'Space+Mono:wght@400;700',
};

const loadedFamilies = new Set<string>();

// '"Noto Serif SC", serif' -> 'Noto Serif SC'
function familyNameFromValue(fontValue: string): string {
  const first = fontValue.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
}

export function ensureFontLoaded(fontValue: string | undefined | null): void {
  if (!fontValue || typeof document === 'undefined') return;

  const familyName = familyNameFromValue(fontValue);
  const spec = GOOGLE_FONT_SPECS[familyName];
  if (!spec || loadedFamilies.has(familyName)) return;

  loadedFamilies.add(familyName);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  link.setAttribute('data-editor-font', familyName);
  document.head.appendChild(link);
}
