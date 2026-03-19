import type { PoemLayerStyle, UserCustomTemplate } from './types';

export const DEFAULT_POEM_STYLE: PoemLayerStyle = {
  titleScale: 1,
  titleOpacity: 1,
  titleLineHeight: 1.6,
  titleLetterSpacing: 4,
  titleBodyGap: 20,
  titleAlign: 'center',
  titlePlacement: 'before-body',
  bodyLineHeight: 1.8,
  bodyLetterSpacing: 4,
  bodyAlign: 'center',
  authorScale: 1,
  authorOpacity: 1,
  authorLineHeight: 1.5,
  authorLetterSpacing: 4,
  authorBodyGap: 12,
  authorAlign: 'center',
  authorPlacement: 'before-body',
  sourceScale: 1,
  sourceOpacity: 1,
  sourceLineHeight: 1.4,
  sourceLetterSpacing: 4,
  sourceGap: 10,
  sourceAlign: 'center',
  sourcePlacement: 'after-body',
};

export function normalizePoemLayerStyle(input?: Partial<PoemLayerStyle> | null): PoemLayerStyle {
  return {
    ...DEFAULT_POEM_STYLE,
    ...(input ?? {}),
  };
}

export function isSamePoemLayerStyle(left: PoemLayerStyle, right: PoemLayerStyle) {
  return (Object.keys(DEFAULT_POEM_STYLE) as Array<keyof PoemLayerStyle>)
    .every((key) => left[key] === right[key]);
}

export function normalizeUserCustomTemplate(template: Omit<UserCustomTemplate, 'poemStyle'> & { poemStyle?: Partial<PoemLayerStyle> | null }): UserCustomTemplate {
  return {
    ...template,
    poemStyle: normalizePoemLayerStyle(template.poemStyle),
  };
}
