import type { BorderStyle } from './types';

interface OrganicBorderStroke {
  path: string;
  opacity: number;
  width: number;
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
  return Math.sin(t * Math.PI * 2 + seed) * roughness + Math.sin(t * Math.PI * 5 + seed * 1.37) * roughness * 0.45;
}

function buildHandDrawnPath(width: number, height: number, inset: number, roughness: number, seed: number, segments = 18) {
  const safeWidth = normalizeDimension(width, 100);
  const safeHeight = normalizeDimension(height, 100);
  const safeInset = Math.max(0, toFiniteNumber(inset, 0));
  const safeRoughness = Math.max(0, toFiniteNumber(roughness, 1));
  const safeSeed = toFiniteNumber(seed, 0);
  const safeSegments = Math.max(8, Math.round(toFiniteNumber(segments, 18)));
  const left = safeInset;
  const top = safeInset;
  const right = safeWidth - safeInset;
  const bottom = safeHeight - safeInset;
  const pathParts: string[] = [];

  for (let index = 0; index <= safeSegments; index += 1) {
    const t = index / safeSegments;
    const x = left + (right - left) * t;
    const y = top + wave(t, safeRoughness, safeSeed + 0.3);
    pathParts.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  for (let index = 1; index <= safeSegments; index += 1) {
    const t = index / safeSegments;
    const x = right + wave(t, safeRoughness * 0.9, safeSeed + 1.1);
    const y = top + (bottom - top) * t;
    pathParts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  for (let index = 1; index <= safeSegments; index += 1) {
    const t = index / safeSegments;
    const x = right - (right - left) * t;
    const y = bottom + wave(t, safeRoughness * 1.1, safeSeed + 2.2);
    pathParts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  for (let index = 1; index <= safeSegments; index += 1) {
    const t = index / safeSegments;
    const x = left + wave(t, safeRoughness * 0.95, safeSeed + 3.4);
    const y = bottom - (bottom - top) * t;
    pathParts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  pathParts.push('Z');
  return pathParts.join(' ');
}

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
        path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 0.55, Math.max(1.5, safeBorderWidth * 0.62), 0.35, 24),
        opacity: 0.96,
        width: Math.max(1.8, safeBorderWidth * 0.55),
      },
      {
        path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 1.15, Math.max(1.1, safeBorderWidth * 0.38), 1.4, 22),
        opacity: 0.72,
        width: Math.max(1.2, safeBorderWidth * 0.33),
      },
      {
        path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 1.9, Math.max(0.8, safeBorderWidth * 0.22), 2.75, 20),
        opacity: 0.32,
        width: Math.max(0.9, safeBorderWidth * 0.16),
      },
    ];
  }

  return [
    {
      path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 0.75, Math.max(0.9, safeBorderWidth * 0.42), 0.8),
      opacity: 0.92,
      width: Math.max(1.4, safeBorderWidth * 0.42),
    },
    {
      path: buildHandDrawnPath(safeWidth, safeHeight, safeBorderWidth * 1.55, Math.max(0.65, safeBorderWidth * 0.24), 2.1),
      opacity: 0.58,
      width: Math.max(1, safeBorderWidth * 0.26),
    },
  ];
}