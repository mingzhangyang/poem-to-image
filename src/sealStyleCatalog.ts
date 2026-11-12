import type { TranslationKey } from './translations';
import type { StampConfig } from './types';
import { SEAL_FONT_STACK, getStampPresetUpdates } from './sealTypography';
import { getStampTextScale, getStampTextStrokeWidthPct } from './stampRendering';

/**
 * Eight traditional use cases, with separate Zhu/Bai name seals and a
 * modern-calligraphy option. The category is not the geometric shape:
 * users can change shape, ink or text independently after applying a design.
 */
export const SEAL_STYLE_DESIGN_IDS = [
  'name-vermilion', 'name-white', 'literati', 'studio', 'auspicious',
  'collector', 'graphic', 'landscape', 'blessing', 'modern',
] as const;
export type SealStyleDesignId = (typeof SEAL_STYLE_DESIGN_IDS)[number];
export type SealStyleDesignGroup = 'text' | 'graphic';

export interface SealStyleDesignInfo {
  group: SealStyleDesignGroup;
  labelKey: TranslationKey;
  /** A gallery example only. Choosing a style never silently sets text. */
  sampleText?: string;
}

export const SEAL_STYLE_DESIGN_INFO: Readonly<Record<SealStyleDesignId, SealStyleDesignInfo>> = {
  'name-vermilion': { group: 'text', labelKey: 'stampPresetVermilion', sampleText: '李明之印' },
  'name-white': { group: 'text', labelKey: 'stampPresetWhite', sampleText: '李明之印' },
  literati: { group: 'text', labelKey: 'stampPresetLiterati', sampleText: '清心' },
  studio: { group: 'text', labelKey: 'stampDesignStudio', sampleText: '书画之印' },
  auspicious: { group: 'text', labelKey: 'stampDesignAuspicious', sampleText: '如意' },
  collector: { group: 'text', labelKey: 'stampDesignCollector', sampleText: '书画珍藏' },
  graphic: { group: 'graphic', labelKey: 'stampDesignGraphic' },
  landscape: { group: 'graphic', labelKey: 'stampDesignLandscape' },
  blessing: { group: 'text', labelKey: 'stampDesignBlessing', sampleText: '吉祥' },
  modern: { group: 'text', labelKey: 'stampPresetModern', sampleText: '雅' },
};

// Text cards set reproducible glyph defaults; graphic cards preserve hidden text tuning.
const TEXT_GLYPH_DEFAULTS = { textScale: 1, textStrokeWidthPct: 0 } as const;

const TRADITIONAL_INK = { inkColor: '#b33227', weathering: 18,
  textureStyle: 'natural' as const, rotation: 0 };

/** Apply only a chosen visual direction, never the example's name or phrase. */
export function getSealStyleDesignUpdates(id: SealStyleDesignId): Partial<StampConfig> {
  switch (id) {
    case 'name-vermilion':
      return { ...getStampPresetUpdates('vermillion-name'), ...TEXT_GLYPH_DEFAULTS, motifId: undefined };
    case 'name-white':
      return { ...getStampPresetUpdates('white-name'), ...TEXT_GLYPH_DEFAULTS, motifId: undefined };
    case 'literati':
      return { ...getStampPresetUpdates('literati'), ...TEXT_GLYPH_DEFAULTS, motifId: undefined };
    case 'modern':
      return { ...getStampPresetUpdates('modern-calligraphy'), ...TEXT_GLYPH_DEFAULTS, motifId: undefined };
    case 'studio':
      return { ...TRADITIONAL_INK, ...TEXT_GLYPH_DEFAULTS, mode: 'zhuwen', style: 'rect-vertical', shapeRatio: 0.58,
        colorScheme: 'outline', motifId: undefined, fontFamily: SEAL_FONT_STACK };
    case 'auspicious':
      return { ...TRADITIONAL_INK, ...TEXT_GLYPH_DEFAULTS, mode: 'baiwen', style: 'oval', shapeRatio: 0.68,
        colorScheme: 'filled', motifId: undefined, fontFamily: SEAL_FONT_STACK };
    case 'collector':
      return { ...TRADITIONAL_INK, ...TEXT_GLYPH_DEFAULTS, mode: 'baiwen', style: 'rect-horizontal', shapeRatio: 0.82,
        colorScheme: 'filled', motifId: undefined, fontFamily: SEAL_FONT_STACK };
    case 'graphic':
      return { ...TRADITIONAL_INK, mode: 'zhuwen', style: 'round',
        colorScheme: 'outline', motifId: 'dragon' };
    case 'landscape':
      return { ...TRADITIONAL_INK, mode: 'zhuwen', style: 'square',
        colorScheme: 'outline', motifId: 'landscape' };
    case 'blessing':
      return { ...TRADITIONAL_INK, ...TEXT_GLYPH_DEFAULTS, mode: 'baiwen', style: 'brush',
        colorScheme: 'filled', motifId: undefined, fontFamily: SEAL_FONT_STACK };
  }
}

/** The active card is derived from the persisted stamp, not extra UI state. */
export function getActiveSealStyleDesign(stamp: StampConfig): SealStyleDesignId | null {
  for (const id of SEAL_STYLE_DESIGN_IDS) {
    const updates = getSealStyleDesignUpdates(id);
    // A custom ink, font, ratio, or texture adjustment must not leave a
    // misleading "selected" badge on a gallery style card.
    if (Object.entries(updates).every(([key, value]) => {
      // Older artwork omits these optional fields; undefined means 1 / 0.
      if (key === 'textScale') return getStampTextScale(stamp) === value;
      if (key === 'textStrokeWidthPct') return getStampTextStrokeWidthPct(stamp) === value;
      return stamp[key as keyof StampConfig] === value;
    })) {
      return id;
    }
  }
  return null;
}

/**
 * Preview-only, fixed-size independent scene; no customer text is sampled
 * and no changed preview settings are written to a real artwork.
 */
export function getSealStyleDesignPreview(id: SealStyleDesignId): StampConfig {
  const info = SEAL_STYLE_DESIGN_INFO[id];
  const updates = getSealStyleDesignUpdates(id);
  return {
    text: info.sampleText ?? '',
    style: 'square',
    mode: 'zhuwen',
    colorScheme: 'outline',
    inkColor: '#b33227',
    weathering: 16,
    textureStyle: 'natural',
    textureSeed: 0x4c3b2a10,
    fontFamily: SEAL_FONT_STACK,
    size: 70,
    rotation: 0,
    opacity: 1,
    positionX: 50,
    positionY: 50,
    ...updates,
    // An editorial thumbnail is always readable, still follows actual
    // body, geometry, glyph and weathering drawing routines.
    size: 70,
    rotation: 0,
    opacity: 1,
    weathering: 16,
    inkColor: '#b33227',
    textureStyle: 'natural',
  };
}

/** A deterministic preview of one editable graphic motif for the gallery. */
export function getSealMotifPreview(motifId: NonNullable<StampConfig['motifId']>): StampConfig {
  return {
    ...getSealStyleDesignPreview('graphic'),
    motifId,
  };
}
