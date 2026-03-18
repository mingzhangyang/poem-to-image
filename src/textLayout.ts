import type { TextAlign, WritingMode } from './types';

export interface MeasuredText {
  width: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

export interface TextLayoutMeasurer {
  measureText: (text: string) => MeasuredText;
}

export interface TextLayoutInput {
  text: string;
  writingMode: WritingMode;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  columns?: number;
  columnGap?: number;
  textAlign?: TextAlign;
  wrapWidth?: number;
}

export interface HorizontalTextLayoutItem {
  kind: 'horizontal-line';
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface VerticalTextLayoutItem {
  kind: 'vertical-segment';
  text: string;
  sideways: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  baselineY: number;
}

export type TextLayoutItem = HorizontalTextLayoutItem | VerticalTextLayoutItem;

export interface TextLayoutResult {
  writingMode: WritingMode;
  width: number;
  height: number;
  items: TextLayoutItem[];
}

function splitLines(text: string) {
  return (text || ' ').split('\n').map((line) => line.trimEnd());
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

export function createCanvasTextMeasurer(
  fontFamily: string,
  fontSize: number,
  context?: CanvasRenderingContext2D | null,
): TextLayoutMeasurer {
  const canvasContext = context ?? document.createElement('canvas').getContext('2d');

  if (!canvasContext) {
    return {
      measureText: () => ({
        width: 0,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 0,
        actualBoundingBoxAscent: fontSize,
        actualBoundingBoxDescent: 0,
      }),
    };
  }

  return {
    measureText: (text: string) => {
      canvasContext.font = `${fontSize}px ${fontFamily}`;
      const metrics = canvasContext.measureText(text || ' ');

      return {
        width: metrics.width,
        actualBoundingBoxLeft: metrics.actualBoundingBoxLeft ?? 0,
        actualBoundingBoxRight: metrics.actualBoundingBoxRight ?? metrics.width,
        actualBoundingBoxAscent: metrics.actualBoundingBoxAscent ?? fontSize,
        actualBoundingBoxDescent: metrics.actualBoundingBoxDescent ?? 0,
      };
    },
  };
}

export function measureTextWidth(measurer: TextLayoutMeasurer, text: string, letterSpacing: number) {
  const characters = Array.from(text || ' ');

  if (characters.length === 0) {
    return 0;
  }

  return characters.reduce((width, character, index) => {
    const nextWidth = width + measurer.measureText(character).width;
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

function getRotatedRunDrawOffset(measurer: TextLayoutMeasurer, text: string, letterSpacing: number) {
  const metrics = measurer.measureText(text);
  const measuredWidth = measureTextWidth(measurer, text, letterSpacing);
  const actualLeft = metrics.actualBoundingBoxLeft;
  const actualRight = metrics.actualBoundingBoxRight;
  const actualAscent = metrics.actualBoundingBoxAscent;
  const actualDescent = metrics.actualBoundingBoxDescent;
  const visualWidth = Math.max(measuredWidth, actualLeft + actualRight);

  return {
    startX: -visualWidth / 2 + actualLeft,
    baselineY: (actualAscent - actualDescent) / 2,
    width: visualWidth,
    height: actualAscent + actualDescent,
  };
}

function wrapHorizontalParagraph(measurer: TextLayoutMeasurer, paragraph: string, maxWidth: number, letterSpacing: number) {
  if (!paragraph) {
    return [''];
  }

  const wrappedLines: string[] = [];
  let currentLine = '';

  Array.from(paragraph).forEach((character) => {
    const candidate = `${currentLine}${character}`;

    if (currentLine && measureTextWidth(measurer, candidate, letterSpacing) > maxWidth) {
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

function normalizeVerticalLines(text: string, columns: number) {
  const sourceLines = splitLines(text || ' ');

  if (Math.max(1, columns) === 1 || sourceLines.length > 1) {
    return sourceLines;
  }

  return distributeEvenly(Array.from(sourceLines[0] || ' '), Math.max(1, columns)).map((characters) => characters.join(''));
}

function createHorizontalTextLayout(input: TextLayoutInput, measurer: TextLayoutMeasurer): TextLayoutResult {
  const actualColumns = Math.max(1, input.columns ?? 1);
  const columnGap = input.columnGap ?? 0;
  const textAlign = input.textAlign ?? 'left';
  const lineAdvance = input.fontSize * input.lineHeight;
  const paragraphs = splitLines(input.text || ' ');
  const wrapWidth = input.wrapWidth !== undefined ? Math.max(1, input.wrapWidth) : undefined;
  const targetColumnWidth = wrapWidth !== undefined
    ? Math.max(1, (wrapWidth - Math.max(0, actualColumns - 1) * columnGap) / actualColumns)
    : undefined;
  const wrappedLines = targetColumnWidth !== undefined
    ? paragraphs.flatMap((paragraph) => wrapHorizontalParagraph(measurer, paragraph, targetColumnWidth, input.letterSpacing))
    : paragraphs;
  const columnsData = distributeEvenly(wrappedLines, actualColumns);
  const columnContentWidths = columnsData.map((columnLines) => Math.max(0, ...columnLines.map((line) => measureTextWidth(measurer, line || ' ', input.letterSpacing))));
  const columnRenderWidths = columnsData.map((_, index) => targetColumnWidth ?? columnContentWidths[index]);
  const containerWidth = wrapWidth ?? columnRenderWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, actualColumns - 1) * columnGap;
  const containerHeight = Math.max(lineAdvance, ...columnsData.map((columnLines) => Math.max(lineAdvance, columnLines.length * lineAdvance)));
  const items: HorizontalTextLayoutItem[] = [];

  let currentX = 0;
  columnsData.forEach((columnLines, columnIndex) => {
    const renderWidth = columnRenderWidths[columnIndex];

    columnLines.forEach((line, lineIndex) => {
      const lineWidth = measureTextWidth(measurer, line || ' ', input.letterSpacing);
      let lineX = currentX;

      if (textAlign === 'center') {
        lineX += (renderWidth - lineWidth) / 2;
      } else if (textAlign === 'right') {
        lineX += renderWidth - lineWidth;
      }

      items.push({
        kind: 'horizontal-line',
        text: line || ' ',
        x: lineX,
        y: lineIndex * lineAdvance,
        width: lineWidth,
      });
    });

    currentX += renderWidth + columnGap;
  });

  return {
    writingMode: 'horizontal-tb',
    width: Math.max(1, containerWidth),
    height: Math.max(1, containerHeight),
    items,
  };
}

function createVerticalTextLayout(input: TextLayoutInput, measurer: TextLayoutMeasurer): TextLayoutResult {
  const actualColumns = Math.max(1, input.columns ?? 1);
  const columnGap = input.columnGap ?? 0;
  const normalizedLines = normalizeVerticalLines(input.text || ' ', actualColumns);
  const columnGroups = distributeEvenly(normalizedLines, actualColumns).filter((group) => group.length > 0);
  const items: VerticalTextLayoutItem[] = [];

  const groupMeasurements = columnGroups.map((group) => {
    const lineLayouts = group.map((line) => {
      const segments = splitVerticalLineSegments(line);
      const height = segments.reduce((total, segment, index) => {
        const advance = segment.sideways
          ? Math.max(input.fontSize, measureTextWidth(measurer, segment.text, input.letterSpacing))
          : input.fontSize * input.lineHeight;
        const spacing = index === segments.length - 1 ? 0 : input.letterSpacing;
        return total + advance + spacing;
      }, 0);

      return {
        segments,
        height: Math.max(input.fontSize, height),
      };
    });

    return {
      lineLayouts,
      width: Math.max(1, group.length) * input.fontSize + Math.max(0, group.length - 1) * columnGap,
      height: Math.max(input.fontSize, ...lineLayouts.map((layout) => layout.height)),
    };
  });

  const width = groupMeasurements.reduce((sum, measurement) => sum + measurement.width, 0) + Math.max(0, groupMeasurements.length - 1) * columnGap;
  const height = Math.max(input.fontSize, ...groupMeasurements.map((measurement) => measurement.height));

  let currentGroupX = 0;
  columnGroups.forEach((group, groupIndex) => {
    const measurement = groupMeasurements[groupIndex];
    const lineOriginX = currentGroupX + measurement.width - input.fontSize / 2;

    group.forEach((_, lineIndex) => {
      const lineLayout = measurement.lineLayouts[lineIndex];
      const columnX = lineOriginX - lineIndex * (input.fontSize + columnGap);
      let cursorY = 0;

      lineLayout.segments.forEach((segment, segmentIndex) => {
        const advance = segment.sideways
          ? Math.max(input.fontSize, measureTextWidth(measurer, segment.text, input.letterSpacing))
          : input.fontSize * input.lineHeight;
        const centerY = cursorY + advance / 2;
        const rotatedRunMetrics = segment.sideways
          ? getRotatedRunDrawOffset(measurer, segment.text, input.letterSpacing)
          : { startX: 0, baselineY: 0, width: input.fontSize, height: input.fontSize };

        items.push({
          kind: 'vertical-segment',
          text: segment.text,
          sideways: segment.sideways,
          x: columnX,
          y: centerY,
          width: rotatedRunMetrics.width,
          height: rotatedRunMetrics.height,
          startX: rotatedRunMetrics.startX,
          baselineY: rotatedRunMetrics.baselineY,
        });

        cursorY += advance + (segmentIndex === lineLayout.segments.length - 1 ? 0 : input.letterSpacing);
      });
    });

    currentGroupX += measurement.width + columnGap;
  });

  return {
    writingMode: 'vertical-rl',
    width: Math.max(1, width),
    height: Math.max(1, height),
    items,
  };
}

export function createTextLayout(input: TextLayoutInput, measurer: TextLayoutMeasurer): TextLayoutResult {
  if (input.writingMode === 'vertical-rl') {
    return createVerticalTextLayout(input, measurer);
  }

  return createHorizontalTextLayout(input, measurer);
}
