import { createExportFilename } from '../export/exportFilename';
import type { ExportFormat } from '../types';

export type ImageDeliveryIntent = 'photos' | 'share';

export function isAppleMobileDevice(
  device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined =
    typeof navigator === 'undefined' ? undefined : navigator,
): boolean {
  if (!device) return false;
  return /iPhone|iPad|iPod/i.test(device.userAgent)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
}

export function imageDeliveryFormat(format: ExportFormat, intent: ImageDeliveryIntent): ExportFormat {
  // iOS Photos and Web Share file targets handle PNG/JPEG more consistently than WebP.
  // Do not alter the user's selected format for regular file downloads.
  return intent === 'photos' && format === 'webp' ? 'png' : format;
}

const mimeFormats: Record<string, ExportFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function createImageFile(blob: Blob, title: string, now = new Date()): File {
  // Canvas.toBlob may silently fall back to image/png when a MIME is unsupported.
  // Preserve the *actual* MIME and extension so iOS can recognize the image.
  const mime = blob.type.toLowerCase().split(';')[0].trim();
  const format = mimeFormats[mime];
  if (!format) throw new Error('UNSUPPORTED_IMAGE_FORMAT');
  return new File([blob], createExportFilename(title, format, now), { type: mime });
}

export function canShareImageFile(
  file: File,
  api: Partial<Pick<Navigator, 'share' | 'canShare'>> | undefined =
    typeof navigator === 'undefined' ? undefined : navigator,
): boolean {
  if (!api || typeof api.share !== 'function' || typeof api.canShare !== 'function') return false;
  try {
    return api.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function fetchPublishedImageFile(imageUrl: string, title: string): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('IMAGE_FETCH_FAILED');

  const original = await response.blob();
  // Some content servers return octet-stream; the published URLs have a known
  // extension. Do not infer MIME from untrusted arbitrary URLs.
  const pathname = new URL(imageUrl, window.location.href).pathname;
  const fallbackMime = pathname.endsWith('.png') ? 'image/png'
    : /\.jpe?g$/i.test(pathname) ? 'image/jpeg' : '';
  const contentType = original.type.toLowerCase().split(';')[0].trim();
  const mime = contentType === 'application/octet-stream' || !contentType
    ? fallbackMime : contentType;
  if (!mimeFormats[mime]) throw new Error('UNSUPPORTED_IMAGE_FORMAT');

  const blob = original.type === mime ? original : new Blob([original], { type: mime });
  return createImageFile(blob, title);
}
