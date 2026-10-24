import type { ExportFormat } from '../types';

/** Portable, human-readable export filenames that retain CJK poetry titles. */
export function createExportFilename(title: string, format: ExportFormat, now = new Date(), suffix = ''): string {
  const sanitized = [title, suffix].filter(Boolean).join('-')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'poem-image';
  const pad = (number: number, width = 2) => String(number).padStart(width, '0');
  const timestamp = [
    pad(now.getFullYear(), 4),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('') + '-' + pad(now.getMilliseconds(), 3);

  // Keep the entire UTF-8 basename, suffix and extension within 255 bytes.
  // String.slice() counts UTF-16 code units and can split supplementary CJK
  // characters; for..of advances by full Unicode code points instead.
  const trailingName = `-${timestamp}.${format}`;
  const maxStemBytes = 255 - new TextEncoder().encode(trailingName).byteLength;
  const encoder = new TextEncoder();
  let stem = '';
  let stemBytes = 0;
  let characters = 0;

  for (const character of sanitized) {
    if (characters >= 80) break;
    const size = encoder.encode(character).byteLength;
    if (stemBytes + size > maxStemBytes) break;
    stem += character;
    stemBytes += size;
    characters += 1;
  }

  return `${stem.replace(/-+$/g, '') || 'poem-image'}${trailingName}`;
}
