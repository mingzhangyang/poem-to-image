import {
  createStampWeatheringRand,
  getStampBorderWidth,
  getStampRasterMetrics,
  getStampShadow,
  getStampTransform,
  STAMP_SHADOW_PADDING,
  getStampCanvasRadii,
  getStampCharacters,
  getStampTextFontSize,
  getStampTextPlacements,
  STAMP_INK_COLOR,
} from '../stampRendering';
import { positionToCanvasPoint } from '../positioningRect';
import { drawNaturalSealImpression } from '../naturalSealDraw';
import { fitTraditionalStampGlyph, getTraditionalStampLayout, isTraditionalStamp } from '../sealTypography';
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

/**
 * Historical seal mode: keep the real ink / carved lettering and generous
 * margins separate from the former decorative grid. Both destinations share
 * the same high-DPI body compositor (drawStampImpression).
 */
function drawTraditionalStampBody(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const layout = getTraditionalStampLayout(stamp);
  const inkColor = stamp.inkColor ?? STAMP_INK_COLOR;
  const isWhiteCharacters = stamp.mode === 'baiwen';

  ctx.save();
  drawStampShape(ctx, stamp, isWhiteCharacters ? 0 : layout.borderWidth / 2);
  if (isWhiteCharacters) {
    ctx.fillStyle = inkColor;
    ctx.fill();
  } else {
    ctx.lineWidth = layout.borderWidth;
    ctx.strokeStyle = inkColor;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  drawStampShape(ctx, stamp, layout.borderWidth * 0.75);
  ctx.clip();
  if (isWhiteCharacters) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
  } else {
    ctx.fillStyle = inkColor;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Match the round clipping path's inset; reserve a little extra breathing
  // room so measured corner strokes do not graze the circular border.
  const roundClipRadius = stamp.style === 'round'
    ? Math.max(0, stamp.size / 2 - layout.borderWidth * 0.75 - stamp.size * 0.015)
    : null;
  for (const slot of layout.slots) {
    ctx.font = 'normal ' + slot.fontSize + 'px ' + stamp.fontFamily;
    const fit = fitTraditionalStampGlyph(
      slot,
      ctx.measureText(slot.character),
      roundClipRadius === null ? undefined : { x: slot.x, y: slot.y, radius: roundClipRadius },
    );
    ctx.save();
    ctx.translate(slot.x, slot.y);
    ctx.scale(fit.scale, fit.scale);
    ctx.fillText(slot.character, fit.offsetX, fit.offsetY);
    ctx.restore();
  }
  ctx.restore();
}

export function drawStampBody(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const isFilled = stamp.colorScheme !== 'outline';
  const half = stamp.size / 2;
  const borderWidth = getStampBorderWidth(stamp.size);
  const chars = getStampCharacters(stamp.text);
  const inkColor = stamp.inkColor ?? STAMP_INK_COLOR;

  if (isTraditionalStamp(stamp)) {
    drawTraditionalStampBody(ctx, stamp);
  } else if (isFilled) {
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

  if (!isTraditionalStamp(stamp)) drawStampText(ctx, stamp);
  const weatheringLevel = stamp.weathering ?? 50;
  if (weatheringLevel > 0) {
    if (stamp.textureStyle === 'natural') {
      drawNaturalSealImpression(ctx, stamp);
    } else {
      // Unset/classic preserves the previous image bit-for-bit for old works.
      applyStampWeathering(ctx, stamp.size, createStampWeatheringRand(stamp), weatheringLevel);
    }
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
  const paddedSide = stamp.size + STAMP_SHADOW_PADDING * 2;
  const { pixels, scale } = getStampRasterMetrics(paddedSide, options.pixelScale ?? 1);
  const { pixels: inkPixels, scale: inkScale } = getStampRasterMetrics(stamp.size, scale);

  // The ink must be isolated because both white-character carving and
  // weathering use destination-out. A second bounded bitmap receives the
  // shadow before compositing: it can then rotate as part of the impression.
  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = inkPixels;
  inkCanvas.height = inkPixels;
  const inkCtx = inkCanvas.getContext('2d');
  if (!inkCtx) return;
  inkCtx.scale(inkScale, inkScale);
  inkCtx.translate(half, half);
  drawStampBody(inkCtx, stamp);

  const impression = document.createElement('canvas');
  impression.width = pixels;
  impression.height = pixels;
  const impressionCtx = impression.getContext('2d');
  if (!impressionCtx) return;

  const shadow = getStampShadow(stamp);
  // Canvas shadowBlur and shadowOffset are expressed in backing pixels and
  // do NOT inherit the drawing transform's scale. Match the bitmap DPR here.
  impressionCtx.shadowColor = shadow.color;
  impressionCtx.shadowBlur = shadow.blur * scale;
  impressionCtx.shadowOffsetX = shadow.offsetX * scale;
  impressionCtx.shadowOffsetY = shadow.offsetY * scale;
  impressionCtx.scale(scale, scale);
  impressionCtx.drawImage(inkCanvas, STAMP_SHADOW_PADDING, STAMP_SHADOW_PADDING, stamp.size, stamp.size);

  ctx.save();
  if (options.applyTransform !== false) {
    const { a, b, c, d } = getStampTransform(stamp);
    ctx.transform(a, b, c, d, 0, 0);
  }
  if (options.applyOpacity !== false) {
    ctx.globalAlpha *= stamp.opacity;
  }

  // A shadow baked in local coordinates rotates together with the seal in
  // both the CSS-transformed preview and the transformed Canvas export.
  ctx.drawImage(impression, -half - STAMP_SHADOW_PADDING, -half - STAMP_SHADOW_PADDING, paddedSide, paddedSide);
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
