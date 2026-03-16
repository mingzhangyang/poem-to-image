import { Sparkles } from 'lucide-react';
import type { Language } from '../../translations';
import type { TranslateFn } from '../../types';

interface SidebarHeaderProps {
  language: Language;
  onLanguageChange: (value: Language) => void;
  t: TranslateFn;
}

export function SidebarHeader({ language, onLanguageChange, t }: SidebarHeaderProps) {
  return (
    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-900">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          {t('appTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      </div>
      <select
        value={language}
        onChange={(event) => onLanguageChange(event.target.value as Language)}
        className="text-xs border border-gray-200 rounded-md text-gray-600 p-1 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <option value="en">EN</option>
        <option value="zh-CN">简</option>
        <option value="zh-TW">繁</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
        <option value="es">ES</option>
        <option value="fr">FR</option>
        <option value="de">DE</option>
      </select>
    </div>
  );
}