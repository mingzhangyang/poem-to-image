import { useCallback, useEffect, useRef, useState } from 'react';
import { findBestPoemMatch, isAppliedPoemSuggestion, type PoemMatcherRequestMessage, type PoemMatcherResponseMessage } from '../poemLibrary';
import type { PoemAutofillSuggestion, PoemContentData } from '../types';
import type { Language } from '../translations';

interface UsePoemAutofillParams {
  poem: PoemContentData;
  language: Language;
}

interface UsePoemAutofillResult {
  suggestion: PoemAutofillSuggestion | null;
  isMatching: boolean;
  applySuggestionToPoem: () => PoemAutofillSuggestion | null;
  dismissSuggestion: () => void;
}

function getSuggestionKey(suggestion: PoemAutofillSuggestion | null): string | null {
  if (!suggestion) {
    return null;
  }

  return `${suggestion.id}:${suggestion.body}`;
}

export function usePoemAutofill({ poem, language }: UsePoemAutofillParams): UsePoemAutofillResult {
  const workerRef = useRef<Worker | null>(null);
  const currentRequestIdRef = useRef(0);
  const [isMatching, setIsMatching] = useState(false);
  const [suggestion, setSuggestion] = useState<PoemAutofillSuggestion | null>(null);
  const [dismissedSuggestionKey, setDismissedSuggestionKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      return;
    }

    const worker = new Worker(new URL('../workers/poemMatcherWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const onWorkerMessage = (event: MessageEvent<PoemMatcherResponseMessage>) => {
      const message = event.data;

      if (!message || message.type !== 'match_result' || message.requestId !== currentRequestIdRef.current) {
        return;
      }

      setIsMatching(false);
      setSuggestion(message.suggestion);
    };

    worker.addEventListener('message', onWorkerMessage as EventListener);

    return () => {
      worker.removeEventListener('message', onWorkerMessage as EventListener);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const hasTitle = poem.title.trim().length > 0;
  const previousDraftRef = useRef({ title: poem.title, body: poem.body });

  useEffect(() => {
    const previous = previousDraftRef.current;
    const titleJustCleared = previous.title.trim().length > 0 && !hasTitle;
    const bodyChanged = previous.body !== poem.body;
    previousDraftRef.current = { title: poem.title, body: poem.body };
    const query = poem.body.trim();
    const requestId = currentRequestIdRef.current + 1;
    currentRequestIdRef.current = requestId;
    // Invalidate previous matches immediately, including responses still in flight.
    setSuggestion(null);

    // Clearing the title alone must remove old matches. Later edits to a
    // title-less body must still run identification to refill the metadata.
    if (query.length < 4 || (titleJustCleared && !bodyChanged)) {
      setIsMatching(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMatching(true);
      const request: PoemMatcherRequestMessage = {
        type: 'find_match',
        requestId,
        language,
        query,
      };

      if (workerRef.current) {
        workerRef.current.postMessage(request);
        return;
      }

      const fallbackSuggestion = findBestPoemMatch(query, language);
      if (requestId !== currentRequestIdRef.current) {
        return;
      }
      setIsMatching(false);
      setSuggestion(fallbackSuggestion);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasTitle, language, poem.body]);

  // Derived rather than cleared, so a match the poem already reflects comes
  // back as soon as an edit (say, clearing the author) makes it useful again.
  const visibleSuggestion = suggestion
    && !isAppliedPoemSuggestion(poem, suggestion)
    && getSuggestionKey(suggestion) !== dismissedSuggestionKey
    ? suggestion
    : null;

  const applySuggestionToPoem = useCallback(() => {
    if (!visibleSuggestion) {
      return null;
    }

    setDismissedSuggestionKey(null);
    // Keep the match when applying changes only the metadata. Visibility is
    // derived from the poem, and body/title-presence changes rematch as usual.
    return visibleSuggestion;
  }, [visibleSuggestion]);

  const dismissSuggestion = useCallback(() => {
    const key = getSuggestionKey(visibleSuggestion);
    if (key) {
      setDismissedSuggestionKey(key);
    }
    setSuggestion(null);
  }, [visibleSuggestion]);

  return {
    suggestion: visibleSuggestion,
    isMatching,
    applySuggestionToPoem,
    dismissSuggestion,
  };
}
