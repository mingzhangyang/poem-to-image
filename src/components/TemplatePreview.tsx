import { useEffect, type CSSProperties } from 'react';
import type { Language } from '../translations';
import type { EditorTemplateDefinition } from '../types';
import { getTemplatePreviewStyle } from '../templates/preview-style';
import { ensureFontLoaded } from '../fontLoader';

interface TemplatePreviewProps {
  template: Pick<EditorTemplateDefinition, 'background' | 'previewImage' | 'typography' | 'decorations'>;
  className?: string;
  language?: Language;
  /** Only the gallery preview includes sample text; the editing canvas remains unchanged. */
  showPoemSample?: boolean;
}

// Original two-line samples, localized independently of the reader's poem.
// They indicate how type and ink interact with each background in the gallery.
const PREVIEW_VERSES: Record<Language, string> = {
  en: 'Soft light\nquiet words',
  'zh-CN': '山有清风\n月照归人',
  'zh-TW': '山有清風\n月照歸人',
  ja: '風の音\n月の光',
  ko: '고요한 바람\n달빛 한 줄',
  es: 'Luz serena\nversos suaves',
  fr: 'Lumière douce\nvers apaisés',
  de: 'Leises Licht\nstille Worte',
};

function getPreviewTextShadow(template: TemplatePreviewProps['template']): string | undefined {
  const type = template.typography;
  if (!type.textShadowEnabled) return undefined;

  // Approximate the full-size shadow at 240px card scale.
  const scale = 0.35;
  return `${type.textShadowOffsetX * scale}px ${type.textShadowOffsetY * scale}px ${Math.max(1, type.textShadowBlur * scale)}px ${type.textShadowColor}`;
}

export function TemplatePreview({
  template,
  className = '',
  language = 'en',
  showPoemSample = false,
}: TemplatePreviewProps) {
  // Compact thumbnails stay image-only; the expanded library requests each
  // sample's actual font on mount and whenever a locale changes its font.
  useEffect(() => {
    if (showPoemSample) ensureFontLoaded(template.typography.fontFamily);
  }, [showPoemSample, template.typography.fontFamily]);

  const previewImage = template.previewImage;
  const objectFit = template.background.backgroundSize === 'stretch'
    ? 'fill'
    : (template.background.backgroundSize ?? 'cover');
  const backgroundStyle: CSSProperties = previewImage
    ? { backgroundColor: template.background.backgroundColor }
    : getTemplatePreviewStyle(template);

  return (
    <div className={`overflow-hidden ${className}`} style={backgroundStyle}>
      {previewImage ? (
        <img
          src={previewImage}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full"
          style={{
            objectFit,
            objectPosition: template.background.backgroundPosition ?? 'center',
          }}
        />
      ) : null}
      {showPoemSample ? (
        <div
          aria-hidden="true"
          data-testid="template-preview-sample"
          className="pointer-events-none absolute grid place-items-center whitespace-pre-line"
          style={{
            left: `${template.decorations.poemPosition.positionX}%`,
            top: '20%',
            width: '74%',
            height: '43%',
            transform: 'translateX(-50%)',
            color: template.typography.textColor,
            fontFamily: template.typography.fontFamily,
            fontSize: template.typography.writingMode === 'vertical-rl' ? '16px' : '17px',
            lineHeight: 1.75,
            letterSpacing: template.typography.writingMode === 'vertical-rl' ? '2px' : '1px',
            writingMode: template.typography.writingMode,
            textAlign: 'center',
            textShadow: getPreviewTextShadow(template),
          }}
        >
          {PREVIEW_VERSES[language]}
        </div>
      ) : null}
    </div>
  );
}
