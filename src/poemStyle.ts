import type { FontWeight, PoemLayerStyle, UserCustomTemplate, WritingMode } from './types';

export const DEFAULT_POEM_STYLE: PoemLayerStyle = {
  titleScale: 1,
  titleFontWeight: 'inherit',
  titleOpacity: 1,
  titleLineHeight: 1.6,
  titleLetterSpacing: 4,
  titleBodyGap: 20,
  titleAlign: 'center',
  titlePlacement: 'before-body',
  bodyScale: 1,
  bodyFontWeight: 'inherit',
  bodyLineHeight: 1.8,
  bodyLetterSpacing: 4,
  bodyAlign: 'center',
  authorScale: 1,
  authorFontWeight: 'inherit',
  authorOpacity: 1,
  authorLineHeight: 1.5,
  authorLetterSpacing: 4,
  authorBodyGap: 12,
  authorAlign: 'center',
  authorPlacement: 'auto',
  sourceScale: 1,
  sourceFontWeight: 'inherit',
  sourceOpacity: 1,
  sourceLineHeight: 1.4,
  sourceLetterSpacing: 4,
  sourceGap: 10,
  sourceAlign: 'center',
  sourcePlacement: 'after-body',
};

/** Select only exposed weights; absent or corrupt drafts use regular. */
export function getFontWeight(value: unknown): FontWeight {
  return value === 500 || value === 700 ? value : 400;
}
function normalizeWeightOverride(value: unknown): FontWeight | 'inherit' {
  return value === 400 || value === 500 || value === 700 ? value : 'inherit';
}
export function resolvePoemFontWeight(override: FontWeight | 'inherit' | undefined, base: FontWeight = 400): FontWeight {
  return override === 400 || override === 500 || override === 700 ? override : getFontWeight(base);
}
export function getPoemFontWeights(style: PoemLayerStyle, base: FontWeight = 400): FontWeight[] {
  return [...new Set([
    resolvePoemFontWeight(style.titleFontWeight, base),
    resolvePoemFontWeight(style.bodyFontWeight, base),
    resolvePoemFontWeight(style.authorFontWeight, base),
    resolvePoemFontWeight(style.sourceFontWeight, base),
  ])];
}

/** A saved legacy style may omit the field; keep the slider and layout bounded. */
export function getBodyFontScale(style: Pick<PoemLayerStyle, 'bodyScale'>): number {
  const value = style.bodyScale;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1.6, Math.max(0.7, value))
    : 1;
}

export function normalizePoemLayerStyle(input?: Partial<PoemLayerStyle> | null): PoemLayerStyle {
  const merged = {
    ...DEFAULT_POEM_STYLE,
    ...(input ?? {}),
  };
  return {
    ...merged,
    bodyScale: getBodyFontScale(merged),
    titleFontWeight: normalizeWeightOverride(merged.titleFontWeight),
    bodyFontWeight: normalizeWeightOverride(merged.bodyFontWeight),
    authorFontWeight: normalizeWeightOverride(merged.authorFontWeight),
    sourceFontWeight: normalizeWeightOverride(merged.sourceFontWeight),
  };
}

/** Keep explicit placements (including restored old drafts); choose a sensible default per writing direction. */
export function resolveAuthorPlacement(
  authorPlacement: PoemLayerStyle['authorPlacement'],
  writingMode: WritingMode,
): 'before-body' | 'after-body' {
  if (authorPlacement === 'auto') {
    return writingMode === 'vertical-rl' ? 'after-body' : 'before-body';
  }
  return authorPlacement;
}

export function isSamePoemLayerStyle(left: PoemLayerStyle, right: PoemLayerStyle) {
  // Older saved documents have no bodyScale; interpret that as 100% when
  // matching a localized built-in template to avoid losing its sync identity.
  const normalizedLeft = normalizePoemLayerStyle(left);
  const normalizedRight = normalizePoemLayerStyle(right);
  return (Object.keys(DEFAULT_POEM_STYLE) as Array<keyof PoemLayerStyle>)
    .every((key) => normalizedLeft[key] === normalizedRight[key]);
}

export function normalizeUserCustomTemplate(template: Omit<UserCustomTemplate, 'poemStyle'> & { poemStyle?: Partial<PoemLayerStyle> | null }): UserCustomTemplate {
  return {
    ...template,
    poemStyle: normalizePoemLayerStyle(template.poemStyle),
  };
}
