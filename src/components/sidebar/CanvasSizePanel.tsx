import { Maximize } from 'lucide-react';
import type { CanvasSizeSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface CanvasSizePanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['canvasSize'];
  onToggle: () => void;
  canvas: CanvasSizeSectionProps;
}

const PRESET_LABELS: Record<string, string> = {
  '1080x1080': '1:1',
  '1080x1350': '4:5',
  '1440x1080': '4:3',
  '1080x1920': '9:16',
  '1920x1080': '16:9',
  '1240x1754': 'A4',
};

export function CanvasSizePanel({ t, expanded, onToggle, canvas }: CanvasSizePanelProps) {
  const presetLabel = canvas.presetSize === 'custom'
    ? t('customSize')
    : PRESET_LABELS[canvas.presetSize] ?? canvas.presetSize;
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
          <label className="block text-xs text-gray-500 mb-1">{t('presetSizes')}</label>
          <select
            value={canvas.presetSize}
            onChange={(event) => canvas.onPresetChange(event.target.value)}
            className="app-select text-sm"
          >
            <option value="1080x1080">1:1 (1080x1080)</option>
            <option value="1080x1350">4:5 (1080x1350)</option>
            <option value="1440x1080">4:3 (1440x1080)</option>
            <option value="1080x1920">9:16 (1080x1920)</option>
            <option value="1920x1080">16:9 (1920x1080)</option>
            <option value="1240x1754">A4 (1240x1754)</option>
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