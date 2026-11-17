import {
  getStampCanvasRadii, getStampCharacters, getStampDimensions, getStampTextScale,
} from './stampRendering';
import type { StampConfig } from './types';

/** Measured in Canvas with textAlign=center and textBaseline=middle. */
export interface WholeStampGlyphMetrics {
  /** Advance width provides a conservative fallback on older Canvas engines. */
  width?: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}
export interface WholeStampInkBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface WholeStampFit {
  character: string;
  /** Canvas text anchor, with the ink visually centered at the target. */
  x: number;
  y: number;
  /** One uniform scale: glyph proportions never stretch independently. */
  scale: number;
  ink: WholeStampInkBox;
}
export interface WholeStampLayout {
  fits: WholeStampFit[];
  /** Zero-based character indices; columns run right-to-left, glyphs top-down. */
  groups: number[][];
  borderWidth: number;
  gap: number;
  paintedArea: number;
  /** Chosen candidate index, stable while compactness changes. */
  variant: 0 | 1 | 2;
}
type CompositionStamp = Pick<StampConfig,
  'text' | 'style' | 'size' | 'shapeRatio' | 'mode' | 'compositionMode'
  | 'compositionTightness' | 'compositionVariant' | 'textScale'>;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function getCompositionTightness(
  stamp: Pick<StampConfig, 'compositionTightness'>,
): number {
  const value = stamp.compositionTightness;
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, 0, 100) : 70;
}

/** Missing mode means a saved pre-Phase-2 seal, and must stay pixel-compatible. */
export function isWholeSealComposition(
  stamp: Pick<StampConfig, 'compositionMode' | 'mode'>,
): boolean {
  return (stamp.mode === 'zhuwen' || stamp.mode === 'baiwen')
    && (stamp.compositionMode === 'whole' || stamp.compositionMode === 'name');
}

function contiguousGroups(count: number, columns: number): number[][] {
  let index = 0;
  return Array.from({ length: columns }, (_, column) => {
    const length = Math.floor(count / columns) + Number(column < count % columns);
    return Array.from({ length }, () => index++);
  });
}

interface InkMetrics {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  balance: number;
}

function measuredInk(bounds: WholeStampGlyphMetrics): InkMetrics {
  const safe = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const left = safe(bounds.actualBoundingBoxLeft);
  const right = safe(bounds.actualBoundingBoxRight);
  const ascent = safe(bounds.actualBoundingBoxAscent);
  const descent = safe(bounds.actualBoundingBoxDescent);
  const advance = typeof bounds.width === 'number' && Number.isFinite(bounds.width)
    ? Math.max(0, bounds.width) : 70;
  const width = Math.max(0.5, left + right > 0.5 ? left + right : advance);
  // Sampled at a fixed 100px face; never infer a huge scale from absent
  // actualBoundingBox* metrics. Narrow genuine strokes keep their own height.
  const height = ascent + descent > 0.5 ? ascent + descent : 80;
  return {
    width, height,
    centerX: (right - left) / 2,
    centerY: (descent - ascent) / 2,
    balance: 0.72 * Math.max(width, height) + 0.28 * Math.sqrt(width * height),
  };
}

/** The same conservative inset as drawStampShape's clipped text face.
 * All four painted-ink rectangle corners must remain inside the actual shape.
 * Brush seals use their four independent roundRect corner radii. */
function makeBoundary(stamp: CompositionStamp, borderWidth: number) {
  const { width, height } = getStampDimensions(stamp);
  const short = Math.min(width, height);
  const inset = borderWidth * 0.75 + short * 0.019;
  const halfW = Math.max(0, width / 2 - inset);
  const halfH = Math.max(0, height / 2 - inset);
  const raw = getStampCanvasRadii(stamp.style, short);
  const radii = (Array.isArray(raw) ? raw : [raw, raw, raw, raw])
    .map(radius => clamp(radius - inset, 0, Math.min(halfW, halfH)));
  return (x: number, y: number) => {
    if (Math.abs(x) > halfW + 1e-7 || Math.abs(y) > halfH + 1e-7) return false;
    if (stamp.style === 'round' || stamp.style === 'oval') {
      return halfW > 0 && halfH > 0
        && (x / halfW) ** 2 + (y / halfH) ** 2 <= 1 + 1e-9;
    }
    const quadrant = x < 0
      ? (y < 0 ? 0 : 3) : (y < 0 ? 1 : 2);
    const radius = radii[quadrant];
    const cx = x < 0 ? -halfW + radius : halfW - radius;
    const cy = y < 0 ? -halfH + radius : halfH - radius;
    if (Math.abs(x) <= halfW - radius || Math.abs(y) <= halfH - radius) return true;
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius + 1e-7;
  };
}

/** Candidate column counts depend only on text length and shape, not slider or
 * measurement. The UI can therefore show only genuinely distinct choices. */
export function getWholeSealColumnChoices(stamp: Pick<StampConfig, 'text' | 'style'>): number[] {
  const n = getStampCharacters(stamp.text).length;
  if (n <= 1) return [1];
  const style = stamp.style;
  const minColumns = style === 'rect-horizontal' ? Math.max(1, Math.ceil(n / 3))
    : n >= 5 && style !== 'rect-vertical' && style !== 'oval' ? 2 : 1;
  const maxColumns = style === 'rect-horizontal' ? n
    : style === 'rect-vertical' ? Math.min(n, Math.ceil(n / 2))
    : style === 'oval' ? Math.min(n, 4)
    : n >= 5 ? Math.min(n, Math.ceil(Math.sqrt(n)) + 1) : n;
  return Array.from({ length: Math.max(0, maxColumns - minColumns + 1) },
    (_, index) => minColumns + index);
}

/** Whole-impression, painted-bounds layout; never uses inherited fixed cells.
 * 1–8 glyphs, no randomness, no per-axis glyph deformation. Candidate reading
 * partitions are solved by binary search for the largest safe ink scale.
 * Visual balance uses conservative optical normalization; no thin stroke
 * (such as 一) becomes a giant horizontal slab. */
export function composeWholeStampLayout(
  stamp: CompositionStamp,
  measured: readonly WholeStampGlyphMetrics[],
  strokeWidth = 0,
): WholeStampLayout {
  const chars = getStampCharacters(stamp.text);
  const n = chars.length;
  const { width, height } = getStampDimensions(stamp);
  const shortSide = Math.min(width, height);
  const borderWidth = Math.min(shortSide * 0.2, Math.max(0.5, shortSide * 0.038));
  const blank = (): WholeStampLayout =>
    ({ fits: [], groups: [], borderWidth, gap: 0, paintedArea: 0, variant: 0 });
  if (n < 1 || n > 8 || n !== measured.length || shortSide <= 0) return blank();
  const metrics = measured.map(measuredInk);
  const median = [...metrics.map(g => g.balance)].sort((a, b) => a - b)[Math.floor(n / 2)];
  const normalization = metrics.map(g =>
    clamp(1 + 0.5 * (median / Math.max(0.5, g.balance) - 1), 0.83, 1.18));
  const inside = makeBoundary(stamp, borderWidth);
  const stroke = Number.isFinite(strokeWidth) ? clamp(strokeWidth, 0, shortSide * 0.2) : 0;
  const tightness = getCompositionTightness(stamp);
  const gap = shortSide * (0.052 - 0.00036 * tightness);

  const arrange = (groups: number[][], size: number, spacing: number) => {
    const dims = metrics.map((m, i) => {
      const scale = size * normalization[i];
      return { scale, width: m.width * scale + stroke, height: m.height * scale + stroke };
    });
    const columnWidths = groups.map(group => Math.max(...group.map(i => dims[i].width)));
    const columnHeights = groups.map(group =>
      group.reduce((sum, i) => sum + dims[i].height, 0) + spacing * (group.length - 1));
    const totalWidth = columnWidths.reduce((sum, v) => sum + v, 0)
      + spacing * (groups.length - 1);
    let nextRight = totalWidth / 2;
    const fits = new Array<WholeStampFit>(n);
    const boxes = new Array<WholeStampInkBox>(n);
    let paintedArea = 0;
    groups.forEach((group, col) => {
      const centerX = nextRight - columnWidths[col] / 2;
      let nextTop = -columnHeights[col] / 2;
      for (const i of group) {
        const d = dims[i];
        const centerY = nextTop + d.height / 2;
        const box = {
          left: centerX - d.width / 2, right: centerX + d.width / 2,
          top: centerY - d.height / 2, bottom: centerY + d.height / 2,
        };
        boxes[i] = box;
        fits[i] = {
          character: chars[i],
          x: centerX - metrics[i].centerX * d.scale,
          y: centerY - metrics[i].centerY * d.scale,
          scale: d.scale,
          ink: box,
        };
        paintedArea += d.width * d.height;
        nextTop += d.height + spacing;
      }
      nextRight -= columnWidths[col] + spacing;
    });
    const valid = boxes.every(b => [b.left, b.right].every(x =>
      [b.top, b.bottom].every(y => inside(x, y))));
    return { fits, valid, paintedArea };
  };

  const upper = Math.max(width, height) * 3
    / Math.max(0.5, Math.min(...metrics.map(m => Math.max(m.width, m.height))));
  const solve = (groups: number[][], spacing: number) => {
    let lo = 0, hi = upper;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (arrange(groups, mid, spacing).valid) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const candidateCounts = () => getWholeSealColumnChoices(stamp);

  const specificName = stamp.compositionMode === 'name' && n === 3;
  const candidates: { groups: number[][]; score: number; columns: number }[] = [];
  if (!specificName) {
    // Topology is ranked at a fixed reference gap, independent of the slider.
    const referenceGap = shortSide * 0.029;
    for (const count of candidateCounts()) {
      const groups = contiguousGroups(n, count);
      const optimal = solve(groups, referenceGap);
      const ink = arrange(groups, optimal, referenceGap);
      const lengths = groups.map(g => g.length);
      const ragged = Math.max(...lengths) - Math.min(...lengths);
      const score = ink.paintedArea * (1 - ragged * 0.055);
      if (ink.valid && optimal > 0) candidates.push({ groups, score, columns: count });
    }
    candidates.sort((a,b) => (b.score - a.score) || (a.columns - b.columns));
  }
  const available = specificName ? 1 : Math.min(3, candidates.length);
  const rawVariant = stamp.compositionVariant;
  const selected = typeof rawVariant === 'number' && Number.isInteger(rawVariant)
    ? clamp(rawVariant, 0, Math.max(0, available - 1)) : 0;
  const variant = selected as 0 | 1 | 2;
  const bestGroups = specificName ? [[0], [1, 2]] : candidates[selected]?.groups;
  if (!bestGroups) return blank();
  const maximum = solve(bestGroups, gap);
  // Leave headroom for the separate 70–110% glyph-size slider.
  const fill = Math.min(0.98, (0.76 + tightness * 0.0018) * getStampTextScale(stamp));
  const result = arrange(bestGroups, maximum * fill, gap);
  if (!result.valid || result.fits.some(f => !(f.scale > 0))) return blank();
  return { fits: result.fits, groups: bestGroups, gap, borderWidth,
    paintedArea: result.paintedArea, variant };
}
