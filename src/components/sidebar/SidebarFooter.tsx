import { Download, Loader2 } from 'lucide-react';
import type { ExportScale, TranslateFn } from '../../types';

interface SidebarFooterProps {
  t: TranslateFn;
  exportScale: ExportScale;
  onExportScaleChange: (value: ExportScale) => void;
  onDownload: () => void;
  isExporting: boolean;
}

const exportScaleOptions: Array<{ value: ExportScale; labelKey: 'exportQualityStandard' | 'exportQualityHd' | 'exportQualityUltraHd' }> = [
  { value: 1, labelKey: 'exportQualityStandard' },
  { value: 2, labelKey: 'exportQualityHd' },
  { value: 3, labelKey: 'exportQualityUltraHd' },
];

export function SidebarFooter({ t, exportScale, onExportScaleChange, onDownload, isExporting }: SidebarFooterProps) {
  return (
    <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 border-t border-[rgba(34,48,52,0.06)] bg-[linear-gradient(180deg,rgba(255,253,249,0.86),rgba(255,250,242,0.96))] md:sticky md:bottom-0">
      <label className="block mb-3">
        <span className="block text-sm font-medium text-gray-700 mb-2">{t('exportQuality')}</span>
        <select
          value={exportScale}
          onChange={(event) => onExportScaleChange(Number(event.target.value) as ExportScale)}
          disabled={isExporting}
          className="app-select text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exportScaleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={onDownload}
        disabled={isExporting}
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
    </div>
  );
}
