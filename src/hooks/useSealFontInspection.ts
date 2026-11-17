import { useEffect, useState } from 'react';
import { getVerifiedSealFont } from '../sealFontSources';
import { loadFontCoverage, missingVerifiedGlyphs } from '../sealFontCoverage';
import { loadSealVariantMap, planSealVariantRows, type SealVariantRow } from '../sealVariantChoices';
import { CNS_SEAL_FONT_STACK } from '../sealTypography';
import { getStampCharacters } from '../stampRendering';

type Status = 'idle' | 'checking' | 'ready' | 'missing' | 'error';
interface Inspection {
  key: string;
  status: Status;
  missing: string[];
  suggestions: readonly SealVariantRow[];
}
const empty: Inspection = { key: '', status: 'idle', missing: [], suggestions: [] };

/** Async results are owned by exact font+text, never by a stale React render. */
export function useSealFontInspection(fontValue: string, text: string, enabled: boolean, withVariants = false) {
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState<Inspection>(empty);
  const face = enabled ? getVerifiedSealFont(fontValue) : undefined;
  const key = face ? fontValue + '\u0000' + text + '\u0000' + withVariants : '';
  useEffect(() => {
    if (!face) return;
    let current = true;
    void Promise.all([
      loadFontCoverage(face.url),
      withVariants ? loadSealVariantMap() : Promise.resolve(null),
    ]).then(([cmap, variants]) => {
      if (!current) return;
      const missing = missingVerifiedGlyphs(text, cmap);
      if (fontValue === CNS_SEAL_FONT_STACK && getStampCharacters(text).includes('宁')
          && !missing.includes('宁')) missing.push('宁');
      setState({
        key,
        status: missing.length ? 'missing' : 'ready',
        missing,
        suggestions: variants ? planSealVariantRows(text, cmap, variants, fontValue === CNS_SEAL_FONT_STACK) : [],
      });
    }).catch(() => {
      if (current) setState({ ...empty, key, status: 'error' });
    });
    return () => { current = false; };
  }, [face, fontValue, text, key, withVariants, retryToken]);
  return {
    ...(face ? (state.key === key ? state : { ...empty, key, status: 'checking' as const }) : empty),
    retry: () => { setState({ ...empty, key, status: 'checking' }); setRetryToken((n) => n + 1); },
  };
}
