import { CheckCircle2, Download, Loader2, Share2 } from 'lucide-react';
import type { ExportFormat, ExportScale, SocialPlatform, TranslateFn } from '../../types';

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
  actionMode?: 'both' | 'save' | 'share';
  surface?: 'sidebar' | 'modal';
  showSocialActions?: boolean;
  onShareToSocial?: (platform: SocialPlatform) => void | Promise<void>;
  activeSocialPlatform?: SocialPlatform | null;
  socialFeedback?: 'clipboard' | 'downloaded' | null;
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

const socialPlatforms: Array<{
  id: SocialPlatform;
  label: string;
  color: string;
  bg: string;
  symbol: string;
}> = [
  { id: 'wechat', label: 'WeChat', color: '#fff', bg: '#07C160', symbol: 'W' },
  { id: 'weibo', label: 'Weibo', color: '#fff', bg: '#E6162D', symbol: 'We' },
  { id: 'xiaohongshu', label: 'Xiaohongshu', color: '#fff', bg: '#FF2442', symbol: 'XHS' },
  { id: 'twitter', label: 'X', color: '#fff', bg: '#000000', symbol: 'X' },
  { id: 'instagram', label: 'Instagram', color: '#fff', bg: '#C13584', symbol: 'In' },
  { id: 'facebook', label: 'Facebook', color: '#fff', bg: '#1877F2', symbol: 'f' },
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
  actionMode = 'both',
  surface = 'sidebar',
  showSocialActions = false,
  onShareToSocial,
  activeSocialPlatform = null,
  socialFeedback = null,
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--app-accent-500)">{title}</p>
          <p className="mt-2 text-sm text-(--app-accent-700)">{getExportSummaryLabel(t, canvasWidth, canvasHeight, exportFormat, exportScale)}</p>
        </div>
      ) : null}

      {showSocialActions && onShareToSocial ? (
        <div className="mb-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--app-accent-500)">{t('shareToSocialTitle')}</p>
          <div className="grid grid-cols-3 gap-2">
            {socialPlatforms.map((platform) => {
              const isActive = activeSocialPlatform === platform.id;

              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => void onShareToSocial(platform.id)}
                  disabled={isBusy}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-[rgba(34,48,52,0.08)] bg-white/70 px-2 py-3 text-center transition-all hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: platform.bg, color: platform.color }}
                  >
                    {isActive ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : platform.symbol}
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-(--app-accent-800)">{platform.label}</span>
                </button>
              );
            })}
          </div>

          {socialFeedback ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-(--app-accent-50) px-3 py-2.5 text-xs text-(--app-accent-800)">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-(--app-accent-600)" />
              <span>{socialFeedback === 'clipboard' ? t('shareImageCopiedHint') : t('shareImageDownloadedHint')}</span>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[rgba(34,48,52,0.08)]" />
            <span className="text-[11px] text-[rgba(34,48,52,0.4)]">{t('shareSystemDivider')}</span>
            <div className="h-px flex-1 bg-[rgba(34,48,52,0.08)]" />
          </div>
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

          {!canShare && shouldShowShareAction ? (
            <p className="text-xs leading-5 text-(--app-accent-500)">{t('shareUnavailableHint')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
