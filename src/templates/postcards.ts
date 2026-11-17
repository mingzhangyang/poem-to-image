import { LEGACY_TEMPLATE_STAMP_FONT } from '../fontOptions';
import type { EditorTemplateDefinition } from '../types';

type PostcardOptions = Pick<EditorTemplateDefinition,
  'id' | 'nameKey' | 'descriptionKey' | 'accentFrom' | 'accentTo'> & {
  previewHash: string;
  paperColor: string;
  inkColor: string;
};

// Purely decorative same-origin SVG backgrounds; poem/title/author and optional
// personal notes remain ordinary editable editor layers. Stretching keeps the
// postage, border and corner botanicals visible at every canvas aspect ratio.
function postcard(options: PostcardOptions): EditorTemplateDefinition {
  const { id, nameKey, descriptionKey, previewHash, accentFrom, accentTo, paperColor, inkColor } = options;
  return {
    id, nameKey, descriptionKey, accentFrom, accentTo,
    seriesKey: 'templateSeriesPostcards',
    usesBackgroundImage: true,
    previewImage: `/template-previews/${id}.${previewHash}.svg`,
    background: {
      backgroundType: 'image',
      backgroundColor: paperColor,
      gradientColor1: paperColor, gradientColor2: paperColor, gradientDirection: 'to bottom',
      backgroundImage: `/template-backgrounds/${id}.svg`,
      backgroundImageSource: 'template',
      backgroundSize: 'stretch', backgroundPosition: 'center',
      bgBrightness: 100, bgBlur: 0,
    },
    typography: {
      fontFamily: '"Cormorant Garamond", serif',
      fontSize: 34, textColor: inkColor, textAlign: 'center', writingMode: 'horizontal-tb',
      padding: 110, lineHeight: 1.8, letterSpacing: 0, columns: 1, columnGap: 36,
      textShadowEnabled: false, textShadowColor: paperColor, textShadowBlur: 0,
      textShadowOffsetX: 0, textShadowOffsetY: 0,
    },
    decorations: {
      showBorder: false, borderStyle: 'solid', borderColor: inkColor, borderWidth: 2,
      // The drawn postage vignette is part of the background, not a second text seal.
      showStamp: false,
      stamp: {
        text: '印', style: 'square', positionX: 83, positionY: 81, size: 56,
        rotation: 0, opacity: 0.7, colorScheme: 'outline', fontFamily: LEGACY_TEMPLATE_STAMP_FONT,
      },
      poemPosition: { positionX: 50, positionY: 50 },
      customTexts: [], logos: [],
    },
  };
}

export const postcardTemplates: EditorTemplateDefinition[] = [
  postcard({
    id: 'postcard-vintage-travel', nameKey: 'templatePostcardVintageTravel',
    descriptionKey: 'templatePostcardVintageTravelDesc',
    previewHash: '159b68e3', accentFrom: '#e8d4af', accentTo: '#66868b',
    paperColor: '#f4e6cb', inkColor: '#443c32',
  }),
  postcard({
    id: 'postcard-poetry-minimal', nameKey: 'templatePostcardMinimalPoetry',
    descriptionKey: 'templatePostcardMinimalPoetryDesc',
    previewHash: '12a92465', accentFrom: '#fffdf8', accentTo: '#a89882',
    paperColor: '#fcf8f1', inkColor: '#45423e',
  }),
  postcard({
    id: 'postcard-botanical', nameKey: 'templatePostcardBotanical',
    descriptionKey: 'templatePostcardBotanicalDesc',
    previewHash: '6cbadd94', accentFrom: '#f6e5da', accentTo: '#7a9880',
    paperColor: '#f9f0e3', inkColor: '#435348',
  }),
];
