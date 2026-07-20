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
}> = [
  { id: 'wechat', label: 'WeChat', color: '#fff', bg: '#07C160' },
  { id: 'weibo', label: 'Weibo', color: '#fff', bg: '#E6162D' },
  { id: 'xiaohongshu', label: 'Xiaohongshu', color: '#fff', bg: '#FF2442' },
  { id: 'twitter', label: 'X', color: '#fff', bg: '#000000' },
  { id: 'instagram', label: 'Instagram', color: '#fff', bg: '#C13584' },
  { id: 'facebook', label: 'Facebook', color: '#fff', bg: '#1877F2' },
];

function PlatformIcon({ id }: { id: SocialPlatform }) {
  const cls = 'h-[18px] w-[18px]';
  if (id === 'wechat') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.5 5C7.01 5 5 6.79 5 9s2.01 4 4.5 4c.45 0 .88-.06 1.28-.17L12.5 14l-.72-2.16C12.55 11.15 13 10.12 13 9c0-2.21-2.01-4-4.5-4zm-1.75 3a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm3.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm3.25 1c0 .44-.08.86-.22 1.26L15 12.5l1.72-.57c.43.11.88.17 1.33.17C20.34 12.1 22 10.7 22 9s-1.66-3.1-4.05-3.1C15.66 5.9 14 7.3 14 9c0 0 0 .01 0 0zm-.25-.75a.625.625 0 1 1 0 1.25.625.625 0 0 1 0-1.25zm2.5 0a.625.625 0 1 1 0 1.25.625.625 0 0 1 0-1.25zM4 15c0 2.76 3.13 5 7 5s7-2.24 7-5-3.13-5-7-5-7 2.24-7 5zm5-1c1.1 0 2 .45 2 1s-.9 1-2 1-2-.45-2-1 .9-1 2-1zm4 1.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z" />
    </svg>
  );
  if (id === 'weibo') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.5 13.5c-2.76 0-5 1.12-5 2.5s2.24 2.5 5 2.5 5-1.12 5-2.5-2.24-2.5-5-2.5zm-2 1.5c.83 0 1.5.45 1.5 1s-.67 1-1.5 1S7 16.55 7 16s.67-1 1.5-1zm3.5.75a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1zM10 8c-3.87 0-7 2.69-7 6 0 1.88.97 3.56 2.5 4.68l-.5 1.82 2.3-.5C8.1 20.32 9.02 20.5 10 20.5c3.87 0 7-2.69 7-6S13.87 8 10 8zm7-1.5a.5.5 0 0 0 0 1c1.38 0 2.5 1.12 2.5 2.5a.5.5 0 0 0 1 0C20.5 8.12 19.19 6.5 17 6.5zm.5-3a.5.5 0 0 0 0 1C20.54 4.5 23 6.96 23 10a.5.5 0 0 0 1 0c0-3.59-2.91-6.5-6.5-6.5z" />
    </svg>
  );
  if (id === 'xiaohongshu') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-6 3h2v3h3v2h-3v3h-2v-3H9v-2h4V6z" />
    </svg>
  );
  if (id === 'twitter') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
  if (id === 'instagram') return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
  if (id === 'facebook') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
  return null;
}

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--app-accent-600)">{title}</p>
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
                    ) : <PlatformIcon id={platform.id} />}
                  </span>
                  <span className="text-xs font-medium leading-tight text-(--app-accent-800)">{platform.label}</span>
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
            <span className="text-xs text-(--app-accent-600)">{t('shareSystemDivider')}</span>
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

      {surface === 'modal' ? (
        <div className="mb-4 rounded-xl border border-[rgba(34,48,52,0.08)] bg-white/70 px-3 py-2.5" aria-live="polite">
          <p className="text-xs font-semibold text-(--app-accent-800)">{getExportSummaryLabel(t, canvasWidth, canvasHeight, exportFormat, exportScale)}</p>
          <p className="mt-1 text-xs text-(--app-accent-600)">poem-image.{exportFormat}</p>
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

          {!canShare && shouldShowShareAction ? (
            <p className="text-xs leading-5 text-(--app-accent-500)">{t('shareUnavailableHint')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
