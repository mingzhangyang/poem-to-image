import type { BackgroundImageSource } from './types';

/**
 * Built-in backgrounds that shipped as PNG before the WebP refresh. Saved
 * drafts and custom templates may still reference the old paths, so they are
 * rewritten to the WebP file that replaced them.
 */
const LEGACY_PNG_TEMPLATE_BACKGROUNDS = new Set([
  'bamboo-scroll-generated',
  'illuminated-manuscript-generated',
  'ink-pine-mist-generated',
  'mountain-waterfall-generated',
  'neon-city',
  'parchment-scroll-generated',
  'sunrise-sea',
  'wax-sealed-letter-generated',
]);

const LEGACY_PNG_PATH = /^\/template-backgrounds\/([a-z0-9-]+)\.png$/;

export function migrateLegacyTemplateBackground(imageUrl: string): string;
export function migrateLegacyTemplateBackground(imageUrl: string | null | undefined): string | null | undefined;
export function migrateLegacyTemplateBackground(imageUrl: string | null | undefined): string | null | undefined {
  const name = imageUrl ? LEGACY_PNG_PATH.exec(imageUrl)?.[1] : undefined;
  return name && LEGACY_PNG_TEMPLATE_BACKGROUNDS.has(name) ? `/template-backgrounds/${name}.webp` : imageUrl;
}

/**
 * Migrate saved editor drafts written before image provenance was recorded.
 * New background selections always store their provenance explicitly.
 */
export function inferBackgroundImageSource(imageUrl: string | null | undefined): BackgroundImageSource {
  if (!imageUrl) return null;
  return imageUrl.startsWith('/template-backgrounds/') ? 'template' : 'upload';
}
