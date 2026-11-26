import { getNaturalSealSeed, nextNaturalSealSeed } from '../../naturalSealTexture';
import { isTraditionalStamp } from '../../sealTypography';
import type { StampConfig, TranslateFn } from '../../types';

interface SealInkControlsProps {
  stamp: StampConfig;
  t: TranslateFn;
  onChange: (updates: Partial<StampConfig>) => void;
}

/** Colour scheme, ink colour, impression texture and weathering of the seal. */
export function SealInkControls({ stamp, t, onChange }: SealInkControlsProps) {
  return (
    <>
      <div>
        <label className="block text-xs text-(--app-accent-500) mb-1">{t('stampColorScheme')}</label>
        <div className="app-segment flex gap-1 p-1 rounded">
          <button
            type="button"
            onClick={() => onChange({
              colorScheme: 'outline',
              ...(isTraditionalStamp(stamp) ? { mode: 'zhuwen' as const } : {}),
            })}
            aria-pressed={stamp.mode === 'zhuwen' || (!isTraditionalStamp(stamp) && (stamp.colorScheme ?? 'filled') === 'outline')}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              (stamp.colorScheme ?? 'filled') === 'outline' ? 'app-segment-button-active' : 'text-(--app-accent-500) hover:bg-(--app-accent-50)'
            }`}
          >
            {t('stampColorOutline')}
          </button>
          <button
            type="button"
            onClick={() => onChange({
              colorScheme: 'filled',
              ...(isTraditionalStamp(stamp) ? { mode: 'baiwen' as const } : {}),
            })}
            aria-pressed={stamp.mode === 'baiwen' || (!isTraditionalStamp(stamp) && stamp.colorScheme === 'filled')}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              stamp.colorScheme === 'filled' ? 'app-segment-button-active' : 'text-(--app-accent-500) hover:bg-(--app-accent-50)'
            }`}
          >
            {t('stampColorFilled')}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-(--app-accent-500) mb-1">{t('stampInkColor')}</label>
        <div className="flex w-full items-center gap-3 rounded-xl border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.96)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <input
            type="color"
            aria-label={t('stampInkColor')}
            value={stamp.inkColor ?? '#c82829'}
            onChange={(event) => onChange({ inkColor: event.target.value })}
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-[0.08em] text-[rgba(51,88,87,0.82)]">
            {stamp.inkColor ?? '#c82829'}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { color: '#c82829', label: 'Vermilion' },
            { color: '#e60000', label: 'Bright Red' },
            { color: '#8b0000', label: 'Dark Red' },
            { color: '#e03c60', label: 'Magenta' },
            { color: '#ff8c00', label: 'Orange' },
            { color: '#00a497', label: 'Turquoise' },
            { color: '#b87333', label: 'Bronze' },
            { color: '#1a1a1a', label: 'Ink Black' },
          ].map(({ color, label }) => {
            const current = stamp.inkColor ?? '#c82829';
            const isActive = current.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ inkColor: color })}
                className={`h-6 w-6 rounded-full border transition-transform ${isActive ? 'scale-110 border-[rgba(34,48,52,0.36)] ring-2 ring-[rgba(20, 169, 155,0.18)]' : 'border-white/80 hover:scale-105'}`}
                style={{ backgroundColor: color }}
                aria-label={label}
                title={label}
              />
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-(--app-accent-500)">{t('stampImpressionStyle')}</label>
        <select
          aria-label={t('stampImpressionStyle')}
          value={stamp.textureStyle ?? 'classic'}
          onChange={(event) => {
            if (event.target.value === 'natural') {
              onChange({
                textureStyle: 'natural',
                textureSeed: getNaturalSealSeed(stamp),
              });
            } else {
              onChange({ textureStyle: 'classic' });
            }
          }}
          className="app-select text-sm"
        >
          <option value="natural">{t('stampNaturalImpression')}</option>
          <option value="classic">{t('stampClassicImpression')}</option>
        </select>
        {stamp.textureStyle === 'natural' && (
          <button
            type="button"
            onClick={() => onChange({
              textureSeed: nextNaturalSealSeed(getNaturalSealSeed(stamp)),
            })}
            className="mt-2 rounded-lg border border-[rgba(34,48,52,0.16)] px-3 py-1.5 text-xs font-medium text-(--app-accent-700) hover:bg-[rgba(244,230,217,0.55)]"
          >
            {t('stampNewImpression')}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
          <span>{t('stampWeathering')}</span>
          <span>{stamp.weathering ?? 50}%</span>
        </div>
        <input
          type="range"
          aria-label={t('stampWeathering')}
          aria-valuetext={`${stamp.weathering ?? 50}%`}
          min="0"
          max="100"
          step="5"
          value={stamp.weathering ?? 50}
          onChange={(event) => onChange({ weathering: Number(event.target.value) })}
          className="app-range app-range-warm"
        />
      </div>
    </>
  );
}
