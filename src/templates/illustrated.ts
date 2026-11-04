import { DEFAULT_STAMP_FONT } from '../fontOptions';
import type { EditorTemplateDefinition } from '../types';

type IllustratedOptions = Pick<EditorTemplateDefinition, 'id' | 'nameKey' | 'descriptionKey' | 'previewImage' | 'accentFrom' | 'accentTo'> & {
  seriesKey?: EditorTemplateDefinition['seriesKey'];
  paperColor: string;
  inkColor: string;
  poemY?: number;
  backgroundPosition?: string;
  scene?: boolean;
};

// These templates share editable typography; the artwork itself contains no text.
function illustrated(options: IllustratedOptions): EditorTemplateDefinition {
  const { id, nameKey, descriptionKey, previewImage, accentFrom, accentTo, seriesKey, paperColor, inkColor, poemY = 50, backgroundPosition = 'center', scene = false } = options;
  return {
    id, nameKey, descriptionKey, previewImage, accentFrom, accentTo,
    seriesKey: seriesKey ?? (scene ? 'templateSeriesPoeticScenes' : 'templateSeriesIllustrated'),
    usesBackgroundImage: true,
    background: {
      backgroundType: 'image', backgroundColor: paperColor,
      gradientColor1: paperColor, gradientColor2: paperColor, gradientDirection: 'to bottom',
      backgroundImage: `/template-backgrounds/${id}.webp`, backgroundImageSource: 'template',
      backgroundSize: 'cover', backgroundPosition, bgBrightness: 100, bgBlur: 0,
    },
    typography: {
      fontFamily: '"Cormorant Garamond", serif', fontSize: 34, textColor: inkColor,
      textAlign: 'center', writingMode: 'horizontal-tb', padding: 100,
      lineHeight: 1.8, letterSpacing: 0, columns: 1, columnGap: 36,
      textShadowEnabled: false, textShadowColor: paperColor, textShadowBlur: 0,
      textShadowOffsetX: 0, textShadowOffsetY: 0,
    },
    decorations: {
      showBorder: false, borderStyle: 'solid', borderColor: inkColor, borderWidth: 2,
      showStamp: false,
      stamp: {
        text: '', style: 'square', positionX: 82, positionY: 82, size: 56,
        rotation: 0, opacity: 0.7, colorScheme: 'outline', fontFamily: DEFAULT_STAMP_FONT,
      },
      poemPosition: { positionX: 50, positionY: poemY }, customTexts: [], logos: [],
    },
  };
}

export const illustratedTemplates: EditorTemplateDefinition[] = [
  illustrated({ id: 'song-floral', nameKey: 'templateSongFloral', descriptionKey: 'templateSongFloralDesc',
    previewImage: '/template-previews/song-floral.887beb39.webp', accentFrom: '#d5b6a7', accentTo: '#687c67', paperColor: '#f7ecda', inkColor: '#34463a' }),
  illustrated({ id: 'blue-green-landscape', nameKey: 'templateBlueGreenLandscape', descriptionKey: 'templateBlueGreenLandscapeDesc',
    previewImage: '/template-previews/blue-green-landscape.756cd1b4.webp', accentFrom: '#99b9ad', accentTo: '#326b79', paperColor: '#f6e8d1', inkColor: '#273e38', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
  illustrated({ id: 'art-nouveau', nameKey: 'templateArtNouveau', descriptionKey: 'templateArtNouveauDesc',
    previewImage: '/template-previews/art-nouveau.3adc2081.webp', accentFrom: '#b394a1', accentTo: '#8a815f', paperColor: '#f7e6ce', inkColor: '#493728' }),
  illustrated({ id: 'midnight-star-chart', nameKey: 'templateMidnightStarChart', descriptionKey: 'templateMidnightStarChartDesc',
    previewImage: '/template-previews/midnight-star-chart.97f355de.webp', accentFrom: '#1c334c', accentTo: '#c1a36c', paperColor: '#101f30', inkColor: '#f6e9cd' }),
  illustrated({ id: 'botanical-specimen', nameKey: 'templateBotanicalSpecimen', descriptionKey: 'templateBotanicalSpecimenDesc',
    previewImage: '/template-previews/botanical-specimen.42d20523.webp', accentFrom: '#d7d5b5', accentTo: '#718365', paperColor: '#f8ecd7', inkColor: '#344631' }),
  illustrated({ id: 'indigo-washi', nameKey: 'templateIndigoWashi', descriptionKey: 'templateIndigoWashiDesc',
    previewImage: '/template-previews/indigo-washi.bafccca6.webp', accentFrom: '#cbdce5', accentTo: '#547b9d', paperColor: '#f3f4ee', inkColor: '#29465b' }),
  illustrated({ id: 'lone-fisherman', nameKey: 'templateLoneFisherman', descriptionKey: 'templateLoneFishermanDesc',
    previewImage: '/template-previews/lone-fisherman.c7c626b9.webp', accentFrom: '#e8e4d8', accentTo: '#778988', paperColor: '#f3efe3', inkColor: '#283c3b', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
  illustrated({ id: 'milky-way', nameKey: 'templateMilkyWay', descriptionKey: 'templateMilkyWayDesc',
    previewImage: '/template-previews/milky-way.a9955c40.webp', accentFrom: '#182e4e', accentTo: '#7d82b4', paperColor: '#101a33', inkColor: '#f5f1e9', scene: true }),
  illustrated({ id: 'tower-reaching-stars', nameKey: 'templateTowerStars', descriptionKey: 'templateTowerStarsDesc',
    previewImage: '/template-previews/tower-reaching-stars.8c968285.webp', accentFrom: '#d7e3e5', accentTo: '#768f9c', paperColor: '#e6eded', inkColor: '#101820', poemY: 43, scene: true }),
  illustrated({ id: 'chrysanthemum-south-mountain', nameKey: 'templateChrysanthemumMountain', descriptionKey: 'templateChrysanthemumMountainDesc',
    previewImage: '/template-previews/chrysanthemum-south-mountain.3d548978.webp', accentFrom: '#e8d5ad', accentTo: '#8d936b', paperColor: '#f5eddb', inkColor: '#394337', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
  illustrated({ id: 'great-river-east', nameKey: 'templateGreatRiverEast', descriptionKey: 'templateGreatRiverEastDesc',
    previewImage: '/template-previews/great-river-east.7102b6a4.webp', accentFrom: '#d8dfd6', accentTo: '#657f7d', paperColor: '#f2efe4', inkColor: '#263e3c', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
  illustrated({ id: 'willow-breeze', nameKey: 'templateWillowBreeze', descriptionKey: 'templateWillowBreezeDesc',
    previewImage: '/template-previews/willow-breeze.e72051a5.webp', accentFrom: '#d6e3d2', accentTo: '#789484', paperColor: '#f2f1e7', inkColor: '#1a2923', poemY: 48, backgroundPosition: 'center top', scene: true }),
  illustrated({ id: 'grassland-breeze', nameKey: 'templateGrasslandBreeze', descriptionKey: 'templateGrasslandBreezeDesc',
    previewImage: '/template-previews/grassland-breeze.759b146b.webp', accentFrom: '#e5ead3', accentTo: '#819978', paperColor: '#f5eee0', inkColor: '#283b32', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
  illustrated({ id: 'pine-snow', nameKey: 'templatePineSnow', descriptionKey: 'templatePineSnowDesc',
    previewImage: '/template-previews/pine-snow.9cdb0be5.webp', accentFrom: '#e4eef4', accentTo: '#91a8a6', paperColor: '#f3f7f8', inkColor: '#233a42', poemY: 52, backgroundPosition: 'center top', scene: true }),
  illustrated({ id: 'sunset-afterglow', nameKey: 'templateSunsetAfterglow', descriptionKey: 'templateSunsetAfterglowDesc',
    previewImage: '/template-previews/sunset-afterglow.e652e478.webp', accentFrom: '#f5d3bf', accentTo: '#b68983', paperColor: '#f9e4d7', inkColor: '#49302e', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
  illustrated({ id: 'moonlit-landscape', nameKey: 'templateMoonlitLandscape', descriptionKey: 'templateMoonlitLandscapeDesc',
    previewImage: '/template-previews/moonlit-landscape.cc2fbd98.webp', accentFrom: '#eceadf', accentTo: '#77889a', paperColor: '#f2f1e8', inkColor: '#243a4a', poemY: 48, backgroundPosition: 'center top', scene: true }),
  illustrated({ id: 'daffodil-lake', nameKey: 'templateDaffodilLake', descriptionKey: 'templateDaffodilLakeDesc',
    previewImage: '/template-previews/daffodil-lake.fa62ab80.webp', seriesKey: 'templateSeriesEnglishPoetry', accentFrom: '#e9e9ca', accentTo: '#9b9c6a', paperColor: '#f8f0dc', inkColor: '#313c31', poemY: 43, backgroundPosition: 'center' }),
  illustrated({ id: 'autumn-forked-path', nameKey: 'templateAutumnFork', descriptionKey: 'templateAutumnForkDesc',
    previewImage: '/template-previews/autumn-forked-path.7720f097.webp', seriesKey: 'templateSeriesEnglishPoetry', accentFrom: '#f1d4a7', accentTo: '#a87540', paperColor: '#f8e6c6', inkColor: '#493727', poemY: 43, backgroundPosition: 'center' }),
  illustrated({ id: 'dover-beach', nameKey: 'templateDoverBeach', descriptionKey: 'templateDoverBeachDesc',
    previewImage: '/template-previews/dover-beach.3448cf98.webp', seriesKey: 'templateSeriesEnglishPoetry', accentFrom: '#d4dbe5', accentTo: '#8592a8', paperColor: '#e7e7ed', inkColor: '#233447', poemY: 43, backgroundPosition: 'center' }),
  illustrated({ id: 'tudor-rose', nameKey: 'templateTudorRose', descriptionKey: 'templateTudorRoseDesc',
    previewImage: '/template-previews/tudor-rose.ddd7372e.webp', seriesKey: 'templateSeriesEnglishPoetry', accentFrom: '#e8d3ac', accentTo: '#95624c', paperColor: '#f5e6c8', inkColor: '#49362d', poemY: 50, backgroundPosition: 'center' }),
  illustrated({ id: 'feathered-hope', nameKey: 'templateFeatheredHope', descriptionKey: 'templateFeatheredHopeDesc',
    previewImage: '/template-previews/feathered-hope.a00e7022.webp', seriesKey: 'templateSeriesEnglishPoetry', accentFrom: '#e7dfcb', accentTo: '#8c9d8e', paperColor: '#f5eddd', inkColor: '#35453c', poemY: 47, backgroundPosition: 'center top' }),
  illustrated({ id: 'midnight-tyger', nameKey: 'templateMidnightTyger', descriptionKey: 'templateMidnightTygerDesc',
    previewImage: '/template-previews/midnight-tyger.bccb314d.webp', seriesKey: 'templateSeriesEnglishPoetry', accentFrom: '#17273a', accentTo: '#a87947', paperColor: '#101d2e', inkColor: '#f8ead1', poemY: 40, backgroundPosition: 'center bottom' }),
  illustrated({ id: 'western-pass', nameKey: 'templateWesternPass', descriptionKey: 'templateWesternPassDesc',
    previewImage: '/template-previews/western-pass.2df6373c.webp', accentFrom: '#ead7bd', accentTo: '#a28977', paperColor: '#f2e8d7', inkColor: '#493b32', poemY: 43, backgroundPosition: 'center bottom', scene: true }),
];
