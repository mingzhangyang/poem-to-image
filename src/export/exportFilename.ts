import type { ExportFormat } from '../types';

/** Portable, human-readable export filenames that retain CJK poetry titles. */
export function createExportFilename(title: string, format: ExportFormat, now = new Date(), suffix = ''): string {
  const stem = [title, suffix].filter(Boolean).join('-')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'poem-image';
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
  return `${stem}-${timestamp}.${format}`;
}
