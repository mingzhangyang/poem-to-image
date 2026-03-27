import { Maximize } from 'lucide-react';
import { CANVAS_SIZE_PRESETS, getCanvasSizePresetById } from '../../canvasPresets';
import type { CanvasSizeSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface CanvasSizePanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['canvasSize'];
  onToggle: () => void;
  canvas: CanvasSizeSectionProps;
}

const LEGACY_PRESET_LABELS: Record<string, string> = {
  '1080x1080': 'Square 1:1',
  '1080x1350': 'Portrait 4:5',
  '1440x1080': 'Landscape 4:3',
  '1080x1920': 'Story 9:16',
  '1920x1080': 'Landscape 16:9',
  '1240x1754': 'A4 Print',
};

const PRESET_GROUPS = [
  { id: 'xiaohongshu', label: 'Xiaohongshu' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'wechat', label: 'WeChat' },
  { id: 'print', label: 'Print' },
  { id: 'general', label: 'General' },
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
  const activePreset = getCanvasSizePresetById(canvas.presetSize);
  const presetLabel = canvas.presetSize === 'custom'
    ? t('customSize')
    : activePreset?.sceneLabel
      ?? LEGACY_PRESET_LABELS[canvas.presetSize]
      ?? canvas.presetSize;
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
          <label className="block text-xs text-gray-500 mb-1">Quick platform presets</label>
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
                      : 'border-[rgba(34,48,52,0.12)] bg-white text-gray-700 hover:border-(--app-accent-300)'
                  }`}
                >
                  {preset.sceneLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('presetSizes')}</label>
          <select
            value={canvas.presetSize}
            onChange={(event) => canvas.onPresetChange(event.target.value)}
            className="app-select text-sm"
          >
            {PRESET_GROUPS.map((group) => {
              const groupedPresets = CANVAS_SIZE_PRESETS.filter((preset) => preset.platform === group.id);

              return (
                <optgroup key={group.id} label={group.label}>
                  {groupedPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {`${preset.sceneLabel} (${getRatioLabel(preset.width, preset.height)} · ${preset.width}x${preset.height})`}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {Object.entries(LEGACY_PRESET_LABELS).map(([presetId, label]) => (
              <option key={presetId} value={presetId}>
                {`${label} (${presetId})`}
              </option>
            ))}
            <option value="custom">{t('customSize')}</option>
          </select>
        </div>

        {canvas.presetSize === 'custom' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('width')} (px)</label>
              <input
                type="number"
                min="100"
                max="4000"
                value={canvas.canvasWidth}
                onChange={(event) => canvas.onCanvasWidthChange(Number(event.target.value))}
                className="app-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('height')} (px)</label>
              <input
                type="number"
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
