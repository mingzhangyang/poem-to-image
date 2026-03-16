import { Download, Loader2, Share2 } from 'lucide-react';
import type { ExportFormat, ExportScale, TranslateFn } from '../../types';

const exportFormatLabelKeys = {
  png: 'exportFormatPng',
  jpg: 'exportFormatJpg',
  webp: 'exportFormatWebp',
} as const;

interface SidebarFooterProps {
  t: TranslateFn;
  canvasWidth: number;
  canvasHeight: number;
  exportFormat: ExportFormat;
  onExportFormatChange: (value: ExportFormat) => void;
  exportScale: ExportScale;
  onExportScaleChange: (value: ExportScale) => void;
  onDownload: () => void;
  onShare: () => void;
  isExporting: boolean;
  isSharing: boolean;
  canShare: boolean;
  showActionButtons?: boolean;
  title?: string;
}

const exportFormatOptions: Array<{ value: ExportFormat; labelKey: 'exportFormatPng' | 'exportFormatJpg' | 'exportFormatWebp' }> = [
  { value: 'png', labelKey: 'exportFormatPng' },
  { value: 'jpg', labelKey: 'exportFormatJpg' },
  { value: 'webp', labelKey: 'exportFormatWebp' },
];

const exportScaleOptions: Array<{ value: ExportScale; labelKey: 'exportQualityStandard' | 'exportQualityHd' | 'exportQualityUltraHd' }> = [
  { value: 1, labelKey: 'exportQualityStandard' },
  { value: 2, labelKey: 'exportQualityHd' },
  { value: 3, labelKey: 'exportQualityUltraHd' },
];

function getExportDimensionsLabel(canvasWidth: number, canvasHeight: number, scale: ExportScale) {
  return `${canvasWidth * scale} x ${canvasHeight * scale} px`;
}

function getExportSummaryLabel(t: TranslateFn, canvasWidth: number, canvasHeight: number, format: ExportFormat, scale: ExportScale) {
  return `${t(exportFormatLabelKeys[format])} · ${getExportDimensionsLabel(canvasWidth, canvasHeight, scale)}`;
}

export function SidebarFooter({
  t,
  canvasWidth,
  canvasHeight,
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  onDownload,
  onShare,
  isExporting,
  isSharing,
  canShare,
  showActionButtons = true,
  title,
}: SidebarFooterProps) {
  const isBusy = isExporting || isSharing;

  return (
    <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 border-t border-[rgba(34,48,52,0.06)] bg-[linear-gradient(180deg,rgba(255,253,249,0.86),rgba(255,250,242,0.96))] md:sticky md:bottom-0">
      {title ? (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--app-accent-500)">{title}</p>
          <p className="mt-2 text-sm text-gray-600">{getExportSummaryLabel(t, canvasWidth, canvasHeight, exportFormat, exportScale)}</p>
        </div>
      ) : null}

      <label className="block mb-3">
        <span className="block text-sm font-medium text-gray-700 mb-2">{t('exportFormat')}</span>
        <select
          value={exportFormat}
          onChange={(event) => onExportFormatChange(event.target.value as ExportFormat)}
          disabled={isBusy}
          className="app-select text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exportFormatOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <label className="block mb-3">
        <span className="block text-sm font-medium text-gray-700 mb-2">{t('exportQuality')}</span>
        <select
          value={exportScale}
          onChange={(event) => onExportScaleChange(Number(event.target.value) as ExportScale)}
          disabled={isBusy}
          className="app-select text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exportScaleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {`${t(option.labelKey)} - ${getExportDimensionsLabel(canvasWidth, canvasHeight, option.value)}`}
            </option>
          ))}
        </select>
      </label>

      {showActionButtons ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onDownload}
            disabled={isBusy}
            className="app-button-primary w-full py-3 px-4 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('exportingImage')}
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                {t('exportImage')}
              </>
            )}
          </button>

          <button
            onClick={onShare}
            disabled={isBusy || !canShare}
            className="app-button-secondary w-full py-3 px-4 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('sharingImage')}
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                {t('shareImage')}
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
