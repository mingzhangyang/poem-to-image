import type { CSSProperties } from 'react';
import type { EditorTemplateDefinition } from '../types';

export function getTemplatePreviewStyle(
  template: Pick<EditorTemplateDefinition, 'background'>,
): CSSProperties {
  const background = template.background;

  if (background.backgroundType === 'image' && background.backgroundImage) {
    return {
      backgroundImage: `url(${background.backgroundImage})`,
      backgroundSize: background.backgroundSize === 'stretch' ? '100% 100%' : (background.backgroundSize ?? 'cover'),
      backgroundPosition: background.backgroundPosition ?? 'center',
    };
  }

  if (background.backgroundType === 'gradient') {
    return {
      backgroundImage: `linear-gradient(${background.gradientDirection}, ${background.gradientColor1}, ${background.gradientColor2})`,
    };
  }

  return {
    backgroundColor: background.backgroundColor,
  };
}
