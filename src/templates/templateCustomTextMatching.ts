import type { CustomText } from '../types';

/** Preserve user edits to any text-box field when localizing a template. */
export function matchesTemplateCustomTexts(
  current: readonly CustomText[],
  template: readonly CustomText[],
): boolean {
  if (current.length !== template.length) return false;

  return current.every((text, index) => {
    const expected = template[index];
    const keys = new Set([...Object.keys(text), ...Object.keys(expected)] as Array<keyof CustomText>);
    return [...keys].every((key) => key === 'zIndex'
      ? (text.zIndex ?? index) === (expected.zIndex ?? index)
      : text[key] === expected[key]);
  });
}
