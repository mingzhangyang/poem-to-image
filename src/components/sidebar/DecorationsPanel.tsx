import { Plus, Stamp, Trash2 } from 'lucide-react';
import type { BorderStyle, DecorationsSectionProps, ExpandedSections, StampStyle, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

const BORDER_STYLE_LABELS: Record<BorderStyle, 'borderSolid' | 'borderDashed' | 'borderDouble'> = {
  solid: 'borderSolid',
  dashed: 'borderDashed',
  double: 'borderDouble',
};

interface DecorationsPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['decorations'];
  onToggle: () => void;
  decorations: DecorationsSectionProps;
}

export function DecorationsPanel({ t, expanded, onToggle, decorations }: DecorationsPanelProps) {
  const summaryParts = [
    decorations.showBorder ? t(BORDER_STYLE_LABELS[decorations.borderStyle]) : null,
    decorations.showStamp ? t('showStamp') : null,
    `${decorations.customTexts.length} ${t('customTexts')}`,
  ].filter(Boolean);

  return (
    <ControlSection
      title={t('decorations')}
      icon={<Stamp className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      summary={summaryParts.join(' · ')}
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={decorations.onAddCustomText}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white"
            style={{
              color: 'var(--app-accent-700)',
              borderColor: 'var(--app-accent-200)',
              backgroundColor: 'var(--app-accent-50)',
            }}
            title={t('addTextBox')}
          >
            <Plus className="w-3 h-3" /> {t('addTextBox')}
          </button>
        </div>

        <div className="app-soft-surface p-3 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input
                type="checkbox"
                checked={decorations.showBorder}
                onChange={(event) => decorations.onShowBorderChange(event.target.checked)}
                className="app-checkbox rounded"
              />
              {t('showBorder')}
            </label>
            {decorations.showBorder ? (
              <select
                value={decorations.borderStyle}
                onChange={(event) => decorations.onBorderStyleChange(event.target.value as BorderStyle)}
                className="app-select p-1 text-xs"
              >
                <option value="solid">{t('borderSolid')}</option>
                <option value="dashed">{t('borderDashed')}</option>
                <option value="double">{t('borderDouble')}</option>
              </select>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input
                type="checkbox"
                checked={decorations.showStamp}
                onChange={(event) => decorations.onShowStampChange(event.target.checked)}
                className="app-checkbox rounded"
              />
              {t('showStamp')}
            </label>
            {decorations.showStamp ? (
              <span className="text-[11px] font-medium rounded-full bg-[rgba(155,95,67,0.12)] px-2 py-1 text-[#8a523b]">{t('dragStampHint')}</span>
            ) : null}
          </div>

          {decorations.showStamp ? (
            <div className="rounded-xl bg-white border border-[rgba(34,48,52,0.08)] p-3 space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <label className="text-xs text-gray-500">{t('stampText')}</label>
                <button
                  type="button"
                  onClick={decorations.onResetStampPosition}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--app-accent-600)' }}
                >
                  {t('resetStampPosition')}
                </button>
                <input
                  type="text"
                  value={decorations.stamp.text}
                  onChange={(event) => decorations.onStampChange({ text: event.target.value.slice(0, 4) })}
                  maxLength={4}
                  className="app-input col-span-2 text-sm text-center"
                  placeholder={t('stampText')}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('stampStyle')}</label>
                <select
                  value={decorations.stamp.style}
                  onChange={(event) => decorations.onStampChange({ style: event.target.value as StampStyle })}
                  className="app-select text-sm"
                >
                  <option value="square">{t('stampStyleSquare')}</option>
                  <option value="round">{t('stampStyleRound')}</option>
                  <option value="brush">{t('stampStyleBrush')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{t('stampSize')}</span>
                  <span>{decorations.stamp.size}px</span>
                </div>
                <input
                  type="range"
                  min="56"
                  max="180"
                  value={decorations.stamp.size}
                  onChange={(event) => decorations.onStampChange({ size: Number(event.target.value) })}
                  className="app-range app-range-warm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{t('stampRotation')}</span>
                  <span>{decorations.stamp.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={decorations.stamp.rotation}
                  onChange={(event) => decorations.onStampChange({ rotation: Number(event.target.value) })}
                  className="app-range app-range-warm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{t('stampOpacity')}</span>
                  <span>{Math.round(decorations.stamp.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="100"
                  value={Math.round(decorations.stamp.opacity * 100)}
                  onChange={(event) => decorations.onStampChange({ opacity: Number(event.target.value) / 100 })}
                  className="app-range app-range-warm"
                />
              </div>
            </div>
          ) : null}
        </div>

        {decorations.customTexts.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTexts')}</div>
            {decorations.customTexts.map((customText) => (
              <div key={customText.id} className="app-soft-surface p-3 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customText.text}
                    onChange={(event) => decorations.onCustomTextChange(customText.id, { text: event.target.value })}
                    className="app-input flex-1 p-1.5 text-sm"
                    placeholder={t('textContent')}
                  />
                  <button
                    onClick={() => decorations.onCustomTextRemove(customText.id)}
                    className="p-1.5 text-[#8a523b] hover:bg-[rgba(155,95,67,0.12)] rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customText.color}
                    onChange={(event) => decorations.onCustomTextChange(customText.id, { color: event.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                  />
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={customText.fontSize}
                    onChange={(event) => decorations.onCustomTextChange(customText.id, { fontSize: Number(event.target.value) })}
                    className="app-range flex-1"
                  />
                  <span className="text-xs text-gray-500 w-8">{customText.fontSize}px</span>
                </div>
                <div className="app-segment flex gap-1 p-1 rounded">
                  <button
                    onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'horizontal-tb' })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      customText.writingMode === 'horizontal-tb' ? 'app-segment-button-active' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t('horiz')}
                  </button>
                  <button
                    onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'vertical-rl' })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      customText.writingMode === 'vertical-rl' ? 'app-segment-button-active' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t('vert')}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8">{t('angle')}</span>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={customText.rotation}
                    onChange={(event) => decorations.onCustomTextChange(customText.id, { rotation: Number(event.target.value) })}
                    className="app-range flex-1"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{customText.rotation}°</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </ControlSection>
  );
}