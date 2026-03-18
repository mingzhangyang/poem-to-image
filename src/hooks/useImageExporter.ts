import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { getCanvasContentRect, renderCanvasExport } from '../export/renderCanvasExport';
import type { BorderStyle, CustomText, ExportFormat, ExportScale, PositionedElement, SocialPlatform, StampConfig, TextAlign, WritingMode } from '../types';

interface SocialPlatformConfig {
  format: ExportFormat;
  scale: ExportScale;
  url: string | null;
}

const SOCIAL_PLATFORM_CONFIG: Record<SocialPlatform, SocialPlatformConfig> = {
  wechat:       { format: 'jpg', scale: 2, url: null },
  weibo:        { format: 'jpg', scale: 2, url: 'https://weibo.com/' },
  xiaohongshu:  { format: 'jpg', scale: 2, url: 'https://creator.xiaohongshu.com/publish/publish' },
  twitter:      { format: 'jpg', scale: 2, url: 'https://x.com/intent/tweet' },
  instagram:    { format: 'jpg', scale: 2, url: 'https://www.instagram.com/' },
  facebook:     { format: 'jpg', scale: 2, url: 'https://www.facebook.com/' },
};

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

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
  borderColor: string;
  borderWidth: number;
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

function getExportMimeType(format: ExportFormat) {
  if (format === 'jpg') {
    return 'image/jpeg';
  }

  if (format === 'webp') {
    return 'image/webp';
  }

  return 'image/png';
}

function getExportFilename(format: ExportFormat) {
  return `poem-image.${format}`;
}

function createOpaqueCanvasCopy(sourceCanvas: HTMLCanvasElement, fillStyle: string) {
  const opaqueCanvas = document.createElement('canvas');
  opaqueCanvas.width = sourceCanvas.width;
  opaqueCanvas.height = sourceCanvas.height;

  const opaqueContext = opaqueCanvas.getContext('2d');

  if (!opaqueContext) {
    return sourceCanvas;
  }

  opaqueContext.fillStyle = fillStyle;
  opaqueContext.fillRect(0, 0, opaqueCanvas.width, opaqueCanvas.height);
  opaqueContext.drawImage(sourceCanvas, 0, 0);

  return opaqueCanvas;
}

function exportCanvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat) {
  const mimeType = getExportMimeType(format);
  const sourceCanvas = format === 'jpg' ? createOpaqueCanvasCopy(canvas, '#ffffff') : canvas;
  const quality = format === 'png' ? undefined : 0.92;

  return new Promise<Blob | null>((resolve) => {
    sourceCanvas.toBlob(resolve, mimeType, quality);
  });
}

async function drawPoemSnapshot(
  canvas: HTMLCanvasElement,
  scene: UseImageExporterSceneOptions,
  exportScale: ExportScale,
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
  ctx.scale(exportScale, exportScale);
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

function downloadBlob(blob: Blob, format: ExportFormat) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = getExportFilename(format);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function supportsFileShare() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File === 'undefined') {
    return false;
  }

  if (typeof navigator.canShare !== 'function') {
    return true;
  }

  try {
    const probeFile = new File(['share'], 'share-test.png', { type: 'image/png' });
    return navigator.canShare({ files: [probeFile] });
  } catch {
    return false;
  }
}

export function useImageExporter(
  exportFormat: ExportFormat,
  exportScale: ExportScale,
  scene: UseImageExporterSceneOptions,
  domRefs: UseImageExporterDomRefs,
  waitForSceneSettled: () => Promise<void>,
) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const canShare = useMemo(() => supportsFileShare(), []);

  const renderOutputCanvas = useCallback(async (overrideScale?: ExportScale) => {
    await waitForSceneSettled();

    const effectiveScale = overrideScale ?? exportScale;
    const exportScene = {
      canvasWidth: scene.canvasWidth,
      canvasHeight: scene.canvasHeight,
      exportScale: effectiveScale,
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
          effectiveScale,
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

    return canvas;
  }, [domRefs, exportScale, scene, waitForSceneSettled]);

  const createOutputBlob = useCallback(async (overrideFormat?: ExportFormat, overrideScale?: ExportScale) => {
    const canvas = await renderOutputCanvas(overrideScale);
    return exportCanvasToBlob(canvas, overrideFormat ?? exportFormat);
  }, [exportFormat, renderOutputCanvas]);

  const exportImage = useCallback(async () => {
    if (isExporting || isSharing) {
      return;
    }

    setIsExporting(true);

    try {
      const blob = await createOutputBlob();

      if (!blob) {
        return;
      }

      downloadBlob(blob, exportFormat);
    } catch (error) {
      console.error('Failed to generate image', error);
    } finally {
      setIsExporting(false);
    }
  }, [createOutputBlob, exportFormat, isExporting, isSharing]);

  const shareImage = useCallback(async () => {
    if (!canShare || isExporting || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const blob = await createOutputBlob();

      if (!blob) {
        return;
      }

      const file = new File([blob], getExportFilename(exportFormat), { type: getExportMimeType(exportFormat) });
      await navigator.share({
        files: [file],
        title: document.title,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Failed to share image', error);
    } finally {
      setIsSharing(false);
    }
  }, [canShare, createOutputBlob, exportFormat, isExporting, isSharing]);

  const shareToSocialPlatform = useCallback(async (platform: SocialPlatform): Promise<'clipboard' | 'downloaded'> => {
    if (isExporting || isSharing) {
      return 'downloaded';
    }

    setIsSharing(true);

    try {
      const { format, scale, url } = SOCIAL_PLATFORM_CONFIG[platform];
      const blob = await createOutputBlob(format, scale);

      if (!blob) {
        return 'downloaded';
      }

      const copied = await copyImageToClipboard(blob);

      if (!copied) {
        downloadBlob(blob, format);
      }

      if (url) {
        setTimeout(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 400);
      }

      return copied ? 'clipboard' : 'downloaded';
    } catch (error) {
      console.error('Failed to share to social platform', error);
      return 'downloaded';
    } finally {
      setIsSharing(false);
    }
  }, [createOutputBlob, isExporting, isSharing]);

  return { exportImage, shareImage, shareToSocialPlatform, isExporting, isSharing, canShare };
}
