import type { StampConfig, StampStyle } from './types';

export interface StampTextPlacement {
  x: number;
  y: number;
}

export const STAMP_INK_COLOR = '#c82829';

export function getStampCharacters(text: string) {
  return Array.from(text || '印').slice(0, 4);
}

export function getStampBorderWidth(size: number) {
  return Math.max(3, Math.round(size * 0.058));
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
  const key = `${stamp.text}|${stamp.style}|${stamp.size}|${stamp.fontFamily}|${stamp.colorScheme ?? ''}`;
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
