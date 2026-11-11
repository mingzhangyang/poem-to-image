/**
 * Vertical-rl presentation only. These compatibility glyphs are never written
 * into user text or persisted drafts. Bracket variants follow Unicode FE3x/FE4x.
 * When a font cannot render one, layout rotates the original source character.
 */
const VERTICAL_FORMS: Readonly<Record<string, string>> = {
  '（': '︵', '）': '︶', '〔': '︹', '〕': '︺',
  '【': '︻', '】': '︼', '《': '︽', '》': '︾',
  '〈': '︿', '〉': '﹀', '「': '﹁', '」': '﹂',
  '『': '﹃', '』': '﹄', '〖': '︗', '〗': '︘',
  '［': '﹇', '］': '﹈', '…': '︙',
};

const PAUSE = new Set(Array.from('，。、；：！？'));
const OPENING = new Set(Array.from('「『（〔【《〈〖［“‘'));
const CLOSING = new Set(Array.from('」』）〕】》〉〗］”’'));

export type VerticalPunctuationClass = 'pause' | 'opening' | 'closing' | 'other';

export function classifyVerticalPunctuation(character: string): VerticalPunctuationClass {
  if (PAUSE.has(character)) return 'pause';
  if (OPENING.has(character)) return 'opening';
  if (CLOSING.has(character)) return 'closing';
  return 'other';
}

export function isVerticalPausePunctuation(character: string) {
  return PAUSE.has(character);
}

export function getVerticalGlyphPresentation(character: string, supportsVerticalForm = true): {
  renderText: string;
  rotation: 0 | 90;
} {
  const verticalForm = VERTICAL_FORMS[character];
  if (!verticalForm) return { renderText: character, rotation: 0 };
  return supportsVerticalForm
    ? { renderText: verticalForm, rotation: 0 }
    : { renderText: character, rotation: 90 };
}

/**
 * Evenly distribute one logical line across right-to-left columns without
 * splitting before closing/pause punctuation or after opening punctuation.
 * If there are too few legal boundaries, use fewer columns, never empty ones.
 * A manually supplied newline remains an explicit column boundary.
 */
export function splitVerticalColumns(line: string, requestedColumns: number): string[] {
  const characters = Array.from(line);
  if (!characters.length) return [line];
  const legalCuts: number[] = [];
  for (let index = 1; index < characters.length; index += 1) {
    if (classifyVerticalPunctuation(characters[index - 1]) === 'opening') continue;
    const nextClass = classifyVerticalPunctuation(characters[index]);
    if (nextClass === 'pause' || nextClass === 'closing') continue;
    legalCuts.push(index);
  }
  const requested = Number.isFinite(requestedColumns) ? Math.max(1, Math.floor(requestedColumns)) : 1;
  const columnCount = Math.min(requested, characters.length, legalCuts.length + 1);
  if (columnCount === 1) return [line];

  const cuts: number[] = [];
  let nextLegalIndex = 0;
  for (let column = 1; column < columnCount; column += 1) {
    // Reserve a legal cut for every remaining column.
    const lastLegalIndex = legalCuts.length - (columnCount - column);
    const ideal = (characters.length * column) / columnCount;
    let best = nextLegalIndex;
    for (let index = nextLegalIndex + 1; index <= lastLegalIndex; index += 1) {
      if (Math.abs(legalCuts[index] - ideal) < Math.abs(legalCuts[best] - ideal)) best = index;
    }
    cuts.push(legalCuts[best]);
    nextLegalIndex = best + 1;
  }

  const boundaries = [0, ...cuts, characters.length];
  return boundaries.slice(1).map((end, index) => characters.slice(boundaries[index], end).join(''));
}
