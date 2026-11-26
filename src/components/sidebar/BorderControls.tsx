import type { BorderStyle, DecorationsSectionProps, TranslateFn } from '../../types';

const BORDER_COLOR_PRESETS = ['#223034', '#406967', '#7d4d32', '#111827', '#5b4636', '#8b1e3f', '#7c2d12', '#1d4ed8'];

interface BorderControlsProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Border toggle and, when the border is shown, its style, colour and width. */
export function BorderControls({ t, decorations }: BorderControlsProps) {
  return (
    <>
      <div className="flex items-start gap-3">
        <label className="text-xs text-(--app-accent-700) flex items-center gap-2">
          <input
            type="checkbox"
            checked={decorations.showBorder}
            onChange={(event) => decorations.onShowBorderChange(event.target.checked)}
            className="app-checkbox rounded"
          />
          {t('showBorder')}
        </label>
      </div>

      {decorations.showBorder ? (
        <div className="rounded-xl border border-[rgba(34,48,52,0.08)] bg-white p-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-(--app-accent-500)">{t('borderStyle')}</label>
            <select
              aria-label={t('borderStyle')}
              value={decorations.borderStyle}
              onChange={(event) => decorations.onBorderStyleChange(event.target.value as BorderStyle)}
              className="app-select text-sm"
            >
              <option value="solid">{t('borderSolid')}</option>
              <option value="dashed">{t('borderDashed')}</option>
              <option value="double">{t('borderDouble')}</option>
              <option value="shadow">{t('borderShadow')}</option>
              <option value="gradient">{t('borderGradient')}</option>
              <option value="broken">{t('borderBroken')}</option>
              <option value="overflow">{t('borderOverflow')}</option>
              <option value="brush">{t('borderBrush')}</option>
              <option value="ink">{t('borderInk')}</option>
              <option value="cloud">{t('borderCloud')}</option>
              <option value="wave">{t('borderWave')}</option>
              <option value="fractal">{t('borderFractal')}</option>
              <option value="meander">{t('borderMeander')}</option>
              <option value="leiwen">{t('borderLeiwen')}</option>
              <option value="ornamental">{t('borderOrnamental')}</option>
              <option value="envelope">{t('borderEnvelope')}</option>
            </select>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-(--app-accent-500)">{t('borderColor')}</label>
              <div className="flex w-full items-center gap-3 rounded-xl border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.96)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <input
                  type="color"
                  aria-label={t('borderColor')}
                  value={decorations.borderColor}
                  onChange={(event) => decorations.onBorderColorChange(event.target.value)}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-[0.08em] text-[rgba(51,88,87,0.82)]">
                  {decorations.borderColor}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {BORDER_COLOR_PRESETS.map((color) => {
                  const isActive = decorations.borderColor.toLowerCase() === color.toLowerCase();

                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => decorations.onBorderColorChange(color)}
                      className={`h-6 w-6 rounded-full border transition-transform ${isActive ? 'scale-110 border-[rgba(34,48,52,0.36)] ring-2 ring-[rgba(20, 169, 155,0.18)]' : 'border-white/80 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`${t('borderColor')} ${color}`}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
                <span>{t('borderWidth')}</span>
                <span>{decorations.borderWidth}px</span>
              </div>
              <input
                type="range"
                aria-label={t('borderWidth')}
                aria-valuetext={`${decorations.borderWidth}px`}
                min="2"
                max="16"
                value={decorations.borderWidth}
                onChange={(event) => decorations.onBorderWidthChange(Number(event.target.value))}
                className="app-range"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
