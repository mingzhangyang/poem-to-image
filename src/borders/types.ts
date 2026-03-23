import type { BorderStyle } from '../types';

export type OrganicBorderStyle = Extract<BorderStyle, 'brush' | 'ink' | 'cloud' | 'wave' | 'fractal' | 'meander' | 'leiwen'>;
export type VectorBorderStyle = OrganicBorderStyle | Extract<BorderStyle, 'broken' | 'overflow' | 'ornamental' | 'envelope'>;

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

export interface Point {
  x: number;
  y: number;
}

export interface OrganicBorderLayerConfig {
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

export interface OrganicBorderConfig {
  basePadding: number;
  minPadding: number;
  layers: OrganicBorderLayerConfig[];
}

export interface ProceduralBorderLayerConfig {
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

export interface ProceduralBorderConfig {
  mode: ProceduralPatternMode;
  basePadding: number;
  minPadding: number;
  layers: ProceduralBorderLayerConfig[];
}

export interface DoubleBorderMetrics {
  lineWidth: number;
  innerInset: number;
  maxPaintInset: number;
}

export interface InsetBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type ProceduralPatternMode = 'cloud' | 'wave' | 'square' | 'fractal';
