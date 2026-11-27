import { clampToDragBounds, type DragBounds, type RelativePosition } from '../positioningRect';
import type { LogoConfig, PlacementArea } from '../types';
import { getOrnamentContentBox, getOrnamentContentExtents } from './contentBox';

type PlacedOrnament = Pick<LogoConfig, 'ornamentId' | 'size' | 'rotation' | 'flipped'>;

/** Snapped ornaments keep their visible ink this fraction of the canvas from its edge. */
const EDGE_MARGIN = 0.03;

/** Duplicates are offset by this many percent of the poem frame width. */
const DUPLICATE_OFFSET = 2;

function reach(ornament: PlacedOrnament) {
  return getOrnamentContentExtents(
    getOrnamentContentBox(ornament.ornamentId, ornament.flipped), ornament.size, ornament.rotation,
  );
}

/**
 * Positions (percentages of the poem frame, which may fall outside 0–100)
 * that keep the ornament's visible ink on the canvas. Canvas padding is for
 * text, so ornaments may use it. An ornament larger than the canvas on an
 * axis is centred on that axis.
 */
export function getOrnamentPositionBounds(area: PlacementArea, ornament: PlacedOrnament): DragBounds {
  const { left, right, top, bottom } = reach(ornament);
  const axis = (before: number, after: number, start: number, size: number, canvasSize: number) => {
    const min = (before - start) / size * 100;
    const max = (canvasSize - after - start) / size * 100;
    return min <= max ? [min, max] : [(min + max) / 2, (min + max) / 2];
  };
  const [minPositionX, maxPositionX] = axis(left, right, area.left, area.width, area.canvasWidth);
  const [minPositionY, maxPositionY] = axis(top, bottom, area.top, area.height, area.canvasHeight);
  return { minPositionX, maxPositionX, minPositionY, maxPositionY };
}

/**
 * Places the ornament's visible ink, not its transparent margin, 3% inside
 * the chosen canvas corner or edge. Anchors are `t`/`b`/`m` then `l`/`r`/`c`,
 * e.g. `tl`, `br`, `bc`, `ml`.
 */
export function getOrnamentAnchorPosition(area: PlacementArea, anchor: string, ornament: PlacedOrnament): RelativePosition {
  const extents = reach(ornament);
  const place = (side: 'start' | 'end' | 'center', before: number, after: number, canvasSize: number) => {
    const margin = canvasSize * EDGE_MARGIN;
    return side === 'start' ? margin + before
      : side === 'end' ? canvasSize - margin - after
        : canvasSize / 2 + (before - after) / 2;
  };
  const x = place(anchor.endsWith('l') ? 'start' : anchor.endsWith('r') ? 'end' : 'center', extents.left, extents.right, area.canvasWidth);
  const y = place(anchor.startsWith('t') ? 'start' : anchor.startsWith('b') ? 'end' : 'center', extents.top, extents.bottom, area.canvasHeight);
  return {
    positionX: (x - area.left) / area.width * 100,
    positionY: (y - area.top) / area.height * 100,
  };
}

/**
 * Where a duplicate goes: slightly right of the original, or slightly left
 * when that would push its ink past the canvas edge, and always on the canvas.
 */
export function getDuplicatePosition(area: PlacementArea, ornament: PlacedOrnament & RelativePosition): RelativePosition {
  const bounds = getOrnamentPositionBounds(area, ornament);
  const right = ornament.positionX + DUPLICATE_OFFSET;
  return clampToDragBounds({
    positionX: right <= bounds.maxPositionX ? right : ornament.positionX - DUPLICATE_OFFSET,
    positionY: ornament.positionY,
  }, bounds);
}
