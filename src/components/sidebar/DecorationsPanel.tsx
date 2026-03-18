import { Plus, Stamp, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STAMP_FONT_OPTIONS } from '../../fontOptions';
import type { BorderStyle, DecorationsSectionProps, ExpandedSections, StampStyle, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

const BORDER_STYLE_LABELS: Record<BorderStyle, 'borderSolid' | 'borderDashed' | 'borderDouble' | 'borderBrush' | 'borderInk'> = {
  solid: 'borderSolid',
  dashed: 'borderDashed',
  double: 'borderDouble',
  brush: 'borderBrush',
  ink: 'borderInk',
};

const BORDER_COLOR_PRESETS = ['#223034', '#406967', '#7d4d32', '#111827', '#5b4636', '#8b1e3f', '#7c2d12', '#1d4ed8'];

interface DecorationsPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['decorations'];
  onToggle: () => void;
  decorations: DecorationsSectionProps;
}

export function DecorationsPanel({ t, expanded, onToggle, decorations }: DecorationsPanelProps) {
  const isComposingRef = useRef(false);
  const [stampInputText, setStampInputText] = useState(decorations.stamp.text);

  useEffect(() => {
    if (!isComposingRef.current) {
      setStampInputText(decorations.stamp.text);
    }
  }, [decorations.stamp.text]);

  const summaryParts = [
    decorations.showBorder ? t(BORDER_STYLE_LABELS[decorations.borderStyle]) : null,
    decorations.showStamp ? t('showStamp') : null,
    `${decorations.customTexts.length} ${t('customTexts')}`,
    `${decorations.logos.length} ${t('logos')}`,
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[linear-gradient(180deg,rgba(237,244,243,0.42),rgba(255,253,249,0.82))] p-2">
          <button
            type="button"
            onClick={decorations.onAddCustomText}
            className="app-action-button"
            title={t('addTextBox')}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t('addTextShort')}</span>
          </button>

          <label
            className="app-action-button cursor-pointer"
            title={t('uploadLogo')}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t('imageShort')}</span>
            <input
              type="file"
              accept="image/*"
              onChange={decorations.onLogoUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="app-soft-surface p-3 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <label className="text-xs text-gray-600 flex items-center gap-2">
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
                <label className="mb-1 block text-xs text-gray-500">{t('borderStyle')}</label>
                <select
                  value={decorations.borderStyle}
                  onChange={(event) => decorations.onBorderStyleChange(event.target.value as BorderStyle)}
                  className="app-select text-sm"
                >
                  <option value="solid">{t('borderSolid')}</option>
                  <option value="dashed">{t('borderDashed')}</option>
                  <option value="double">{t('borderDouble')}</option>
                  <option value="brush">{t('borderBrush')}</option>
                  <option value="ink">{t('borderInk')}</option>
                </select>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">{t('borderColor')}</label>
                  <div className="flex w-full items-center gap-3 rounded-xl border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.96)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    <input
                      type="color"
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
                          className={`h-6 w-6 rounded-full border transition-transform ${isActive ? 'scale-110 border-[rgba(34,48,52,0.36)] ring-2 ring-[rgba(84,127,125,0.18)]' : 'border-white/80 hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                          aria-label={`${t('borderColor')} ${color}`}
                          title={color}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{t('borderWidth')}</span>
                    <span>{decorations.borderWidth}px</span>
                  </div>
                  <input
                    type="range"
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
                  value={stampInputText}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    setStampInputText(newValue);
                    if (!isComposingRef.current) {
                      decorations.onStampChange({ text: newValue.slice(0, 4) });
                    }
                  }}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={(event) => {
                    isComposingRef.current = false;
                    const finalValue = (event.target as HTMLInputElement).value.slice(0, 4);
                    setStampInputText(finalValue);
                    decorations.onStampChange({ text: finalValue });
                  }}
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

              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('stampColorScheme')}</label>
                <div className="app-segment flex gap-1 p-1 rounded">
                  <button
                    type="button"
                    onClick={() => decorations.onStampChange({ colorScheme: 'outline' })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      (decorations.stamp.colorScheme ?? 'filled') === 'outline' ? 'app-segment-button-active' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t('stampColorOutline')}
                  </button>
                  <button
                    type="button"
                    onClick={() => decorations.onStampChange({ colorScheme: 'filled' })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      decorations.stamp.colorScheme === 'filled' ? 'app-segment-button-active' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t('stampColorFilled')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('stampFont')}</label>
                <select
                  value={decorations.stamp.fontFamily}
                  onChange={(event) => decorations.onStampChange({ fontFamily: event.target.value })}
                  className="app-select text-sm"
                >
                  {STAMP_FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                      {font.label}
                    </option>
                  ))}
                </select>
                {STAMP_FONT_OPTIONS.find((f) => f.value === decorations.stamp.fontFamily)?.cjkOnly &&
                  /[a-zA-Z]/.test(decorations.stamp.text) && (
                  <p className="mt-1 text-xs text-amber-600">{t('stampFontCjkWarning')}</p>
                )}
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
                    className={`flex-1 py-1 flex justify-center items-center rounded transition-colors ${
                      customText.writingMode === 'horizontal-tb' ? 'app-segment-button-active' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    aria-label={t('horizontal')}
                  >
                    <Text className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => decorations.onCustomTextChange(customText.id, { writingMode: 'vertical-rl' })}
                    className={`flex-1 py-1 flex justify-center items-center rounded transition-colors ${
                      customText.writingMode === 'vertical-rl' ? 'app-segment-button-active' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    aria-label={t('vertical')}
                  >
                    <TextCursorInput className="w-4 h-4 rotate-90" />
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

        {decorations.logos.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('logos')}</div>
            {decorations.logos.map((logo) => (
              <div key={logo.id} className="app-soft-surface p-3 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={logo.imageUrl}
                    alt="Logo"
                    className="w-8 h-8 object-contain rounded"
                  />
                  <span className="text-xs text-gray-500 flex-1 truncate">Logo {logo.id.slice(-4)}</span>
                  <button
                    onClick={() => decorations.onLogoRemove(logo.id)}
                    className="p-1.5 text-[#8a523b] hover:bg-[rgba(155,95,67,0.12)] rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8">{t('size')}</span>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    value={logo.size}
                    onChange={(event) => decorations.onLogoChange(logo.id, { size: Number(event.target.value) })}
                    className="app-range flex-1"
                  />
                  <span className="text-xs text-gray-500 w-8">{logo.size}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8">{t('angle')}</span>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={logo.rotation}
                    onChange={(event) => decorations.onLogoChange(logo.id, { rotation: Number(event.target.value) })}
                    className="app-range flex-1"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{logo.rotation}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8">{t('opacity')}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(logo.opacity * 100)}
                    onChange={(event) => decorations.onLogoChange(logo.id, { opacity: Number(event.target.value) / 100 })}
                    className="app-range flex-1"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{Math.round(logo.opacity * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </ControlSection>
  );
}