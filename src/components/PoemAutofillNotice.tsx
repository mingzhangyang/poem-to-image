import { LoaderCircle, X } from 'lucide-react';
import type { ContentSectionProps, TranslateFn } from '../types';

interface PoemAutofillNoticeProps {
  t: TranslateFn;
  content: ContentSectionProps;
  className?: string;
}

/**
 * Offers the recognized poem for the text being typed, or shows that a match
 * is being looked up. Shared by the desktop Content panel and the poem editor.
 */
export function PoemAutofillNotice({ t, content, className = '' }: PoemAutofillNoticeProps) {
  const suggestion = content.poemAutofillSuggestion;
  if (!suggestion && !content.isPoemAutofillMatching) return null;
  const firstSuggestionLine = suggestion?.body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return (
    <div className={className}>
      {suggestion ? (
        <div className="rounded-[1.15rem] border border-[rgba(34,48,52,0.08)] bg-[rgba(237,244,243,0.75)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-(--app-ink)">
                {suggestion.title} · {suggestion.author}
              </p>
              {firstSuggestionLine ? (
                <p className="mt-1 truncate text-xs leading-5 text-(--app-accent-700)">{firstSuggestionLine}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={content.onDismissPoemAutofill}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(34,48,52,0.08)] bg-white/70 text-(--app-accent-500) transition-colors hover:text-(--app-accent-800)"
              aria-label={t('closeControls')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-(--app-accent-500)">
              {Math.round(suggestion.confidence * 100)}% match
            </div>
            <button
              type="button"
              onClick={content.onApplyPoemAutofill}
              className="inline-flex rounded-full border border-[rgba(34,48,52,0.1)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-(--app-accent-700) transition-colors hover:bg-(--app-accent-50)"
            >
              {t('applyTemplate')}
            </button>
          </div>
        </div>
      ) : null}

      {content.isPoemAutofillMatching ? (
        <div className={`${suggestion ? 'mt-4 ' : ''}inline-flex items-center gap-2 rounded-full border border-[rgba(34,48,52,0.08)] bg-white/75 px-3 py-1.5 text-xs text-(--app-accent-500)`}>
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          <span>{t('poemFields')}</span>
        </div>
      ) : null}
    </div>
  );
}
