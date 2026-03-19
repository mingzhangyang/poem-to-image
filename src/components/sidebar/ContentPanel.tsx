import { useMemo, useState } from 'react';
import { Expand, ScrollText, Type } from 'lucide-react';
import { PoemEditorModal } from '../PoemEditorModal';
import type { ContentSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface ContentPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['content'];
  onToggle: () => void;
  content: ContentSectionProps;
}

export function ContentPanel({ t, expanded, onToggle, content }: ContentPanelProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const trimmedLines = content.poem.body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const filledFields = useMemo(
    () => [content.poem.title, content.poem.author, content.poem.body, content.poem.sourceNote].filter((value) => value.trim().length > 0).length,
    [content.poem.author, content.poem.body, content.poem.sourceNote, content.poem.title],
  );
  const summary = content.poem.title.trim()
    || (trimmedLines.length > 0 ? trimmedLines[0].slice(0, 48) : '')
    || content.poem.author.trim()
    || t('enterPoem');

  return (
    <>
      <ControlSection
        title={t('content')}
        icon={<Type className="w-4 h-4" />}
        expanded={expanded}
        onToggle={onToggle}
        summary={summary}
      >
        <div className="space-y-4">
          <p className="text-xs leading-5 text-gray-500">{t('poemStructureHint')}</p>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[rgba(255,253,249,0.94)] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{t('poemFields')}</div>
                <div className="text-base font-semibold text-gray-900">{filledFields}/4</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[rgba(255,253,249,0.94)] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{t('poemLines')}</div>
                <div className="text-base font-semibold text-gray-900">{trimmedLines.length}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[rgba(255,250,242,0.72)] px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-(--app-accent-500)">
                <ScrollText className="h-3.5 w-3.5" />
                <span>{t('poemEditorTitle')}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-600">{t('poemEditorHint')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-[rgba(34,48,52,0.08)] bg-[linear-gradient(135deg,rgba(237,244,243,0.88),rgba(255,253,249,0.96))] px-4 py-4 text-left transition-colors hover:border-(--app-accent-200)"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">{t('openPoemEditor')}</span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">{summary}</span>
            </span>
            <Expand className="h-4 w-4 shrink-0 text-(--app-accent-600)" />
          </button>
        </div>
      </ControlSection>

      <PoemEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        t={t}
        content={content}
      />
    </>
  );
}
