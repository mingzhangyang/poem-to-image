import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { getCanvasContentRect, renderCanvasExport } from '../export/renderCanvasExport';
import type { BorderStyle, CustomText, ExportScale, PositionedElement, StampConfig, TextAlign, WritingMode } from '../types';

interface UseImageExporterBackgroundOptions {
  backgroundType: 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  bgBrightness: number;
  bgBlur: number;
}

interface UseImageExporterTypographyOptions {
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

interface UseImageExporterDecorationsOptions {
  showBorder: boolean;
  borderStyle: BorderStyle;
  showStamp: boolean;
  stamp: StampConfig;
  customTexts: CustomText[];
}

interface UseImageExporterSceneOptions {
  canvasWidth: number;
  canvasHeight: number;
  background: UseImageExporterBackgroundOptions;
  typography: UseImageExporterTypographyOptions;
  decorations: UseImageExporterDecorationsOptions;
}

interface UseImageExporterDomRefs {
  poemFrameRef: RefObject<HTMLDivElement | null>;
  poemTextRef: RefObject<HTMLDivElement | null>;
}

interface PoemGlyph {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  sideways?: boolean;
  horizontalRunGlyph?: boolean;
}

interface PoemGlyphGroup {
  text: string;
  glyphs: PoemGlyph[];
}

function isSidewaysVerticalGlyph(text: string, rect: DOMRect) {
  if (!/[\p{Script=Latin}\p{Number}]/u.test(text)) {
    return false;
  }

  return rect.width > rect.height;
}

function isHorizontalRunGlyph(text: string) {
  return /[\p{Script=Latin}\p{Number}\s.,!?;:'"()\[\]{}\-–—/&]/u.test(text);
}

function isLatinOrNumberGlyph(text: string) {
  return /[\p{Script=Latin}\p{Number}]/u.test(text);
}

function isWhitespaceGlyph(text: string) {
  return /^\s+$/u.test(text);
}

function isAttachedPunctuationGlyph(text: string) {
  return /^[.,!?;:'"()\[\]{}\-–—/&]$/u.test(text);
}

function buildCanvasFont(computedStyle: CSSStyleDeclaration) {
  return computedStyle.font && computedStyle.font !== ''
    ? computedStyle.font
    : `${computedStyle.fontStyle} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
}

function createGraphemeSegments(text: string) {
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (segment) => ({ text: segment.segment, index: segment.index }));
  }

  const segments: Array<{ text: string; index: number }> = [];
  let offset = 0;

  Array.from(text).forEach((character) => {
    segments.push({ text: character, index: offset });
    offset += character.length;
  });

  return segments;
}

function measureRunWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  const characters = Array.from(text);

  if (characters.length === 0) {
    return 0;
  }

  return characters.reduce((width, character, index) => {
    const nextWidth = width + ctx.measureText(character).width;
    return index === characters.length - 1 ? nextWidth : nextWidth + letterSpacing;
  }, 0);
}

function drawRunText(ctx: CanvasRenderingContext2D, text: string, startX: number, startY: number, letterSpacing: number) {
  if (letterSpacing <= 0) {
    ctx.fillText(text, startX, startY);
    return;
  }

  let currentX = startX;
  Array.from(text).forEach((character) => {
    ctx.fillText(character, currentX, startY);
    currentX += ctx.measureText(character).width + letterSpacing;
  });
}

function getGlyphVerticalGap(previousGlyph: PoemGlyph, nextGlyph: PoemGlyph) {
  return nextGlyph.top - (previousGlyph.top + previousGlyph.height);
}

function shouldAppendToSidewaysRun(runGlyphs: PoemGlyph[], nextGlyph: PoemGlyph) {
  if (!nextGlyph.horizontalRunGlyph) {
    return false;
  }

  const previousGlyph = runGlyphs[runGlyphs.length - 1];
  const gap = getGlyphVerticalGap(previousGlyph, nextGlyph);
  const referenceAdvance = Math.max(previousGlyph.height, nextGlyph.height, 1);

  if (gap > referenceAdvance * 1.35) {
    return false;
  }

  const hasLatinCore = runGlyphs.some((glyph) => isLatinOrNumberGlyph(glyph.text));

  if (isWhitespaceGlyph(nextGlyph.text) || isAttachedPunctuationGlyph(nextGlyph.text)) {
    return hasLatinCore;
  }

  return isLatinOrNumberGlyph(nextGlyph.text);
}

function groupSidewaysRuns(glyphs: PoemGlyph[]) {
  const groups: PoemGlyphGroup[] = [];
  let index = 0;

  while (index < glyphs.length) {
    const glyph = glyphs[index];

    if (!glyph.sideways) {
      groups.push({ text: glyph.text, glyphs: [glyph] });
      index += 1;
      continue;
    }

    const runGlyphs = [glyph];
    let runText = glyph.text;
    let cursor = index + 1;

    while (cursor < glyphs.length && shouldAppendToSidewaysRun(runGlyphs, glyphs[cursor])) {
      runGlyphs.push(glyphs[cursor]);
      runText += glyphs[cursor].text;
      cursor += 1;
    }

    runText = runText.replace(/^\s+/u, '').replace(/\s+$/u, '');

    if (!runText) {
      groups.push({ text: glyph.text, glyphs: [glyph] });
      index += 1;
      continue;
    }

    groups.push({ text: runText, glyphs: runGlyphs });
    index = cursor;
  }

  return groups;
}

function getRotatedRunDrawOffset(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  const metrics = ctx.measureText(text);
  const measuredWidth = measureRunWidth(ctx, text, letterSpacing);
  const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
  const actualRight = metrics.actualBoundingBoxRight ?? measuredWidth;
  const actualAscent = metrics.actualBoundingBoxAscent ?? 0;
  const actualDescent = metrics.actualBoundingBoxDescent ?? 0;
  const visualWidth = Math.max(measuredWidth, actualLeft + actualRight);
  const startX = -visualWidth / 2 + actualLeft;
  const baselineY = (actualAscent - actualDescent) / 2;

  return { startX, baselineY };
}

function collectPoemGlyphs(poemTextElement: HTMLDivElement, frameRect: DOMRect) {
  const glyphs: PoemGlyph[] = [];
  const walker = document.createTreeWalker(poemTextElement, NodeFilter.SHOW_TEXT);
  const computedStyle = window.getComputedStyle(poemTextElement);
  const usesVerticalWriting = computedStyle.writingMode.startsWith('vertical');

  while (walker.nextNode()) {
    const textNode = walker.currentNode;

    if (!(textNode instanceof Text) || !textNode.data) {
      continue;
    }

    const segments = createGraphemeSegments(textNode.data);

    segments.forEach(({ text, index }) => {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + text.length);
      const rect = range.getBoundingClientRect();
      range.detach?.();

      if (rect.width === 0 && rect.height === 0) {
        return;
      }

      glyphs.push({
        text,
        left: rect.left - frameRect.left,
        top: rect.top - frameRect.top,
        width: rect.width,
        height: rect.height,
      });
    });
  }

  if (!usesVerticalWriting) {
    return glyphs;
  }

  return glyphs.map((glyph) => ({
    ...glyph,
    sideways: isSidewaysVerticalGlyph(glyph.text, new DOMRect(0, 0, glyph.width, glyph.height)),
    horizontalRunGlyph: isHorizontalRunGlyph(glyph.text),
  }));
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

async function drawPoemSnapshot(
  canvas: HTMLCanvasElement,
  scene: UseImageExporterSceneOptions,
  domRefs: UseImageExporterDomRefs,
) {
  const poemFrameElement = domRefs.poemFrameRef.current;
  const poemTextElement = domRefs.poemTextRef.current;

  if (!poemFrameElement || !poemTextElement) {
    return false;
  }

  const frameRect = poemFrameElement.getBoundingClientRect();
  const poemRect = poemTextElement.getBoundingClientRect();

  if (frameRect.width <= 0 || frameRect.height <= 0 || poemRect.width <= 0 || poemRect.height <= 0) {
    return false;
  }
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return false;
  }

  const glyphs = collectPoemGlyphs(poemTextElement, frameRect);

  if (glyphs.length === 0) {
    return false;
  }

  const contentRect = getCanvasContentRect({ ...scene, exportScale: 1 });
  const scaleX = contentRect.width / frameRect.width;
  const scaleY = contentRect.height / frameRect.height;
  const computedStyle = window.getComputedStyle(poemTextElement);
  const letterSpacing = Number.parseFloat(computedStyle.letterSpacing || '0');
  const drawGroups: PoemGlyphGroup[] = computedStyle.writingMode.startsWith('vertical')
    ? groupSidewaysRuns(glyphs)
    : glyphs.map((glyph) => ({ text: glyph.text, glyphs: [glyph] }));

  ctx.save();
  ctx.scale(scene.exportScale, scene.exportScale);
  ctx.fillStyle = computedStyle.color;
  ctx.font = buildCanvasFont(computedStyle);
  ctx.textBaseline = 'top';

  if (scene.typography.textShadowEnabled) {
    ctx.shadowColor = scene.typography.textShadowColor;
    ctx.shadowBlur = scene.typography.textShadowBlur;
    ctx.shadowOffsetX = scene.typography.textShadowOffsetX;
    ctx.shadowOffsetY = scene.typography.textShadowOffsetY;
  }

  drawGroups.forEach((group) => {
    const firstGlyph = group.glyphs[0];
    const left = Math.min(...group.glyphs.map((glyph) => glyph.left));
    const top = Math.min(...group.glyphs.map((glyph) => glyph.top));
    const right = Math.max(...group.glyphs.map((glyph) => glyph.left + glyph.width));
    const bottom = Math.max(...group.glyphs.map((glyph) => glyph.top + glyph.height));
    const drawX = contentRect.x + left * scaleX;
    const drawY = contentRect.y + top * scaleY;

    if (firstGlyph.sideways && group.glyphs.length > 0) {
      const centerX = contentRect.x + ((left + right) / 2) * scaleX;
      const centerY = contentRect.y + ((top + bottom) / 2) * scaleY;
      const safeLetterSpacing = Number.isFinite(letterSpacing) ? letterSpacing : 0;
      const { startX, baselineY } = getRotatedRunDrawOffset(ctx, group.text, safeLetterSpacing);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      drawRunText(ctx, group.text, startX, baselineY, safeLetterSpacing);
      ctx.restore();
      ctx.textAlign = 'start';
      ctx.textBaseline = 'top';
      return;
    }

    ctx.fillText(group.text, drawX, drawY);
  });

  ctx.restore();
  return true;
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'poem-image.png';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function useImageExporter(
  exportScale: ExportScale,
  scene: UseImageExporterSceneOptions,
  domRefs: UseImageExporterDomRefs,
  waitForSceneSettled: () => Promise<void>,
) {
  const [isExporting, setIsExporting] = useState(false);

  const exportImage = useCallback(async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      await waitForSceneSettled();

      const exportScene = {
        canvasWidth: scene.canvasWidth,
        canvasHeight: scene.canvasHeight,
        exportScale,
        background: scene.background,
        typography: scene.typography,
        decorations: scene.decorations,
      };
      const shouldSnapshotPoem = scene.typography.columns > 1 && domRefs.poemFrameRef.current && domRefs.poemTextRef.current;
      let canvas = await renderCanvasExport(exportScene, { skipPoem: shouldSnapshotPoem });

      if (shouldSnapshotPoem) {
        try {
          const didDrawSnapshot = await drawPoemSnapshot(
            canvas,
            { ...scene, canvasWidth: scene.canvasWidth, canvasHeight: scene.canvasHeight },
            domRefs,
          );

          if (!didDrawSnapshot) {
            canvas = await renderCanvasExport(exportScene);
          }
        } catch (snapshotError) {
          console.error('Failed to snapshot poem layout, falling back to canvas poem renderer', snapshotError);
          canvas = await renderCanvasExport(exportScene);
        }
      }

      const blob = await toBlob(canvas);

      if (!blob) {
        return;
      }

      downloadBlob(blob);
    } catch (error) {
      console.error('Failed to generate image', error);
    } finally {
      setIsExporting(false);
    }
  }, [domRefs, exportScale, isExporting, scene, waitForSceneSettled]);

  return { exportImage, isExporting };
}
