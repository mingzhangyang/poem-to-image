import { getStampCharacters } from './stampRendering';
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
        inkColor: '#bc2925', weathering: 18, fontFamily: SEAL_FONT_STACK, rotation: 0 };
    case 'white-name':
      return { mode: 'baiwen', style: 'square', colorScheme: 'filled',
        inkColor: '#bd2c25', weathering: 18, fontFamily: SEAL_FONT_STACK, rotation: 0 };
    case 'literati':
      return { mode: 'zhuwen', style: 'brush', colorScheme: 'outline',
        inkColor: '#9e2924', weathering: 30, fontFamily: SEAL_FONT_STACK, rotation: -5 };
    case 'modern-calligraphy':
      return { mode: 'modern', style: 'round', colorScheme: 'filled',
        inkColor: '#c82829', weathering: 25, fontFamily: '"Ma Shan Zheng", cursive', rotation: -8 };
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
 * A single shared pure seal-composition layout. Columns read right-to-left;
 * within each column characters read top-to-bottom. For a 3-character seal,
 * the leftmost character spans the full height and stays visually centered.
 * Everything is proportional to the logical seal size (no pixel breakpoints).
 */
export function getTraditionalStampLayout(stamp: Pick<StampConfig, 'size' | 'text'>): TraditionalStampLayout {
  const characters = getStampCharacters(stamp.text);
  const count = characters.length;
  const size = Number.isFinite(stamp.size) && stamp.size > 0 ? stamp.size : 1;
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
  roundClip?: { x: number; y: number; radius: number },
) {
  const left = Number.isFinite(bounds.actualBoundingBoxLeft) ? bounds.actualBoundingBoxLeft : 0;
  const right = Number.isFinite(bounds.actualBoundingBoxRight) ? bounds.actualBoundingBoxRight : 0;
  const ascent = Number.isFinite(bounds.actualBoundingBoxAscent) ? bounds.actualBoundingBoxAscent : 0;
  const descent = Number.isFinite(bounds.actualBoundingBoxDescent) ? bounds.actualBoundingBoxDescent : 0;
  const glyphWidth = Math.max(1, left + right);
  const glyphHeight = Math.max(1, ascent + descent);
  let scale = Math.min(1, slot.width * 0.88 / glyphWidth, slot.height * 0.88 / glyphHeight);
  if (roundClip) {
    // After optical centering, the farthest ink corner is
    // (|x| + halfGlyphWidth * scale, |y| + halfGlyphHeight * scale).
    // Solve its circle inequality instead of clipping the outer strokes.
    const x = Math.abs(roundClip.x);
    const y = Math.abs(roundClip.y);
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
