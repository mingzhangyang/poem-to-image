import { Suspense, lazy, useEffect, useId, useState } from 'react';
import { Expand, SlidersHorizontal, Type } from 'lucide-react';
import type { ContentSectionProps, TranslateFn } from '../../types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ControlSection } from '../ControlSection';
import { PoemAutofillNotice } from '../PoemAutofillNotice';

const PoemEditorModal = lazy(async () => ({ default: (await import('../PoemEditorModal')).PoemEditorModal }));

/** Same breakpoint as Tailwind's lg, where the desktop sidebar replaces the mobile drawer. */
const DESKTOP_QUERY = '(min-width: 1024px)';

interface ContentPanelProps {
  t: TranslateFn;
  content: ContentSectionProps;
}

/**
 * On desktop the poem's text is edited in place and the full editor holds the
 * per-section styles. On phones typing happens in the full-screen editor, so
 * the drawer only offers the button that opens it.
 */
export function ContentPanel({ t, content }: ContentPanelProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const fieldId = useId();
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

  const labelClassName = 'mb-1.5 block text-xs text-(--app-accent-600)';

  return (
    <>
      <ControlSection
        title={t('content')}
        icon={<Type className="w-4 h-4" />}
        summary={summary}
      >
        {isDesktop ? (
          // Inert while the full editor is open, so only one set of poem fields is reachable.
          <div className="space-y-4" inert={isEditorOpen} data-content-inline-fields>
            <PoemAutofillNotice t={t} content={content} />

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor={`${fieldId}-title`} className={labelClassName}>{t('poemTitle')}</label>
                <input
                  id={`${fieldId}-title`}
                  className="app-input text-sm"
                  value={content.poem.title}
                  onChange={(event) => content.onTitleChange(event.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor={`${fieldId}-author`} className={labelClassName}>{t('poemAuthor')}</label>
                <input
                  id={`${fieldId}-author`}
                  className="app-input text-sm"
                  value={content.poem.author}
                  onChange={(event) => content.onAuthorChange(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${fieldId}-body`} className={labelClassName}>{t('poemBody')}</label>
              {/* Grows with the poem where field-sizing is supported; otherwise a fixed ten-line box. */}
              <textarea
                id={`${fieldId}-body`}
                rows={10}
                className="app-textarea min-h-60 max-h-[55vh] resize-y text-sm leading-7 [field-sizing:content]"
                value={content.poem.body}
                onChange={(event) => content.onBodyChange(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-source`} className={labelClassName}>{t('poemSource')}</label>
              <input
                id={`${fieldId}-source`}
                className="app-input text-sm"
                value={content.poem.sourceNote}
                onChange={(event) => content.onSourceNoteChange(event.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[rgba(34,48,52,0.08)] px-4 py-3 text-left transition-colors hover:border-(--app-accent-200) hover:bg-[rgba(237,244,243,0.6)]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-(--app-ink)">{t('openPoemEditor')}</span>
                <span className="mt-0.5 block text-xs leading-5 text-(--app-accent-500)">{t('poemSectionStylesHint')}</span>
              </span>
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-(--app-accent-600)" />
            </button>
          </div>
        ) : (
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
        )}
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
