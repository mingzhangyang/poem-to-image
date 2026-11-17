import { getStampCharacters } from './stampRendering';
import type { StampConfig, StampGlyphEdit } from './types';

export const EMPTY_GLYPH_EDIT = Object.freeze({
  offsetX: 0, offsetY: 0, widthPct: 100, heightPct: 100, locked: false,
});

const within = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Strict, bounded user settings; no data-dependent coordinates or font identities. */
export function isValidStampGlyphEdit(value: unknown): value is StampGlyphEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const edit = value as Partial<StampGlyphEdit>;
  return typeof edit.index === 'number' && Number.isInteger(edit.index) && within(edit.index, 0, 7)
    && typeof edit.character === 'string' && edit.character.length > 0
    && edit.character.length <= 32
    && within(edit.offsetX, -20, 20) && within(edit.offsetY, -20, 20)
    && within(edit.widthPct, 70, 130) && within(edit.heightPct, 70, 130)
    && typeof edit.locked === 'boolean';
}
export function isValidStampGlyphEditList(value: unknown): value is StampGlyphEdit[] {
  if (!Array.isArray(value) || value.length > 8) return false;
  const used = new Set<number>();
  return value.every(entry => {
    if (!isValidStampGlyphEdit(entry) || used.has(entry.index)) return false;
    used.add(entry.index);
    return true;
  });
}

/** A repeated character must not make an edit leak to a different text index. */
export function getActiveStampGlyphEdits(
  stamp: Pick<StampConfig, 'text' | 'glyphEdits'>,
): StampGlyphEdit[] {
  const chars = getStampCharacters(stamp.text);
  const entries = Array.isArray(stamp.glyphEdits) ? stamp.glyphEdits : [];
  return entries.filter(e =>
    isValidStampGlyphEdit(e) && chars[e.index] === e.character);
}

export function getStampGlyphEdit(
  stamp: Pick<StampConfig, 'text' | 'glyphEdits'>, index: number,
): Readonly<StampGlyphEdit> {
  const char = getStampCharacters(stamp.text)[index] ?? '';
  return getActiveStampGlyphEdits(stamp).find(e => e.index === index)
    ?? { index, character: char, ...EMPTY_GLYPH_EDIT };
}

/** Patches stay immutable, and locking blocks changes except explicit unlock. */
export function updateStampGlyphEdit(
  stamp: Pick<StampConfig, 'text' | 'glyphEdits'>,
  index: number,
  patch: Partial<Pick<StampGlyphEdit, 'offsetX' | 'offsetY' | 'widthPct' | 'heightPct' | 'locked'>>,
): StampGlyphEdit[] {
  const chars = getStampCharacters(stamp.text);
  if (!Number.isInteger(index) || index < 0 || index >= chars.length) {
    return getActiveStampGlyphEdits(stamp);
  }
  const current = getStampGlyphEdit(stamp, index);
  if (current.locked && patch.locked !== false) return getActiveStampGlyphEdits(stamp);
  const next: StampGlyphEdit = { ...current, ...patch, index, character: chars[index] };
  if (!isValidStampGlyphEdit(next)) return getActiveStampGlyphEdits(stamp);
  const other = getActiveStampGlyphEdits(stamp).filter(e => e.index !== index);
  if (!next.locked && next.offsetX === 0 && next.offsetY === 0
      && next.widthPct === 100 && next.heightPct === 100) return other;
  return [...other, next].sort((a,b) => a.index - b.index);
}

export function resetStampGlyphEdit(
  stamp: Pick<StampConfig, 'text' | 'glyphEdits'>,
  index: number,
): StampGlyphEdit[] {
  return getActiveStampGlyphEdits(stamp).filter(e => e.index !== index || e.locked);
}

/** Keep protected edits when resetting only unlocked glyphs. */
export function resetUnlockedStampGlyphEdits(
  stamp: Pick<StampConfig, 'text' | 'glyphEdits'>,
): StampGlyphEdit[] {
  return getActiveStampGlyphEdits(stamp).filter(e => e.locked);
}

/** On text edits, retain only the identical prefix. Insertion/deletion
 * never reattaches an edit to another occurrence of a duplicated glyph. */
export function reconcileStampGlyphEdits(
  previous: string,
  next: string,
  edits: StampGlyphEdit[] | undefined,
): StampGlyphEdit[] {
  if (next.length === 0) return [];
  const before = getStampCharacters(previous);
  const after = getStampCharacters(next);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix++;
  }
  return getActiveStampGlyphEdits({ text: previous, glyphEdits: edits })
    .filter(e => e.index < prefix);
}
