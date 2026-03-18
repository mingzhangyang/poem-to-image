import { createOrganicBorderStrokes } from '../borderUtils';
import type { BorderStyle, CustomText, ExportScale, PositionedElement, StampConfig, TextAlign, WritingMode } from '../types';

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
  text: string;
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

  if (borderStyle === 'brush' || borderStyle === 'ink') {
    const strokes = createOrganicBorderStrokes(rect.width, rect.height, safeBorderWidth, borderStyle);

    ctx.translate(rect.x, rect.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach((stroke) => {
      ctx.save();
      ctx.globalAlpha = stroke.opacity;
      ctx.lineWidth = stroke.width;
      ctx.stroke(new Path2D(stroke.path));
      ctx.restore();
    });

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
    const doubleLineWidth = Math.max(1.25, safeBorderWidth / 3);
    const innerInset = safeBorderWidth - doubleLineWidth / 2;

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

function splitLines(text: string) {
  return text.split('\n').map((line) => line.trimEnd());
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

function isHorizontalRunGlyph(text: string) {
  return /[\p{Script=Latin}\p{Number}\s.,!?;:'"()\[\]{}\-–—/&]/u.test(text);
}

interface VerticalLineSegment {
  text: string;
  sideways: boolean;
}

interface VerticalLineLayout {
  segments: VerticalLineSegment[];
  height: number;
}

function measureSidewaysRunExtent(ctx: CanvasRenderingContext2D, text: string, fontSize: number, letterSpacing: number) {
  return Math.max(fontSize, measureTextWidth(ctx, text, letterSpacing));
}

function getVerticalSegmentAdvance(
  ctx: CanvasRenderingContext2D,
  segment: VerticalLineSegment,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
) {
  if (segment.sideways) {
    return measureSidewaysRunExtent(ctx, segment.text, fontSize, letterSpacing);
  }

  return fontSize * lineHeight;
}

function splitVerticalLineSegments(line: string) {
  const characters = Array.from(line || ' ');
  const segments: VerticalLineSegment[] = [];
  let sidewaysBuffer = '';

  const flushSidewaysBuffer = () => {
    const text = sidewaysBuffer.trim();

    if (text) {
      segments.push({ text, sideways: true });
    }

    sidewaysBuffer = '';
  };

  characters.forEach((character) => {
    if (isHorizontalRunGlyph(character)) {
      sidewaysBuffer += character;
      return;
    }

    flushSidewaysBuffer();
    segments.push({ text: character, sideways: false });
  });

  flushSidewaysBuffer();

  if (segments.length === 0) {
    segments.push({ text: ' ', sideways: false });
  }

  return segments;
}

function getRotatedRunDrawOffset(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  const metrics = ctx.measureText(text);
  const measuredWidth = measureTextWidth(ctx, text, letterSpacing);
  const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
  const actualRight = metrics.actualBoundingBoxRight ?? measuredWidth;
  const actualAscent = metrics.actualBoundingBoxAscent ?? 0;
  const actualDescent = metrics.actualBoundingBoxDescent ?? 0;
  const visualWidth = Math.max(measuredWidth, actualLeft + actualRight);

  return {
    startX: -visualWidth / 2 + actualLeft,
    baselineY: (actualAscent - actualDescent) / 2,
    width: visualWidth,
    height: actualAscent + actualDescent,
  };
}

function measureVerticalLineLayout(
  ctx: CanvasRenderingContext2D,
  line: string,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
) {
  const segments = splitVerticalLineSegments(line);
  const height = segments.reduce((total, segment, index) => {
    const advance = getVerticalSegmentAdvance(ctx, segment, fontSize, lineHeight, letterSpacing);
    const spacing = index === segments.length - 1 ? 0 : letterSpacing;
    return total + advance + spacing;
  }, 0);

  return {
    segments,
    height: Math.max(fontSize, height),
  };
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

function createStampFill(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const half = stamp.size / 2;

  if (stamp.style === 'round') {
    const gradient = ctx.createRadialGradient(-half * 0.22, -half * 0.2, half * 0.12, 0, 0, half);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
    gradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(0.68, 'rgba(185, 28, 28, 0.14)');
    gradient.addColorStop(1, 'rgba(254, 242, 242, 0.16)');
    return gradient;
  }

  const gradient = ctx.createLinearGradient(-half, -half, half, half);

  if (stamp.style === 'brush') {
    gradient.addColorStop(0, 'rgba(185, 28, 28, 0.18)');
    gradient.addColorStop(1, 'rgba(153, 27, 27, 0.28)');
    return gradient;
  }

  gradient.addColorStop(0, 'rgba(185, 28, 28, 0.1)');
  gradient.addColorStop(1, 'rgba(153, 27, 27, 0.22)');
  return gradient;
}

function drawStampSurfaceDetails(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const half = stamp.size / 2;

  ctx.save();
  drawStampShape(ctx, stamp);
  ctx.clip();

  ctx.fillStyle = createStampFill(ctx, stamp);
  ctx.fillRect(-half, -half, stamp.size, stamp.size);

  const highlight = ctx.createRadialGradient(-half * 0.38, -half * 0.4, half * 0.06, -half * 0.38, -half * 0.4, half * 0.9);
  highlight.addColorStop(0, stamp.style === 'brush' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.52)');
  highlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.16)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(-half, -half, stamp.size, stamp.size);

  const innerGlow = ctx.createRadialGradient(0, -half * 0.1, half * 0.06, 0, -half * 0.1, half * 0.78);
  innerGlow.addColorStop(0, 'rgba(220, 38, 38, 0.14)');
  innerGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
  ctx.fillStyle = innerGlow;
  ctx.fillRect(-half, -half, stamp.size, stamp.size);

  ctx.restore();
}

function drawStampInnerBorder(ctx: CanvasRenderingContext2D, stamp: StampConfig, inset: number, strokeStyle: string, lineWidth: number) {
  const innerStamp = {
    ...stamp,
    size: Math.max(1, stamp.size - inset * 2),
  };

  if (innerStamp.size <= 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  drawStampShape(ctx, innerStamp);
  ctx.stroke();
  ctx.restore();
}

function wrapHorizontalParagraph(ctx: CanvasRenderingContext2D, paragraph: string, maxWidth: number, letterSpacing: number) {
  if (!paragraph) {
    return [''];
  }

  const wrappedLines: string[] = [];
  let currentLine = '';

  Array.from(paragraph).forEach((character) => {
    const candidate = `${currentLine}${character}`;

    if (currentLine && measureTextWidth(ctx, candidate, letterSpacing) > maxWidth) {
      wrappedLines.push(currentLine);
      currentLine = character.trim() ? character : '';
      return;
    }

    currentLine = candidate;
  });

  if (currentLine || wrappedLines.length === 0) {
    wrappedLines.push(currentLine);
  }

  return wrappedLines;
}

function distributeEvenly<T>(items: T[], groups: number) {
  const actualGroups = Math.max(1, groups);
  const baseSize = Math.floor(items.length / actualGroups);
  const remainder = items.length % actualGroups;
  let offset = 0;

  return Array.from({ length: actualGroups }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0);
    const chunk = items.slice(offset, offset + size);
    offset += size;
    return chunk;
  });
}

function measureHorizontalColumns(
  ctx: CanvasRenderingContext2D,
  typography: CanvasExportTypography,
  frameRect: Rect,
  fontSize: number,
  lineHeight: number,
) {
  const actualColumns = Math.max(1, typography.columns);
  const columnGap = typography.columnGap;
  const availableWidth = typography.poemPosition.boxWidth !== undefined
    ? (frameRect.width * typography.poemPosition.boxWidth) / 100
    : frameRect.width;
  const targetColumnWidth = Math.max(1, (availableWidth - Math.max(0, actualColumns - 1) * columnGap) / actualColumns);
  const paragraphs = splitLines(typography.text || ' ');
  const wrappedLines = paragraphs.flatMap((paragraph, index) => {
    const nextLines = wrapHorizontalParagraph(ctx, paragraph, targetColumnWidth, typography.letterSpacing);
    return index === paragraphs.length - 1 ? nextLines : [...nextLines, ''];
  });
  const columnsData = distributeEvenly(wrappedLines, actualColumns);
  const lineAdvance = fontSize * lineHeight;
  const columnWidths = columnsData.map((columnLines) => Math.max(0, ...columnLines.map((line) => measureTextWidth(ctx, line || ' ', typography.letterSpacing))));
  const columnHeights = columnsData.map((columnLines) => Math.max(lineAdvance, columnLines.length * lineAdvance));
  const width = columnWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, actualColumns - 1) * columnGap;
  const height = Math.max(...columnHeights, lineAdvance);

  return { columnsData, columnWidths, lineAdvance, width, height };
}

function drawHorizontalText(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { typography } = scene;

  ctx.save();
  ctx.fillStyle = typography.textColor;
  ctx.font = `${typography.fontSize}px ${typography.fontFamily}`;
  ctx.textBaseline = 'top';
  applyTextShadow(ctx, typography);

  const { columnsData, columnWidths, lineAdvance, width, height } = measureHorizontalColumns(
    ctx,
    typography,
    frameRect,
    typography.fontSize,
    typography.lineHeight,
  );

  let currentX = typography.poemPosition.exportLeft !== undefined
    ? frameRect.x + (frameRect.width * typography.poemPosition.exportLeft) / 100
    : frameRect.x + (frameRect.width * typography.poemPosition.positionX) / 100 - width / 2;
  const startY = typography.poemPosition.exportTop !== undefined
    ? frameRect.y + (frameRect.height * typography.poemPosition.exportTop) / 100
    : frameRect.y + (frameRect.height * typography.poemPosition.positionY) / 100 - height / 2;

  columnsData.forEach((columnLines, columnIndex) => {
    const columnWidth = columnWidths[columnIndex];

    columnLines.forEach((line, lineIndex) => {
      let textX = currentX;
      const lineWidth = measureTextWidth(ctx, line || ' ', typography.letterSpacing);

      if (typography.textAlign === 'center') {
        textX += (columnWidth - lineWidth) / 2;
      } else if (typography.textAlign === 'right') {
        textX += columnWidth - lineWidth;
      }

      drawHorizontalLine(ctx, line, textX, startY + lineIndex * lineAdvance, typography.letterSpacing);
    });

    currentX += columnWidth + typography.columnGap;
  });

  ctx.restore();
}

function normalizeVerticalLines(text: string, columns: number) {
  const sourceLines = splitLines(text || ' ');

  if (Math.max(1, columns) === 1 || sourceLines.length > 1) {
    return sourceLines;
  }

  return distributeEvenly(Array.from(sourceLines[0] || ' '), Math.max(1, columns)).map((characters) => characters.join(''));
}

function measureVerticalBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  fontSize: number,
  lineHeight: number,
  columnGap: number,
  letterSpacing: number,
) {
  const lineLayouts = lines.map((line) => measureVerticalLineLayout(ctx, line, fontSize, lineHeight, letterSpacing));
  const blockWidth = Math.max(1, lines.length) * fontSize + Math.max(0, lines.length - 1) * columnGap;
  const blockHeight = Math.max(fontSize, ...lineLayouts.map((layout) => layout.height));
  return { lineLayouts, blockWidth, blockHeight };
}

function drawVerticalTextBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  startX: number,
  startY: number,
  fontSize: number,
  lineHeight: number,
  columnGap: number,
  letterSpacing: number,
) {
  const { lineLayouts, blockWidth } = measureVerticalBlock(ctx, lines, fontSize, lineHeight, columnGap, letterSpacing);
  const lineOriginX = startX + blockWidth - fontSize / 2;
  const blockTop = startY;

  lines.forEach((line, lineIndex) => {
    const columnX = lineOriginX - lineIndex * (fontSize + columnGap);
    const layout = lineLayouts[lineIndex];
    let cursorY = blockTop;

    layout.segments.forEach((segment, segmentIndex) => {
      const advance = getVerticalSegmentAdvance(ctx, segment, fontSize, lineHeight, letterSpacing);

      if (segment.sideways) {
        const { startX: runStartX, baselineY } = getRotatedRunDrawOffset(ctx, segment.text, letterSpacing);

        ctx.save();
        ctx.translate(columnX, cursorY + advance / 2);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        drawHorizontalLine(ctx, segment.text, runStartX, baselineY, letterSpacing);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        cursorY += advance + (segmentIndex === layout.segments.length - 1 ? 0 : letterSpacing);
        return;
      }

      ctx.fillText(segment.text, columnX, cursorY + advance / 2);
      cursorY += advance + (segmentIndex === layout.segments.length - 1 ? 0 : letterSpacing);
    });
  });
}

function measureVerticalColumns(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  fontSize: number,
  lineHeight: number,
  columnGap: number,
  columns: number,
  letterSpacing: number,
) {
  const actualColumns = Math.max(1, columns);
  const columnGroups = distributeEvenly(lines, actualColumns).filter((group) => group.length > 0);
  const groupMeasurements = columnGroups.map((group) => measureVerticalBlock(ctx, group, fontSize, lineHeight, columnGap, letterSpacing));
  const width = groupMeasurements.reduce((sum, measurement) => sum + measurement.blockWidth, 0) + Math.max(0, groupMeasurements.length - 1) * columnGap;
  const height = Math.max(fontSize, ...groupMeasurements.map((measurement) => measurement.blockHeight));

  return { columnGroups, groupMeasurements, width, height };
}

function drawVerticalText(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { typography } = scene;
  const lines = normalizeVerticalLines(typography.text || ' ', typography.columns);
  const { columnGroups, groupMeasurements, width, height } = measureVerticalColumns(
    ctx,
    lines,
    typography.fontSize,
    typography.lineHeight,
    typography.columnGap,
    typography.columns,
    typography.letterSpacing,
  );
  const startX = typography.poemPosition.exportLeft !== undefined
    ? frameRect.x + (frameRect.width * typography.poemPosition.exportLeft) / 100
    : frameRect.x + (frameRect.width * typography.poemPosition.positionX) / 100 - width / 2;
  const startY = typography.poemPosition.exportTop !== undefined
    ? frameRect.y + (frameRect.height * typography.poemPosition.exportTop) / 100
    : frameRect.y + (frameRect.height * typography.poemPosition.positionY) / 100 - height / 2;

  ctx.save();
  ctx.fillStyle = typography.textColor;
  ctx.font = `${typography.fontSize}px ${typography.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  applyTextShadow(ctx, typography);

  let currentX = startX;
  columnGroups.forEach((group, index) => {
    drawVerticalTextBlock(ctx, group, currentX, startY, typography.fontSize, typography.lineHeight, typography.columnGap, typography.letterSpacing);
    currentX += groupMeasurements[index].blockWidth + typography.columnGap;
  });

  ctx.restore();
}

function drawPoem(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  if (scene.typography.writingMode === 'vertical-rl') {
    drawVerticalText(ctx, scene, frameRect);
    return;
  }

  drawHorizontalText(ctx, scene, frameRect);
}

function drawCustomText(ctx: CanvasRenderingContext2D, customText: CustomText, scene: CanvasExportScene, frameRect: Rect) {
  const lineHeight = scene.typography.lineHeight;
  const letterSpacing = scene.typography.letterSpacing;
  const translateX = customText.exportLeft !== undefined
    ? frameRect.x + (frameRect.width * customText.exportLeft) / 100
    : frameRect.x + (frameRect.width * customText.positionX) / 100;
  const translateY = customText.exportTop !== undefined
    ? frameRect.y + (frameRect.height * customText.exportTop) / 100
    : frameRect.y + (frameRect.height * customText.positionY) / 100;

  ctx.save();
  ctx.translate(translateX, translateY);
  ctx.rotate((customText.rotation * Math.PI) / 180);
  ctx.fillStyle = customText.color;
  ctx.font = `${customText.fontSize}px ${scene.typography.fontFamily}`;
  applyTextShadow(ctx, scene.typography);

  if (customText.writingMode === 'vertical-rl') {
    const lines = splitLines(customText.text || ' ');
    const { blockWidth, blockHeight } = measureVerticalBlock(
      ctx,
      lines,
      customText.fontSize,
      lineHeight,
      scene.typography.columnGap,
      letterSpacing,
    );
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawVerticalTextBlock(ctx, lines, -blockWidth / 2, -blockHeight / 2, customText.fontSize, lineHeight, scene.typography.columnGap, letterSpacing);
    ctx.restore();
    return;
  }

  const lines = splitLines(customText.text || ' ');
  const lineAdvance = customText.fontSize * lineHeight;
  const maxLineWidth = Math.max(0, ...lines.map((line) => measureTextWidth(ctx, line || ' ', letterSpacing)));
  const blockHeight = Math.max(lineAdvance, lines.length * lineAdvance);
  const blockTop = -blockHeight / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, lineIndex) => {
    const lineWidth = measureTextWidth(ctx, line || ' ', letterSpacing);
    drawHorizontalLine(
      ctx,
      line || ' ',
      -maxLineWidth / 2 + (maxLineWidth - lineWidth) / 2,
      blockTop + lineIndex * lineAdvance,
      letterSpacing,
    );
  });
  ctx.restore();
}

function drawStampShape(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const half = stamp.size / 2;

  ctx.beginPath();

  if (stamp.style === 'round') {
    ctx.arc(0, 0, half, 0, Math.PI * 2);
  } else if (stamp.style === 'brush') {
    ctx.roundRect(-half, -half, stamp.size, stamp.size, [stamp.size * 0.28, stamp.size * 0.2, stamp.size * 0.26, stamp.size * 0.18]);
  } else {
    ctx.roundRect(-half, -half, stamp.size, stamp.size, stamp.size * 0.18);
  }

  ctx.closePath();
}

function drawStampText(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const characters = Array.from(stamp.text || '印').slice(0, 4);
  const fontSize = Math.max(18, stamp.size * (characters.length > 2 ? 0.23 : 0.28));
  const letterSpacing = Math.max(0, stamp.size * 0.01);
  const offsets = characters.length <= 1
    ? [{ x: 0, y: 0 }]
    : characters.length === 2
      ? [{ x: 0, y: -fontSize * 0.6 }, { x: 0, y: fontSize * 0.6 }]
      : [
          { x: -fontSize * 0.55, y: -fontSize * 0.55 },
          { x: fontSize * 0.55, y: -fontSize * 0.55 },
          { x: -fontSize * 0.55, y: fontSize * 0.55 },
          { x: fontSize * 0.55, y: fontSize * 0.55 },
        ];

  ctx.save();
  ctx.fillStyle = stamp.colorScheme === 'filled' ? '#ffffff' : '#b91c1c';
  ctx.font = `700 ${fontSize}px ${stamp.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = stamp.colorScheme === 'filled' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(127, 29, 29, 0.28)';
  ctx.shadowBlur = 2;
  characters.forEach((character, index) => {
    const offset = offsets[index] ?? { x: 0, y: 0 };
    drawHorizontalLine(ctx, character, offset.x - measureTextWidth(ctx, character, letterSpacing) / 2, offset.y - fontSize / 2, letterSpacing);
  });
  ctx.restore();
}

function drawStampFilled(ctx: CanvasRenderingContext2D, stamp: StampConfig) {
  const half = stamp.size / 2;

  ctx.save();
  drawStampShape(ctx, stamp);
  ctx.clip();
  ctx.fillStyle = 'rgb(185, 28, 28)';
  ctx.fillRect(-half, -half, stamp.size, stamp.size);
  ctx.restore();
}

function drawStamp(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { stamp } = scene.decorations;
  const isFilled = stamp.colorScheme === 'filled';
  const centerX = frameRect.x + (frameRect.width * stamp.positionX) / 100;
  const centerY = frameRect.y + (frameRect.height * stamp.positionY) / 100;
  const borderWidth = Math.max(3, Math.round(stamp.size * 0.06));
  const brushSkewX = Math.tan((-2 * Math.PI) / 180);
  const brushSkewY = Math.tan((1 * Math.PI) / 180);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((stamp.rotation * Math.PI) / 180);
  if (stamp.style === 'brush') {
    ctx.transform(1, brushSkewY, brushSkewX, 1, 0, 0);
  }
  ctx.globalAlpha = stamp.opacity;

  ctx.save();
  ctx.shadowColor = isFilled ? 'rgba(127, 29, 29, 0.3)' : 'rgba(127, 29, 29, 0.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  drawStampShape(ctx, stamp);
  ctx.fillStyle = isFilled ? 'rgba(185, 28, 28, 0.5)' : (stamp.style === 'brush' ? 'rgba(254, 242, 242, 0.1)' : 'rgba(254, 242, 242, 0.16)');
  ctx.fill();
  ctx.restore();

  if (isFilled) {
    drawStampFilled(ctx, stamp);
  } else {
    drawStampShape(ctx, stamp);
    ctx.fillStyle = stamp.style === 'brush' ? 'rgba(254, 242, 242, 0.1)' : 'rgba(254, 242, 242, 0.12)';
    ctx.fill();
    drawStampSurfaceDetails(ctx, stamp);
  }

  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = 'rgba(185, 28, 28, 0.92)';
  drawStampShape(ctx, stamp);
  ctx.stroke();

  // 移除内层边框效果，提升简洁性

  drawStampText(ctx, stamp);
  ctx.restore();
}

export function getCanvasContentRect(scene: CanvasExportScene): Rect {
  return {
    x: scene.typography.padding,
    y: scene.typography.padding,
    width: scene.canvasWidth - scene.typography.padding * 2,
    height: scene.canvasHeight - scene.typography.padding * 2,
  };
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
    drawPoem(ctx, scene, contentRect);
  }

  scene.decorations.customTexts.forEach((customText) => drawCustomText(ctx, customText, scene, contentRect));

  if (scene.decorations.showStamp) {
    drawStamp(ctx, scene, contentRect);
  }

  return canvas;
}

export async function renderCanvasExportBlob(scene: CanvasExportScene) {
  const canvas = await renderCanvasExport(scene);
  return toBlob(canvas);
}