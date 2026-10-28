// On-demand font loader for the editor. Chinese handwriting fonts are bundled
// locally via @fontsource / LXGW and requested only when selected. Other font
// families retain their Google Fonts fallback. We wait for selected glyphs at
// export time to avoid producing an image in a temporary fallback font.
// Signature fonts have their own loader in signatureRendering.ts.

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

// The Chinese font CSS is bundled by Vite and uses unicode-range subsets.
// Vite fetches only the CSS for a selected family; the browser fetches only
// the glyph subsets needed for the poem, avoiding external font CDNs.
const LOCAL_FONT_LOADERS: Record<string, () => Promise<unknown>> = {
  'LXGW WenKai Screen': () => import('lxgw-wenkai-screen-webfont/lxgwwenkaigbscreen.css'),
  'Ma Shan Zheng': () => import('@fontsource/ma-shan-zheng/400.css'),
  'Zhi Mang Xing': () => import('@fontsource/zhi-mang-xing/400.css'),
  'Long Cang': () => import('@fontsource/long-cang/400.css'),
  'ZCOOL KuaiLe': () => import('@fontsource/zcool-kuaile/400.css'),
};

const pendingStylesheets = new Map<string, Promise<void>>();

// '"Noto Serif SC", serif' -> 'Noto Serif SC'
function familyNameFromValue(fontValue: string): string {
  const first = fontValue.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
}

function loadFontStylesheet(fontValue: string | undefined | null): Promise<void> {
  if (!fontValue || typeof document === 'undefined') return Promise.resolve();
  const family = familyNameFromValue(fontValue);
  const existing = pendingStylesheets.get(family);
  if (existing) return existing;

  const local = LOCAL_FONT_LOADERS[family];
  if (local) {
    const promise = local().then(() => undefined);
    pendingStylesheets.set(family, promise);
    void promise.catch(() => pendingStylesheets.delete(family));
    return promise;
  }

  const spec = GOOGLE_FONT_SPECS[family];
  if (!spec) return Promise.resolve();
  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    link.setAttribute('data-editor-font', family);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Could not load font stylesheet: ${family}`));
    document.head.appendChild(link);
  });
  pendingStylesheets.set(family, promise);
  void promise.catch(() => pendingStylesheets.delete(family));
  return promise;
}

/** Start loading on selection without delaying typing or the live preview. */
export function ensureFontLoaded(fontValue: string | undefined | null): void {
  void loadFontStylesheet(fontValue).catch(() => {
    // The browser preview uses fallback text on network errors. An export
    // independently retries and reports failure rather than silently swapping.
  });
}

/**
 * Canvas drawing must not run while a font stylesheet or unicode-range glyph
 * subset is still loading. Load the *actual text* used by the artwork so a
 * copy/share/export always renders the same face as the preview.
 */
export async function ensureFontReady(fontValue: string | undefined | null, text: string): Promise<void> {
  if (!fontValue || typeof document === 'undefined' || typeof document.fonts?.load !== 'function') return;
  const family = familyNameFromValue(fontValue);
  await loadFontStylesheet(fontValue);
  await document.fonts.load(`20px "${family}"`, text.trim() || '诗');
  await document.fonts.ready;
}
