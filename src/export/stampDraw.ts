import {
  createStampWeatheringRand,
  getStampBorderWidth,
  getStampRasterDimensions,
  getStampDimensions,
  isExtendedStampStyle,
  getStampShadow,
  getStampTransform,
  STAMP_SHADOW_PADDING,
  getStampCanvasRadii,
  getStampCharacters,
  getStampTextFontSize,
  getStampTextScale,
  getStampTextStrokeWidth,
  getStampTextPlacements,
  STAMP_INK_COLOR,
} from '../stampRendering';
import { positionToCanvasPoint } from '../positioningRect';
import { drawNaturalSealImpression } from '../naturalSealDraw';
import { getNaturalSealEdgePoint } from '../naturalSealTexture';
import { drawSealMotif, isSealMotifId } from '../sealMotifs';
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

/** Classic dots for new forms follow their real face; old dot paths stay untouched. */
function applyElongatedStampWeathering(
  ctx: CanvasRenderingContext2D, stamp: StampConfig, rand: () => number,
  weatheringLevel: number,
) {
  const { width, height } = getStampDimensions(stamp);
  const weathering = Math.max(0, Math.min(100, weatheringLevel)) / 100;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (let index = 0; index < weathering * 600; index++) {
    ctx.beginPath();
    ctx.arc((rand() - 0.5) * width, (rand() - 0.5) * height, rand() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let index = 0; index < weathering * 220; index++) {
    const [x, y] = getNaturalSealEdgePoint(stamp.style, rand(), rand() * 0.04, stamp.shapeRatio);
    ctx.beginPath();
    ctx.arc((x - 0.5) * width, (y - 0.5) * height, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStampShape(ctx: CanvasRenderingContext2D, stamp: StampConfig, inset = 0) {
  const { width, height } = getStampDimensions(stamp);
  const halfWidth = Math.max(0, width / 2 - inset);
  const halfHeight = Math.max(0, height / 2 - inset);
  ctx.beginPath();
  if (stamp.style === 'round') {
    ctx.arc(0, 0, halfWidth, 0, Math.PI * 2);
  } else if (stamp.style === 'oval') {
    ctx.ellipse(0, 0, halfWidth, halfHeight, 0, 0, Math.PI * 2);
  } else {
    const radii = getStampCanvasRadii(stamp.style,
      isExtendedStampStyle(stamp.style) ? Math.min(width, height) : stamp.size);
    const insetRadii = Array.isArray(radii)
      ? radii.map((radius) => Math.max(0, radius - inset))
      : Math.max(0, radii - inset);
    ctx.roundRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2, insetRadii);
  }
  ctx.closePath();
}

/**
 * Motif stamps share the same frame, clipping and isolated ink canvas as
 * traditional text seals. The vector is uniformly scaled, never distorted.
 * Bai Wen carves negative space via destination-out on the isolated ink layer.
 */
function drawMotifStampBody(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  if (!isSealMotifId(stamp.motifId)) return;
  const { width, height } = getStampDimensions(stamp);
  const shortSide = Math.min(width, height);
  const borderWidth = Math.min(shortSide * 0.2, Math.max(0.5, shortSide * 0.038));
  const inkColor = stamp.inkColor ?? STAMP_INK_COLOR;
  const isCarved = stamp.mode === 'baiwen'
    || (stamp.mode !== 'zhuwen' && stamp.colorScheme !== 'outline');

  ctx.save();
  drawStampShape(ctx, stamp, isCarved ? 0 : borderWidth / 2);
  if (isCarved) {
    ctx.fillStyle = inkColor;
    ctx.fill();
  } else {
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  drawStampShape(ctx, stamp, borderWidth * 0.75);
  ctx.clip();
  ctx.globalCompositeOperation = isCarved ? 'destination-out' : 'source-over';
  ctx.strokeStyle = isCarved ? '#000' : inkColor;
  ctx.fillStyle = isCarved ? '#000' : inkColor;

  // Keep the motif's proportions even inside a tall or wide seal.
  // The additional oval inset leaves room near its curved boundary.
  const side = Math.max(0, Math.min(width, height)
    * (stamp.style === 'round' || stamp.style === 'oval' ? 0.67 : 0.77));
  ctx.scale(side / 100, side / 100);
  drawSealMotif(ctx, stamp.motifId);
  ctx.restore();
}

function drawStampText(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const isFilled = stamp.colorScheme !== 'outline';
  const characters = getStampCharacters(stamp.text);
  const fontSize = getStampTextFontSize(stamp.size, characters.length) * getStampTextScale(stamp);
  const strokeWidth = getStampTextStrokeWidth(stamp);
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
  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isFilled ? '#000' : inkColor;
  }

  characters.forEach((character, index) => {
    const { x, y } = placements[index] ?? placements[placements.length - 1];
    if (strokeWidth > 0) ctx.strokeText(character, x, y);
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
  // New forms share the measured glyph renderer even when used in modern mode.
  const isWhiteCharacters = stamp.mode === 'baiwen'
    || (stamp.mode !== 'zhuwen' && stamp.colorScheme !== 'outline');
  const glyphStrokeWidth = getStampTextStrokeWidth(stamp);

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
  if (glyphStrokeWidth > 0) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isWhiteCharacters ? '#000' : inkColor;
  }
  // Match the round clipping path's inset; reserve a little extra breathing
  // room so measured corner strokes do not graze the circular border.
  const roundClipRadius = stamp.style === 'round'
    ? Math.max(0, stamp.size / 2 - layout.borderWidth * 0.75 - stamp.size * 0.015)
    : null;
  const dimensions = getStampDimensions(stamp);
  const ovalClip = stamp.style === 'oval' ? {
    radiusX: Math.max(0, dimensions.width / 2 - layout.borderWidth * 0.75 - dimensions.width * 0.015),
    radiusY: Math.max(0, dimensions.height / 2 - layout.borderWidth * 0.75 - dimensions.height * 0.015),
  } : null;
  for (const slot of layout.slots) {
    ctx.font = 'normal ' + slot.fontSize + 'px ' + stamp.fontFamily;
    const fit = fitTraditionalStampGlyph(
      slot,
      ctx.measureText(slot.character),
      roundClipRadius !== null ? { x: slot.x, y: slot.y, radius: roundClipRadius }
        : ovalClip ? { x: slot.x, y: slot.y, ...ovalClip } : undefined,
      getStampTextScale(stamp),
      glyphStrokeWidth,
    );
    if (fit.scale <= 0) continue; // No drawable glyph fits inside the ink/clip budget.
    ctx.save();
    ctx.translate(slot.x, slot.y);
    ctx.scale(fit.scale, fit.scale);
    if (glyphStrokeWidth > 0) {
      // Canvas scales lineWidth with its transform. Counteract glyph fitting
      // so the stroke slider always means a percentage of the seal, not the glyph.
      ctx.lineWidth = glyphStrokeWidth / fit.scale;
      ctx.strokeText(slot.character, fit.offsetX, fit.offsetY);
    }
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

  const useMotif = isSealMotifId(stamp.motifId);
  const useMeasuredLayout = isTraditionalStamp(stamp)
    || isExtendedStampStyle(stamp.style) || chars.length > 4;
  if (useMotif) {
    drawMotifStampBody(ctx, stamp);
  } else if (useMeasuredLayout) {
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

  if (!useMotif && !useMeasuredLayout) drawStampText(ctx, stamp);
  const weatheringLevel = stamp.weathering ?? 50;
  if (weatheringLevel > 0) {
    if (stamp.textureStyle === 'natural') {
      drawNaturalSealImpression(ctx, stamp);
    } else {
      // Unset/classic preserves the previous image bit-for-bit for old works.
      const rand = createStampWeatheringRand(stamp);
      if (isExtendedStampStyle(stamp.style)) {
        applyElongatedStampWeathering(ctx, stamp, rand, weatheringLevel);
      } else {
        applyStampWeathering(ctx, stamp.size, rand, weatheringLevel);
      }
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
  const { width, height } = getStampDimensions(stamp);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const paddedWidth = width + STAMP_SHADOW_PADDING * 2;
  const paddedHeight = height + STAMP_SHADOW_PADDING * 2;
  const { widthPixels, heightPixels, scale } = getStampRasterDimensions(
    paddedWidth, paddedHeight, options.pixelScale ?? 1,
  );
  const { widthPixels: inkWidth, heightPixels: inkHeight, scale: inkScale } =
    getStampRasterDimensions(width, height, scale);

  // The ink must be isolated because both white-character carving and
  // weathering use destination-out. A second bounded bitmap receives the
  // shadow before compositing: it can then rotate as part of the impression.
  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = inkWidth;
  inkCanvas.height = inkHeight;
  const inkCtx = inkCanvas.getContext('2d');
  if (!inkCtx) return;
  inkCtx.scale(inkScale, inkScale);
  inkCtx.translate(halfWidth, halfHeight);
  drawStampBody(inkCtx, stamp);

  const impression = document.createElement('canvas');
  impression.width = widthPixels;
  impression.height = heightPixels;
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
  impressionCtx.drawImage(inkCanvas, STAMP_SHADOW_PADDING, STAMP_SHADOW_PADDING, width, height);

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
  ctx.drawImage(impression, -halfWidth - STAMP_SHADOW_PADDING,
    -halfHeight - STAMP_SHADOW_PADDING, paddedWidth, paddedHeight);
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
