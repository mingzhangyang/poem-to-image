import { getStampCharacters } from './stampRendering';
import { getVerifiedSealFont } from './sealFontSources';
import { CNS_SEAL_FONT_STACK } from './sealTypography';

/** Inspect actual sfnt cmap; browser FontFace.check alone cannot prove glyph coverage. */
export interface CmapCoverage {
  hasCodePoint: (point: number) => boolean;
}

/** Parse Unicode cmap formats 4 and 12; glyph ID zero means absent.
 * This checks actual binary mappings, not a marketing character list.
 */
export function inspectUnicodeCmap(data: ArrayBuffer): CmapCoverage {
  const view = new DataView(data);
  const size = data.byteLength;
  if (size < 12 || size > 32_000_000) throw new Error('Invalid font length');
  const tableCount = view.getUint16(4, false);
  if (12 + tableCount * 16 > size) throw new Error('Truncated sfnt directory');

  let cmapStart = -1;
  let cmapLength = 0;
  for (let i = 0; i < tableCount; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3),
    );
    if (tag === 'cmap') {
      cmapStart = view.getUint32(at + 8, false);
      cmapLength = view.getUint32(at + 12, false);
      break;
    }
  }
  if (cmapStart < 0 || cmapLength < 4 || cmapStart + cmapLength > size) {
    throw new Error('No valid cmap table');
  }

  const count = view.getUint16(cmapStart + 2, false);
  if (cmapStart + 4 + count * 8 > cmapStart + cmapLength) {
    throw new Error('Truncated cmap records');
  }

  const readers: Array<(point: number) => boolean> = [];
  const seen = new Set<number>();
  for (let index = 0; index < count; index++) {
    const at = cmapStart + 4 + index * 8;
    const platform = view.getUint16(at, false);
    const encoding = view.getUint16(at + 2, false);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    const sub = cmapStart + view.getUint32(at + 4, false);
    if (seen.has(sub) || sub + 4 > cmapStart + cmapLength) continue;
    seen.add(sub);
    const format = view.getUint16(sub, false);

    if (format === 12) {
      if (sub + 16 > cmapStart + cmapLength) continue;
      const length = view.getUint32(sub + 4, false);
      const groupCount = view.getUint32(sub + 12, false);
      if (length < 16 || sub + length > cmapStart + cmapLength || groupCount > (length - 16) / 12) continue;
      readers.push((point) => {
        // The ranges are sorted by Unicode in the cmap format 12 spec.
        let lo = 0;
        let hi = groupCount - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          const group = sub + 16 + mid * 12;
          const start = view.getUint32(group, false);
          const end = view.getUint32(group + 4, false);
          if (point < start) hi = mid - 1;
          else if (point > end) lo = mid + 1;
          else return view.getUint32(group + 8, false) + (point - start) !== 0;
        }
        return false;
      });
    } else if (format === 4) {
      const length = view.getUint16(sub + 2, false);
      if (length < 24 || sub + length > cmapStart + cmapLength) continue;
      const segCountX2 = view.getUint16(sub + 6, false);
      if (segCountX2 === 0 || segCountX2 % 2 !== 0) continue;
      const segCount = segCountX2 / 2;
      const endBase = sub + 14;
      const startBase = endBase + segCount * 2 + 2;
      const deltaBase = startBase + segCount * 2;
      const rangeBase = deltaBase + segCount * 2;
      if (rangeBase + segCount * 2 > sub + length) continue;
      readers.push((point) => {
        if (point > 0xffff) return false;
        for (let i = 0; i < segCount; i++) {
          const end = view.getUint16(endBase + i * 2, false);
          if (point > end) continue;
          const start = view.getUint16(startBase + i * 2, false);
          if (point < start) return false;
          const delta = view.getInt16(deltaBase + i * 2, false);
          const rangeOffset = view.getUint16(rangeBase + i * 2, false);
          if (rangeOffset === 0) return ((point + delta) & 0xffff) !== 0;
          const address = rangeBase + i * 2 + rangeOffset + (point - start) * 2;
          if (address + 2 > sub + length) return false;
          const glyph = view.getUint16(address, false);
          return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
        }
        return false;
      });
    }
  }
  if (!readers.length) throw new Error('No usable Unicode cmap');
  return {
    hasCodePoint: (point) => Number.isInteger(point) && point >= 0 && point <= 0x10ffff
      && readers.some((reader) => reader(point)),
  };
}

export function missingGlyphs(text: string, coverage: CmapCoverage): string[] {
  return getStampCharacters(text).filter((grapheme) =>
    Array.from(grapheme).some((character) =>
      !coverage.hasCodePoint(character.codePointAt(0) ?? -1)));
}


const coverageByUrl = new Map<string, Promise<CmapCoverage>>();
export function loadFontCoverage(url: string): Promise<CmapCoverage> {
  const cached = coverageByUrl.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error('Font download failed: HTTP ' + response.status);
      return response.arrayBuffer();
    })
    .then(inspectUnicodeCmap);
  coverageByUrl.set(url, pending);
  void pending.catch(() => {
    if (coverageByUrl.get(url) === pending) coverageByUrl.delete(url);
  });
  return pending;
}
export function missingVerifiedGlyphs(text: string, coverage: CmapCoverage): string[] {
  return [...new Set(getStampCharacters(text).filter((grapheme) =>
    Array.from(grapheme).some((ch) => !coverage.hasCodePoint(ch.codePointAt(0) ?? -1))))];
}
/** Fail closed before copy, share or raster export. Modern and legacy WOFF2 stamps retain old behavior. */
export async function assertVerifiedSealGlyphs(fontValue: string | null | undefined, text: string): Promise<void> {
  const face = getVerifiedSealFont(fontValue);
  if (!face) return;
  let cmap: CmapCoverage;
  try {
    cmap = await loadFontCoverage(face.url);
  } catch {
    throw new Error('Cannot verify seal font ' + face.label + '. Check connectivity and retry.');
  }
  const missing = missingVerifiedGlyphs(text, cmap);
  // In the CNS historical table 宁 is zhù, not simplified níng.
  if (fontValue === CNS_SEAL_FONT_STACK && getStampCharacters(text).includes('宁')
      && !missing.includes('宁')) missing.push('宁');
  if (missing.length) throw new Error('Seal font ' + face.label + ' is missing: ' + missing.join('、') + '. Confirm traditional variants or select another font.');
}
