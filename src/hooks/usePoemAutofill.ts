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

  useEffect(() => {
    const query = poem.body.trim();
    const requestId = currentRequestIdRef.current + 1;
    currentRequestIdRef.current = requestId;

    if (query.length < 4) {
      setSuggestion(null);
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
  }, [language, poem.body]);

  useEffect(() => {
    if (!suggestion) {
      return;
    }

    if (isAppliedPoemSuggestion(poem, suggestion)) {
      setSuggestion(null);
      return;
    }

    const suggestionKey = getSuggestionKey(suggestion);
    if (suggestionKey && dismissedSuggestionKey === suggestionKey) {
      setSuggestion(null);
    }
  }, [dismissedSuggestionKey, poem.author, poem.body, poem.sourceNote, poem.title, suggestion]);

  const applySuggestionToPoem = useCallback(() => {
    if (!suggestion) {
      return null;
    }

    setDismissedSuggestionKey(null);
    setSuggestion(null);
    return suggestion;
  }, [suggestion]);

  const dismissSuggestion = useCallback(() => {
    const key = getSuggestionKey(suggestion);
    if (key) {
      setDismissedSuggestionKey(key);
    }
    setSuggestion(null);
  }, [suggestion]);

  return {
    suggestion,
    isMatching,
    applySuggestionToPoem,
    dismissSuggestion,
  };
}
