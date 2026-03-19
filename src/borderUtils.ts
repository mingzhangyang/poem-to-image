import type { BorderStyle } from './types';

export type OrganicBorderStyle = Extract<BorderStyle, 'brush' | 'ink' | 'cloud' | 'wave' | 'fractal' | 'meander' | 'leiwen'>;
type HandDrawnBorderStyle = Extract<OrganicBorderStyle, 'brush' | 'ink'>;
type ProceduralBorderStyle = Exclude<OrganicBorderStyle, HandDrawnBorderStyle>;
export type VectorBorderStyle = OrganicBorderStyle | Extract<BorderStyle, 'broken' | 'overflow' | 'ornamental' | 'envelope'>;
type ProceduralPatternMode = 'cloud' | 'wave' | 'square' | 'fractal';

export interface OrganicBorderStroke {
  path: string;
  opacity: number;
  width: number;
}

export interface BorderStroke {
  path: string;
  opacity: number;
  width: number;
  dash?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
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

interface ProceduralBorderLayerConfig {
  insetMultiplier: number;
  amplitudeMultiplier: number;
  minAmplitude: number;
  opacity: number;
  widthMultiplier: number;
  minWidth: number;
  wavelengthMultiplier: number;
  minWavelength: number;
  phase: number;
}

interface ProceduralBorderConfig {
  mode: ProceduralPatternMode;
  basePadding: number;
  minPadding: number;
  layers: ProceduralBorderLayerConfig[];
}

interface DoubleBorderMetrics {
  lineWidth: number;
  innerInset: number;
  maxPaintInset: number;
}

interface InsetBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
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

function toRgbaColor(color: string, alpha: number) {
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

function getInsetBounds(width: number, height: number, inset: number): InsetBounds {
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

function toClosedPolylinePath(points: Point[]) {
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

function buildHandDrawnPath(width: number, height: number, inset: number, roughness: number, seed: number, segments = 18) {
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

const ORGANIC_BORDER_CONFIGS: Record<HandDrawnBorderStyle, OrganicBorderConfig> = {
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

const PROCEDURAL_BORDER_CONFIGS: Record<ProceduralBorderStyle, ProceduralBorderConfig> = {
  cloud: {
    mode: 'cloud',
    basePadding: 14,
    minPadding: 24,
    layers: [
      {
        insetMultiplier: 1.08,
        amplitudeMultiplier: 1.18,
        minAmplitude: 2.8,
        opacity: 0.2,
        widthMultiplier: 1.2,
        minWidth: 2,
        wavelengthMultiplier: 8.2,
        minWavelength: 42,
        phase: 0.28,
      },
      {
        insetMultiplier: 1.08,
        amplitudeMultiplier: 0.94,
        minAmplitude: 2.2,
        opacity: 0.9,
        widthMultiplier: 0.9,
        minWidth: 1.8,
        wavelengthMultiplier: 8.2,
        minWavelength: 42,
        phase: 0.28,
      },
    ],
  },
  wave: {
    mode: 'wave',
    basePadding: 12,
    minPadding: 22,
    layers: [
      {
        insetMultiplier: 0.94,
        amplitudeMultiplier: 0.76,
        minAmplitude: 1.8,
        opacity: 0.28,
        widthMultiplier: 1.2,
        minWidth: 1.8,
        wavelengthMultiplier: 6.4,
        minWavelength: 30,
        phase: 0.55,
      },
      {
        insetMultiplier: 0.94,
        amplitudeMultiplier: 0.52,
        minAmplitude: 1.2,
        opacity: 0.92,
        widthMultiplier: 0.9,
        minWidth: 1.6,
        wavelengthMultiplier: 6.4,
        minWavelength: 30,
        phase: 1.15,
      },
    ],
  },
  fractal: {
    mode: 'fractal',
    basePadding: 13,
    minPadding: 24,
    layers: [
      {
        insetMultiplier: 1.04,
        amplitudeMultiplier: 1.32,
        minAmplitude: 2.6,
        opacity: 0.24,
        widthMultiplier: 1.16,
        minWidth: 1.9,
        wavelengthMultiplier: 9,
        minWavelength: 48,
        phase: 0,
      },
      {
        insetMultiplier: 1.04,
        amplitudeMultiplier: 1,
        minAmplitude: 2.1,
        opacity: 0.9,
        widthMultiplier: 0.86,
        minWidth: 1.7,
        wavelengthMultiplier: 9,
        minWavelength: 48,
        phase: 0,
      },
    ],
  },
  meander: {
    mode: 'square',
    basePadding: 13,
    minPadding: 23,
    layers: [
      {
        insetMultiplier: 0.98,
        amplitudeMultiplier: 0.96,
        minAmplitude: 2.2,
        opacity: 0.24,
        widthMultiplier: 1.16,
        minWidth: 1.9,
        wavelengthMultiplier: 7.2,
        minWavelength: 34,
        phase: 0.22,
      },
      {
        insetMultiplier: 0.98,
        amplitudeMultiplier: 0.8,
        minAmplitude: 1.8,
        opacity: 0.9,
        widthMultiplier: 0.88,
        minWidth: 1.6,
        wavelengthMultiplier: 7.2,
        minWavelength: 34,
        phase: 0.22,
      },
    ],
  },
  leiwen: {
    mode: 'square',
    basePadding: 14,
    minPadding: 24,
    layers: [
      {
        insetMultiplier: 1.02,
        amplitudeMultiplier: 0.72,
        minAmplitude: 1.6,
        opacity: 0.26,
        widthMultiplier: 1.1,
        minWidth: 1.8,
        wavelengthMultiplier: 4.4,
        minWavelength: 20,
        phase: 0.1,
      },
      {
        insetMultiplier: 1.02,
        amplitudeMultiplier: 0.58,
        minAmplitude: 1.2,
        opacity: 0.92,
        widthMultiplier: 0.86,
        minWidth: 1.4,
        wavelengthMultiplier: 4.4,
        minWavelength: 20,
        phase: 0.1,
      },
    ],
  },
};

function isHandDrawnBorderStyle(borderStyle: OrganicBorderStyle): borderStyle is HandDrawnBorderStyle {
  return borderStyle === 'brush' || borderStyle === 'ink';
}

function isProceduralBorderStyle(borderStyle: OrganicBorderStyle): borderStyle is ProceduralBorderStyle {
  return borderStyle === 'cloud'
    || borderStyle === 'wave'
    || borderStyle === 'fractal'
    || borderStyle === 'meander'
    || borderStyle === 'leiwen';
}

function getOrganicBorderConfig(borderStyle: HandDrawnBorderStyle) {
  return ORGANIC_BORDER_CONFIGS[borderStyle];
}

function getProceduralBorderConfig(borderStyle: ProceduralBorderStyle) {
  return PROCEDURAL_BORDER_CONFIGS[borderStyle];
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

function getOrganicLayerPaintInset(borderWidth: number, layer: OrganicBorderLayerConfig) {
  const strokeWidth = getOrganicLayerStrokeWidth(borderWidth, layer);
  return getOrganicLayerInset(borderWidth, layer)
    + strokeWidth / 2
    + Math.max(layer.minRoughness, borderWidth * layer.roughnessMultiplier);
}

function getOrganicPadding(borderWidth: number, borderStyle: HandDrawnBorderStyle) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const config = getOrganicBorderConfig(borderStyle);
  const bleed = config.layers.reduce((maxBleed, layer) => Math.max(maxBleed, getOrganicLayerPaintInset(safeBorderWidth, layer)), 0);

  return Math.max(config.minPadding, Math.round(config.basePadding + bleed));
}

function getProceduralLayerStrokeWidth(borderWidth: number, layer: ProceduralBorderLayerConfig) {
  return Math.max(layer.minWidth, borderWidth * layer.widthMultiplier);
}

function getProceduralLayerInset(borderWidth: number, layer: ProceduralBorderLayerConfig) {
  return borderWidth / 2 + layer.insetMultiplier;
}

function getProceduralLayerAmplitude(borderWidth: number, layer: ProceduralBorderLayerConfig) {
  return Math.max(layer.minAmplitude, borderWidth * layer.amplitudeMultiplier);
}

function getProceduralLayerWavelength(borderWidth: number, layer: ProceduralBorderLayerConfig) {
  return Math.max(layer.minWavelength, borderWidth * layer.wavelengthMultiplier);
}

function getProceduralLayerPaintInset(borderWidth: number, layer: ProceduralBorderLayerConfig) {
  const strokeWidth = getProceduralLayerStrokeWidth(borderWidth, layer);
  const amplitude = getProceduralLayerAmplitude(borderWidth, layer);
  return getProceduralLayerInset(borderWidth, layer) + strokeWidth / 2 + amplitude;
}

function getProceduralPadding(borderWidth: number, borderStyle: ProceduralBorderStyle) {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const config = getProceduralBorderConfig(borderStyle);
  const bleed = config.layers.reduce((maxBleed, layer) => Math.max(maxBleed, getProceduralLayerPaintInset(safeBorderWidth, layer)), 0);

  return Math.max(config.minPadding, Math.round(config.basePadding + bleed));
}

function getPatternDisplacement(mode: Exclude<ProceduralPatternMode, 'fractal'>, angle: number) {
  if (mode === 'cloud') {
    return Math.abs(Math.sin(angle));
  }

  if (mode === 'square') {
    return Math.sin(angle) >= 0 ? 1 : -1;
  }

  return Math.sin(angle);
}

function appendPatternEdgePoints(
  points: Point[],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  normalX: number,
  normalY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  mode: Exclude<ProceduralPatternMode, 'fractal'>,
) {
  const edgeLength = Math.hypot(endX - startX, endY - startY);
  const cycles = Math.max(1, edgeLength / Math.max(8, wavelength));
  const segments = Math.max(10, Math.round(cycles * 22));
  const startIndex = points.length === 0 ? 0 : 1;

  for (let index = startIndex; index <= segments; index += 1) {
    const t = index / segments;
    const angle = t * cycles * Math.PI * 2 + phase;
    const displacement = getPatternDisplacement(mode, angle) * amplitude;

    points.push({
      x: startX + (endX - startX) * t + normalX * displacement,
      y: startY + (endY - startY) * t + normalY * displacement,
    });
  }
}

function buildPatternPath(
  width: number,
  height: number,
  inset: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  mode: Exclude<ProceduralPatternMode, 'fractal'>,
  smooth: boolean,
) {
  const { left, top, right, bottom } = getInsetBounds(width, height, inset);
  const points: Point[] = [];

  appendPatternEdgePoints(points, left, top, right, top, 0, -1, amplitude, wavelength, phase + 0.1, mode);
  appendPatternEdgePoints(points, right, top, right, bottom, 1, 0, amplitude, wavelength, phase + 1.2, mode);
  appendPatternEdgePoints(points, right, bottom, left, bottom, 0, 1, amplitude, wavelength, phase + 2.35, mode);
  appendPatternEdgePoints(points, left, bottom, left, top, -1, 0, amplitude, wavelength, phase + 3.4, mode);

  return smooth ? toSmoothClosedPath(points) : toClosedPolylinePath(points);
}

function appendFractalEdgePoints(
  points: Point[],
  start: Point,
  end: Point,
  depth: number,
  normalX: number,
  normalY: number,
  amplitude: number,
) {
  if (depth <= 0) {
    points.push(end);
    return;
  }

  const firstThird: Point = {
    x: start.x + (end.x - start.x) / 3,
    y: start.y + (end.y - start.y) / 3,
  };
  const secondThird: Point = {
    x: start.x + ((end.x - start.x) * 2) / 3,
    y: start.y + ((end.y - start.y) * 2) / 3,
  };
  const peak: Point = {
    x: (firstThird.x + secondThird.x) / 2 + normalX * amplitude,
    y: (firstThird.y + secondThird.y) / 2 + normalY * amplitude,
  };
  const nextAmplitude = amplitude * 0.62;

  appendFractalEdgePoints(points, start, firstThird, depth - 1, normalX, normalY, nextAmplitude);
  appendFractalEdgePoints(points, firstThird, peak, depth - 1, normalX, normalY, nextAmplitude);
  appendFractalEdgePoints(points, peak, secondThird, depth - 1, normalX, normalY, nextAmplitude);
  appendFractalEdgePoints(points, secondThird, end, depth - 1, normalX, normalY, nextAmplitude);
}

function getFractalDepth(width: number, height: number) {
  const shortestEdge = Math.min(normalizeDimension(width, 100), normalizeDimension(height, 100));
  return clamp(Math.round(shortestEdge / 420) + 1, 2, 3);
}

function buildFractalPath(width: number, height: number, inset: number, amplitude: number) {
  const { left, top, right, bottom } = getInsetBounds(width, height, inset);
  const depth = getFractalDepth(width, height);
  const points: Point[] = [{ x: left, y: top }];

  appendFractalEdgePoints(points, { x: left, y: top }, { x: right, y: top }, depth, 0, -1, amplitude);
  appendFractalEdgePoints(points, { x: right, y: top }, { x: right, y: bottom }, depth, 1, 0, amplitude);
  appendFractalEdgePoints(points, { x: right, y: bottom }, { x: left, y: bottom }, depth, 0, 1, amplitude);
  appendFractalEdgePoints(points, { x: left, y: bottom }, { x: left, y: top }, depth, -1, 0, amplitude);

  return toClosedPolylinePath(points);
}

function createHandDrawnBorderStrokes(
  width: number,
  height: number,
  borderWidth: number,
  borderStyle: HandDrawnBorderStyle,
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

function createProceduralBorderStrokes(
  width: number,
  height: number,
  borderWidth: number,
  borderStyle: ProceduralBorderStyle,
): OrganicBorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const safeWidth = normalizeDimension(width, 100);
  const safeHeight = normalizeDimension(height, 100);
  const config = getProceduralBorderConfig(borderStyle);

  return config.layers.map((layer) => {
    const inset = getProceduralLayerInset(safeBorderWidth, layer);
    const amplitude = getProceduralLayerAmplitude(safeBorderWidth, layer);
    const wavelength = getProceduralLayerWavelength(safeBorderWidth, layer);

    const path = config.mode === 'fractal'
      ? buildFractalPath(safeWidth, safeHeight, inset, amplitude)
      : buildPatternPath(
          safeWidth,
          safeHeight,
          inset,
          amplitude,
          wavelength,
          layer.phase,
          config.mode,
          config.mode !== 'square',
        );

    return {
      path,
      opacity: layer.opacity,
      width: getProceduralLayerStrokeWidth(safeBorderWidth, layer),
    };
  });
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

function toRectPath(left: number, top: number, right: number, bottom: number) {
  return [
    `M ${left.toFixed(2)} ${top.toFixed(2)}`,
    `L ${right.toFixed(2)} ${top.toFixed(2)}`,
    `L ${right.toFixed(2)} ${bottom.toFixed(2)}`,
    `L ${left.toFixed(2)} ${bottom.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function createBrokenBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const { left, top, right, bottom } = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const frameWidth = right - left;
  const frameHeight = bottom - top;
  const cornerGap = Math.min(Math.max(9, safeBorderWidth * 2.2), Math.min(frameWidth, frameHeight) * 0.22);
  const majorGap = Math.min(Math.max(30, safeBorderWidth * 5.2), frameWidth * 0.36);
  const minorGap = Math.min(Math.max(14, safeBorderWidth * 3.1), frameHeight * 0.34);
  const primaryPath = [
    `M ${(left + cornerGap).toFixed(2)} ${top.toFixed(2)} L ${(right - majorGap).toFixed(2)} ${top.toFixed(2)}`,
    `M ${right.toFixed(2)} ${(top + cornerGap).toFixed(2)} L ${right.toFixed(2)} ${(bottom - minorGap).toFixed(2)}`,
    `M ${(right - cornerGap).toFixed(2)} ${bottom.toFixed(2)} L ${(left + majorGap * 0.7).toFixed(2)} ${bottom.toFixed(2)}`,
    `M ${left.toFixed(2)} ${(bottom - cornerGap).toFixed(2)} L ${left.toFixed(2)} ${(top + majorGap * 0.42).toFixed(2)}`,
  ].join(' ');
  const secondaryInset = safeBorderWidth * 1.12;
  const secondary = getInsetBounds(width, height, safeBorderWidth / 2 + secondaryInset);
  const secondaryWidth = secondary.right - secondary.left;
  const secondaryPath = [
    `M ${(secondary.left + secondaryWidth * 0.18).toFixed(2)} ${secondary.top.toFixed(2)} L ${(secondary.left + secondaryWidth * 0.54).toFixed(2)} ${secondary.top.toFixed(2)}`,
    `M ${(secondary.right - secondaryWidth * 0.2).toFixed(2)} ${secondary.bottom.toFixed(2)} L ${(secondary.right - secondaryWidth * 0.45).toFixed(2)} ${secondary.bottom.toFixed(2)}`,
  ].join(' ');

  return [
    {
      path: primaryPath,
      opacity: 0.92,
      width: Math.max(1.4, safeBorderWidth * 0.92),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: secondaryPath,
      opacity: 0.42,
      width: Math.max(1.05, safeBorderWidth * 0.52),
      dash: [Math.max(4, safeBorderWidth * 1.7), Math.max(6, safeBorderWidth * 2.3)],
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

function createOverflowBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const { left, top, right, bottom } = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const frameWidth = right - left;
  const frameHeight = bottom - top;
  const shortestEdge = Math.max(1, Math.min(frameWidth, frameHeight));
  const mainPath = toRectPath(left, top, right, bottom);
  const arm = Math.min(Math.max(15, safeBorderWidth * 3.6), shortestEdge * 0.52);
  const edgeOffset = Math.min(Math.max(20, safeBorderWidth * 5), shortestEdge * 0.42);
  const burstPath = [
    `M ${(left + edgeOffset).toFixed(2)} ${top.toFixed(2)} L ${(left - arm * 0.72).toFixed(2)} ${(top - arm * 0.42).toFixed(2)}`,
    `M ${left.toFixed(2)} ${(top + edgeOffset).toFixed(2)} L ${(left - arm * 0.42).toFixed(2)} ${(top - arm * 0.72).toFixed(2)}`,
    `M ${(right - edgeOffset).toFixed(2)} ${top.toFixed(2)} L ${(right + arm * 0.72).toFixed(2)} ${(top - arm * 0.42).toFixed(2)}`,
    `M ${right.toFixed(2)} ${(top + edgeOffset).toFixed(2)} L ${(right + arm * 0.42).toFixed(2)} ${(top - arm * 0.72).toFixed(2)}`,
    `M ${(right - edgeOffset).toFixed(2)} ${bottom.toFixed(2)} L ${(right + arm * 0.72).toFixed(2)} ${(bottom + arm * 0.42).toFixed(2)}`,
    `M ${right.toFixed(2)} ${(bottom - edgeOffset).toFixed(2)} L ${(right + arm * 0.42).toFixed(2)} ${(bottom + arm * 0.72).toFixed(2)}`,
    `M ${(left + edgeOffset).toFixed(2)} ${bottom.toFixed(2)} L ${(left - arm * 0.72).toFixed(2)} ${(bottom + arm * 0.42).toFixed(2)}`,
    `M ${left.toFixed(2)} ${(bottom - edgeOffset).toFixed(2)} L ${(left - arm * 0.42).toFixed(2)} ${(bottom + arm * 0.72).toFixed(2)}`,
  ].join(' ');
  const inner = getInsetBounds(width, height, safeBorderWidth / 2 + Math.max(2.5, safeBorderWidth * 1.25));
  const innerPath = toRectPath(inner.left, inner.top, inner.right, inner.bottom);

  return [
    {
      path: mainPath,
      opacity: 0.9,
      width: Math.max(1.25, safeBorderWidth * 0.88),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: innerPath,
      opacity: 0.28,
      width: Math.max(0.9, safeBorderWidth * 0.44),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: burstPath,
      opacity: 0.72,
      width: Math.max(1, safeBorderWidth * 0.52),
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

function createOrnamentalBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const outer = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const inner = getInsetBounds(width, height, safeBorderWidth / 2 + Math.max(3.2, safeBorderWidth * 1.72));
  const shortestEdge = Math.max(1, Math.min(outer.right - outer.left, outer.bottom - outer.top));
  const curl = Math.min(Math.max(12, safeBorderWidth * 3), shortestEdge * 0.24);
  const feather = Math.min(Math.max(7, safeBorderWidth * 1.8), shortestEdge * 0.16);
  const { left, top, right, bottom } = outer;
  const cornerCurls = [
    `M ${(left + curl).toFixed(2)} ${top.toFixed(2)} C ${(left + feather).toFixed(2)} ${top.toFixed(2)} ${left.toFixed(2)} ${(top + feather).toFixed(2)} ${left.toFixed(2)} ${(top + curl).toFixed(2)}`,
    `M ${(right - curl).toFixed(2)} ${top.toFixed(2)} C ${(right - feather).toFixed(2)} ${top.toFixed(2)} ${right.toFixed(2)} ${(top + feather).toFixed(2)} ${right.toFixed(2)} ${(top + curl).toFixed(2)}`,
    `M ${(right - curl).toFixed(2)} ${bottom.toFixed(2)} C ${(right - feather).toFixed(2)} ${bottom.toFixed(2)} ${right.toFixed(2)} ${(bottom - feather).toFixed(2)} ${right.toFixed(2)} ${(bottom - curl).toFixed(2)}`,
    `M ${(left + curl).toFixed(2)} ${bottom.toFixed(2)} C ${(left + feather).toFixed(2)} ${bottom.toFixed(2)} ${left.toFixed(2)} ${(bottom - feather).toFixed(2)} ${left.toFixed(2)} ${(bottom - curl).toFixed(2)}`,
    `M ${(left + curl * 0.78).toFixed(2)} ${(top + feather * 0.38).toFixed(2)} Q ${(left + curl * 0.28).toFixed(2)} ${(top + curl * 0.2).toFixed(2)} ${(left + feather * 0.42).toFixed(2)} ${(top + curl * 0.78).toFixed(2)}`,
    `M ${(right - curl * 0.78).toFixed(2)} ${(top + feather * 0.38).toFixed(2)} Q ${(right - curl * 0.28).toFixed(2)} ${(top + curl * 0.2).toFixed(2)} ${(right - feather * 0.42).toFixed(2)} ${(top + curl * 0.78).toFixed(2)}`,
    `M ${(right - curl * 0.78).toFixed(2)} ${(bottom - feather * 0.38).toFixed(2)} Q ${(right - curl * 0.28).toFixed(2)} ${(bottom - curl * 0.2).toFixed(2)} ${(right - feather * 0.42).toFixed(2)} ${(bottom - curl * 0.78).toFixed(2)}`,
    `M ${(left + curl * 0.78).toFixed(2)} ${(bottom - feather * 0.38).toFixed(2)} Q ${(left + curl * 0.28).toFixed(2)} ${(bottom - curl * 0.2).toFixed(2)} ${(left + feather * 0.42).toFixed(2)} ${(bottom - curl * 0.78).toFixed(2)}`,
  ].join(' ');

  return [
    {
      path: toRectPath(outer.left, outer.top, outer.right, outer.bottom),
      opacity: 0.84,
      width: Math.max(1.15, safeBorderWidth * 0.56),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: toRectPath(inner.left, inner.top, inner.right, inner.bottom),
      opacity: 0.42,
      width: Math.max(1, safeBorderWidth * 0.32),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: cornerCurls,
      opacity: 0.8,
      width: Math.max(1, safeBorderWidth * 0.5),
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

function createEnvelopeBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const outer = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const frameWidth = outer.right - outer.left;
  const frameHeight = outer.bottom - outer.top;
  const shortestEdge = Math.max(1, Math.min(frameWidth, frameHeight));
  const centerX = (outer.left + outer.right) / 2;
  const flapHalf = Math.min(Math.max(14, safeBorderWidth * 3.5), frameWidth * 0.22);
  const flapDepth = Math.min(Math.max(12, safeBorderWidth * 3), frameHeight * 0.22);
  const fold = Math.min(Math.max(10, safeBorderWidth * 2.6), shortestEdge * 0.24);
  const inner = getInsetBounds(width, height, safeBorderWidth / 2 + Math.max(3, safeBorderWidth * 1.4));
  const lowerJoinY = Math.min(outer.bottom - fold * 0.7, outer.top + frameHeight * 0.56);
  const seamY = Math.min(
    outer.bottom - Math.max(10, safeBorderWidth * 2),
    outer.top + flapDepth + Math.max(8, safeBorderWidth * 2),
  );
  const seamHalf = Math.min(frameWidth * 0.28, Math.max(24, safeBorderWidth * 6));
  const envelopeFramePath = [
    `M ${outer.left.toFixed(2)} ${outer.top.toFixed(2)} L ${(centerX - flapHalf).toFixed(2)} ${outer.top.toFixed(2)}`,
    `M ${(centerX + flapHalf).toFixed(2)} ${outer.top.toFixed(2)} L ${outer.right.toFixed(2)} ${outer.top.toFixed(2)}`,
    `M ${outer.right.toFixed(2)} ${outer.top.toFixed(2)} L ${outer.right.toFixed(2)} ${outer.bottom.toFixed(2)} L ${outer.left.toFixed(2)} ${outer.bottom.toFixed(2)} L ${outer.left.toFixed(2)} ${outer.top.toFixed(2)}`,
  ].join(' ');
  const foldPath = [
    `M ${(centerX - flapHalf).toFixed(2)} ${outer.top.toFixed(2)} L ${centerX.toFixed(2)} ${(outer.top + flapDepth).toFixed(2)} L ${(centerX + flapHalf).toFixed(2)} ${outer.top.toFixed(2)}`,
    `M ${outer.left.toFixed(2)} ${outer.top.toFixed(2)} L ${(outer.left + fold).toFixed(2)} ${(outer.top + fold).toFixed(2)}`,
    `M ${outer.right.toFixed(2)} ${outer.top.toFixed(2)} L ${(outer.right - fold).toFixed(2)} ${(outer.top + fold).toFixed(2)}`,
    `M ${outer.left.toFixed(2)} ${outer.bottom.toFixed(2)} L ${(outer.left + fold).toFixed(2)} ${(outer.bottom - fold).toFixed(2)}`,
    `M ${outer.right.toFixed(2)} ${outer.bottom.toFixed(2)} L ${(outer.right - fold).toFixed(2)} ${(outer.bottom - fold).toFixed(2)}`,
    `M ${outer.left.toFixed(2)} ${outer.bottom.toFixed(2)} L ${centerX.toFixed(2)} ${lowerJoinY.toFixed(2)} L ${outer.right.toFixed(2)} ${outer.bottom.toFixed(2)}`,
  ].join(' ');
  const seamPath = `M ${(centerX - seamHalf).toFixed(2)} ${seamY.toFixed(2)} L ${(centerX + seamHalf).toFixed(2)} ${seamY.toFixed(2)}`;

  return [
    {
      path: envelopeFramePath,
      opacity: 0.9,
      width: Math.max(1.25, safeBorderWidth * 0.86),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: toRectPath(inner.left, inner.top, inner.right, inner.bottom),
      opacity: 0.32,
      width: Math.max(0.95, safeBorderWidth * 0.4),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: foldPath,
      opacity: 0.78,
      width: Math.max(1, safeBorderWidth * 0.48),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: seamPath,
      opacity: 0.5,
      width: Math.max(0.85, safeBorderWidth * 0.34),
      dash: [Math.max(4, safeBorderWidth * 1.5), Math.max(4, safeBorderWidth * 1.8)],
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

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

export function isVectorBorderStyle(borderStyle: BorderStyle): borderStyle is VectorBorderStyle {
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

export function isOrganicBorderStyle(borderStyle: BorderStyle): borderStyle is OrganicBorderStyle {
  return borderStyle === 'brush'
    || borderStyle === 'ink'
    || borderStyle === 'cloud'
    || borderStyle === 'wave'
    || borderStyle === 'fractal'
    || borderStyle === 'meander'
    || borderStyle === 'leiwen';
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

export function createOrganicBorderStrokes(
  width: number,
  height: number,
  borderWidth: number,
  borderStyle: OrganicBorderStyle,
): OrganicBorderStroke[] {
  if (isHandDrawnBorderStyle(borderStyle)) {
    return createHandDrawnBorderStrokes(width, height, borderWidth, borderStyle);
  }

  if (isProceduralBorderStyle(borderStyle)) {
    return createProceduralBorderStrokes(width, height, borderWidth, borderStyle);
  }

  return [];
}

export function createVectorBorderStrokes(
  width: number,
  height: number,
  borderWidth: number,
  borderStyle: VectorBorderStyle,
): BorderStroke[] {
  if (isOrganicBorderStyle(borderStyle)) {
    return createOrganicBorderStrokes(width, height, borderWidth, borderStyle).map((stroke) => ({
      path: stroke.path,
      opacity: stroke.opacity,
      width: stroke.width,
      lineCap: 'round',
      lineJoin: 'round',
    }));
  }

  if (borderStyle === 'broken') {
    return createBrokenBorderStrokes(width, height, borderWidth);
  }

  if (borderStyle === 'overflow') {
    return createOverflowBorderStrokes(width, height, borderWidth);
  }

  if (borderStyle === 'ornamental') {
    return createOrnamentalBorderStrokes(width, height, borderWidth);
  }

  if (borderStyle === 'envelope') {
    return createEnvelopeBorderStrokes(width, height, borderWidth);
  }

  return [];
}
