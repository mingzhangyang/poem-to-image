import { Download } from 'lucide-react';
import type { TranslateFn } from '../../types';

interface SidebarFooterProps {
  t: TranslateFn;
  onDownload: () => void;
}

export function SidebarFooter({ t, onDownload }: SidebarFooterProps) {
  return (
    <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">
      <button
        onClick={onDownload}
        className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
      >
        <Download className="w-5 h-5" /> {t('exportImage')}
      </button>
    </div>
  );
}