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

function drawBorder(ctx: CanvasRenderingContext2D, rect: Rect, borderStyle: BorderStyle, color: string) {
  const borderWidth = 4;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  if (borderStyle === 'dashed') {
    ctx.lineWidth = borderWidth;
    ctx.setLineDash([borderWidth * 4, borderWidth * 3]);
    ctx.strokeRect(
      rect.x + borderWidth / 2,
      rect.y + borderWidth / 2,
      rect.width - borderWidth,
      rect.height - borderWidth,
    );
    ctx.restore();
    return;
  }

  if (borderStyle === 'double') {
    const doubleLineWidth = borderWidth / 3;
    const innerInset = borderWidth - doubleLineWidth / 2;

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

  ctx.lineWidth = borderWidth;
  ctx.strokeRect(
    rect.x + borderWidth / 2,
    rect.y + borderWidth / 2,
    rect.width - borderWidth,
    rect.height - borderWidth,
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
  const targetColumnWidth = Math.max(1, (frameRect.width - Math.max(0, actualColumns - 1) * columnGap) / actualColumns);
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

function measureVerticalBlock(lines: string[], fontSize: number, lineHeight: number, columnGap: number) {
  const charAdvance = fontSize * lineHeight;
  const blockWidth = Math.max(1, lines.length) * fontSize + Math.max(0, lines.length - 1) * columnGap;
  const blockHeight = Math.max(fontSize, Math.max(...lines.map((line) => Math.max(1, Array.from(line).length)), 1) * charAdvance);
  return { charAdvance, blockWidth, blockHeight };
}

function drawVerticalTextBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  startX: number,
  startY: number,
  fontSize: number,
  lineHeight: number,
  columnGap: number,
) {
  const { charAdvance, blockWidth } = measureVerticalBlock(lines, fontSize, lineHeight, columnGap);
  const lineOriginX = startX + blockWidth - fontSize / 2;
  const lineOriginY = startY + fontSize / 2;

  lines.forEach((line, lineIndex) => {
    const columnX = lineOriginX - lineIndex * (fontSize + columnGap);
    Array.from(line || ' ').forEach((character, charIndex) => {
      ctx.fillText(character, columnX, lineOriginY + charIndex * charAdvance);
    });
  });
}

function measureVerticalColumns(lines: string[], fontSize: number, lineHeight: number, columnGap: number, columns: number) {
  const actualColumns = Math.max(1, columns);
  const columnGroups = distributeEvenly(lines, actualColumns).filter((group) => group.length > 0);
  const groupMeasurements = columnGroups.map((group) => measureVerticalBlock(group, fontSize, lineHeight, columnGap));
  const width = groupMeasurements.reduce((sum, measurement) => sum + measurement.blockWidth, 0) + Math.max(0, groupMeasurements.length - 1) * columnGap;
  const height = Math.max(fontSize, ...groupMeasurements.map((measurement) => measurement.blockHeight));

  return { columnGroups, groupMeasurements, width, height };
}

function drawVerticalText(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { typography } = scene;
  const lines = normalizeVerticalLines(typography.text || ' ', typography.columns);
  const { columnGroups, groupMeasurements, width, height } = measureVerticalColumns(
    lines,
    typography.fontSize,
    typography.lineHeight,
    typography.columnGap,
    typography.columns,
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
    drawVerticalTextBlock(ctx, group, currentX, startY, typography.fontSize, typography.lineHeight, typography.columnGap);
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

  ctx.save();
  ctx.rotate((customText.rotation * Math.PI) / 180);
  ctx.fillStyle = customText.color;
  ctx.font = `${customText.fontSize}px ${scene.typography.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  applyTextShadow(ctx, scene.typography);

  if (customText.writingMode === 'vertical-rl') {
    const lines = splitLines(customText.text || ' ');
    const { blockWidth, blockHeight } = measureVerticalBlock(lines, customText.fontSize, lineHeight, scene.typography.columnGap);
    const centerX = customText.exportLeft !== undefined
      ? frameRect.x + (frameRect.width * customText.exportLeft) / 100 + blockWidth / 2
      : frameRect.x + (frameRect.width * customText.positionX) / 100;
    const centerY = customText.exportTop !== undefined
      ? frameRect.y + (frameRect.height * customText.exportTop) / 100 + blockHeight / 2
      : frameRect.y + (frameRect.height * customText.positionY) / 100;
    ctx.translate(centerX, centerY);
    drawVerticalTextBlock(ctx, lines, -blockWidth / 2, -blockHeight / 2, customText.fontSize, lineHeight, scene.typography.columnGap);
    ctx.restore();
    return;
  }

  const lines = splitLines(customText.text || ' ');
  const lineAdvance = customText.fontSize * lineHeight;
  const maxLineWidth = Math.max(0, ...lines.map((line) => ctx.measureText(line || ' ').width));
  const translateX = customText.exportLeft !== undefined
    ? frameRect.x + (frameRect.width * customText.exportLeft) / 100 + maxLineWidth / 2
    : frameRect.x + (frameRect.width * customText.positionX) / 100;
  const translateY = customText.exportTop !== undefined
    ? frameRect.y + (frameRect.height * customText.exportTop) / 100 + (lines.length * lineAdvance) / 2 - lineAdvance / 2
    : frameRect.y + (frameRect.height * customText.positionY) / 100;
  ctx.translate(translateX, translateY);
  const startY = -((lines.length - 1) * lineAdvance) / 2;
  lines.forEach((line, lineIndex) => {
    ctx.fillText(line, 0, startY + lineIndex * lineAdvance);
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
  ctx.fillStyle = '#b91c1c';
  ctx.font = `700 ${fontSize}px "Ma Shan Zheng", cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  characters.forEach((character, index) => {
    const offset = offsets[index] ?? { x: 0, y: 0 };
    ctx.fillText(character, offset.x, offset.y);
  });
  ctx.restore();
}

function drawStamp(ctx: CanvasRenderingContext2D, scene: CanvasExportScene, frameRect: Rect) {
  const { stamp } = scene.decorations;
  const centerX = frameRect.x + (frameRect.width * stamp.positionX) / 100;
  const centerY = frameRect.y + (frameRect.height * stamp.positionY) / 100;
  const borderWidth = Math.max(3, Math.round(stamp.size * 0.06));

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((stamp.rotation * Math.PI) / 180);
  ctx.globalAlpha = stamp.opacity;

  drawStampShape(ctx, stamp);
  ctx.fillStyle = stamp.style === 'brush' ? 'rgba(254, 242, 242, 0.1)' : 'rgba(254, 242, 242, 0.16)';
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = 'rgba(185, 28, 28, 0.92)';
  ctx.stroke();

  ctx.save();
  ctx.scale(0.82, 0.82);
  drawStampShape(ctx, stamp);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(127, 29, 29, 0.45)';
  ctx.stroke();
  ctx.restore();

  drawStampText(ctx, stamp);
  ctx.restore();
}

export async function renderCanvasExport(scene: CanvasExportScene) {
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

  const contentRect: Rect = {
    x: scene.typography.padding,
    y: scene.typography.padding,
    width: scene.canvasWidth - scene.typography.padding * 2,
    height: scene.canvasHeight - scene.typography.padding * 2,
  };

  if (scene.decorations.showBorder) {
    drawBorder(ctx, contentRect, scene.decorations.borderStyle, scene.typography.textColor);
  }

  drawPoem(ctx, scene, contentRect);
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