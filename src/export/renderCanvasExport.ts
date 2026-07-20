import { createStructuredPoemLayout } from '../poemContent';
import { getCanvasPositioningRect } from '../positioningRect';
import { createCanvasTextMeasurer, createTextLayout } from '../textLayout';
import { drawSignatureToCanvas, ensureSignatureFontsLoaded, getSignatureCanvasSize } from '../signatureRendering';
import type {
  BorderStyle,
  CustomText,
  ExportScale,
  LogoConfig,
  PoemContentData,
  PoemLayerStyle,
  PositionedElement,
  SignatureConfig,
  StampConfig,
  TextAlign,
  WritingMode,
} from '../types';
import { drawBackground, loadImage } from './background';
import { drawBorder } from './border';
import { drawStamp, drawStampBody } from './stampDraw';

export interface CanvasExportBackground {
  backgroundType: 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  backgroundSize: 'cover' | 'contain' | 'stretch';
  backgroundPosition?: string;
  bgBrightness: number;
  bgBlur: number;
}

export interface CanvasExportTypography {
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

export interface CanvasExportDecorations {
  showBorder: boolean;
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  stamp: StampConfig;
  customTexts: CustomText[];
  logos: LogoConfig[];
  signatures: SignatureConfig[];
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

function normalizePositiveNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getSafePadding(width: number, height: number, padding: number) {
  const maxPadding = Math.max(0, Math.min(width, height) / 2 - 1);
  if (!Number.isFinite(padding)) return 0;
  return Math.min(Math.max(0, padding), maxPadding);
}

function normalizeExportScene(scene: CanvasExportScene): CanvasExportScene {
  const canvasWidth = normalizePositiveNumber(scene.canvasWidth, 1);
  const canvasHeight = normalizePositiveNumber(scene.canvasHeight, 1);

  return {
    ...scene,
    canvasWidth,
    canvasHeight,
    typography: {
      ...scene.typography,
      padding: getSafePadding(canvasWidth, canvasHeight, scene.typography.padding),
    },
  };
}

// --- Text drawing helpers ---

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

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  startX: number,
  startY: number,
  letterSpacing: number,
) {
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

function drawStructuredPoem(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { typography } = scene;
  const poemLayout = createStructuredPoemLayout({
    poem: typography.poem,
    poemStyle: typography.poemStyle,
    placeholder: ' ',
    writingMode: typography.writingMode,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    columns: typography.columns,
    columnGap: typography.columnGap,
    wrapWidth:
      typography.poemPosition.boxWidth !== undefined
        ? Math.max(1, (frameRect.width * typography.poemPosition.boxWidth) / 100)
        : typography.writingMode === 'horizontal-tb'
          ? frameRect.width
          : undefined,
    measurerFactory: (fontFamily, size) => createCanvasTextMeasurer(fontFamily, size, ctx),
  });
  const startX =
    typography.poemPosition.exportLeft !== undefined
      ? frameRect.x + (frameRect.width * typography.poemPosition.exportLeft) / 100
      : frameRect.x + (frameRect.width * typography.poemPosition.positionX) / 100 - poemLayout.width / 2;
  const startY =
    typography.poemPosition.exportTop !== undefined
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

function drawCustomText(
  ctx: CanvasRenderingContext2D,
  customText: CustomText,
  scene: CanvasExportScene,
  frameRect: Rect,
) {
  const letterSpacing = scene.typography.letterSpacing;
  const translateX = frameRect.x + (frameRect.width * customText.positionX) / 100;
  const translateY = frameRect.y + (frameRect.height * customText.positionY) / 100;
  const layout = createTextLayout(
    {
      text: customText.text || ' ',
      writingMode: customText.writingMode,
      fontSize: customText.fontSize,
      lineHeight: scene.typography.lineHeight,
      letterSpacing,
      columns: 1,
      columnGap: 0,
      textAlign: 'left',
      wrapWidth:
        customText.boxWidth !== undefined
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

function drawSignatureElement(ctx: CanvasRenderingContext2D, sig: SignatureConfig, frameRect: Rect) {
  const { width: sigWidth, height: sigHeight } = getSignatureCanvasSize(sig.fontSize);
  const centerX = frameRect.x + (frameRect.width * sig.positionX) / 100;
  const centerY = frameRect.y + (frameRect.height * sig.positionY) / 100;

  const offCanvas = document.createElement('canvas');
  offCanvas.width = sigWidth;
  offCanvas.height = sigHeight;
  const offCtx = offCanvas.getContext('2d');
  if (!offCtx) return;

  drawSignatureToCanvas(offCtx, sig, sigWidth, sigHeight);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((sig.rotation * Math.PI) / 180);
  ctx.globalAlpha = sig.opacity;
  ctx.drawImage(offCanvas, -sigWidth / 2, -sigHeight / 2);
  ctx.restore();
}

// --- Exports ---

/**
 * Draws the stamp body centred at (0,0) on the given context.
 * The caller must translate to the stamp centre before calling this.
 * Intended for the live preview canvas in StampOverlay.
 */
export function renderStampBodyToContext(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  drawStampBody(ctx, stamp);
}

export function getCanvasContentRect(scene: CanvasExportScene): Rect {
  const canvasWidth = normalizePositiveNumber(scene.canvasWidth, 1);
  const canvasHeight = normalizePositiveNumber(scene.canvasHeight, 1);
  const padding = getSafePadding(canvasWidth, canvasHeight, scene.typography.padding);

  return {
    x: padding,
    y: padding,
    width: canvasWidth - padding * 2,
    height: canvasHeight - padding * 2,
  };
}

export function getOrderedDecorationLayers(scene: CanvasExportScene): DecorationLayer[] {
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
  return layers.sort((a, b) => a.zIndex - b.zIndex || a.order - b.order);
}

export async function renderCanvasExport(inputScene: CanvasExportScene, options: RenderCanvasExportOptions = {}) {
  const scene = normalizeExportScene(inputScene);
  const canvas = document.createElement('canvas');
  canvas.width = scene.canvasWidth * scene.exportScale;
  canvas.height = scene.canvasHeight * scene.exportScale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create export canvas');

  if (scene.decorations.signatures.length > 0) await ensureSignatureFontsLoaded();
  if ('fonts' in document) await document.fonts.ready;

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
    drawBorder(ctx, contentRect, scene.decorations.borderStyle, scene.decorations.borderColor, scene.decorations.borderWidth);
  }

  if (!options.skipPoem) drawStructuredPoem(ctx, scene, positioningRect);

  if (scene.decorations.showStamp) drawStamp(ctx, scene, positioningRect);

  for (const layer of getOrderedDecorationLayers(scene)) {
    if (layer.kind === 'customText') {
      drawCustomText(ctx, layer.item, scene, positioningRect);
    } else {
      await drawLogo(ctx, layer.item, positioningRect);
    }
  }

  for (const sig of scene.decorations.signatures) {
    drawSignatureElement(ctx, sig, positioningRect);
  }

  return canvas;
}

export async function renderCanvasExportBlob(scene: CanvasExportScene) {
  const canvas = await renderCanvasExport(scene);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}
