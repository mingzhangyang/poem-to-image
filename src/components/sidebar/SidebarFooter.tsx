import { Copy, Download, Link2, Loader2, Share2 } from 'lucide-react';
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
  onCopy: () => void;
  onPublishLink: () => void;
  publishLinkLabel: string;
  onManageShares: () => void;
  manageSharesLabel: string;
  isExporting: boolean;
  isSharing: boolean;
  canShare: boolean;
  showActionButtons?: boolean;
  title?: string;
  actionMode?: 'both' | 'save' | 'share';
  surface?: 'sidebar' | 'modal';
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
  onCopy,
  onPublishLink,
  publishLinkLabel,
  onManageShares,
  manageSharesLabel,
  isExporting,
  isSharing,
  canShare,
  showActionButtons = true,
  title,
  actionMode = 'both',
  surface = 'sidebar',
}: SidebarFooterProps) {
  const isBusy = isExporting || isSharing;
  const shouldShowSaveAction = actionMode === 'both' || actionMode === 'save';
  const shouldShowShareAction = actionMode === 'both' || actionMode === 'share';
  const containerClassName = surface === 'modal'
    ? 'p-0'
    : 'px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 border-t border-[rgba(34,48,52,0.06)] bg-[linear-gradient(180deg,rgba(255,253,249,0.86),rgba(255,250,242,0.96))] md:sticky md:bottom-0';
  const actionGridClassName = shouldShowSaveAction && shouldShowShareAction ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3';

  return (
    <div className={containerClassName}>
      {title ? (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--app-accent-600)">{title}</p>
          <p className="mt-2 text-sm text-(--app-accent-700)">{getExportSummaryLabel(t, canvasWidth, canvasHeight, exportFormat, exportScale)}</p>
        </div>
      ) : null}

      <label className="block mb-3">
        <span className="block text-sm font-medium text-(--app-accent-800) mb-2">{t('exportFormat')}</span>
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
        <span className="block text-sm font-medium text-(--app-accent-800) mb-2">{t('exportQuality')}</span>
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

      {surface === 'modal' ? (
        <div className="mb-4 rounded-xl border border-[rgba(34,48,52,0.08)] bg-white/70 px-3 py-2.5" aria-live="polite">
          <p className="text-xs font-semibold text-(--app-accent-800)">{getExportSummaryLabel(t, canvasWidth, canvasHeight, exportFormat, exportScale)}</p>
          <p className="mt-1 text-xs text-(--app-accent-600)">{t('exportFilenameHint')}</p>
        </div>
      ) : null}

      {showActionButtons ? (
        <div className="space-y-2">
          <div className={actionGridClassName}>
          {shouldShowSaveAction ? (
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
                  {t('saveImage')}
                </>
              )}
            </button>
          ) : null}

          {shouldShowShareAction ? (
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
          ) : null}
          </div>
          <button
            type="button"
            onClick={onCopy}
            disabled={isBusy}
            className="app-button-secondary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy className="h-5 w-5" />
            {t('copyImage')}
          </button>

          <button type="button" onClick={onPublishLink} disabled={isBusy}
            className="app-button-secondary flex w-full items-center justify-center gap-2 rounded-xl border border-(--app-accent-200) px-4 py-3 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60">
            <Link2 className="h-5 w-5" />
            {publishLinkLabel}
          </button>
          <button type="button" onClick={onManageShares}
            className="app-button-secondary flex w-full items-center justify-center gap-2 rounded-xl border border-(--app-accent-200) px-4 py-3 font-medium transition-all">
            <Link2 className="h-5 w-5" />
            {manageSharesLabel}
          </button>

          {!canShare && shouldShowShareAction ? (
            <p className="text-xs leading-5 text-(--app-accent-500)">{t('shareUnavailableHint')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
