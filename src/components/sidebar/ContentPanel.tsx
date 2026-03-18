import { Type } from 'lucide-react';
import type { ContentSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface ContentPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['content'];
  onToggle: () => void;
  content: ContentSectionProps;
}

export function ContentPanel({ t, expanded, onToggle, content }: ContentPanelProps) {
  const trimmedLines = content.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = trimmedLines.length > 0
    ? trimmedLines[0].slice(0, 48)
    : t('enterPoem');

  return (
    <ControlSection
      title={t('content')}
      icon={<Type className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      summary={summary}
    >
      <textarea
        className="app-textarea h-32 resize-none text-sm"
        value={content.text}
        onChange={(event) => content.onTextChange(event.target.value)}
        placeholder={t('enterPoem')}
      />
      <p className="text-xs text-gray-500 mt-2">
        {t('textControlHint')}
      </p>
    </ControlSection>
  );
}