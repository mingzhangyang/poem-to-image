import {
  createVectorBorderStrokes,
  getBorderGradientStops,
  getDoubleBorderMetrics,
  isGradientBorderStyle,
  isVectorBorderStyle,
  isShadowBorderStyle,
  toRgba,
} from '../borderUtils';
import { createStructuredPoemLayout } from '../poemContent';
import { getCanvasPositioningRect } from '../positioningRect';
import {
  createStampWeatheringRand,
  getBrushStampSkew,
  getStampBorderWidth,
  getStampCanvasRadii,
  getStampCharacters,
  getStampTextFontSize,
  getStampTextPlacements,
  STAMP_INK_COLOR,
} from '../stampRendering';
import { createCanvasTextMeasurer, createTextLayout } from '../textLayout';
import type { BorderStyle, CustomText, ExportScale, LogoConfig, PoemContentData, PoemLayerStyle, PositionedElement, StampConfig, TextAlign, WritingMode } from '../types';

interface CanvasExportBackground {
  backgroundType: 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  bgBrightness: number;
  bgBlur: number;
}

interface CanvasExportTypography {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: TextAlign;
  writingMode: WritingMode;
  padding: number;
  lineHeight: number;
  letterSpacing: number;
  columns: number;
  columnGap: number;
  textShadowEnabled: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowOffsetY: number;
  textShadowOffsetX: number;
  poemPosition: PositionedElement;
}

interface CanvasExportDecorations {
  showBorder: boolean;
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  stamp: StampConfig;
  customTexts: CustomText[];
  logos: LogoConfig[];
}

export interface CanvasExportScene {
  canvasWidth: number;
  canvasHeight: number;
  exportScale: ExportScale;
  background: CanvasExportBackground;
  typography: CanvasExportTypography;
  decorations: CanvasExportDecorations;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderCanvasExportOptions {
  skipPoem?: boolean;
}

type DecorationLayer =
  | { kind: 'customText'; item: CustomText; zIndex: number; order: number }
  | { kind: 'logo'; item: LogoConfig; zIndex: number; order: number };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

function applyTextShadow(ctx: CanvasRenderingContext2D, typography: CanvasExportTypography) {
  if (!typography.textShadowEnabled) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }

  ctx.shadowColor = typography.textShadowColor;
  ctx.shadowBlur = typography.textShadowBlur;
  ctx.shadowOffsetX = typography.textShadowOffsetX;
  ctx.shadowOffsetY = typography.textShadowOffsetY;
}

function createGradient(ctx: CanvasRenderingContext2D, rect: Rect, direction: string, color1: string, color2: string) {
  let x0 = rect.x;
  let y0 = rect.y;
  let x1 = rect.x + rect.width;
  let y1 = rect.y;

  if (direction === 'to bottom') {
    x1 = rect.x;
    y1 = rect.y + rect.height;
  } else if (direction === 'to bottom right') {
    x1 = rect.x + rect.width;
    y1 = rect.y + rect.height;
  } else if (direction === 'to top right') {
    x0 = rect.x;
    y0 = rect.y + rect.height;
    x1 = rect.x + rect.width;
    y1 = rect.y;
  }

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

async function drawBackground(ctx: CanvasRenderingContext2D, scene: CanvasExportScene) {
  const { canvasWidth, canvasHeight, background } = scene;
  const rect = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

  if (background.backgroundType === 'transparent') {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    return;
  }

  if (background.backgroundType === 'solid') {
    ctx.fillStyle = background.backgroundColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (background.backgroundType === 'gradient') {
    ctx.fillStyle = createGradient(ctx, rect, background.gradientDirection, background.gradientColor1, background.gradientColor2);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (!background.backgroundImage) {
    return;
  }

  const image = await loadImage(background.backgroundImage);
  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;

  if (imageRatio > canvasRatio) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imageRatio;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imageRatio;
  }

  if (background.bgBlur > 0) {
    drawWidth *= 1.1;
    drawHeight *= 1.1;
  }

  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  ctx.save();
  ctx.filter = `brightness(${background.bgBrightness}%) blur(${background.bgBlur}px)`;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function drawBorder(ctx: CanvasRenderingContext2D, rect: Rect, borderStyle: BorderStyle, color: string, borderWidth: number) {
  const safeBorderWidth = Math.max(2, borderWidth);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  if (isVectorBorderStyle(borderStyle)) {
    const strokes = createVectorBorderStrokes(rect.width, rect.height, safeBorderWidth, borderStyle);

    ctx.translate(rect.x, rect.y);

    strokes.forEach((stroke) => {
      ctx.save();
      ctx.globalAlpha = stroke.opacity;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = stroke.lineCap ?? 'round';
      ctx.lineJoin = stroke.lineJoin ?? 'round';
      ctx.setLineDash(stroke.dash ?? []);
      ctx.stroke(new Path2D(stroke.path));
      ctx.restore();
    });

    ctx.restore();
    return;
  }

  if (isShadowBorderStyle(borderStyle)) {
    const lineWidth = Math.max(1.1, safeBorderWidth * 0.3);
    const shadowStrokeInset = lineWidth / 2;
    const thinStrokeWidth = Math.max(1, safeBorderWidth * 0.2);
    const thinStrokeInset = thinStrokeWidth / 2;

    ctx.save();
    ctx.strokeStyle = toRgba(color, 0.22);
    ctx.lineWidth = thinStrokeWidth;
    ctx.strokeRect(
      rect.x + thinStrokeInset,
      rect.y + thinStrokeInset,
      rect.width - thinStrokeInset * 2,
      rect.height - thinStrokeInset * 2,
    );
    ctx.restore();

    // Match CSS getBorderShadowCss: blur max(16, bw*4.6), offsetY max(8, bw*1.7)
    ctx.shadowColor = toRgba(color, 0.35);
    ctx.shadowBlur = Math.max(16, safeBorderWidth * 4.6);
    ctx.shadowOffsetY = Math.max(8, safeBorderWidth * 1.7);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = toRgba(color, 0.58);
    ctx.strokeRect(
      rect.x + shadowStrokeInset,
      rect.y + shadowStrokeInset,
      rect.width - shadowStrokeInset * 2,
      rect.height - shadowStrokeInset * 2,
    );
    ctx.restore();
    return;
  }

  if (isGradientBorderStyle(borderStyle)) {
    // Match CSS linear-gradient(132deg): angle measured clockwise from top
    const angleRad = (132 * Math.PI) / 180;
    const dx = Math.sin(angleRad);
    const dy = -Math.cos(angleRad);
    const halfLen = (rect.width * Math.abs(dx) + rect.height * Math.abs(dy)) / 2;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const gradient = ctx.createLinearGradient(cx - dx * halfLen, cy - dy * halfLen, cx + dx * halfLen, cy + dy * halfLen);
    const [startColor, midColor, endColor] = getBorderGradientStops(color);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(0.48, midColor);
    gradient.addColorStop(1, endColor);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = safeBorderWidth;
    ctx.strokeRect(
      rect.x + safeBorderWidth / 2,
      rect.y + safeBorderWidth / 2,
      rect.width - safeBorderWidth,
      rect.height - safeBorderWidth,
    );
    ctx.restore();
    return;
  }

  if (borderStyle === 'dashed') {
    ctx.lineWidth = safeBorderWidth;
    ctx.setLineDash([safeBorderWidth * 4, safeBorderWidth * 3]);
    ctx.strokeRect(
      rect.x + safeBorderWidth / 2,
      rect.y + safeBorderWidth / 2,
      rect.width - safeBorderWidth,
      rect.height - safeBorderWidth,
    );
    ctx.restore();
    return;
  }

  if (borderStyle === 'double') {
    const { lineWidth: doubleLineWidth, innerInset } = getDoubleBorderMetrics(safeBorderWidth);

    ctx.lineWidth = doubleLineWidth;
    ctx.strokeRect(
      rect.x + doubleLineWidth / 2,
      rect.y + doubleLineWidth / 2,
      rect.width - doubleLineWidth,
      rect.height - doubleLineWidth,
    );
    ctx.strokeRect(
      rect.x + innerInset,
      rect.y + innerInset,
      rect.width - innerInset * 2,
      rect.height - innerInset * 2,
    );
    ctx.restore();
    return;
  }

  ctx.lineWidth = safeBorderWidth;
  ctx.strokeRect(
    rect.x + safeBorderWidth / 2,
    rect.y + safeBorderWidth / 2,
    rect.width - safeBorderWidth,
    rect.height - safeBorderWidth,
  );
  ctx.restore();
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  const characters = Array.from(text || ' ');

  if (characters.length === 0) {
    return 0;
  }

  return characters.reduce((width, character, index) => {
    const nextWidth = width + ctx.measureText(character).width;
    return index === characters.length - 1 ? nextWidth : nextWidth + letterSpacing;
  }, 0);
}

function drawHorizontalLine(ctx: CanvasRenderingContext2D, text: string, startX: number, startY: number, letterSpacing: number) {
  if (letterSpacing <= 0) {
    ctx.fillText(text || ' ', startX, startY);
    return;
  }

  let currentX = startX;
  Array.from(text || ' ').forEach((character) => {
    ctx.fillText(character, currentX, startY);
    currentX += ctx.measureText(character).width + letterSpacing;
  });
}

function drawTextLayout(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof createTextLayout>,
  letterSpacing: number,
  offsetX: number,
  offsetY: number,
) {
  layout.items.forEach((item) => {
    if (item.kind === 'horizontal-line') {
      drawHorizontalLine(ctx, item.text, offsetX + item.x, offsetY + item.y, letterSpacing);
      return;
    }

    if (item.sideways) {
      ctx.save();
      ctx.translate(offsetX + item.x, offsetY + item.y);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      drawHorizontalLine(ctx, item.text, item.startX, item.baselineY, letterSpacing);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      return;
    }

    ctx.fillText(item.text, offsetX + item.x, offsetY + item.y);
  });
}

function applyStampWeathering(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  const weathering = 0.5;
  const half = size / 2;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';

  // Surface noise
  const noiseCount = weathering * 2000;
  for (let i = 0; i < noiseCount; i++) {
    ctx.beginPath();
    ctx.arc(
      (rand() - 0.5) * size,
      (rand() - 0.5) * size,
      rand() * 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Edge wear
  const edgeWearCount = weathering * 400;
  const depth = size * 0.06;
  for (let i = 0; i < edgeWearCount; i++) {
    const edge = Math.floor(rand() * 4);
    let x: number, y: number;
    if (edge === 0) { x = (rand() - 0.5) * size; y = -half + rand() * depth; }
    else if (edge === 1) { x = (rand() - 0.5) * size; y = half - rand() * depth; }
    else if (edge === 2) { x = -half + rand() * depth; y = (rand() - 0.5) * size; }
    else { x = half - rand() * depth; y = (rand() - 0.5) * size; }
    ctx.beginPath();
    ctx.arc(x, y, rand() * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Large chunks
  const chunkCount = weathering * 10;
  for (let i = 0; i < chunkCount; i++) {
    const edge = Math.floor(rand() * 4);
    let x: number, y: number;
    if (edge === 0) { x = (rand() - 0.5) * size; y = -half; }
    else if (edge === 1) { x = (rand() - 0.5) * size; y = half; }
    else if (edge === 2) { x = -half; y = (rand() - 0.5) * size; }
    else { x = half; y = (rand() - 0.5) * size; }
    ctx.beginPath();
    ctx.arc(x, y, rand() * size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStructuredPoem(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { typography } = scene;
  const poemLayout = createStructuredPoemLayout(
    {
      poem: typography.poem,
      poemStyle: typography.poemStyle,
      placeholder: ' ',
      writingMode: typography.writingMode,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      lineHeight: typography.lineHeight,
      letterSpacing: typography.letterSpacing,
      textAlign: typography.textAlign,
      columns: typography.columns,
      columnGap: typography.columnGap,
      wrapWidth: typography.poemPosition.boxWidth !== undefined
        ? Math.max(1, (frameRect.width * typography.poemPosition.boxWidth) / 100)
        : typography.writingMode === 'horizontal-tb'
          ? frameRect.width
          : undefined,
      measurerFactory: (fontFamily, size) => createCanvasTextMeasurer(fontFamily, size, ctx),
    },
  );
  const startX = typography.poemPosition.exportLeft !== undefined
    ? frameRect.x + (frameRect.width * typography.poemPosition.exportLeft) / 100
    : frameRect.x + (frameRect.width * typography.poemPosition.positionX) / 100 - poemLayout.width / 2;
  const startY = typography.poemPosition.exportTop !== undefined
    ? frameRect.y + (frameRect.height * typography.poemPosition.exportTop) / 100
    : frameRect.y + (frameRect.height * typography.poemPosition.positionY) / 100 - poemLayout.height / 2;

  ctx.save();
  applyTextShadow(ctx, typography);
  poemLayout.sections.forEach((section) => {
    ctx.save();
    ctx.globalAlpha = section.opacity;
    ctx.fillStyle = typography.textColor;
    ctx.font = `${section.fontSize}px ${typography.fontFamily}`;
    ctx.textAlign = section.layout.writingMode === 'vertical-rl' ? 'center' : 'left';
    ctx.textBaseline = section.layout.writingMode === 'vertical-rl' ? 'middle' : 'top';
    drawTextLayout(ctx, section.layout, section.letterSpacing, startX + section.x, startY + section.y);
    ctx.restore();
  });
  ctx.restore();
}

function drawPoem(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  drawStructuredPoem(ctx, scene, frameRect);
}

function drawCustomText(ctx: CanvasRenderingContext2D, customText: CustomText, scene: CanvasExportScene, frameRect: Rect) {
  const lineHeight = scene.typography.lineHeight;
  const letterSpacing = scene.typography.letterSpacing;
  const translateX = frameRect.x + (frameRect.width * customText.positionX) / 100;
  const translateY = frameRect.y + (frameRect.height * customText.positionY) / 100;
  const layout = createTextLayout(
    {
      text: customText.text || ' ',
      writingMode: customText.writingMode,
      fontSize: customText.fontSize,
      lineHeight,
      letterSpacing,
      columns: 1,
      columnGap: 0,
      textAlign: 'left',
      wrapWidth: customText.boxWidth !== undefined
        ? Math.max(1, (frameRect.width * customText.boxWidth) / 100)
        : undefined,
    },
    createCanvasTextMeasurer(scene.typography.fontFamily, customText.fontSize, ctx),
  );

  ctx.save();
  ctx.translate(translateX, translateY);
  ctx.rotate((customText.rotation * Math.PI) / 180);
  ctx.fillStyle = customText.color;
  ctx.font = `${customText.fontSize}px ${scene.typography.fontFamily}`;
  applyTextShadow(ctx, scene.typography);
  ctx.textAlign = layout.writingMode === 'vertical-rl' ? 'center' : 'left';
  ctx.textBaseline = layout.writingMode === 'vertical-rl' ? 'middle' : 'top';
  drawTextLayout(ctx, layout, letterSpacing, -layout.width / 2, -layout.height / 2);
  ctx.restore();
}

async function drawLogo(ctx: CanvasRenderingContext2D, logo: LogoConfig, frameRect: Rect) {
  const centerX = frameRect.x + (frameRect.width * logo.positionX) / 100;
  const centerY = frameRect.y + (frameRect.height * logo.positionY) / 100;
  const image = await loadImage(logo.imageUrl);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((logo.rotation * Math.PI) / 180);
  ctx.globalAlpha = logo.opacity;
  ctx.drawImage(image, -logo.size / 2, -logo.size / 2, logo.size, logo.size);
  ctx.restore();
}

function drawStampShape(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const half = stamp.size / 2;

  ctx.beginPath();

  if (stamp.style === 'round') {
    ctx.arc(0, 0, half, 0, Math.PI * 2);
  } else {
    ctx.roundRect(-half, -half, stamp.size, stamp.size, getStampCanvasRadii(stamp.style, stamp.size));
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

  if (isFilled) {
    drawStampShape(ctx, stamp);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
  } else {
    ctx.fillStyle = STAMP_INK_COLOR;
  }

  characters.forEach((character, index) => {
    const { x, y } = placements[index] ?? placements[placements.length - 1];
    ctx.fillText(character, x, y);
  });

  ctx.restore();
}

function drawStampBody(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const isFilled = stamp.colorScheme !== 'outline';
  const half = stamp.size / 2;
  const borderWidth = getStampBorderWidth(stamp.size);
  const chars = getStampCharacters(stamp.text);

  if (isFilled) {
    // Baiwen (白文): solid red fill, text carved out
    drawStampShape(ctx, stamp);
    ctx.fillStyle = STAMP_INK_COLOR;
    ctx.fill();
  } else {
    // Zhuwen (朱文): red border, transparent fill, red text
    ctx.save();
    drawStampShape(ctx, stamp);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = STAMP_INK_COLOR;
    ctx.stroke();

    // Grid dividers: vertical for 2+ chars, horizontal for 3+ chars
    if (chars.length > 1) {
      ctx.save();
      drawStampShape(ctx, stamp);
      ctx.clip();
      ctx.lineWidth = borderWidth / 2;
      ctx.strokeStyle = STAMP_INK_COLOR;
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
  applyStampWeathering(ctx, stamp.size, createStampWeatheringRand(stamp));
}

function drawStamp(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { stamp } = scene.decorations;
  const centerX = frameRect.x + (frameRect.width * stamp.positionX) / 100;
  const centerY = frameRect.y + (frameRect.height * stamp.positionY) / 100;
  const { skewXDeg, skewYDeg } = getBrushStampSkew();
  const brushSkewX = Math.tan((skewXDeg * Math.PI) / 180);
  const brushSkewY = Math.tan((skewYDeg * Math.PI) / 180);
  const half = stamp.size / 2;

  // Render stamp to offscreen canvas so destination-out text carving
  // does not punch through the background already drawn on the main canvas.
  const offCanvas = document.createElement('canvas');
  offCanvas.width = stamp.size;
  offCanvas.height = stamp.size;
  const offCtx = offCanvas.getContext('2d');
  if (!offCtx) return;

  offCtx.translate(half, half);
  drawStampBody(offCtx, stamp);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((stamp.rotation * Math.PI) / 180);
  if (stamp.style === 'brush') {
    ctx.transform(1, brushSkewY, brushSkewX, 1, 0, 0);
  }
  ctx.globalAlpha = stamp.opacity;
  ctx.drawImage(offCanvas, -half, -half);
  ctx.restore();
}

/**
 * Draws the stamp body centred at (0, 0) on the given context.
 * The caller must translate to the stamp centre before calling this.
 * Intended for the live preview canvas in StampOverlay.
 */
export function renderStampBodyToContext(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  drawStampBody(ctx, stamp);
}

export function getCanvasContentRect(scene: CanvasExportScene): Rect {
  return {
    x: scene.typography.padding,
    y: scene.typography.padding,
    width: scene.canvasWidth - scene.typography.padding * 2,
    height: scene.canvasHeight - scene.typography.padding * 2,
  };
}

function getOrderedDecorationLayers(scene: CanvasExportScene) {
  const layers: DecorationLayer[] = [
    ...scene.decorations.customTexts.map((item, index) => ({
      kind: 'customText' as const,
      item,
      zIndex: item.zIndex ?? index,
      order: index,
    })),
    ...scene.decorations.logos.map((item, index) => ({
      kind: 'logo' as const,
      item,
      zIndex: item.zIndex ?? scene.decorations.customTexts.length + index,
      order: scene.decorations.customTexts.length + index,
    })),
  ];

  return layers.sort((left, right) => (left.zIndex - right.zIndex) || (left.order - right.order));
}

export async function renderCanvasExport(scene: CanvasExportScene, options: RenderCanvasExportOptions = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = scene.canvasWidth * scene.exportScale;
  canvas.height = scene.canvasHeight * scene.exportScale;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create export canvas');
  }

  if ('fonts' in document) {
    await document.fonts.ready;
  }

  ctx.scale(scene.exportScale, scene.exportScale);
  await drawBackground(ctx, scene);

  const contentRect = getCanvasContentRect(scene);
  const positioningRect = getCanvasPositioningRect(
    contentRect,
    scene.decorations.showBorder,
    scene.decorations.borderStyle,
    scene.decorations.borderWidth,
  );

  if (scene.decorations.showBorder) {
    drawBorder(
      ctx,
      contentRect,
      scene.decorations.borderStyle,
      scene.decorations.borderColor,
      scene.decorations.borderWidth,
    );
  }

  if (!options.skipPoem) {
    drawPoem(ctx, scene, positioningRect);
  }

  if (scene.decorations.showStamp) {
    drawStamp(ctx, scene, positioningRect);
  }

  for (const layer of getOrderedDecorationLayers(scene)) {
    if (layer.kind === 'customText') {
      drawCustomText(ctx, layer.item, scene, positioningRect);
      continue;
    }

    await drawLogo(ctx, layer.item, positioningRect);
  }

  return canvas;
}

export async function renderCanvasExportBlob(scene: CanvasExportScene) {
  const canvas = await renderCanvasExport(scene);
  return toBlob(canvas);
}
