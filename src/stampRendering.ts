import type { StampConfig, StampStyle } from './types';

export interface StampTextPlacement {
  x: number;
  y: number;
}

export const STAMP_INK_COLOR = '#c82829';

export const STAMP_MAX_CHARACTERS = 4;
const COMBINING_MARK = /\p{Mark}/u;

/** Count user-perceived characters, not UTF-16 code units or code points. */
function segmentStampText(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      (part) => part.segment,
    );
  }

  // A conservative fallback for older browsers: never split surrogate pairs,
  // combining accents, variation selectors, or joiner sequences.
  const result: string[] = [];
  let previousWasJoiner = false;
  for (const codePoint of Array.from(text)) {
    const joinsPrevious = COMBINING_MARK.test(codePoint) || codePoint === '\u200d' || previousWasJoiner;
    if (joinsPrevious && result.length > 0) {
      result[result.length - 1] += codePoint;
    } else {
      result.push(codePoint);
    }
    previousWasJoiner = codePoint === '\u200d';
  }
  return result;
}

/** Keep stored input empty if the user cleared it; the visible seal keeps its legacy 印 fallback. */
export function limitStampText(text: string): string {
  return segmentStampText(text).slice(0, STAMP_MAX_CHARACTERS).join('');
}

export function getStampCharacters(text: string): string[] {
  return segmentStampText(text || '印').slice(0, STAMP_MAX_CHARACTERS);
}

export function getStampBorderWidth(size: number) {
  if (!Number.isFinite(size) || size <= 0) return 0;
  // Old drafts can contain seals smaller than the usual 3px border.
  // An inset stroke must not create a negative arc radius.
  return Math.min(size, Math.max(3, Math.round(size * 0.058)));
}

export function getStampCssBorderRadius(style: StampStyle, size: number) {
  if (style === 'round') {
    return '999px';
  }

  if (style === 'brush') {
    return '34% 23% 30% 27% / 26% 36% 24% 34%';
  }

  return `${Math.round(size * 0.12)}px`;
}

export function getStampCanvasRadii(style: StampStyle, size: number) {
  if (style === 'brush') {
    return [size * 0.24, size * 0.16, size * 0.22, size * 0.18];
  }

  return size * 0.12;
}

export function getBrushStampSkew() {
  return {
    skewXDeg: -2,
    skewYDeg: 1,
  };
}

/** Safe, backwards-compatible glyph controls shared by preview and exports. */
export function getStampTextScale(stamp: Pick<StampConfig, 'textScale'>): number {
  const value = stamp.textScale;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1.1, Math.max(0.7, value))
    : 1;
}

export function getStampTextStrokeWidthPct(stamp: Pick<StampConfig, 'textStrokeWidthPct'>): number {
  const value = stamp.textStrokeWidthPct;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(4, Math.max(0, value))
    : 0;
}

export function getStampTextStrokeWidth(stamp: Pick<StampConfig, 'size' | 'textStrokeWidthPct'>): number {
  return Number.isFinite(stamp.size) && stamp.size > 0
    ? stamp.size * getStampTextStrokeWidthPct(stamp) / 100
    : 0;
}

export function getStampTextFontSize(size: number, count: number) {
  return count <= 1 ? size * 0.6 : size * 0.4;
}

export function getStampTextPlacements(size: number, count: number): StampTextPlacement[] {
  const offset = size * 0.25;
  const vo = size * 0.02; // slight vertical offset to center visually

  if (count <= 1) {
    return [{ x: 0, y: vo }];
  }

  if (count === 2) {
    return [
      { x: offset, y: vo },
      { x: -offset, y: vo },
    ];
  }

  if (count === 3) {
    return [
      { x: offset, y: -offset + vo },
      { x: offset, y: offset + vo },
      { x: -offset, y: vo },
    ];
  }

  return [
    { x: offset, y: -offset + vo },
    { x: offset, y: offset + vo },
    { x: -offset, y: -offset + vo },
    { x: -offset, y: offset + vo },
  ];
}

/**
 * Returns a seeded pseudo-random function (mulberry32) derived from the
 * stamp's visible properties. Identical stamps always produce identical
 * weathering, so the texture is stable across re-renders.
 */
export function createStampWeatheringRand(stamp: StampConfig): () => number {
  const key = `${stamp.text}|${stamp.style}|${stamp.size}|${stamp.fontFamily}|${stamp.colorScheme ?? ''}|${stamp.inkColor ?? ''}|${stamp.weathering ?? 50}`;
  let seed = 0;
  for (let i = 0; i < key.length; i++) {
    seed = (Math.imul(31, seed) + key.charCodeAt(i)) | 0;
  }
  seed = seed >>> 0;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


/** Shared affine matrix: CSS preview and Canvas export apply the same rotation and brush skew. */
export function getStampTransform(stamp: Pick<StampConfig, 'style' | 'rotation'>) {
  const angle = (Number.isFinite(stamp.rotation) ? stamp.rotation : 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { skewXDeg, skewYDeg } = getBrushStampSkew();
  const skewX = stamp.style === 'brush' ? Math.tan(skewXDeg * Math.PI / 180) : 0;
  const skewY = stamp.style === 'brush' ? Math.tan(skewYDeg * Math.PI / 180) : 0;
  return {
    a: cos - sin * skewY,
    b: sin + cos * skewY,
    c: cos * skewX - sin,
    d: sin * skewX + cos,
  };
}

export const STAMP_SHADOW_PADDING = 36;
const MAX_STAMP_RASTER_SIDE = 2048;

/**
 * Canvas backing pixels for a logical square. The pixel ratio is capped at
 * 3× and the bitmap at 2048×2048, keeping old/oversized draft data safe.
 */
export function getStampRasterMetrics(logicalSide: number, requestedScale: number) {
  const side = Number.isFinite(logicalSide) && logicalSide > 0 ? logicalSide : 1;
  const scale = Number.isFinite(requestedScale)
    ? Math.min(3, Math.max(1, requestedScale))
    : 1;
  const pixels = Math.max(1, Math.min(MAX_STAMP_RASTER_SIDE, Math.ceil(side * scale)));
  return { pixels, scale: pixels / side };
}

/** The preview's CSS zoom and device DPR both consume backing pixels. */
export function getStampPreviewRasterMetrics(stampSize: number, effectiveScale: number, devicePixelRatio: number) {
  return getStampRasterMetrics(
    stampSize + STAMP_SHADOW_PADDING * 2,
    effectiveScale * devicePixelRatio,
  );
}

/** One deliberately subtle ink-colored shadow for both preview and exported artwork. */
export function getStampShadow(stamp: StampConfig) {
  const inkColor = stamp.inkColor ?? STAMP_INK_COLOR;
  const color = /^#[0-9a-f]{6}$/i.test(inkColor) ? inkColor : STAMP_INK_COLOR;
  return {
    color: color + ((stamp.mode === 'zhuwen' || (stamp.mode !== 'baiwen' && stamp.colorScheme === 'outline')) ? '1f' : '38'),
    blur: 12,
    offsetX: 0,
    offsetY: 5,
  };
}
