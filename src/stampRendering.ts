import type { StampConfig, StampStyle } from './types';

export type StampTextureTint = 'dark' | 'light' | 'void';

export interface StampTextureBlob {
  x: number;
  y: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  blur: number;
  rotationDeg: number;
  tint: StampTextureTint;
}

export interface StampTextPlacement {
  x: number;
  y: number;
  rotateDeg: number;
  scale: number;
}

export interface StampGradientStop {
  offset: number;
  color: string;
}

export interface StampLinearGradientSpec {
  kind: 'linear';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: StampGradientStop[];
}

export interface StampRadialGradientSpec {
  kind: 'radial';
  x0: number;
  y0: number;
  r0: number;
  x1: number;
  y1: number;
  r1: number;
  stops: StampGradientStop[];
}

export type StampGradientSpec = StampLinearGradientSpec | StampRadialGradientSpec;

export interface StampAppearance {
  isFilled: boolean;
  baseFill: StampGradientSpec;
  surfaceLayers: StampGradientSpec[];
  centerGlow: StampGradientSpec;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  shadowFill: string;
  previewBoxShadow: string;
  textColor: string;
  textShadowColor: string;
  textShadowBlur: number;
  textureColors: Record<StampTextureTint, string>;
}

export const STAMP_TEXTURE_BLOBS: StampTextureBlob[] = [
  { x: 0.22, y: 0.2, radius: 0.14, scaleX: 1.2, scaleY: 0.78, opacity: 0.2, blur: 0.018, rotationDeg: -16, tint: 'light' },
  { x: 0.77, y: 0.24, radius: 0.12, scaleX: 0.9, scaleY: 1.18, opacity: 0.22, blur: 0.016, rotationDeg: 18, tint: 'dark' },
  { x: 0.34, y: 0.53, radius: 0.1, scaleX: 1.36, scaleY: 0.92, opacity: 0.14, blur: 0.014, rotationDeg: -10, tint: 'dark' },
  { x: 0.67, y: 0.63, radius: 0.14, scaleX: 1.08, scaleY: 0.86, opacity: 0.18, blur: 0.02, rotationDeg: 12, tint: 'light' },
  { x: 0.52, y: 0.43, radius: 0.18, scaleX: 1.04, scaleY: 1.04, opacity: 0.14, blur: 0.024, rotationDeg: 0, tint: 'dark' },
  { x: 0.57, y: 0.8, radius: 0.09, scaleX: 1.4, scaleY: 0.7, opacity: 0.12, blur: 0.014, rotationDeg: -8, tint: 'light' },
];

export const STAMP_EDGE_WEAR_BLOBS: StampTextureBlob[] = [
  { x: 0.12, y: 0.18, radius: 0.07, scaleX: 1.25, scaleY: 0.7, opacity: 0.32, blur: 0.008, rotationDeg: -20, tint: 'void' },
  { x: 0.88, y: 0.28, radius: 0.06, scaleX: 1.1, scaleY: 0.88, opacity: 0.28, blur: 0.008, rotationDeg: 14, tint: 'void' },
  { x: 0.84, y: 0.84, radius: 0.08, scaleX: 1.28, scaleY: 0.76, opacity: 0.3, blur: 0.01, rotationDeg: -12, tint: 'void' },
  { x: 0.24, y: 0.9, radius: 0.07, scaleX: 1.18, scaleY: 0.8, opacity: 0.24, blur: 0.008, rotationDeg: 8, tint: 'void' },
  { x: 0.5, y: 0.08, radius: 0.05, scaleX: 1.55, scaleY: 0.65, opacity: 0.18, blur: 0.006, rotationDeg: 0, tint: 'void' },
];

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
  if (count <= 1) {
    return Math.max(22, size * 0.36);
  }

  if (count === 2) {
    return Math.max(20, size * 0.28);
  }

  return Math.max(18, size * 0.225);
}

export function getStampTextLetterSpacing(size: number, count: number) {
  return Math.max(0, size * (count <= 1 ? 0.02 : 0.008));
}

export function getStampTextPlacements(size: number, count: number): StampTextPlacement[] {
  if (count <= 1) {
    return [{ x: 0, y: 0, rotateDeg: -2, scale: 1 }];
  }

  if (count === 2) {
    const offset = size * 0.18;
    return [
      { x: 0, y: -offset, rotateDeg: -3, scale: 0.98 },
      { x: 0, y: offset, rotateDeg: 2, scale: 1.02 },
    ];
  }

  if (count === 3) {
    const offset = size * 0.18;
    return [
      { x: -offset, y: -offset * 0.95, rotateDeg: -3, scale: 0.98 },
      { x: offset, y: -offset * 0.95, rotateDeg: 2, scale: 1.01 },
      { x: 0, y: offset, rotateDeg: -1, scale: 1.03 },
    ];
  }

  const offset = size * 0.18;
  return [
    { x: -offset, y: -offset, rotateDeg: -3, scale: 0.98 },
    { x: offset, y: -offset, rotateDeg: 2, scale: 1.01 },
    { x: -offset, y: offset, rotateDeg: -1, scale: 1.02 },
    { x: offset, y: offset, rotateDeg: 3, scale: 0.99 },
  ];
}

function linearGradient(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: StampGradientStop[],
): StampLinearGradientSpec {
  return { kind: 'linear', x0, y0, x1, y1, stops };
}

function radialGradient(
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: StampGradientStop[],
): StampRadialGradientSpec {
  return { kind: 'radial', x0, y0, r0, x1, y1, r1, stops };
}

function gradientStopsToCss(stops: StampGradientStop[]) {
  return stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 1000) / 10}%`).join(', ');
}

export function getStampCssGradient(spec: StampGradientSpec) {
  if (spec.kind === 'linear') {
    const angle = Math.atan2(spec.y1 - spec.y0, spec.x1 - spec.x0) * (180 / Math.PI) + 90;
    return `linear-gradient(${angle}deg, ${gradientStopsToCss(spec.stops)})`;
  }

  return `radial-gradient(circle at ${spec.x1 * 100}% ${spec.y1 * 100}%, ${gradientStopsToCss(spec.stops)})`;
}

export function getStampCssBackground(specs: StampGradientSpec[]) {
  return specs.map((spec) => getStampCssGradient(spec)).join(', ');
}

export function createCanvasStampGradient(
  ctx: CanvasRenderingContext2D,
  spec: StampGradientSpec,
  size: number,
) {
  const half = size / 2;
  const toCanvasCoord = (value: number) => value * size - half;
  const gradient = spec.kind === 'linear'
    ? ctx.createLinearGradient(
        toCanvasCoord(spec.x0),
        toCanvasCoord(spec.y0),
        toCanvasCoord(spec.x1),
        toCanvasCoord(spec.y1),
      )
    : ctx.createRadialGradient(
        toCanvasCoord(spec.x0),
        toCanvasCoord(spec.y0),
        spec.r0 * size,
        toCanvasCoord(spec.x1),
        toCanvasCoord(spec.y1),
        spec.r1 * size,
      );

  spec.stops.forEach((stop) => {
    gradient.addColorStop(stop.offset, stop.color);
  });

  return gradient;
}

export function getStampAppearance(stamp: Pick<StampConfig, 'style' | 'colorScheme'>): StampAppearance {
  const isFilled = stamp.colorScheme === 'filled';

  if (isFilled) {
    return {
      isFilled,
      baseFill: stamp.style === 'round'
        ? radialGradient(0.24, 0.28, 0.1, 0.5, 0.5, 0.5, [
            { offset: 0, color: 'rgba(182, 30, 30, 0.98)' },
            { offset: 0.48, color: 'rgba(154, 19, 19, 0.98)' },
            { offset: 1, color: 'rgba(118, 13, 13, 0.99)' },
          ])
        : linearGradient(0, 0, 1, 1, [
            { offset: 0, color: 'rgba(143, 16, 16, 0.98)' },
            { offset: 0.48, color: 'rgba(189, 30, 30, 0.96)' },
            { offset: 1, color: 'rgba(122, 14, 14, 0.98)' },
          ]),
      surfaceLayers: stamp.style === 'round'
        ? [
            radialGradient(0.34, 0.28, 0, 0.34, 0.28, 0.24, [
              { offset: 0, color: 'rgba(255,255,255,0.12)' },
              { offset: 1, color: 'rgba(255,255,255,0)' },
            ]),
            radialGradient(0.64, 0.68, 0, 0.64, 0.68, 0.48, [
              { offset: 0, color: 'rgba(91,12,12,0.3)' },
              { offset: 1, color: 'rgba(91,12,12,0)' },
            ]),
            linearGradient(0, 0, 1, 1, [
              { offset: 0, color: 'rgba(160,20,20,0.2)' },
              { offset: 1, color: 'rgba(112,14,14,0.34)' },
            ]),
          ]
        : [
            radialGradient(0.28, 0.24, 0, 0.28, 0.24, 0.22, [
              { offset: 0, color: 'rgba(255,255,255,0.12)' },
              { offset: 1, color: 'rgba(255,255,255,0)' },
            ]),
            radialGradient(0.68, 0.72, 0, 0.68, 0.72, 0.46, [
              { offset: 0, color: 'rgba(88,10,10,0.28)' },
              { offset: 1, color: 'rgba(88,10,10,0)' },
            ]),
            linearGradient(0, 0, 1, 1, [
              { offset: 0, color: 'rgba(164,22,22,0.18)' },
              { offset: 1, color: 'rgba(111,14,14,0.28)' },
            ]),
          ],
      centerGlow: radialGradient(0.5, 0.5, 0.1, 0.5, 0.5, 0.72, [
        { offset: 0, color: 'rgba(255,255,255,0.06)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ]),
      shadowColor: 'rgba(97, 15, 15, 0.2)',
      shadowBlur: 22,
      shadowOffsetY: 8,
      shadowFill: 'rgba(185, 28, 28, 0.48)',
      previewBoxShadow: '0 16px 26px rgba(97, 15, 15, 0.2), 0 3px 8px rgba(127, 29, 29, 0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
      textColor: '#fff7f2',
      textShadowColor: 'rgba(93, 9, 9, 0.34)',
      textShadowBlur: 1.5,
      textureColors: {
        dark: 'rgba(109, 15, 15, 0.22)',
        light: 'rgba(231, 91, 77, 0.16)',
        void: 'rgba(0, 0, 0, 0.9)',
      },
    };
  }

  return {
    isFilled,
    baseFill: stamp.style === 'round'
      ? radialGradient(0.32, 0.28, 0.08, 0.5, 0.5, 0.5, [
          { offset: 0, color: 'rgba(255, 249, 246, 0.84)' },
          { offset: 0.54, color: 'rgba(255, 245, 243, 0.34)' },
          { offset: 1, color: 'rgba(255, 234, 234, 0.2)' },
        ])
      : linearGradient(0, 0, 1, 1, [
          { offset: 0, color: 'rgba(255, 247, 244, 0.82)' },
          { offset: 0.52, color: 'rgba(255, 255, 255, 0.22)' },
          { offset: 1, color: 'rgba(255, 238, 238, 0.32)' },
        ]),
    surfaceLayers: stamp.style === 'round'
      ? [
          radialGradient(0.32, 0.28, 0, 0.32, 0.28, 0.26, [
            { offset: 0, color: 'rgba(255,255,255,0.5)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ]),
          radialGradient(0.64, 0.62, 0, 0.64, 0.62, 0.44, [
            { offset: 0, color: 'rgba(185,28,28,0.12)' },
            { offset: 1, color: 'rgba(185,28,28,0)' },
          ]),
          linearGradient(0, 0, 1, 1, [
            { offset: 0, color: 'rgba(255,255,255,0.14)' },
            { offset: 1, color: 'rgba(185,28,28,0.08)' },
          ]),
        ]
      : [
          radialGradient(0.28, 0.24, 0, 0.28, 0.24, 0.25, [
            { offset: 0, color: 'rgba(255,255,255,0.52)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ]),
          radialGradient(0.66, 0.68, 0, 0.66, 0.68, 0.42, [
            { offset: 0, color: 'rgba(185,28,28,0.1)' },
            { offset: 1, color: 'rgba(185,28,28,0)' },
          ]),
          linearGradient(0, 0, 1, 1, [
            { offset: 0, color: 'rgba(255,255,255,0.12)' },
            { offset: 1, color: 'rgba(185,28,28,0.06)' },
          ]),
        ],
    centerGlow: radialGradient(0.5, 0.5, 0.1, 0.5, 0.5, 0.72, [
      { offset: 0, color: 'rgba(185,28,28,0.08)' },
      { offset: 1, color: 'rgba(255,255,255,0)' },
    ]),
    shadowColor: 'rgba(127, 29, 29, 0.12)',
    shadowBlur: 22,
    shadowOffsetY: 8,
    shadowFill: 'rgba(255, 246, 242, 0.18)',
    previewBoxShadow: '0 14px 24px rgba(127, 29, 29, 0.12), 0 3px 8px rgba(127, 29, 29, 0.08), inset 0 0 0 1px rgba(255,255,255,0.28)',
    textColor: '#ad1f1f',
    textShadowColor: 'rgba(127, 29, 29, 0.18)',
    textShadowBlur: 2,
    textureColors: {
      dark: 'rgba(175, 29, 29, 0.12)',
      light: 'rgba(255, 255, 255, 0.34)',
      void: 'rgba(255, 255, 255, 0.52)',
    },
  };
}
