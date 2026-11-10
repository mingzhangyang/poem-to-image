import {
  createStampWeatheringRand,
  getStampBorderWidth,
  getStampRasterMetrics,
  getStampShadow,
  getStampTransform,
  getStampCanvasRadii,
  getStampCharacters,
  getStampTextFontSize,
  getStampTextPlacements,
  STAMP_INK_COLOR,
} from '../stampRendering';
import { positionToCanvasPoint } from '../positioningRect';
import type { StampConfig } from '../types';
import type { CanvasExportScene } from './renderCanvasExport';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function applyStampWeathering(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: () => number,
  weatheringLevel: number,
) {
  const weathering = weatheringLevel / 100;
  const half = size / 2;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';

  const noiseCount = weathering * 2000;
  for (let i = 0; i < noiseCount; i++) {
    ctx.beginPath();
    ctx.arc((rand() - 0.5) * size, (rand() - 0.5) * size, rand() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const edgeWearCount = weathering * 400;
  const depth = size * 0.06;
  for (let i = 0; i < edgeWearCount; i++) {
    const edge = Math.floor(rand() * 4);
    let x: number, y: number;
    if (edge === 0)      { x = (rand() - 0.5) * size; y = -half + rand() * depth; }
    else if (edge === 1) { x = (rand() - 0.5) * size; y = half - rand() * depth; }
    else if (edge === 2) { x = -half + rand() * depth; y = (rand() - 0.5) * size; }
    else                 { x = half - rand() * depth; y = (rand() - 0.5) * size; }
    ctx.beginPath();
    ctx.arc(x, y, rand() * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const chunkCount = weathering * 10;
  for (let i = 0; i < chunkCount; i++) {
    const edge = Math.floor(rand() * 4);
    let x: number, y: number;
    if (edge === 0)      { x = (rand() - 0.5) * size; y = -half; }
    else if (edge === 1) { x = (rand() - 0.5) * size; y = half; }
    else if (edge === 2) { x = -half; y = (rand() - 0.5) * size; }
    else                 { x = half; y = (rand() - 0.5) * size; }
    ctx.beginPath();
    ctx.arc(x, y, rand() * size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStampShape(ctx: CanvasRenderingContext2D, stamp: StampConfig, inset = 0) {
  const half = stamp.size / 2 - inset;
  ctx.beginPath();
  if (stamp.style === 'round') {
    ctx.arc(0, 0, half, 0, Math.PI * 2);
  } else {
    const radii = getStampCanvasRadii(stamp.style, stamp.size);
    const insetRadii = Array.isArray(radii)
      ? radii.map((radius) => Math.max(0, radius - inset))
      : Math.max(0, radii - inset);
    ctx.roundRect(-half, -half, half * 2, half * 2, insetRadii);
  }
  ctx.closePath();
}

function drawStampText(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const isFilled = stamp.colorScheme !== 'outline';
  const characters = getStampCharacters(stamp.text);
  const fontSize = getStampTextFontSize(stamp.size, characters.length);
  const placements = getStampTextPlacements(stamp.size, characters.length);

  ctx.save();
  ctx.font = `bold ${fontSize}px ${stamp.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const inkColor = stamp.inkColor ?? STAMP_INK_COLOR;

  if (isFilled) {
    drawStampShape(ctx, stamp);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
  } else {
    ctx.fillStyle = inkColor;
  }

  characters.forEach((character, index) => {
    const { x, y } = placements[index] ?? placements[placements.length - 1];
    ctx.fillText(character, x, y);
  });

  ctx.restore();
}

export function drawStampBody(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const isFilled = stamp.colorScheme !== 'outline';
  const half = stamp.size / 2;
  const borderWidth = getStampBorderWidth(stamp.size);
  const chars = getStampCharacters(stamp.text);
  const inkColor = stamp.inkColor ?? STAMP_INK_COLOR;

  if (isFilled) {
    drawStampShape(ctx, stamp);
    ctx.fillStyle = inkColor;
    ctx.fill();
  } else {
    ctx.save();
    drawStampShape(ctx, stamp, borderWidth / 2);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = inkColor;
    ctx.stroke();

    if (chars.length > 1) {
      ctx.save();
      drawStampShape(ctx, stamp);
      ctx.clip();
      ctx.lineWidth = borderWidth / 2;
      ctx.strokeStyle = inkColor;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(0, half);
      ctx.stroke();

      if (chars.length > 2) {
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.lineTo(half, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawStampText(ctx, stamp);
  const weatheringLevel = stamp.weathering ?? 50;
  if (weatheringLevel > 0) {
    applyStampWeathering(ctx, stamp.size, createStampWeatheringRand(stamp), weatheringLevel);
  }
}

export interface StampImpressionOptions {
  /** Target backing pixels per logical pixel (1×, 2×, 3× or preview DPR). */
  pixelScale?: number;
  /** CSS applies the same matrix to the draggable live preview frame. */
  applyTransform?: boolean;
  /** CSS applies opacity to the draggable live preview frame. */
  applyOpacity?: boolean;
}

/**
 * Paint a complete seal centred on the current origin, including its shadow.
 * The stamp body is isolated so destination-out carving never erases the poem.
 * Both the live preview and 1×/2×/3× export use this compositor.
 */
export function drawStampImpression(
  ctx: CanvasRenderingContext2D,
  stamp: StampConfig,
  options: StampImpressionOptions = {},
) {
  if (!Number.isFinite(stamp.size) || stamp.size <= 0) return;
  const half = stamp.size / 2;
  const { pixels, scale } = getStampRasterMetrics(stamp.size, options.pixelScale ?? 1);
  const offCanvas = document.createElement('canvas');
  offCanvas.width = pixels;
  offCanvas.height = pixels;
  const offCtx = offCanvas.getContext('2d');
  if (!offCtx) return;

  offCtx.scale(scale, scale);
  offCtx.translate(half, half);
  drawStampBody(offCtx, stamp);

  ctx.save();
  if (options.applyTransform !== false) {
    const { a, b, c, d } = getStampTransform(stamp);
    ctx.transform(a, b, c, d, 0, 0);
  }
  if (options.applyOpacity !== false) {
    ctx.globalAlpha *= stamp.opacity;
  }
  const shadow = getStampShadow(stamp);
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetX = shadow.offsetX;
  ctx.shadowOffsetY = shadow.offsetY;

  // Explicit destination dimensions retain the logical size even when the
  // source bitmap is generated at higher DPR or at its safety cap.
  ctx.drawImage(offCanvas, -half, -half, stamp.size, stamp.size);
  ctx.restore();
}

export function drawStamp(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { stamp } = scene.decorations;
  const { x, y } = positionToCanvasPoint(frameRect, stamp);

  ctx.save();
  ctx.translate(x, y);
  drawStampImpression(ctx, stamp, { pixelScale: scene.exportScale });
  ctx.restore();
}
