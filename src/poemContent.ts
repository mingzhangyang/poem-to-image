import { createCanvasTextMeasurer, createTextLayout, type TextLayoutMeasurer, type TextLayoutResult } from './textLayout';
import type { PoemContentData, PoemLayerStyle, PoemSectionPlacement, TextAlign, WritingMode } from './types';

export interface StructuredPoemSectionLayout {
  key: 'title' | 'body' | 'author' | 'sourceNote';
  layout: TextLayoutResult;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
  x: number;
  y: number;
}

export interface StructuredPoemLayout {
  writingMode: WritingMode;
  width: number;
  height: number;
  sections: StructuredPoemSectionLayout[];
}

interface CreateStructuredPoemLayoutParams {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  placeholder: string;
  writingMode: WritingMode;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: TextAlign;
  columns: number;
  columnGap: number;
  wrapWidth?: number;
  measurerFactory?: (fontFamily: string, fontSize: number) => TextLayoutMeasurer;
}

interface BaseSectionSpec {
  key: 'title' | 'body' | 'author' | 'sourceNote';
  text: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
  textAlign: TextAlign;
  gapBefore?: number;
}

function createGap(baseFontSize: number, value: number) {
  return Math.max(0, Math.round(baseFontSize * value));
}

function roundFontSize(value: number) {
  return Math.max(12, Math.round(value));
}

function normalizeSourceNoteForWritingMode(sourceNote: string, writingMode: WritingMode) {
  if (writingMode !== 'vertical-rl') {
    return sourceNote;
  }

  return sourceNote.replace(/[《》〈〉]/g, '').trim();
}

function createSectionSpecs(
  poem: PoemContentData,
  poemStyle: PoemLayerStyle,
  placeholder: string,
  writingMode: WritingMode,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
) {
  const title = poem.title.trim();
  const author = poem.author.trim();
  const body = poem.body.trim();
  const sourceNote = normalizeSourceNoteForWritingMode(poem.sourceNote.trim(), writingMode);
  const bodyText = body || placeholder;
  const titleScale = writingMode === 'vertical-rl' ? 1.12 : 1.18;
  const metaScale = writingMode === 'vertical-rl' ? 0.74 : 0.72;
  const metaLineHeight = Math.max(1.2, lineHeight - 0.15);
  const metaLetterSpacing = writingMode === 'vertical-rl'
    ? Math.max(letterSpacing, Math.round(fontSize * 0.08))
    : letterSpacing;

  const titleSection = title ? {
    key: 'title' as const,
    text: title,
    fontSize: roundFontSize(fontSize * titleScale * poemStyle.titleScale),
    lineHeight: poemStyle.titleLineHeight,
    letterSpacing: poemStyle.titleLetterSpacing,
    opacity: Math.max(0, Math.min(1, poemStyle.titleOpacity)),
    textAlign: poemStyle.titleAlign,
  } : null;

  const bodySection = {
    key: 'body' as const,
    text: bodyText,
    fontSize,
    lineHeight: poemStyle.bodyLineHeight,
    letterSpacing: poemStyle.bodyLetterSpacing,
    opacity: body ? 1 : 0.72,
    textAlign: poemStyle.bodyAlign,
  };

  const authorSection = author ? {
    key: 'author' as const,
    text: author,
    fontSize: roundFontSize(fontSize * metaScale * poemStyle.authorScale),
    lineHeight: poemStyle.authorLineHeight,
    letterSpacing: poemStyle.authorLetterSpacing,
    opacity: Math.max(0, Math.min(1, 0.82 * poemStyle.authorOpacity)),
    textAlign: poemStyle.authorAlign,
  } : null;

  const sourceSection = sourceNote ? {
    key: 'sourceNote' as const,
    text: sourceNote,
    fontSize: roundFontSize(fontSize * (metaScale - 0.04) * poemStyle.sourceScale),
    lineHeight: poemStyle.sourceLineHeight,
    letterSpacing: poemStyle.sourceLetterSpacing,
    opacity: Math.max(0, Math.min(1, 0.68 * poemStyle.sourceOpacity)),
    textAlign: poemStyle.sourceAlign,
  } : null;

  const orderedSections: BaseSectionSpec[] = [];

  if (titleSection && poemStyle.titlePlacement === 'before-body') {
    orderedSections.push(titleSection);
  }

  if (authorSection && poemStyle.authorPlacement === 'before-body') {
    orderedSections.push(authorSection);
    if (sourceSection && poemStyle.sourcePlacement === 'after-author') {
      orderedSections.push(sourceSection);
    }
  }

  if (sourceSection && poemStyle.sourcePlacement === 'before-body') {
    orderedSections.push(sourceSection);
  }

  orderedSections.push(bodySection);

  if (titleSection && poemStyle.titlePlacement === 'after-body') {
    orderedSections.push(titleSection);
  }

  if (authorSection && poemStyle.authorPlacement === 'after-body') {
    orderedSections.push(authorSection);
    if (sourceSection && poemStyle.sourcePlacement === 'after-author') {
      orderedSections.push(sourceSection);
    }
  }

  if (sourceSection && poemStyle.sourcePlacement === 'after-body') {
    orderedSections.push(sourceSection);
  }

  if (sourceSection && poemStyle.sourcePlacement === 'after-author' && !authorSection) {
    orderedSections.push(sourceSection);
  }

  return orderedSections.map((section, index) => {
    const previousSection = orderedSections[index - 1];

    if (!previousSection) {
      return section;
    }

    let gapBefore = createGap(fontSize, 0.28);

    if (section.key === 'body') {
      if (previousSection.key === 'title') {
        gapBefore = poemStyle.titleBodyGap;
      } else if (previousSection.key === 'author') {
        gapBefore = poemStyle.authorBodyGap;
      } else if (previousSection.key === 'sourceNote') {
        gapBefore = poemStyle.sourceGap;
      }
    } else if (section.key === 'title') {
      gapBefore = previousSection.key === 'body' ? poemStyle.titleBodyGap : createGap(fontSize, 0.24);
    } else if (section.key === 'author') {
      gapBefore = previousSection.key === 'body' ? poemStyle.authorBodyGap : createGap(fontSize, 0.24);
    } else if (section.key === 'sourceNote') {
      gapBefore = poemStyle.sourceGap;
    }

    return {
      ...section,
      gapBefore,
    };
  });
}

function getSectionGap(
  baseFontSize: number,
  writingMode: WritingMode,
  currentKey: BaseSectionSpec['key'],
  nextSection?: Pick<BaseSectionSpec, 'key' | 'gapBefore'>,
) {
  if (!nextSection) {
    return 0;
  }

  if (nextSection.gapBefore !== undefined) {
    return nextSection.gapBefore;
  }

  if (writingMode === 'vertical-rl') {
    if (currentKey === 'title' || nextSection.key === 'body') {
      return Math.round(baseFontSize * 0.6);
    }

    return Math.round(baseFontSize * 0.4);
  }

  if (currentKey === 'title' || nextSection.key === 'body') {
    return Math.round(baseFontSize * 0.5);
  }

  return Math.round(baseFontSize * 0.28);
}

export function getPlainPoemText(poem: PoemContentData) {
  const title = poem.title.trim();
  const author = poem.author.trim();
  const body = poem.body.trim();
  const sourceNote = poem.sourceNote.trim();
  const parts: string[] = [];

  if (title) {
    parts.push(title);
  }

  if (author) {
    parts.push(author);
  }

  if (body) {
    if (parts.length > 0) {
      parts.push('');
    }

    parts.push(body);
  }

  if (sourceNote) {
    if (parts.length > 0) {
      parts.push('');
    }

    parts.push(sourceNote);
  }

  return parts.join('\n').trim();
}

export function isSamePoemContent(left: PoemContentData, right: PoemContentData) {
  return left.title === right.title
    && left.author === right.author
    && left.body === right.body
    && left.sourceNote === right.sourceNote;
}

export function createStructuredPoemLayout({
  poem,
  poemStyle,
  placeholder,
  writingMode,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
  textAlign,
  columns,
  columnGap,
  wrapWidth,
  measurerFactory,
}: CreateStructuredPoemLayoutParams): StructuredPoemLayout {
  const sections = createSectionSpecs(poem, poemStyle, placeholder, writingMode, fontSize, lineHeight, letterSpacing).map((section) => {
    const layout = createTextLayout(
      {
        text: section.text,
        writingMode,
        fontSize: section.fontSize,
        lineHeight: section.lineHeight,
        letterSpacing: section.letterSpacing,
        columns: section.key === 'body' ? columns : 1,
        columnGap: section.key === 'body' ? columnGap : 0,
        textAlign: section.textAlign,
        wrapWidth: section.key === 'body'
          ? wrapWidth
          : writingMode === 'horizontal-tb'
            ? wrapWidth
            : undefined,
      },
      measurerFactory
        ? measurerFactory(fontFamily, section.fontSize)
        : createCanvasTextMeasurer(fontFamily, section.fontSize),
    );

    return {
      ...section,
      layout,
      x: 0,
      y: 0,
    };
  });

  if (sections.length === 0) {
    return {
      writingMode,
      width: 1,
      height: 1,
      sections: [],
    };
  }

  if (writingMode === 'vertical-rl') {
    // In vertical mode, ensure section gaps adjacent to body are larger than column gap
    const minBodySectionGap = columnGap + Math.round(fontSize * 0.15);
    const adjustedSections = sections.map((section, index) => {
      const prevSection = sections[index - 1];
      if (!prevSection || section.gapBefore === undefined) return section;
      const isBodyAdjacent =
        (section.key === 'body' && (prevSection.key === 'title' || prevSection.key === 'author'))
        || ((section.key === 'title' || section.key === 'author') && prevSection.key === 'body');
      return isBodyAdjacent
        ? { ...section, gapBefore: Math.max(section.gapBefore, minBodySectionGap) }
        : section;
    });

    const totalGap = adjustedSections.reduce(
      (sum, section, index) => sum + getSectionGap(fontSize, writingMode, section.key, adjustedSections[index + 1]),
      0,
    );
    const width = adjustedSections.reduce((sum, section) => sum + section.layout.width, 0) + totalGap;

    // Compute y-offsets to align first characters of all sections at the same visual top position.
    // The 0.1 * fontSize term corrects for the font's internal glyph offset within the em box:
    // CJK glyphs sit ~10% of fontSize below the span top, and this offset scales with font size,
    // so without it the smaller author font appears visually above the larger title font.
    const topPaddings = adjustedSections.map((s) => s.fontSize * ((s.lineHeight - 1) / 2 + 0.1));
    const maxTopPadding = Math.max(0, ...topPaddings);

    let currentX = width;
    const positionedSections = adjustedSections.map((section, index) => {
      currentX -= section.layout.width;
      const positionedSection = {
        ...section,
        x: currentX,
        y: Math.round(maxTopPadding - topPaddings[index]),
      };
      currentX -= getSectionGap(fontSize, writingMode, section.key, adjustedSections[index + 1]);
      return positionedSection;
    });

    const height = Math.max(...positionedSections.map((s) => s.y + s.layout.height));

    return {
      writingMode,
      width: Math.max(1, width),
      height: Math.max(1, height),
      sections: positionedSections,
    };
  }

  const width = Math.max(...sections.map((section) => section.layout.width));
  let currentY = 0;
  const positionedSections = sections.map((section, index) => {
    const resolvedX = section.textAlign === 'center'
      ? (width - section.layout.width) / 2
      : section.textAlign === 'right'
        ? width - section.layout.width
        : 0;

    const positionedSection = {
      ...section,
      x: resolvedX,
      y: currentY,
    };

    currentY += section.layout.height + getSectionGap(fontSize, writingMode, section.key, sections[index + 1]);
    return positionedSection;
  });

  return {
    writingMode,
    width: Math.max(1, width),
    height: Math.max(1, currentY),
    sections: positionedSections,
  };
}
