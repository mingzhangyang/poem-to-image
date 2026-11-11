import { getStampCharacters, getStampDimensions, isExtendedStampStyle } from './stampRendering';
import type { StampConfig } from './types';

/**
 * Authentic Zhongshan Kingdom bronze-script lettering by Jingfeng Liu (SIL OFL 1.1).
 * This is historical seal script, NOT a fully-covered Xiaozhuan/Miaozhuan font.
 * An immutable upstream revision is loaded on demand (~818 KiB WOFF2).
 * See docs/seal-font-license.md before altering its source or version.
 */
export const SEAL_FONT_FAMILY = 'InkPoem Zhongshan Seal';
export const SEAL_FONT_STACK = '"InkPoem Zhongshan Seal", "Noto Serif SC", serif';
export const SMALL_SEAL_FONT_FAMILY = 'InkPoem Xiaozhuan';
export const SMALL_SEAL_FONT_STACK = '"InkPoem Xiaozhuan", "Noto Serif SC", serif';
/** LXGW Seal: genuine Xiaozhuan, OFL 1.1; 165 seal entries in the 2026-10 table. */
export const SMALL_SEAL_FONT_URL =
  'https://cdn.jsdelivr.net/gh/lxgw/LxgwSeal@2b1d01195168110b9a8f3a8abaff844ff22fa716/TTF/LXGWSeal-Regular.ttf';

export function isSealScriptFont(fontFamily: string): boolean {
  return fontFamily.startsWith('"' + SEAL_FONT_FAMILY + '"')
    || fontFamily.startsWith('"' + SMALL_SEAL_FONT_FAMILY + '"');
}
export const SEAL_FONT_URL =
  'https://cdn.jsdelivr.net/gh/SuperMate-Ai/JFZSKSealScript@a12bf04c0413da28e46cba3d16184ac91ad1bc96/fonts/JFZSKSealScript_V2.0.woff2';

export type StampVisualMode = NonNullable<StampConfig['mode']> | 'legacy';
export type StampPresetId = 'vermillion-name' | 'white-name' | 'literati' | 'modern-calligraphy';

export function getStampVisualMode(stamp: StampConfig): StampVisualMode {
  return stamp.mode ?? 'legacy';
}

export function isTraditionalStamp(stamp: StampConfig): boolean {
  return stamp.mode === 'zhuwen' || stamp.mode === 'baiwen';
}

export const SEAL_PRESET_IDS: readonly StampPresetId[] = [
  'vermillion-name', 'white-name', 'literati', 'modern-calligraphy',
];

/** Update only artistic fields: position, size, text and identity are preserved. */
export function getStampPresetUpdates(preset: StampPresetId): Partial<StampConfig> {
  switch (preset) {
    case 'vermillion-name':
      return { mode: 'zhuwen', style: 'square', colorScheme: 'outline',
        inkColor: '#bc2925', weathering: 18, textureStyle: 'natural', fontFamily: SEAL_FONT_STACK, rotation: 0 };
    case 'white-name':
      return { mode: 'baiwen', style: 'square', colorScheme: 'filled',
        inkColor: '#bd2c25', weathering: 18, textureStyle: 'natural', fontFamily: SEAL_FONT_STACK, rotation: 0 };
    case 'literati':
      return { mode: 'zhuwen', style: 'brush', colorScheme: 'outline',
        inkColor: '#9e2924', weathering: 30, textureStyle: 'natural', fontFamily: SEAL_FONT_STACK, rotation: -5 };
    case 'modern-calligraphy':
      return { mode: 'modern', style: 'round', colorScheme: 'filled',
        inkColor: '#c82829', weathering: 25, textureStyle: 'classic', fontFamily: '"Ma Shan Zheng", cursive', rotation: -8 };
  }
}

export interface TraditionalStampSlot {
  character: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface TraditionalStampLayout {
  borderWidth: number;
  slots: TraditionalStampSlot[];
}

/**
 * Traditional 1–4 character square, round and brush layout remains unchanged.
 * New elongated forms use real rectangular glyph cells, never stretched fonts.
 * Extended 5–8 character texts use right-to-left columns and top-to-bottom rows.
 */
export function getTraditionalStampLayout(
  stamp: Pick<StampConfig, 'size' | 'text'> & Partial<Pick<StampConfig, 'style' | 'shapeRatio'>>,
): TraditionalStampLayout {
  const characters = getStampCharacters(stamp.text);
  const count = characters.length;
  const size = Number.isFinite(stamp.size) && stamp.size > 0 ? stamp.size : 1;
  const style = stamp.style ?? 'square';
  const extended = isExtendedStampStyle(style);
  if (!extended && count <= 4) {
    const usable = size * 0.76;
    const gap = size * 0.055;
    const cols = count === 1 ? 1 : 2;
    const width = cols === 1 ? usable : (usable - gap) / 2;
    const borderWidth = Math.min(size * 0.2, Math.max(0.5, size * 0.038));
    const slots: TraditionalStampSlot[] = characters.map((character, index) => {
      const column = count === 1 ? 0 : count === 2 ? index : Math.floor(index / 2);
      const rightColumn = column === 0;
      const rowsInColumn = count <= 2 ? 1 : (count === 3 && column === 1 ? 1 : 2);
      const row = count <= 2 ? 0 : (count === 3 && column === 1 ? 0 : index % 2);
      const height = rowsInColumn === 1 ? usable : (usable - gap) / 2;
      const x = cols === 1 ? 0 : (rightColumn ? 1 : -1) * (width + gap) / 2;
      const y = rowsInColumn === 1 ? 0 : (row === 0 ? -1 : 1) * (height + gap) / 2;
      const fontSize = Math.min(width * 1.12, height * 1.08);
      return { character, x, y, width, height, fontSize };
    });
    return { borderWidth, slots };
  }

  const { width: faceWidth, height: faceHeight } = getStampDimensions({
    style, size, shapeRatio: stamp.shapeRatio,
  });
  const shortSide = Math.min(faceWidth, faceHeight);
  const borderWidth = Math.min(shortSide * 0.2, Math.max(0.5, shortSide * 0.038));
  const gap = shortSide * 0.045;
  const usableWidth = faceWidth * 0.75;
  const usableHeight = faceHeight * 0.76;
  let columnCounts: number[];
  if ((style === 'rect-vertical' && count <= 6) || (style === 'oval' && count <= 4)) {
    columnCounts = [count]; // a calligraphic vertical line
  } else if (style === 'rect-horizontal') {
    columnCounts = count <= 4
      ? Array.from({ length: count }, () => 1)
      : Array.from({ length: Math.ceil(count / 2) }, (_, index) =>
          Math.min(2, count - index * 2));
  } else {
    columnCounts = [Math.ceil(count / 2), Math.floor(count / 2)];
  }
  const columns = columnCounts.length;
  const cellWidth = (usableWidth - gap * (columns - 1)) / columns;
  const slots: TraditionalStampSlot[] = [];
  let textIndex = 0;
  for (let column = 0; column < columns; column++) {
    const rows = columnCounts[column];
    const cellHeight = (usableHeight - gap * (rows - 1)) / rows;
    const x = usableWidth / 2 - cellWidth / 2 - column * (cellWidth + gap);
    for (let row = 0; row < rows; row++) {
      const y = (row - (rows - 1) / 2) * (cellHeight + gap);
      const fontSize = Math.min(cellWidth * 1.12, cellHeight * 1.08);
      slots.push({ character: characters[textIndex++], x, y, width: cellWidth,
        height: cellHeight, fontSize });
    }
  }
  return { borderWidth, slots };
}

export interface GlyphBounds {
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

/** Optical center and uniform fit, never anisotropic glyph distortion.
 * Round seals also fit the *measured ink bounds*, not just rectangular cells,
 * inside the same inset circle used to clip the Canvas impression.
 */
export function fitTraditionalStampGlyph(
  slot: Pick<TraditionalStampSlot, 'width' | 'height'>,
  bounds: GlyphBounds,
  roundClip?: { x: number; y: number; radius: number } |
    { x: number; y: number; radiusX: number; radiusY: number },
  textScale = 1,
  strokeWidth = 0,
) {
  const left = Number.isFinite(bounds.actualBoundingBoxLeft) ? bounds.actualBoundingBoxLeft : 0;
  const right = Number.isFinite(bounds.actualBoundingBoxRight) ? bounds.actualBoundingBoxRight : 0;
  const ascent = Number.isFinite(bounds.actualBoundingBoxAscent) ? bounds.actualBoundingBoxAscent : 0;
  const descent = Number.isFinite(bounds.actualBoundingBoxDescent) ? bounds.actualBoundingBoxDescent : 0;
  const glyphWidth = Math.max(1, left + right);
  const glyphHeight = Math.max(1, ascent + descent);
  // Stroke thickness is in logical seal pixels, independently of glyph scale.
  // Reserve its full post-transform width rather than scaling it with the font.
  const safeStroke = Number.isFinite(strokeWidth) ? Math.max(0, strokeWidth) : 0;
  const sizeMultiplier = Number.isFinite(textScale) ? Math.min(1.1, Math.max(0.7, textScale)) : 1;
  const fillRatio = 0.88 * sizeMultiplier;
  let scale = Math.max(0, Math.min(
    sizeMultiplier,
    (slot.width * fillRatio - safeStroke) / glyphWidth,
    (slot.height * fillRatio - safeStroke) / glyphHeight,
  ));
  if (roundClip && 'radiusX' in roundClip) {
    // Uniformly fit all four outer ink corners within an elliptical face.
    // A monotonic binary search preserves the glyph aspect ratio and stroke.
    const rx = Math.max(0, roundClip.radiusX);
    const ry = Math.max(0, roundClip.radiusY);
    const inside = (s: number) => rx > 0 && ry > 0
      && ((Math.abs(roundClip.x) + (glyphWidth * s + safeStroke) / 2) / rx) ** 2
       + ((Math.abs(roundClip.y) + (glyphHeight * s + safeStroke) / 2) / ry) ** 2 <= 1;
    if (!inside(0)) scale = 0;
    else {
      let lower = 0;
      let upper = scale;
      for (let index = 0; index < 32; index++) {
        const mid = (lower + upper) / 2;
        if (inside(mid)) lower = mid;
        else upper = mid;
      }
      scale = lower;
    }
  } else if (roundClip && 'radius' in roundClip) {
    // The stroke expands every side by half its unscaled seal-space width.
    // Solve the farthest outer-ink corner against the actual clipping circle.
    const x = Math.abs(roundClip.x) + safeStroke / 2;
    const y = Math.abs(roundClip.y) + safeStroke / 2;
    const radius = Math.max(0, roundClip.radius);
    const remainingRadiusSquared = radius * radius - x * x - y * y;
    if (remainingRadiusSquared <= 0) {
      scale = 0;
    } else {
      const halfWidth = glyphWidth / 2;
      const halfHeight = glyphHeight / 2;
      const a = halfWidth * halfWidth + halfHeight * halfHeight;
      const b = 2 * (x * halfWidth + y * halfHeight);
      const circleScale = 2 * remainingRadiusSquared
        / (b + Math.sqrt(b * b + 4 * a * remainingRadiusSquared));
      scale = Math.min(scale, circleScale);
    }
  }
  return {
    scale,
    offsetX: (left - right) / 2,
    offsetY: (ascent - descent) / 2,
  };
}
