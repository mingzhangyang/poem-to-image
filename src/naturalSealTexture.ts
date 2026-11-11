import type { StampConfig, StampStyle } from './types';
import { getStampCanvasRadii } from './stampRendering';

export type SealPoint = readonly [number, number];

export interface OrganicSealPatch {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly angle: number;
  readonly opacity: number;
  /** A small irregular organic outline in local unit-circle coordinates. */
  readonly contour: readonly SealPoint[];
}

export interface EdgeSealPatch extends Omit<OrganicSealPatch, 'x' | 'y'> {
  /** Position along the stamp perimeter, independent of its style or size. */
  readonly perimeter: number;
  readonly depth: number;
}

export interface SealFiber {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly bend: number;
  readonly width: number;
  readonly opacity: number;
}

export interface NaturalSealTexturePlan {
  readonly seed: number;
  readonly mottle: readonly OrganicSealPatch[];
  readonly edgeWear: readonly EdgeSealPatch[];
  readonly cracks: readonly SealFiber[];
  readonly fibers: readonly SealFiber[];
}

export const NATURAL_SEAL_PLAN_LIMITS = {
  mottle: 22,
  edgeWear: 16,
  cracks: 10,
  fibers: 64,
} as const;

/**
 * The seed is an independent, saved identity. For a natural seal created by
 * an older client without a seed, derive one from its text, never its size,
 * color, weathering, opacity, font, orientation or coordinates.
 */
export function getNaturalSealSeed(stamp: Pick<StampConfig, 'text' | 'textureSeed'>): number {
  if (Number.isFinite(stamp.textureSeed)) {
    return Math.trunc(stamp.textureSeed as number) >>> 0;
  }
  let hash = 2166136261;
  for (let index = 0; index < stamp.text.length; index++) {
    hash ^= stamp.text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash ^ 0x9e3779b9) >>> 0;
}

/** Only an explicit "new impression" action changes the saved seed. */
export function nextNaturalSealSeed(seed: number): number {
  return (Math.trunc(seed) + 0x9e3779b9) >>> 0;
}

function mulberry32(initial: number): () => number {
  let seed = initial >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeContour(rand: () => number): readonly SealPoint[] {
  const points: SealPoint[] = [];
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    const radius = 0.72 + rand() * 0.48;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return points;
}

function makeFiber(rand: () => number, isCrack: boolean): SealFiber {
  const angle = rand() * Math.PI * 2;
  const length = (isCrack ? 0.015 : 0.006) + rand() * (isCrack ? 0.055 : 0.025);
  return {
    x: 0.08 + rand() * 0.84,
    y: 0.08 + rand() * 0.84,
    dx: Math.cos(angle) * length,
    dy: Math.sin(angle) * length,
    bend: (rand() - 0.5) * length * 0.4,
    width: isCrack ? 0.0018 + rand() * 0.0035 : 0.0009 + rand() * 0.0021,
    opacity: isCrack ? 0.36 + rand() * 0.38 : 0.12 + rand() * 0.3,
  };
}

/** Pure plan: fixed normalized 0..1 coordinates, no Canvas, no DOM, no time. */
export function createNaturalSealTexturePlan(seed: number): NaturalSealTexturePlan {
  const identity = Math.trunc(Number.isFinite(seed) ? seed : 0) >>> 0;
  const rand = mulberry32(identity);
  const mottle = Array.from({ length: NATURAL_SEAL_PLAN_LIMITS.mottle }, (): OrganicSealPatch => ({
    x: 0.08 + rand() * 0.84,
    y: 0.08 + rand() * 0.84,
    rx: 0.025 + rand() * 0.075,
    ry: 0.016 + rand() * 0.045,
    angle: rand() * Math.PI,
    opacity: 0.08 + rand() * 0.18,
    contour: makeContour(rand),
  }));
  const edgeWear = Array.from({ length: NATURAL_SEAL_PLAN_LIMITS.edgeWear }, (): EdgeSealPatch => ({
    perimeter: rand(),
    depth: 0.004 + rand() * 0.014,
    rx: 0.013 + rand() * 0.026,
    ry: 0.011 + rand() * 0.028,
    angle: rand() * Math.PI,
    opacity: 0.37 + rand() * 0.42,
    contour: makeContour(rand),
  }));
  const cracks = Array.from({ length: NATURAL_SEAL_PLAN_LIMITS.cracks }, () => makeFiber(rand, true));
  const fibers = Array.from({ length: NATURAL_SEAL_PLAN_LIMITS.fibers }, () => makeFiber(rand, false));
  return { seed: identity, mottle, edgeWear, cracks, fibers };
}

/** A bounded, geometry-only cache prevents React repaints recreating the plan. */
const planCache = new Map<number, NaturalSealTexturePlan>();
const MAX_CACHED_PLANS = 24;

export function getNaturalSealTexturePlan(seed: number): NaturalSealTexturePlan {
  const identity = Math.trunc(Number.isFinite(seed) ? seed : 0) >>> 0;
  const cached = planCache.get(identity);
  if (cached) return cached;
  const plan = createNaturalSealTexturePlan(identity);
  if (planCache.size >= MAX_CACHED_PLANS) {
    const oldest = planCache.keys().next().value;
    if (oldest !== undefined) planCache.delete(oldest);
  }
  planCache.set(identity, plan);
  return plan;
}

/** Increasing intensity progressively reveals more marks in the same plan. */
export function getNaturalSealFeatureCounts(weathering: number) {
  const fraction = Number.isFinite(weathering)
    ? Math.max(0, Math.min(100, weathering)) / 100 : 0;
  return {
    mottle: Math.floor(fraction * NATURAL_SEAL_PLAN_LIMITS.mottle),
    edgeWear: Math.floor(fraction * NATURAL_SEAL_PLAN_LIMITS.edgeWear),
    cracks: Math.floor(fraction * NATURAL_SEAL_PLAN_LIMITS.cracks),
    fibers: Math.floor(fraction * NATURAL_SEAL_PLAN_LIMITS.fibers),
  };
}

/** Pure style-aware perimeter sampler for organic nicks and worn ink edges. */
export function getNaturalSealEdgePoint(style: StampStyle, perimeter: number, depth: number): SealPoint {
  const position = ((perimeter % 1) + 1) % 1;
  const inset = Math.max(0, Math.min(0.49, depth));
  if (style === 'round') {
    const angle = position * Math.PI * 2 - Math.PI / 2;
    const radius = 0.5 - inset;
    return [0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius];
  }
  // Share the same four radii and order as the painted Canvas roundRect.
  // Offsetting both the bounding box and radii by inset keeps the arc centers
  // fixed, placing nicks inside the deposited ink rather than empty corners.
  const radii = getStampCanvasRadii(style, 1);
  const [topLeft, topRight, bottomRight, bottomLeft] = Array.isArray(radii)
    ? radii : [radii, radii, radii, radii];
  const tl = Math.max(0, topLeft - inset);
  const tr = Math.max(0, topRight - inset);
  const br = Math.max(0, bottomRight - inset);
  const bl = Math.max(0, bottomLeft - inset);
  const left = inset;
  const right = 1 - inset;
  const top = inset;
  const bottom = 1 - inset;
  const horizontal = right - left;
  const vertical = bottom - top;
  const quarterArc = Math.PI / 2;
  const lengths = [
    horizontal - tl - tr, tr * quarterArc,
    vertical - tr - br, br * quarterArc,
    horizontal - br - bl, bl * quarterArc,
    vertical - bl - tl, tl * quarterArc,
  ];
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let distance = position * total;
  const segments: Array<(t: number) => SealPoint> = [
    (t) => [left + tl + t, top],
    (t) => [right - tr + tr * Math.sin(t / tr), top + tr - tr * Math.cos(t / tr)],
    (t) => [right, top + tr + t],
    (t) => [right - br + br * Math.cos(t / br), bottom - br + br * Math.sin(t / br)],
    (t) => [right - br - t, bottom],
    (t) => [left + bl - bl * Math.sin(t / bl), bottom - bl + bl * Math.cos(t / bl)],
    (t) => [left, bottom - bl - t],
    (t) => [left + tl - tl * Math.cos(t / tl), top + tl - tl * Math.sin(t / tl)],
  ];
  for (let index = 0; index < lengths.length; index++) {
    // Zero-length arcs must not evaluate t / 0 when an inset removes a corner.
    if (lengths[index] > 0 && distance <= lengths[index]) return segments[index](distance);
    distance -= lengths[index];
  }
  return [left + tl, top];
}
