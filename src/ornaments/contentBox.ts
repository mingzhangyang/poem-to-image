import manifest from './manifest.json';

/** [left, top, right, bottom] as fractions of an ornament's square layout box. */
export type OrnamentContentBox = readonly [left: number, top: number, right: number, bottom: number];

const FULL_BOX: OrnamentContentBox = [0, 0, 1, 1];

const contentById = new Map<string, OrnamentContentBox>(
  manifest.map(item => [item.id, item.content as unknown as OrnamentContentBox]),
);

/**
 * The visible part of an ornament inside its size × size layout box, mirrored
 * when the ornament is flipped. Ornament images carry transparent margins;
 * selecting, dragging and anchoring use this box so the visible ink, not the
 * margin, can reach the canvas edge. Unknown ornaments use the whole box.
 */
export function getOrnamentContentBox(ornamentId: string | undefined, flipped = false): OrnamentContentBox {
  const box = (ornamentId && contentById.get(ornamentId)) || FULL_BOX;
  return flipped ? [1 - box[2], box[1], 1 - box[0], box[3]] : box;
}

/**
 * How far the rotated content box reaches from the ornament's centre, in the
 * same units as `size`. Rotation is about the layout box centre, as in the
 * preview and the export.
 */
export function getOrnamentContentExtents(box: OrnamentContentBox, size: number, rotationDegrees: number) {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const fx of [box[0], box[2]]) {
    for (const fy of [box[1], box[3]]) {
      const x = (fx - 0.5) * size;
      const y = (fy - 0.5) * size;
      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;
      left = Math.min(left, rotatedX);
      right = Math.max(right, rotatedX);
      top = Math.min(top, rotatedY);
      bottom = Math.max(bottom, rotatedY);
    }
  }
  return { left: -left, right, top: -top, bottom };
}
