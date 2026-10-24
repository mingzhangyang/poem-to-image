import type { ExportFormat } from '../types';

/** Replace unsafe path punctuation while keeping non-Latin poetry titles readable. */
function sanitizeFilenamePart(value: string): string {
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

/** Truncate without splitting a Unicode code point or exceeding a UTF-8 byte limit. */
function takeUtf8Prefix(value: string, maxBytes: number, maxCharacters = Infinity): string {
  const encoder = new TextEncoder();
  let prefix = '';
  let bytes = 0;
  let count = 0;
  for (const character of value) {
    const size = encoder.encode(character).byteLength;
    if (bytes + size > maxBytes || count >= maxCharacters) break;
    prefix += character;
    bytes += size;
    count++;
  }
  return prefix.replace(/-+$/g, '');
}

/** Portable, human-readable export filenames that retain the batch size identifier. */
export function createExportFilename(title: string, format: ExportFormat, now = new Date(), suffix = ''): string {
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

  const encoder = new TextEncoder();
  const trailingName = `-${timestamp}.${format}`;
  const maxStemBytes = 255 - encoder.encode(trailingName).byteLength;

  // Batch exports depend on their preset ID and dimensions to distinguish files.
  // Reserve the sanitized suffix (including its separator) before fitting the title.
  // An abnormally long suffix is capped only to keep the fallback title valid.
  const sanitizedSuffix = sanitizeFilenamePart(suffix);
  const maxSuffixBytes = maxStemBytes - encoder.encode('poem-image-').byteLength;
  const safeSuffix = takeUtf8Prefix(sanitizedSuffix, maxSuffixBytes);
  const suffixPart = safeSuffix ? `-${safeSuffix}` : '';
  const maxTitleBytes = maxStemBytes - encoder.encode(suffixPart).byteLength;
  const safeTitle = takeUtf8Prefix(sanitizeFilenamePart(title) || 'poem-image', maxTitleBytes, 80) || 'poem-image';

  return `${safeTitle}${suffixPart}${trailingName}`;
}
