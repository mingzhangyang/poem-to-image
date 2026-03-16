import { Plus, Stamp, Trash2 } from 'lucide-react';
import type { BorderStyle, DecorationsSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface DecorationsPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['decorations'];
  onToggle: () => void;
  decorations: DecorationsSectionProps;
}

export function DecorationsPanel({ t, expanded, onToggle, decorations }: DecorationsPanelProps) {
  return (
    <ControlSection
      title={t('decorations')}
      icon={<Stamp className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      action={
        <button
          onClick={decorations.onAddCustomText}
          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1 text-xs font-medium"
          title={t('addTextBox')}
        >
          <Plus className="w-3 h-3" /> {t('addTextBox')}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input
                type="checkbox"
                checked={decorations.showBorder}
                onChange={(event) => decorations.onShowBorderChange(event.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              {t('showBorder')}
            </label>
            {decorations.showBorder ? (
              <select
                value={decorations.borderStyle}
                onChange={(event) => decorations.onBorderStyleChange(event.target.value as BorderStyle)}
                className="p-1 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500"
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
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              {t('showStamp')}
            </label>
            {decorations.showStamp ? (
              <input
                type="text"
                value={decorations.stampText}
                onChange={(event) => decorations.onStampTextChange(event.target.value.slice(0, 2))}
                maxLength={2}
                className="w-16 p-1 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-center"
                placeholder={t('stampText')}
              />
            ) : null}
          </div>
        </div>

        {decorations.customTexts.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTexts')}</div>
            {decorations.customTexts.map((customText) => (
              <div key={customText.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customText.text}
                    onChange={(event) => decorations.onCustomTextChange(customText.id, { text: event.target.value })}
                    className="flex-1 p-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('textContent')}
                  />
                  <button
                    onClick={() => decorations.onCustomTextRemove(customText.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
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
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="text-xs text-gray-500 w-8">{customText.fontSize}px</span>
                </div>
                <div className="flex gap-1 bg-white p-1 rounded border border-gray-200">
                  <button
                    onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'horizontal-tb' })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      customText.writingMode === 'horizontal-tb' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t('horiz')}
                  </button>
                  <button
                    onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'vertical-rl' })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      customText.writingMode === 'vertical-rl' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
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
                    className="flex-1 accent-indigo-600"
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