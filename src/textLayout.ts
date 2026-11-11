import type { TextAlign, WritingMode } from './types';
import { getVerticalGlyphPresentation, isVerticalPausePunctuation, isVerticalSidewaysRunGlyph, splitVerticalColumns } from './verticalPunctuation';

export interface MeasuredText {
  width: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

export interface TextLayoutMeasurer {
  measureText: (text: string) => MeasuredText;
  /** Best-effort font coverage check; a false result triggers rotated-source fallback. */
  supportsGlyph?: (character: string) => boolean;
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
  /** Actual glyph to paint; the source text remains unchanged. */
  renderText: string;
  rotation: 0 | 90;
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
  const font = `${fontSize}px ${fontFamily}`;

  if (!canvasContext) {
    return {
      measureText: () => ({
        width: 0,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 0,
        actualBoundingBoxAscent: fontSize,
        actualBoundingBoxDescent: 0,
      }),
      supportsGlyph: () => false,
    };
  }

  const measureCache = new Map<string, MeasuredText>();
  const measurer: TextLayoutMeasurer = {
    measureText: (text: string) => {
      const key = text || ' ';
      const cached = measureCache.get(key);
      if (cached) return cached;

      // TextMetrics ink bounds depend on textAlign/textBaseline. Measure in
      // one consistent coordinate system, without changing the drawing context.
      canvasContext.save();
      canvasContext.font = font;
      canvasContext.textAlign = 'left';
      canvasContext.textBaseline = 'alphabetic';
      const metrics = canvasContext.measureText(key);
      canvasContext.restore();
      const measured: MeasuredText = {
        width: metrics.width,
        actualBoundingBoxLeft: metrics.actualBoundingBoxLeft ?? 0,
        actualBoundingBoxRight: metrics.actualBoundingBoxRight ?? metrics.width,
        actualBoundingBoxAscent: metrics.actualBoundingBoxAscent ?? fontSize,
        actualBoundingBoxDescent: metrics.actualBoundingBoxDescent ?? 0,
      };
      measureCache.set(key, measured);
      if (measureCache.size > 2048) {
        measureCache.clear();
        measureCache.set(key, measured);
      }
      return measured;
    },
    supportsGlyph: (character: string) => {
      const glyph = measurer.measureText(character);
      if (glyph.width <= 0 || glyph.actualBoundingBoxAscent + glyph.actualBoundingBoxDescent <= 0) return false;
      // Canvas provides no font glyph-coverage API. Treat a missing-character
      // box as unsupported when its ink metrics match the noncharacter boxes.
      // False negatives are safe: rotation of the original remains legible.
      const absentA = measurer.measureText('\u{10FFFE}');
      const absentB = measurer.measureText('\u{10FFFF}');
      const same = (sample: MeasuredText) => (
        Math.abs(glyph.width - sample.width) < 0.01
        && Math.abs(glyph.actualBoundingBoxLeft - sample.actualBoundingBoxLeft) < 0.01
        && Math.abs(glyph.actualBoundingBoxRight - sample.actualBoundingBoxRight) < 0.01
        && Math.abs(glyph.actualBoundingBoxAscent - sample.actualBoundingBoxAscent) < 0.01
        && Math.abs(glyph.actualBoundingBoxDescent - sample.actualBoundingBoxDescent) < 0.01
      );
      return !(same(absentA) && same(absentB));
    },
  };
  return measurer;
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

interface HorizontalVisualBounds {
  left: number;
  right: number;
  width: number;
}

function measureHorizontalVisualBounds(measurer: TextLayoutMeasurer, text: string, letterSpacing: number): HorizontalVisualBounds {
  const characters = Array.from(text || ' ');

  if (characters.length === 0) {
    return { left: 0, right: 0, width: 0 };
  }

  let cursorX = 0;
  let minLeft = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;

  characters.forEach((character, index) => {
    const metrics = measurer.measureText(character);
    const glyphLeft = cursorX - metrics.actualBoundingBoxLeft;
    const glyphRight = cursorX + metrics.actualBoundingBoxRight;

    minLeft = Math.min(minLeft, glyphLeft);
    maxRight = Math.max(maxRight, glyphRight);

    cursorX += metrics.width + (index === characters.length - 1 ? 0 : letterSpacing);
  });

  if (!Number.isFinite(minLeft) || !Number.isFinite(maxRight)) {
    return { left: 0, right: 0, width: 0 };
  }

  return {
    left: minLeft,
    right: maxRight,
    width: Math.max(0, maxRight - minLeft),
  };
}

function isHorizontalRunGlyph(text: string) {
  return isVerticalSidewaysRunGlyph(text);
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

/**
 * Ink positioning is independent of logical cell advance. Mainland-style
 * Chinese stop punctuation sits in the upper-right part of its own full cell,
 * bounded by measured glyph ink rather than fixed per-font pixel offsets.
 */
function getUprightGlyphDrawOffset(
  measurer: TextLayoutMeasurer,
  renderText: string,
  fontSize: number,
  upperRight: boolean,
) {
  const metrics = measurer.measureText(renderText);
  const left = Math.max(0, metrics.actualBoundingBoxLeft);
  const right = Math.max(0, metrics.actualBoundingBoxRight);
  const ascent = Math.max(0, metrics.actualBoundingBoxAscent);
  const descent = Math.max(0, metrics.actualBoundingBoxDescent);
  const inkWidth = left + right;
  const inkHeight = ascent + descent;
  const inset = fontSize * 0.08;
  const centerX = upperRight ? Math.max(0, (fontSize - inkWidth) / 2 - inset) : 0;
  // The em square stays centered inside line-height leading. Punctuation
  // should rise within that square, not jump into the preceding line's gap.
  const centerY = upperRight ? -Math.max(0, (fontSize - inkHeight) / 2 - inset) : 0;
  return {
    startX: centerX + (left - right) / 2,
    baselineY: centerY + (ascent - descent) / 2,
    width: inkWidth,
    height: inkHeight,
  };
}

function isBreakableWhitespace(character: string | undefined) {
  return character !== undefined && /\s/u.test(character) && !/[\u00a0\u2007\u202f]/u.test(character);
}

function wrapHorizontalParagraph(measurer: TextLayoutMeasurer, paragraph: string, maxWidth: number, letterSpacing: number) {
  if (!paragraph) {
    return [''];
  }

  const wrappedLines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  let characters = Array.from(paragraph);
  const indentLength = characters.findIndex((character) => !/\s/u.test(character));
  if (indentLength > 0) {
    // Clamp indentation only when it would leave no room for the first glyph.
    // A soft wrap must not turn an overlong indent into a blank line.
    const firstGlyphWidth = measurer.measureText(characters[indentLength]).width;
    let indentWidth = 0;
    let retainedIndent = 0;
    for (let offset = 0; offset < indentLength; offset += 1) {
      const width = measurer.measureText(characters[offset]).width;
      const nextIndentWidth = retainedIndent ? indentWidth + letterSpacing + width : width;
      if (nextIndentWidth > maxWidth || nextIndentWidth + letterSpacing + firstGlyphWidth > maxWidth) break;
      indentWidth = nextIndentWidth;
      retainedIndent += 1;
    }
    if (retainedIndent < indentLength) {
      characters = [...characters.slice(0, retainedIndent), ...characters.slice(indentLength)];
    }
  }
  let index = 0;
  let softWrapped = false;
  while (index < characters.length) {
    const character = characters[index];
    if (softWrapped && !currentLine && /\s/u.test(character)) {
      index += 1;
      continue;
    }
    const characterWidth = measurer.measureText(character).width;
    const nextWidth = currentLine ? currentWidth + letterSpacing + characterWidth : characterWidth;

    if (currentLine && nextWidth > maxWidth) {
      softWrapped = true;
      // Prefer a word boundary, while retaining character-level fallback for
      // long words and scripts which do not put spaces between words.
      if (isBreakableWhitespace(character)) {
        if (currentLine.trim()) wrappedLines.push(currentLine.trimEnd());
        currentLine = '';
        currentWidth = 0;
        index += 1;
        while (isBreakableWhitespace(characters[index])) index += 1;
      } else {
        let breakAt = currentLine.length - 1;
        while (breakAt >= 0 && !isBreakableWhitespace(currentLine[breakAt])) breakAt -= 1;
        if (breakAt > 0 && currentLine.slice(0, breakAt).trim()) {
          wrappedLines.push(currentLine.slice(0, breakAt).trimEnd());
          currentLine = currentLine.slice(breakAt + 1).trimStart();
          currentWidth = currentLine ? measureTextWidth(measurer, currentLine, letterSpacing) : 0;
        } else {
          wrappedLines.push(currentLine);
          currentLine = '';
          currentWidth = 0;
        }
      }
      continue;
    }

    currentLine = `${currentLine}${character}`;
    currentWidth = nextWidth;
    index += 1;
  }

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
  return splitVerticalColumns(sourceLines[0] || ' ', columns);
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
      const lineText = line || ' ';
      const lineWidth = measureTextWidth(measurer, lineText, input.letterSpacing);
      const visualBounds = measureHorizontalVisualBounds(measurer, lineText, input.letterSpacing);
      let lineX = currentX;

      if (textAlign === 'center') {
        lineX += (renderWidth - visualBounds.width) / 2 - visualBounds.left;
      } else if (textAlign === 'right') {
        lineX += renderWidth - visualBounds.width - visualBounds.left;
      }

      items.push({
        kind: 'horizontal-line',
        text: lineText,
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
  const wrapWidth = input.wrapWidth !== undefined ? Math.max(1, input.wrapWidth) : undefined;
  const maxVisibleLines = wrapWidth !== undefined
    ? Math.max(1, Math.floor((wrapWidth + columnGap) / (input.fontSize + columnGap)))
    : actualColumns;
  const normalizedLines = normalizeVerticalLines(input.text || ' ', maxVisibleLines);
  const columnGroups = distributeEvenly(normalizedLines, actualColumns).filter((group) => group.length > 0);
  const items: VerticalTextLayoutItem[] = [];

  const groupMeasurements = columnGroups.map((group) => {
    const lineLayouts = group.map((line) => {
      const segments = splitVerticalLineSegments(line);
      const height = segments.reduce((total, segment, index) => {
        const advance = segment.sideways
          ? Math.max(input.fontSize, measureTextWidth(measurer, segment.text, input.letterSpacing))
          : input.fontSize * input.lineHeight;
        return total + advance + (index === segments.length - 1 ? 0 : input.letterSpacing);
      }, 0);
      return { segments, height: Math.max(input.fontSize, height) };
    });
    return {
      lineLayouts,
      width: Math.max(1, group.length) * input.fontSize + Math.max(0, group.length - 1) * columnGap,
      height: Math.max(input.fontSize, ...lineLayouts.map((layout) => layout.height)),
    };
  });

  const width = groupMeasurements.reduce((sum, measurement) => sum + measurement.width, 0)
    + Math.max(0, groupMeasurements.length - 1) * columnGap;
  const height = Math.max(input.fontSize, ...groupMeasurements.map((measurement) => measurement.height));

  // Read order is right-to-left not just within a group but across groups.
  let currentGroupRight = width;
  columnGroups.forEach((group, groupIndex) => {
    const measurement = groupMeasurements[groupIndex];
    currentGroupRight -= measurement.width;
    const lineOriginX = currentGroupRight + measurement.width - input.fontSize / 2;

    group.forEach((_, lineIndex) => {
      const lineLayout = measurement.lineLayouts[lineIndex];
      const columnX = lineOriginX - lineIndex * (input.fontSize + columnGap);
      let cursorY = 0;

      lineLayout.segments.forEach((segment, segmentIndex) => {
        const advance = segment.sideways
          ? Math.max(input.fontSize, measureTextWidth(measurer, segment.text, input.letterSpacing))
          : input.fontSize * input.lineHeight;
        const centerY = cursorY + advance / 2;
        const candidate = segment.sideways
          ? { renderText: segment.text, rotation: 90 as const }
          : getVerticalGlyphPresentation(segment.text);
        const supportsVariant = candidate.renderText === segment.text
          || measurer.supportsGlyph?.(candidate.renderText) !== false;
        const presentation = supportsVariant
          ? candidate
          : getVerticalGlyphPresentation(segment.text, false);
        const metrics = presentation.rotation === 90
          ? getRotatedRunDrawOffset(measurer, presentation.renderText, input.letterSpacing)
          : getUprightGlyphDrawOffset(
            measurer, presentation.renderText, input.fontSize,
            isVerticalPausePunctuation(segment.text),
          );

        items.push({
          kind: 'vertical-segment',
          text: segment.text,
          renderText: presentation.renderText,
          rotation: presentation.rotation,
          sideways: segment.sideways,
          x: columnX,
          y: centerY,
          width: metrics.width,
          height: metrics.height,
          startX: metrics.startX,
          baselineY: metrics.baselineY,
        });
        cursorY += advance + (segmentIndex === lineLayout.segments.length - 1 ? 0 : input.letterSpacing);
      });
    });
    currentGroupRight -= columnGap;
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
