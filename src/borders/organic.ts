import type { BorderStyle } from '../types';
import type {
  OrganicBorderStyle,
  OrganicBorderStroke,
  OrganicBorderLayerConfig,
  OrganicBorderConfig,
  ProceduralBorderLayerConfig,
  ProceduralBorderConfig,
  ProceduralPatternMode,
  Point,
} from './types';
import {
  normalizeBorderWidth,
  normalizeDimension,
  clamp,
  getInsetBounds,
  toSmoothClosedPath,
  toClosedPolylinePath,
  buildHandDrawnPath,
} from './utils';

type HandDrawnBorderStyle = Extract<OrganicBorderStyle, 'brush' | 'ink'>;
type ProceduralBorderStyle = Exclude<OrganicBorderStyle, HandDrawnBorderStyle>;

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

export function isHandDrawnBorderStyle(borderStyle: OrganicBorderStyle): borderStyle is HandDrawnBorderStyle {
  return borderStyle === 'brush' || borderStyle === 'ink';
}

export function isProceduralBorderStyle(borderStyle: OrganicBorderStyle): borderStyle is ProceduralBorderStyle {
  return borderStyle === 'cloud'
    || borderStyle === 'wave'
    || borderStyle === 'fractal'
    || borderStyle === 'meander'
    || borderStyle === 'leiwen';
}

export function getOrganicBorderConfig(borderStyle: HandDrawnBorderStyle) {
  return ORGANIC_BORDER_CONFIGS[borderStyle];
}

export function getProceduralBorderConfig(borderStyle: ProceduralBorderStyle) {
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

export function getOrganicLayerPaintInset(borderWidth: number, layer: OrganicBorderLayerConfig) {
  const strokeWidth = getOrganicLayerStrokeWidth(borderWidth, layer);
  return getOrganicLayerInset(borderWidth, layer)
    + strokeWidth / 2
    + Math.max(layer.minRoughness, borderWidth * layer.roughnessMultiplier);
}

export function getOrganicPadding(borderWidth: number, borderStyle: HandDrawnBorderStyle) {
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

export function getProceduralLayerPaintInset(borderWidth: number, layer: ProceduralBorderLayerConfig) {
  const strokeWidth = getProceduralLayerStrokeWidth(borderWidth, layer);
  const amplitude = getProceduralLayerAmplitude(borderWidth, layer);
  return getProceduralLayerInset(borderWidth, layer) + strokeWidth / 2 + amplitude;
}

export function getProceduralPadding(borderWidth: number, borderStyle: ProceduralBorderStyle) {
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
  segmentsPerCycle: number,
) {
  const edgeLength = Math.hypot(endX - startX, endY - startY);
  const cycles = Math.max(1, edgeLength / Math.max(8, wavelength));
  const segments = Math.max(10, Math.round(cycles * segmentsPerCycle));
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
  // Square waves need far fewer sample points than smooth curves — sharp transitions
  // are adequately represented with ~10 samples/cycle, while smooth modes need ~16.
  const segmentsPerCycle = smooth ? 16 : 10;

  appendPatternEdgePoints(points, left, top, right, top, 0, -1, amplitude, wavelength, phase + 0.1, mode, segmentsPerCycle);
  appendPatternEdgePoints(points, right, top, right, bottom, 1, 0, amplitude, wavelength, phase + 1.2, mode, segmentsPerCycle);
  appendPatternEdgePoints(points, right, bottom, left, bottom, 0, 1, amplitude, wavelength, phase + 2.35, mode, segmentsPerCycle);
  appendPatternEdgePoints(points, left, bottom, left, top, -1, 0, amplitude, wavelength, phase + 3.4, mode, segmentsPerCycle);

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

export function isOrganicBorderStyle(borderStyle: BorderStyle): borderStyle is OrganicBorderStyle {
  return borderStyle === 'brush'
    || borderStyle === 'ink'
    || borderStyle === 'cloud'
    || borderStyle === 'wave'
    || borderStyle === 'fractal'
    || borderStyle === 'meander'
    || borderStyle === 'leiwen';
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
