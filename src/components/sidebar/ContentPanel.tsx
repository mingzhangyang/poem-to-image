import { Suspense, lazy, useEffect, useState } from 'react';
import { Expand, Type } from 'lucide-react';
import type { ContentSectionProps, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

const PoemEditorModal = lazy(async () => ({ default: (await import('../PoemEditorModal')).PoemEditorModal }));

interface ContentPanelProps {
  t: TranslateFn;
  content: ContentSectionProps;
}

export function ContentPanel({ t, content }: ContentPanelProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { editorOpenRequestId = 0, onEditorOpenRequestHandled } = content;

  useEffect(() => {
    if (editorOpenRequestId <= 0) return;
    setIsEditorOpen(true);
    onEditorOpenRequestHandled?.();
  }, [editorOpenRequestId, onEditorOpenRequestHandled]);
  const trimmedLines = content.poem.body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = content.poem.title.trim()
    || (trimmedLines.length > 0 ? trimmedLines[0].slice(0, 48) : '')
    || content.poem.author.trim()
    || t('enterPoem');

  return (
    <>
      <ControlSection
        title={t('content')}
        icon={<Type className="w-4 h-4" />}
        summary={summary}
      >
        <button
          type="button"
          onClick={() => setIsEditorOpen(true)}
          className="flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-[rgba(34,48,52,0.08)] bg-[linear-gradient(135deg,rgba(237,244,243,0.88),rgba(255,253,249,0.96))] px-4 py-4 text-left transition-colors hover:border-(--app-accent-200)"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-(--app-ink)">{t('openPoemEditor')}</span>
            <span className="mt-1 block text-xs leading-5 text-(--app-accent-500)">{t('poemEditorHint')}</span>
          </span>
          <Expand className="h-4 w-4 shrink-0 text-(--app-accent-600)" />
        </button>
      </ControlSection>

      <Suspense fallback={null}>
        <PoemEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          t={t}
          content={content}
        />
      </Suspense>
    </>
  );
}
