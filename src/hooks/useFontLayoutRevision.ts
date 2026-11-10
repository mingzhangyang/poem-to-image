import { useEffect, useState } from 'react';
import { ensureFontReady } from '../fontLoader';

/**
 * Canvas measurements used in the DOM preview must be recomputed when a
 * stylesheet AND its requested glyphs become available. Merely waiting at
 * export time leaves the preview's layout cached in fallback-font metrics.
 *
 * Changes are coalesced, and a late response from a previous font/text pair
 * may not remeasure the newer editor scene.
 */
export function useFontLayoutRevision(fontFamily: string, text: string): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void ensureFontReady(fontFamily, text).then(() => {
        if (!cancelled) setRevision((previous) => previous + 1);
      }).catch(() => {
        // Keep the usable fallback preview if fonts are blocked/offline.
        // Export independently reports font-loading failure.
      });
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [fontFamily, text]);
  return revision;
}
