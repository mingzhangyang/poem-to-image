import { Sparkles } from 'lucide-react';
import type { Language } from '../../translations';
import type { TranslateFn } from '../../types';
import { useAppAuth } from '../../context/auth';

interface SidebarHeaderProps {
  language: Language;
  onLanguageChange: (value: Language) => void;
  t: TranslateFn;
  isSheet?: boolean;
  balance?: number | null;
}

export function SidebarHeader({ language, onLanguageChange, t, isSheet = false, balance }: SidebarHeaderProps) {
  const { isSignedIn } = useAppAuth();

  return (
    <div className={`${isSheet ? 'px-4 py-4' : 'px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:p-6'} border-b border-gray-100 flex items-start justify-between gap-3`}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-indigo-900">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          <span className="truncate">{t('appTitle')}</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        {isSignedIn && balance !== null && balance !== undefined && (
          <p className="text-xs text-indigo-600 mt-0.5 font-medium">
            {balance} {t('credits')}
          </p>
        )}
      </div>
      <select
        value={language}
        onChange={(event) => onLanguageChange(event.target.value as Language)}
        className="shrink-0 text-xs border border-gray-200 rounded-md text-gray-600 p-1 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
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
