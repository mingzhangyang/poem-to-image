import { getStampCharacters } from '../../stampRendering';
import { getCompositionTightness, getWholeSealColumnChoices } from '../../sealTypography';
import type { StampConfig, TranslateFn } from '../../types';

interface SealCompositionControlsProps {
  stamp: StampConfig;
  t: TranslateFn;
  onChange: (updates: Partial<StampConfig>) => void;
}

/** Composition mode of a traditional text seal: classic, whole-seal or name layout. */
export function SealCompositionControls({ stamp, t, onChange }: SealCompositionControlsProps) {
  const wholeVariantCount = Math.min(3, getWholeSealColumnChoices(stamp).length);
  const activeWholeVariant = Math.min(stamp.compositionVariant ?? 0,
    wholeVariantCount - 1);

  return (
    <div className="space-y-2 rounded-lg border border-[rgba(34,48,52,0.12)] p-2.5">
      <label className="block text-xs font-semibold text-(--app-accent-700)">
        {t('stampComposition')}
      </label>
      <select
        className="app-select text-sm"
        aria-label={t('stampComposition')}
        value={stamp.compositionMode ?? 'legacy'}
        onChange={(event) => onChange({
          compositionMode: event.target.value as 'legacy' | 'whole' | 'name',
        })}
      >
        <option value="legacy">{t('stampCompositionClassic')}</option>
        <option value="whole">{t('stampCompositionWhole')}</option>
        {(getStampCharacters(stamp.text).length === 3 ||
          stamp.compositionMode === 'name') && (
          <option value="name">{t('stampCompositionName')}</option>
        )}
      </select>
      {stamp.compositionMode === 'whole' &&
        wholeVariantCount > 1 && (
          <div className="space-y-1">
            <label className="block text-xs text-(--app-accent-500)">
              {t('stampCompositionVariant')}
            </label>
            <div className="flex gap-1" role="group" aria-label={t('stampCompositionVariant')}>
              {(['stampCompositionVariantA', 'stampCompositionVariantB', 'stampCompositionVariantC'] as const)
                .slice(0, wholeVariantCount).map((label, index) => (
                  <button type="button" key={label}
                    aria-pressed={activeWholeVariant === index}
                    onClick={() => onChange({ compositionVariant: index as 0 | 1 | 2 })}
                    className={'flex-1 rounded border px-2 py-1.5 text-xs font-medium ' +
                      (activeWholeVariant === index
                        ? 'border-(--app-accent-700) bg-(--app-accent-700) text-white'
                        : 'border-(--app-accent-200) bg-white text-(--app-accent-700)')}>
                    {t(label)}
                  </button>
                ))}
            </div>
          </div>
        )}
      {stamp.compositionMode === 'name' && (
        <p className="text-[11px] text-(--app-accent-500)" role="note">
          {t('stampCompositionNameHint')}
        </p>
      )}
      {(stamp.compositionMode === 'whole' ||
        stamp.compositionMode === 'name') && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
            <span>{t('stampCompositionTightness')}</span>
            <span>{Math.round(getCompositionTightness(stamp))}%</span>
          </div>
          <input
            type="range" min="0" max="100" step="5"
            className="app-range app-range-warm"
            aria-label={t('stampCompositionTightness')}
            aria-valuetext={String(Math.round(getCompositionTightness(stamp))) + '%'}
            value={getCompositionTightness(stamp)}
            onChange={(event) => onChange({
              compositionTightness: Number(event.target.value),
            })}
          />
        </div>
      )}
    </div>
  );
}
