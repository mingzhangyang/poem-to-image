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
  return (
    <ControlSection
      title={t('content')}
      icon={<Type className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <textarea
        className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm"
        value={content.text}
        onChange={(event) => content.onTextChange(event.target.value)}
        placeholder={t('enterPoem')}
      />
    </ControlSection>
  );
}