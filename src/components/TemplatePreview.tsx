import type { EditorTemplateDefinition } from '../types';
import { getTemplatePreviewStyle } from '../templates/preview-style';

interface TemplatePreviewProps {
  template: Pick<EditorTemplateDefinition, 'background' | 'previewImage'>;
  className?: string;
}

export function TemplatePreview({ template, className = '' }: TemplatePreviewProps) {
  const previewImage = template.previewImage;

  if (!previewImage) {
    return <div className={className} style={getTemplatePreviewStyle(template)} />;
  }

  const objectFit = template.background.backgroundSize === 'stretch'
    ? 'fill'
    : (template.background.backgroundSize ?? 'cover');

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ backgroundColor: template.background.backgroundColor }}
    >
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
    </div>
  );
}
