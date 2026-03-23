import type { Point, InsetBounds } from './types';

export function toFiniteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeBorderWidth(borderWidth: number) {
  return Math.max(2, toFiniteNumber(borderWidth, 4));
}

export function normalizeDimension(value: number, fallback: number) {
  return Math.max(1, toFiniteNumber(value, fallback));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(hexColor: string) {
  const normalized = hexColor.trim();
  const shortMatch = /^#([\da-fA-F]{3})$/.exec(normalized);
  const longMatch = /^#([\da-fA-F]{6})$/.exec(normalized);

  if (shortMatch) {
    const expanded = shortMatch[1].split('').map((digit) => `${digit}${digit}`).join('');
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  if (longMatch) {
    return {
      r: Number.parseInt(longMatch[1].slice(0, 2), 16),
      g: Number.parseInt(longMatch[1].slice(2, 4), 16),
      b: Number.parseInt(longMatch[1].slice(4, 6), 16),
    };
  }

  return null;
}

export function toRgbaColor(color: string, alpha: number) {
  const rgb = parseHexColor(color);
  const safeAlpha = clamp(toFiniteNumber(alpha, 1), 0, 1);

  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha.toFixed(3)})`;
}

function wave(t: number, roughness: number, seed: number) {
  return Math.sin(t * Math.PI * 2 + seed) * roughness * 0.64
    + Math.sin(t * Math.PI * 4 + seed * 1.21) * roughness * 0.18
    + Math.cos(t * Math.PI * 6 + seed * 0.73) * roughness * 0.08;
}

export function getInsetBounds(width: number, height: number, inset: number): InsetBounds {
  const safeWidth = normalizeDimension(width, 100);
  const safeHeight = normalizeDimension(height, 100);
  const safeInset = Math.max(0, toFiniteNumber(inset, 0));

  const left = safeInset;
  const top = safeInset;
  const right = Math.max(left + 1, safeWidth - safeInset);
  const bottom = Math.max(top + 1, safeHeight - safeInset);

  return { left, top, right, bottom };
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

export function toSmoothClosedPath(points: Point[]) {
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

export function toClosedPolylinePath(points: Point[]) {
  if (points.length < 2) {
    return '';
  }

  const pathParts = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let index = 1; index < points.length; index += 1) {
    pathParts.push(`L ${points[index].x.toFixed(2)} ${points[index].y.toFixed(2)}`);
  }

  pathParts.push('Z');
  return pathParts.join(' ');
}

export function buildHandDrawnPath(width: number, height: number, inset: number, roughness: number, seed: number, segments = 18) {
  const safeRoughness = Math.max(0, toFiniteNumber(roughness, 1));
  const safeSeed = toFiniteNumber(seed, 0);
  const safeSegments = Math.max(10, Math.round(toFiniteNumber(segments, 18)));
  const { left, top, right, bottom } = getInsetBounds(width, height, inset);
  const points: Point[] = [];

  appendHandDrawnEdgePoints(points, left, top, right, top, safeRoughness * 0.72, safeSeed + 0.25, safeSegments, 'y');
  appendHandDrawnEdgePoints(points, right, top, right, bottom, safeRoughness * 0.58, safeSeed + 1.1, safeSegments, 'x');
  appendHandDrawnEdgePoints(points, right, bottom, left, bottom, safeRoughness * 0.76, safeSeed + 2.05, safeSegments, 'y');
  appendHandDrawnEdgePoints(points, left, bottom, left, top, safeRoughness * 0.62, safeSeed + 3.15, safeSegments, 'x');

  return toSmoothClosedPath(points);
}

export function toRectPath(left: number, top: number, right: number, bottom: number) {
  return [
    `M ${left.toFixed(2)} ${top.toFixed(2)}`,
    `L ${right.toFixed(2)} ${top.toFixed(2)}`,
    `L ${right.toFixed(2)} ${bottom.toFixed(2)}`,
    `L ${left.toFixed(2)} ${bottom.toFixed(2)}`,
    'Z',
  ].join(' ');
}
