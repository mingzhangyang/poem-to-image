import type { BackgroundImageSource } from './types';

/**
 * Migrate saved editor drafts written before image provenance was recorded.
 * New background selections always store their provenance explicitly.
 */
export function inferBackgroundImageSource(imageUrl: string | null | undefined): BackgroundImageSource {
  if (!imageUrl) return null;
  return imageUrl.startsWith('/template-backgrounds/') ? 'template' : 'upload';
}
