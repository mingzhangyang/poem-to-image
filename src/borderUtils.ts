import type { BorderStyle } from './types';

export type OrganicBorderStyle = Extract<BorderStyle, 'brush' | 'ink'>;

export interface OrganicBorderStroke {
  path: string;
  opacity: number;
  width: number;
}

interface Point {
  x: number;
  y: number;
}

interface OrganicBorderLayerConfig {
  insetMultiplier: number;
  roughnessMultiplier: number;
  minRoughness: number;
  opacity: number;
  widthMultiplier: number;
  minWidth: number;
  seed: number;
  segmentDensity: number;
  minSegments: number;
  maxSegments: number;
}

interface OrganicBorderConfig {
  basePadding: number;
  minPadding: number;
  layers: OrganicBorderLayerConfig[];
}

interface DoubleBorderMetrics {
  lineWidth: number;
  innerInset: number;
  maxPaintInset: number;
}

function toFiniteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBorderWidth(borderWidth: number) {
  return Math.max(2, toFiniteNumber(borderWidth, 4));
}

function normalizeDimension(value: number, fallback: number) {
  return Math.max(1, toFiniteNumber(value, fallback));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wave(t: number, roughness: number, seed: number) {
  return Math.sin(t * Math.PI * 2 + seed) * roughness * 0.64
    + Math.sin(t * Math.PI * 4 + seed * 1.21) * roughness * 0.18
    + Math.cos(t * Math.PI * 6 + seed * 0.73) * roughness * 0.08;
}

function appendHandDrawnEdgePoints(
  points: Point[],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  roughness: number,
  seed: number,
  segments: number,
  offsetAxis: 'x' | 'y',
) {
  const startIndex = points.length === 0 ? 0 : 1;

  for (let index = startIndex; index <= segments; index += 1) {
    const t = index / segments;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    const offset = wave(t, roughness, seed);

    points.push({
      x: offsetAxis === 'x' ? x + offset : x,
      y: offsetAxis === 'y' ? y + offset : y,
    });
  }
}

function toSmoothClosedPath(points: Point[]) {
  if (points.length < 2) {
    return '';
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const startX = (lastPoint.x + firstPoint.x) / 2;
  const startY = (lastPoint.y + firstPoint.y) / 2;
  const pathParts = [`M ${startX.toFixed(2)} ${startY.toFixed(2)}`];

  for (let index = 0; index < points.length; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const midpointX = (currentPoint.x + nextPoint.x) / 2;
    const midpointY = (currentPoint.y + nextPoint.y) / 2;
    pathParts.push(
      `Q ${currentPoint.x.toFixed(2)} ${currentPoint.y.toFixed(2)} ${midpointX.toFixed(2)} ${midpointY.toFixed(2)}`,
    );
  }

  pathParts.push('Z');
  return pathParts.join(' ');
}

function buildHandDrawnPath(width: number, height: number, inset: number, roughness: number, seed: number, segments = 18) {
  const safeWidth = normalizeDimension(width, 100);
  const safeHeight = normalizeDimension(height, 100);
  const safeInset = Math.max(0, toFiniteNumber(inset, 0));
  const safeRoughness = Math.max(0, toFiniteNumber(roughness, 1));
  const safeSeed = toFiniteNumber(seed, 0);
  const safeSegments = Math.max(10, Math.round(toFiniteNumber(segments, 18)));
  const left = safeInset;
  const top = safeInset;
  const right = Math.max(left + 1, safeWidth - safeInset);
  const bottom = Math.max(top + 1, safeHeight - safeInset);
  const points: Point[] = [];

  appendHandDrawnEdgePoints(points, left, top, right, top, safeRoughness * 0.72, safeSeed + 0.25, safeSegments, 'y');
  appendHandDrawnEdgePoints(points, right, top, right, bottom, safeRoughness * 0.58, safeSeed + 1.1, safeSegments, 'x');
  appendHandDrawnEdgePoints(points, right, bottom, left, bottom, safeRoughness * 0.76, safeSeed + 2.05, safeSegments, 'y');
  appendHandDrawnEdgePoints(points, left, bottom, left, top, safeRoughness * 0.62, safeSeed + 3.15, safeSegments, 'x');

  return toSmoothClosedPath(points);
}

// No longer needed: base rect removed for organic styles

const ORGANIC_BORDER_CONFIGS: Record<OrganicBorderStyle, OrganicBorderConfig> = {
  brush: {
    basePadding: 16,
    minPadding: 26,
    layers: [
      {
        insetMultiplier: 1.22,
        roughnessMultiplier: 0.46,
        minRoughness: 1.05,
        opacity: 0.22,
        widthMultiplier: 1.28,
        minWidth: 2,
        seed: 2.8,
        segmentDensity: 17,
        minSegments: 28,
        maxSegments: 96,
      },
      {
        insetMultiplier: 1.22,
        roughnessMultiplier: 0.46,
        minRoughness: 1.05,
        opacity: 0.9,
        widthMultiplier: 0.9,
        minWidth: 2,
        seed: 2.8,
        segmentDensity: 17,
        minSegments: 28,
        maxSegments: 108,
      },
    ],
  },
  ink: {
    basePadding: 18,
    minPadding: 28,
    layers: [
      {
        insetMultiplier: 1.12,
        roughnessMultiplier: 0.12,
        minRoughness: 0.48,
        opacity: 0.16,
        widthMultiplier: 1.32,
        minWidth: 2.4,
        seed: 1.72,
        segmentDensity: 28,
        minSegments: 14,
        maxSegments: 72,
      },
      {
        insetMultiplier: 1.12,
        roughnessMultiplier: 0.12,
        minRoughness: 0.48,
        opacity: 0.86,
        widthMultiplier: 0.95,
        minWidth: 2,
        seed: 1.72,
        segmentDensity: 28,
        minSegments: 14,
        maxSegments: 72,
      },
    ],
  },
};

function getOrganicBorderConfig(borderStyle: OrganicBorderStyle) {
  return ORGANIC_BORDER_CONFIGS[borderStyle];
}

function getOrganicLayerSegments(width: number, height: number, layer: OrganicBorderLayerConfig) {
  const perimeter = (normalizeDimension(width, 100) + normalizeDimension(height, 100)) * 2;
  return clamp(Math.round(perimeter / layer.segmentDensity), layer.minSegments, layer.maxSegments);
}

function getOrganicLayerStrokeWidth(borderWidth: number, layer: OrganicBorderLayerConfig) {
  return Math.max(layer.minWidth, borderWidth * layer.widthMultiplier);
}

function getOrganicLayerInset(borderWidth: number, layer: OrganicBorderLayerConfig) {
  return borderWidth / 2 + layer.insetMultiplier;
}

function getOrganicLayerRoughness(
  width: number,
  height: number,
  borderWidth: number,
  layer: OrganicBorderLayerConfig,
) {
  const sizeLimit = Math.min(normalizeDimension(width, 100), normalizeDimension(height, 100)) * 0.045;
  return Math.min(sizeLimit, Math.max(layer.minRoughness, borderWidth * layer.roughnessMultiplier));
}

function getOrganicPadding(borderWidth: number, borderStyle: OrganicBorderStyle) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const config = getOrganicBorderConfig(borderStyle);
  const bleed = config.layers.reduce((maxBleed, layer) => Math.max(maxBleed, getOrganicLayerPaintInset(safeBorderWidth, layer)), 0);

  return Math.max(config.minPadding, Math.round(config.basePadding + bleed));
}

function getOrganicLayerPaintInset(borderWidth: number, layer: OrganicBorderLayerConfig) {
  const strokeWidth = getOrganicLayerStrokeWidth(borderWidth, layer);
  return getOrganicLayerInset(borderWidth, layer)
    + strokeWidth / 2
    + Math.max(layer.minRoughness, borderWidth * layer.roughnessMultiplier);
}

export function getDoubleBorderMetrics(borderWidth: number): DoubleBorderMetrics {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const lineWidth = Math.max(1.25, safeBorderWidth * 0.32);
  const gap = Math.max(1.5, safeBorderWidth * 0.36);
  const innerInset = lineWidth + gap;

  return {
    lineWidth,
    innerInset,
    maxPaintInset: innerInset + lineWidth / 2,
  };
}

function getBorderPaintInset(borderWidth: number, borderStyle: BorderStyle) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);

  if (isOrganicBorderStyle(borderStyle)) {
    return getOrganicBorderConfig(borderStyle).layers.reduce(
      (maxBleed, layer) => Math.max(maxBleed, getOrganicLayerPaintInset(safeBorderWidth, layer)),
      0,
    );
  }

  if (borderStyle === 'double') {
    return getDoubleBorderMetrics(safeBorderWidth).maxPaintInset;
  }

  return safeBorderWidth;
}

export function isOrganicBorderStyle(borderStyle: BorderStyle): borderStyle is OrganicBorderStyle {
  return borderStyle === 'brush' || borderStyle === 'ink';
}

export function getBorderPadding(borderWidth: number, borderStyle: BorderStyle) {
  if (isOrganicBorderStyle(borderStyle)) {
    return getOrganicPadding(borderWidth, borderStyle);
  }

  return Math.max(24, Math.round(16 + getBorderPaintInset(borderWidth, borderStyle)));
}

export function createOrganicBorderStrokes(
  width: number,
  height: number,
  borderWidth: number,
  borderStyle: OrganicBorderStyle,
): OrganicBorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const safeWidth = normalizeDimension(width, 100);
  const safeHeight = normalizeDimension(height, 100);
  const config = getOrganicBorderConfig(borderStyle);

  return config.layers.map((layer) => ({
    path: buildHandDrawnPath(
      safeWidth,
      safeHeight,
      getOrganicLayerInset(safeBorderWidth, layer),
      getOrganicLayerRoughness(safeWidth, safeHeight, safeBorderWidth, layer),
      layer.seed,
      getOrganicLayerSegments(safeWidth, safeHeight, layer),
    ),
    opacity: layer.opacity,
    width: getOrganicLayerStrokeWidth(safeBorderWidth, layer),
  }));
}
