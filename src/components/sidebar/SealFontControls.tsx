import { STAMP_FONT_OPTIONS } from '../../fontOptions';
import { getVerifiedSealFont } from '../../sealFontSources';
import type { useSealFontInspection } from '../../hooks/useSealFontInspection';
import { getStampTextScale, getStampTextStrokeWidthPct } from '../../stampRendering';
import { getLXGWUnlistedCharacters } from '../../lxgwSealCoverage';
import { isSealScriptFont, SMALL_SEAL_FONT_STACK } from '../../sealTypography';
import type { StampConfig, TranslateFn } from '../../types';

interface SealFontControlsProps {
  stamp: StampConfig;
  t: TranslateFn;
  onChange: (updates: Partial<StampConfig>) => void;
  inspected: ReturnType<typeof useSealFontInspection>;
}

/** Advanced text-seal settings: font (with glyph coverage status), text size and stroke width. */
export function SealFontControls({ stamp, t, onChange, inspected }: SealFontControlsProps) {
  const smallSealUnlisted = stamp.fontFamily === SMALL_SEAL_FONT_STACK
    ? getLXGWUnlistedCharacters(stamp.text) : [];
  const verifiedFace = getVerifiedSealFont(stamp.fontFamily);

  return (
    <>
      <div>
        <label className="block text-xs text-(--app-accent-500) mb-1">{t('stampFont')}</label>
        <select
          aria-label={t('stampFont')}
          value={stamp.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
          className="app-select text-sm"
        >
          {STAMP_FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
              {font.label}
            </option>
          ))}
        </select>
        {verifiedFace ? (
          <div className="mt-1 text-xs" role="status" aria-live="polite">
            {inspected.status === 'checking' && <p className="text-(--app-accent-500)">{t('stampFontChecking')}</p>}
            {inspected.status === 'ready' && <p className="text-emerald-800">{t('stampFontVerified')}</p>}
            {inspected.status === 'missing' && (
              <p className="text-amber-800">{t('stampFontMissingVerified')} {inspected.missing.join('、')}</p>
            )}
            {inspected.status === 'error' && (
              <p className="text-red-700">{t('stampFontVerifyFailed')}</p>
            )}
            {(inspected.status === 'error') && (
              <button type="button" className="mt-1 underline" onClick={inspected.retry}>
                {t('stampFontRetry')}
              </button>
            )}
          </div>
        ) : isSealScriptFont(stamp.fontFamily) ? (
          <>
            <p className="mt-1 text-xs text-amber-700" role="note">{t('stampFontCoverageNote')}</p>
            {smallSealUnlisted.length > 0 && (
              <p className="mt-1 text-xs text-amber-700" role="note">
                {t('stampFontMissingNote')} {smallSealUnlisted.join('、')}
              </p>
            )}
          </>
        ) : null}
        {STAMP_FONT_OPTIONS.find((f) => f.value === stamp.fontFamily)?.cjkOnly &&
          /[a-zA-Z]/.test(stamp.text) && (
          <p className="mt-1 text-xs text-amber-600">{t('stampFontCjkWarning')}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
          <span>{t('stampTextSize')}</span>
          <span>{Math.round(getStampTextScale(stamp) * 100)}%</span>
        </div>
        <input
          type="range"
          aria-label={t('stampTextSize')}
          aria-valuetext={`${Math.round(getStampTextScale(stamp) * 100)}%`}
          min="70"
          max="110"
          step="5"
          value={Math.round(getStampTextScale(stamp) * 100)}
          onChange={(event) => onChange({ textScale: Number(event.target.value) / 100 })}
          className="app-range app-range-warm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
          <span>{t('stampStrokeWidth')}</span>
          <span>{getStampTextStrokeWidthPct(stamp)}%</span>
        </div>
        <input
          type="range"
          aria-label={t('stampStrokeWidth')}
          aria-valuetext={`${getStampTextStrokeWidthPct(stamp)}%`}
          min="0"
          max="4"
          step="0.5"
          value={getStampTextStrokeWidthPct(stamp)}
          onChange={(event) => onChange({ textStrokeWidthPct: Number(event.target.value) })}
          className="app-range app-range-warm"
        />
      </div>
    </>
  );
}
