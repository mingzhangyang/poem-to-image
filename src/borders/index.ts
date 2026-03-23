import type { BorderStyle } from '../types';
import { normalizeBorderWidth, toRgbaColor } from './utils';
import {
  isOrganicBorderStyle,
  isHandDrawnBorderStyle,
  isProceduralBorderStyle,
  getOrganicBorderConfig,
  getProceduralBorderConfig,
  getOrganicLayerPaintInset,
  getProceduralLayerPaintInset,
  getOrganicPadding,
  getProceduralPadding,
} from './organic';
import { getDoubleBorderMetrics } from './vector';

export type { OrganicBorderStyle, VectorBorderStyle, OrganicBorderStroke, BorderStroke, DoubleBorderMetrics } from './types';
export { isOrganicBorderStyle, createOrganicBorderStrokes } from './organic';
export { getDoubleBorderMetrics, createVectorBorderStrokes } from './vector';

export function isInsetBorderStyle(borderStyle: BorderStyle) {
  return borderStyle === 'solid'
    || borderStyle === 'dashed'
    || borderStyle === 'double'
    || borderStyle === 'gradient';
}

export function isShadowBorderStyle(borderStyle: BorderStyle) {
  return borderStyle === 'shadow';
}

export function isGradientBorderStyle(borderStyle: BorderStyle) {
  return borderStyle === 'gradient';
}

export function isVectorBorderStyle(borderStyle: BorderStyle) {
  return isOrganicBorderStyle(borderStyle)
    || borderStyle === 'broken'
    || borderStyle === 'overflow'
    || borderStyle === 'ornamental'
    || borderStyle === 'envelope';
}

export function toRgba(color: string, alpha: number) {
  return toRgbaColor(color, alpha);
}

export function getBorderGradientStops(color: string): [string, string, string] {
  return [toRgbaColor(color, 0.34), color, toRgbaColor(color, 0.3)];
}

export function getBorderGradientCss(color: string) {
  const [start, mid, end] = getBorderGradientStops(color);
  return `linear-gradient(132deg, ${start} 0%, ${mid} 48%, ${end} 100%)`;
}

export function getBorderShadowCss(color: string, borderWidth: number) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const innerStroke = Math.max(1, safeBorderWidth * 0.22);
  const liftY = Math.max(8, safeBorderWidth * 1.7);
  const blur = Math.max(16, safeBorderWidth * 4.6);
  const spread = Math.max(1, safeBorderWidth * 0.56);
  const ambientBlur = Math.max(22, safeBorderWidth * 6.2);

  return [
    `inset 0 0 0 ${innerStroke.toFixed(2)}px ${toRgbaColor(color, 0.2)}`,
    `0 ${liftY.toFixed(2)}px ${blur.toFixed(2)}px ${spread.toFixed(2)}px ${toRgbaColor(color, 0.33)}`,
    `0 ${(liftY * 0.55).toFixed(2)}px ${ambientBlur.toFixed(2)}px ${toRgbaColor(color, 0.16)}`,
  ].join(', ');
}

function getBorderPaintInset(borderWidth: number, borderStyle: BorderStyle) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);

  if (borderStyle === 'shadow') {
    return Math.max(14, safeBorderWidth * 3.8);
  }

  if (borderStyle === 'overflow') {
    return Math.max(safeBorderWidth * 2.1, 14);
  }

  if (borderStyle === 'ornamental') {
    return Math.max(safeBorderWidth * 2.4, 15);
  }

  if (borderStyle === 'envelope') {
    return Math.max(safeBorderWidth * 1.9, 14);
  }

  if (isOrganicBorderStyle(borderStyle)) {
    if (isHandDrawnBorderStyle(borderStyle)) {
      return getOrganicBorderConfig(borderStyle).layers.reduce(
        (maxBleed, layer) => Math.max(maxBleed, getOrganicLayerPaintInset(safeBorderWidth, layer)),
        0,
      );
    }

    if (isProceduralBorderStyle(borderStyle)) {
      return getProceduralBorderConfig(borderStyle).layers.reduce(
        (maxBleed, layer) => Math.max(maxBleed, getProceduralLayerPaintInset(safeBorderWidth, layer)),
        0,
      );
    }
  }

  if (borderStyle === 'double') {
    return getDoubleBorderMetrics(safeBorderWidth).maxPaintInset;
  }

  return safeBorderWidth;
}

export function getBorderPadding(borderWidth: number, borderStyle: BorderStyle) {
  if (isOrganicBorderStyle(borderStyle)) {
    if (isHandDrawnBorderStyle(borderStyle)) {
      return getOrganicPadding(borderWidth, borderStyle);
    }

    if (isProceduralBorderStyle(borderStyle)) {
      return getProceduralPadding(borderWidth, borderStyle);
    }
  }

  return Math.max(24, Math.round(16 + getBorderPaintInset(borderWidth, borderStyle)));
}
