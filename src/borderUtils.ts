import type { BorderStyle } from './types';

interface OrganicBorderStroke {
  path: string;
  opacity: number;
  width: number;
}

interface Point {
  x: number;
  y: number;
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

export function getBorderPadding(borderWidth: number, borderStyle: BorderStyle) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const borderAllowance = borderStyle === 'double'
    ? safeBorderWidth * 2.8
    : borderStyle === 'ink'
      ? safeBorderWidth * 2.6
      : safeBorderWidth * 2;
  return Math.max(24, Math.round(16 + borderAllowance));
}

export function createOrganicBorderStrokes(width: number, height: number, borderWidth: number, borderStyle: Extract<BorderStyle, 'brush' | 'ink'>): OrganicBorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const safeWidth = normalizeDimension(width, 100);
  const safeHeight = normalizeDimension(height, 100);

  if (borderStyle === 'ink') {
    return [
      {
        path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 1.2, Math.max(0.5, safeBorderWidth * 0.15), 1.5, 36),
        opacity: 0.9,
        width: safeBorderWidth,
      },
    ];
  }

  // brush (handwritten japanese-magazine style)
  return [
    {
      path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 1.2, Math.max(0.7, safeBorderWidth * 0.25), 2.8, 48),
      opacity: 0.95,
      width: Math.max(2, safeBorderWidth * 0.9),
    },
  ];
}