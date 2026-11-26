import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Text, TextCursorInput, Trash2 } from 'lucide-react';
import { getAllFontOptions } from '../../fontOptions';
import type { DecorationsSectionProps, TranslateFn } from '../../types';

interface CustomTextListProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Controls for each custom text box on the card. */
export function CustomTextList({ t, decorations }: CustomTextListProps) {
  if (decorations.customTexts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-(--app-accent-500) uppercase tracking-wider">{t('customTexts')}</div>
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
            aria-label={t('deleteTemplate')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          </div>
          <div>
            <label className="block text-xs text-(--app-accent-500) mb-1">{t('fontFamily')}</label>
            <select className="app-select text-sm"
              aria-label={t('fontFamily') + ' · ' + customText.text}
              value={customText.fontFamily ?? ''}
              onChange={(event) => decorations.onCustomTextChange(customText.id, {
                fontFamily: event.target.value || undefined,
              })}>
              <option value="">{t('fontUseCard')}</option>
              {getAllFontOptions().map((font) => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t('textColor')}
              value={customText.color}
              onChange={(event) => decorations.onCustomTextChange(customText.id, { color: event.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0"
            />
            <input
              type="range"
              aria-label={t('fontSize')}
              aria-valuetext={`${customText.fontSize}px`}
              min="12"
              max="120"
              value={customText.fontSize}
              onChange={(event) => decorations.onCustomTextChange(customText.id, { fontSize: Number(event.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8">{customText.fontSize}px</span>
          </div>
          <div className="app-segment flex gap-1 p-1 rounded">
            <button
              type="button"
              onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'horizontal-tb' })}
              className={`flex-1 py-1 flex justify-center items-center rounded transition-colors ${
                customText.writingMode === 'horizontal-tb' ? 'app-segment-button-active' : 'text-(--app-accent-500) hover:bg-(--app-accent-50)'
              }`}
              aria-label={t('horizontal')}
              aria-pressed={customText.writingMode === 'horizontal-tb'}
            >
              <Text className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'vertical-rl' })}
              className={`flex-1 py-1 flex justify-center items-center rounded transition-colors ${
                customText.writingMode === 'vertical-rl' ? 'app-segment-button-active' : 'text-(--app-accent-500) hover:bg-(--app-accent-50)'
              }`}
              aria-label={t('vertical')}
              aria-pressed={customText.writingMode === 'vertical-rl'}
            >
              <TextCursorInput className="w-4 h-4 rotate-90" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-8">{t('angle')}</span>
            <input
              type="range"
              aria-label={t('angle')}
              aria-valuetext={`${customText.rotation}°`}
              min="-180"
              max="180"
              value={customText.rotation}
              onChange={(event) => decorations.onCustomTextChange(customText.id, { rotation: Number(event.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{customText.rotation}°</span>
          </div>
          <div className="flex items-center justify-between border-t border-[rgba(34,48,52,0.06)] pt-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider text-[rgba(34,48,52,0.4)] font-semibold">{t('layers')}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => decorations.onCustomTextReorder(customText.id, 'bottom')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('sendToBack')}
                aria-label={t('sendToBack')}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => decorations.onCustomTextReorder(customText.id, 'down')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('moveDown')}
                aria-label={t('moveDown')}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => decorations.onCustomTextReorder(customText.id, 'up')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('moveUp')}
                aria-label={t('moveUp')}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => decorations.onCustomTextReorder(customText.id, 'top')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('bringToFront')}
                aria-label={t('bringToFront')}
              >
                <ArrowUpToLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
