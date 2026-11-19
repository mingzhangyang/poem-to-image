import { LEGACY_TEMPLATE_STAMP_FONT } from '../fontOptions';
import type { EditorTemplateDefinition } from '../types';

// All artwork is generated raster image content, self-contained as SVG-wrapped
// WebP assets so it can be committed using the available text-only GitHub API.
// The poem, title, author and optional notes remain separately editable.
export const listeningToRainTemplates: EditorTemplateDefinition[] = [{
  id: 'listening-to-rain',
  nameKey: 'templateListeningToRain',
  descriptionKey: 'templateListeningToRainDesc',
  seriesKey: 'templateSeriesPoeticScenes',
  usesBackgroundImage: true,
  previewImage: '/template-previews/listening-to-rain.765c5f60.svg',
  accentFrom: '#b58164',
  accentTo: '#516b77',
  background: {
    backgroundType: 'image',
    backgroundColor: '#eee9e0',
    gradientColor1: '#f4ebdf',
    gradientColor2: '#c9d4d3',
    gradientDirection: 'to bottom',
    backgroundImage: '/template-backgrounds/listening-to-rain.svg',
    backgroundImageSource: 'template',
    // Prefer 4:5. Preserve all three life stages on non-4:5 canvases.
    backgroundSize: 'stretch',
    backgroundPosition: 'center',
    bgBrightness: 100,
    bgBlur: 0,
  },
  typography: {
    fontFamily: '"Noto Serif SC", serif',
    fontSize: 32,
    textColor: '#273b40',
    textAlign: 'center',
    writingMode: 'vertical-rl',
    padding: 90,
    lineHeight: 1.72,
    letterSpacing: 3,
    columns: 1,
    columnGap: 32,
    textShadowEnabled: false,
    textShadowColor: '#f7f4ec',
    textShadowBlur: 0,
    textShadowOffsetX: 0,
    textShadowOffsetY: 0,
  },
  decorations: {
    showBorder: false,
    borderStyle: 'solid',
    borderColor: '#64777a',
    borderWidth: 2,
    showStamp: false,
    stamp: {
      text: '雨',
      style: 'square',
      positionX: 86,
      positionY: 86,
      size: 60,
      rotation: 0,
      opacity: 0.72,
      colorScheme: 'outline',
      fontFamily: LEGACY_TEMPLATE_STAMP_FONT,
    },
    poemPosition: { positionX: 64, positionY: 50 },
    customTexts: [],
    logos: [],
  },
}];
