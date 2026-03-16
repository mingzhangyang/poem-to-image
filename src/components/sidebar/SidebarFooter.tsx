import { Download } from 'lucide-react';
import type { ExportScale, TranslateFn } from '../../types';

interface SidebarFooterProps {
  t: TranslateFn;
  exportScale: ExportScale;
  onExportScaleChange: (value: ExportScale) => void;
  onDownload: () => void;
}

const exportScaleOptions: Array<{ value: ExportScale; labelKey: 'exportQualityStandard' | 'exportQualityHd' | 'exportQualityUltraHd' }> = [
  { value: 1, labelKey: 'exportQualityStandard' },
  { value: 2, labelKey: 'exportQualityHd' },
  { value: 3, labelKey: 'exportQualityUltraHd' },
];

export function SidebarFooter({ t, exportScale, onExportScaleChange, onDownload }: SidebarFooterProps) {
  return (
    <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 border-t border-gray-100 bg-white md:sticky md:bottom-0">
      <label className="block mb-3">
        <span className="block text-sm font-medium text-gray-700 mb-2">{t('exportQuality')}</span>
        <select
          value={exportScale}
          onChange={(event) => onExportScaleChange(Number(event.target.value) as ExportScale)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
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
        className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
      >
        <Download className="w-5 h-5" /> {t('exportImage')}
      </button>
    </div>
  );
}