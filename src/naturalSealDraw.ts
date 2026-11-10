import type { StampConfig } from './types';
import {
  getNaturalSealEdgePoint,
  getNaturalSealFeatureCounts,
  getNaturalSealSeed,
  getNaturalSealTexturePlan,
} from './naturalSealTexture';
import type { OrganicSealPatch, SealFiber } from './naturalSealTexture';

/**
 * Draw only translucent losses of deposited ink; the background is never
 * painted or sampled, so paper texture shines through the impression.
 * Coordinates are normalized to 0..1 independently from output resolution.
 * Call on an isolated ink-only canvas after the lettering is composed.
 */
export function drawNaturalSealImpression(ctx: CanvasRenderingContext2D, stamp: StampConfig): void {
  const size = stamp.size;
  if (!Number.isFinite(size) || size <= 0) return;
  const counts = getNaturalSealFeatureCounts(stamp.weathering ?? 50);
  if (!counts.mottle && !counts.edgeWear && !counts.cracks && !counts.fibers) return;
  const plan = getNaturalSealTexturePlan(getNaturalSealSeed(stamp));
  ctx.save();
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(size, size);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  // Preserve the original ink even at 100% wear: layers are thin and bounded.
  // Draw features in fixed order; adjusting intensity only adds features.
  for (let index = 0; index < counts.mottle; index++) {
    drawPatch(ctx, plan.mottle[index]);
  }
  for (let index = 0; index < counts.edgeWear; index++) {
    const item = plan.edgeWear[index];
    const [x, y] = getNaturalSealEdgePoint(stamp.style, item.perimeter, item.depth);
    drawPatch(ctx, { ...item, x, y });
  }
  for (let index = 0; index < counts.cracks; index++) {
    drawFiber(ctx, plan.cracks[index]);
  }
  for (let index = 0; index < counts.fibers; index++) {
    drawFiber(ctx, plan.fibers[index]);
  }
  ctx.restore();
}

function drawPatch(ctx: CanvasRenderingContext2D, patch: OrganicSealPatch): void {
  ctx.save();
  ctx.translate(patch.x, patch.y);
  ctx.rotate(patch.angle);
  ctx.scale(patch.rx, patch.ry);
  ctx.globalAlpha = patch.opacity;
  const points = patch.contour;
  const last = points[points.length - 1];
  const first = points[0];
  ctx.beginPath();
  ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  for (let index = 0; index < points.length; index++) {
    const p = points[index];
    const q = points[(index + 1) % points.length];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFiber(ctx: CanvasRenderingContext2D, fiber: SealFiber): void {
  ctx.save();
  ctx.globalAlpha = fiber.opacity;
  ctx.lineWidth = fiber.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fiber.x, fiber.y);
  ctx.quadraticCurveTo(
    fiber.x + fiber.dx / 2 - fiber.bend,
    fiber.y + fiber.dy / 2 + fiber.bend,
    fiber.x + fiber.dx,
    fiber.y + fiber.dy,
  );
  ctx.stroke();
  ctx.restore();
}
