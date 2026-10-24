import { Maximize } from 'lucide-react';
import { CANVAS_SIZE_PRESETS, getCanvasSizePresetById } from '../../canvasPresets';
import type { CanvasSizeSectionProps, ExpandedSections, TranslateFn } from '../../types';
import type { TranslationKey } from '../../translations';
import { ControlSection } from '../ControlSection';

interface CanvasSizePanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['canvasSize'];
  onToggle: () => void;
  canvas: CanvasSizeSectionProps;
}

const PRESET_LABEL_KEYS: Record<string, TranslationKey> = {
  'xiaohongshu-cover': 'canvasPresetXiaohongshuCover',
  'xiaohongshu-square': 'canvasPresetXiaohongshuSquare',
  'instagram-portrait': 'canvasPresetInstagramPortrait',
  'instagram-story': 'canvasPresetInstagramStory',
  'wechat-moments-long': 'canvasPresetWechatLong',
  'print-card': 'canvasPresetPrintCard',
  'classic-4x3': 'canvasPresetLandscape4x3',
  'classic-16x9': 'canvasPresetLandscape16x9',
};

const LEGACY_PRESET_LABEL_KEYS: Record<string, TranslationKey> = {
  '1080x1080': 'canvasLegacySquare',
  '1080x1350': 'canvasLegacyPortrait',
  '1440x1080': 'canvasLegacyLandscape4x3',
  '1080x1920': 'canvasLegacyStory',
  '1920x1080': 'canvasLegacyLandscape16x9',
  '1240x1754': 'canvasLegacyPrintA4',
};

const PRESET_GROUPS = [
  { id: 'xiaohongshu', label: 'Xiaohongshu' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'wechat', label: 'WeChat' },
  { id: 'print', labelKey: 'canvasGroupPrint' },
  { id: 'general', labelKey: 'canvasGroupGeneral' },
] as const;

const QUICK_PRESET_IDS = [
  'xiaohongshu-cover',
  'xiaohongshu-square',
  'instagram-story',
  'wechat-moments-long',
  'print-card',
] as const;

function getRatioLabel(width: number, height: number) {
  const gcd = (left: number, right: number): number => (right === 0 ? left : gcd(right, left % right));
  const factor = gcd(width, height);
  return `${width / factor}:${height / factor}`;
}

export function CanvasSizePanel({ t, expanded, onToggle, canvas }: CanvasSizePanelProps) {
  const presetName = (id: string) => {
    const key = PRESET_LABEL_KEYS[id] ?? LEGACY_PRESET_LABEL_KEYS[id];
    return key ? t(key) : id;
  };
  const presetLabel = canvas.presetSize === 'custom' ? t('customSize') : presetName(canvas.presetSize);
  const summary = `${presetLabel} · ${canvas.canvasWidth}×${canvas.canvasHeight}`;

  return (
    <ControlSection
      title={t('canvasSize')}
      icon={<Maximize className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      summary={summary}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-(--app-accent-500) mb-1">{t('canvasQuickPresets')}</label>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESET_IDS.map((presetId) => {
              const preset = getCanvasSizePresetById(presetId);

              if (!preset) {
                return null;
              }

              const isActive = canvas.presetSize === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => canvas.onPresetChange(preset.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? 'border-(--app-accent-500) bg-(--app-accent-50) text-(--app-accent-700)'
                      : 'border-[rgba(34,48,52,0.12)] bg-white text-(--app-accent-800) hover:border-(--app-accent-300)'
                  }`}
                >
                  {presetName(preset.id)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-(--app-accent-500) mb-1">{t('presetSizes')}</label>
          <select
            aria-label={t('presetSizes')}
            value={canvas.presetSize}
            onChange={(event) => canvas.onPresetChange(event.target.value)}
            className="app-select text-sm"
          >
            {PRESET_GROUPS.map((group) => {
              const groupedPresets = CANVAS_SIZE_PRESETS.filter((preset) => preset.platform === group.id);

              return (
                <optgroup key={group.id} label={'labelKey' in group ? t(group.labelKey) : group.label}>
                  {groupedPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {`${presetName(preset.id)} (${getRatioLabel(preset.width, preset.height)} · ${preset.width}x${preset.height})`}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {Object.keys(LEGACY_PRESET_LABEL_KEYS).map((presetId) => (
              <option key={presetId} value={presetId}>
                {`${presetName(presetId)} (${presetId})`}
              </option>
            ))}
            <option value="custom">{t('customSize')}</option>
          </select>
        </div>

        {canvas.presetSize === 'custom' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-(--app-accent-500) mb-1">{t('width')} (px)</label>
              <input
                type="number"
                aria-label={`${t('width')} (px)`}
                min="100"
                max="4000"
                value={canvas.canvasWidth}
                onChange={(event) => canvas.onCanvasWidthChange(Number(event.target.value))}
                className="app-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-(--app-accent-500) mb-1">{t('height')} (px)</label>
              <input
                type="number"
                aria-label={`${t('height')} (px)`}
                min="100"
                max="4000"
                value={canvas.canvasHeight}
                onChange={(event) => canvas.onCanvasHeightChange(Number(event.target.value))}
                className="app-input text-sm"
              />
            </div>
          </div>
        ) : null}
      </div>
    </ControlSection>
  );
}
