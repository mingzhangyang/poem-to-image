import { getStampCharacters } from './stampRendering';
import type { CmapCoverage } from './sealFontCoverage';

export type SealVariantMap = ReadonlyMap<string, readonly string[]>;
export interface SealVariantRow {
  index: number;
  original: string;
  required: boolean;
  choices: readonly { character: string; gloss: string }[];
}
const GLOSSES: Readonly<Record<string,string>> = {
  '發': '发展 / 發展', '髮': '头发 / 頭髮', '後': '前后 / 前後', '雲': '云彩 / 雲彩',
  '寧': '安宁 / 安寧', '甯': '姓氏', '楊': '姓氏', '張': '姓氏', '齋': '书斋 / 書齋',
  '歷': '经历 / 經歷', '曆': '日历 / 日曆', '臺': '楼台 / 樓臺', '颱': '台风 / 颱風',
  '松': '松树 / 松樹', '鬆': '松散 / 鬆散', '后': '皇后 / 姓氏', '云': '云云',
  '乾': '乾坤', '幹': '树干 / 樹幹',
};
export function parseSealVariantTable(table: string): SealVariantMap {
  const map = new Map<string, string[]>();
  for (const line of table.split('\n')) {
    const [from, ...options] = Array.from(line);
    if (from && options.length) map.set(from, options);
  }
  return map;
}
let pending: Promise<SealVariantMap> | null = null;
export function loadSealVariantMap(): Promise<SealVariantMap> {
  if (pending) return pending;
  const request = import('./sealVariantTable').then((m) => parseSealVariantTable(m.SEAL_VARIANT_TABLE));
  pending = request;
  void request.catch(() => { if (pending === request) pending = null; });
  return request;
}
export function planSealVariantRows(
  text: string,
  cmap: CmapCoverage,
  variants: SealVariantMap,
  cns = false,
): SealVariantRow[] {
  return getStampCharacters(text).flatMap((original, index) => {
    const options = variants.get(original);
    if (!options || Array.from(original).length !== 1) return [];
    const currentlyCovered = cmap.hasCodePoint(original.codePointAt(0) ?? -1);
    // CNS maps simplified 宁 to zhù, not the traditional form for níng.
    const wrongMeaning = cns && original === '宁';
    const coveredChoices = [...new Set(options)]
      .filter((character) => character !== original && cmap.hasCodePoint(character.codePointAt(0) ?? -1))
      .map((character) => ({ character, gloss: GLOSSES[character] || '' }));
    if (!coveredChoices.length) return [];
    return [{ index, original, required: !currentlyCovered || wrongMeaning, choices: coveredChoices }];
  });
}
export function replaceSealVariantAt(text: string, index: number, original: string, value: string): string {
  const chars = getStampCharacters(text);
  if (chars[index] !== original) return text;
  chars[index] = value;
  return chars.join('');
}
