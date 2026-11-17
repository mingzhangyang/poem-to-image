import { LEGACY_TEMPLATE_STAMP_FONT } from '../fontOptions';
import type { EditorTemplateDefinition } from '../types';

type PremiumPostcardOptions = Pick<EditorTemplateDefinition,
  'id' | 'nameKey' | 'descriptionKey' | 'accentFrom' | 'accentTo'> & {
  previewHash: string;
  paperColor: string;
  inkColor: string;
};

// Each background is an original image-generated composition, not a rasterized
// copy of the SVG postcards. All editable poem/title/author text remains
// outside the artwork and uses the existing editor and export pipeline.
function premiumPostcard(options: PremiumPostcardOptions): EditorTemplateDefinition {
  const { id, nameKey, descriptionKey, previewHash, accentFrom, accentTo, paperColor, inkColor } = options;
  return {
    id, nameKey, descriptionKey,
    seriesKey: 'templateSeriesPremiumPostcards',
    accentFrom, accentTo, usesBackgroundImage: true,
    previewImage: `/template-previews/${id}.${previewHash}.webp`,
    background: {
      backgroundType: 'image',
      backgroundColor: paperColor,
      gradientColor1: paperColor, gradientColor2: paperColor, gradientDirection: 'to bottom',
      backgroundImage: `/template-backgrounds/${id}.webp`,
      backgroundImageSource: 'template',
      backgroundSize: 'cover', backgroundPosition: 'center',
      bgBrightness: 100, bgBlur: 0,
    },
    typography: {
      fontFamily: '"Cormorant Garamond", serif',
      fontSize: 32, textColor: inkColor,
      textAlign: 'center', writingMode: 'horizontal-tb', padding: 112,
      lineHeight: 1.85, letterSpacing: 0, columns: 1, columnGap: 36,
      textShadowEnabled: false, textShadowColor: paperColor, textShadowBlur: 0,
      textShadowOffsetX: 0, textShadowOffsetY: 0,
    },
    decorations: {
      showBorder: false, borderStyle: 'solid', borderColor: inkColor, borderWidth: 2,
      // Postal marks are illustrated in the image; they are not text seals.
      showStamp: false,
      stamp: {
        text: '印', style: 'square', positionX: 84, positionY: 84, size: 56,
        rotation: 0, opacity: 0.7, colorScheme: 'outline',
        fontFamily: LEGACY_TEMPLATE_STAMP_FONT,
      },
      poemPosition: { positionX: 50, positionY: 46 },
      customTexts: [], logos: [],
    },
  };
}

export const premiumPostcardTemplates: EditorTemplateDefinition[] = [
  premiumPostcard({
    id: 'postcard-premium-europe', nameKey: 'templatePremiumEurope',
    descriptionKey: 'templatePremiumEuropeDesc', previewHash: 'c322e6a4',
    accentFrom: '#e8c496', accentTo: '#69868e',
    paperColor: '#f5e7d0', inkColor: '#4d3a2c',
  }),
  premiumPostcard({
    id: 'postcard-premium-botanical', nameKey: 'templatePremiumBotanical',
    descriptionKey: 'templatePremiumBotanicalDesc', previewHash: 'fdac3196',
    accentFrom: '#e5c2bc', accentTo: '#8a9d74',
    paperColor: '#faf0dc', inkColor: '#44534b',
  }),
  premiumPostcard({
    id: 'postcard-premium-letter-collage', nameKey: 'templatePremiumLetterCollage',
    descriptionKey: 'templatePremiumLetterCollageDesc', previewHash: '131a64d2',
    accentFrom: '#a77b65', accentTo: '#633830',
    paperColor: '#ead4b7', inkColor: '#4d3028',
  }),
  premiumPostcard({
    id: 'postcard-premium-seaside', nameKey: 'templatePremiumSeaside',
    descriptionKey: 'templatePremiumSeasideDesc', previewHash: '53e80d95',
    accentFrom: '#f4d5aa', accentTo: '#81afbd',
    paperColor: '#f6eade', inkColor: '#365c66',
  }),
];
