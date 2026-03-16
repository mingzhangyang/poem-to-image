import { Settings } from 'lucide-react';
import type { TranslateFn } from '../../types';
import { useAppAuth } from '../../context/auth';
import { Logo } from '../logo';

interface SidebarHeaderProps {
  t: TranslateFn;
  isSheet?: boolean;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
  balance?: number | null;
}

export function SidebarHeader({ t, isSheet = false, isSettingsOpen = false, onSettingsToggle, balance }: SidebarHeaderProps) {
  const { isSignedIn } = useAppAuth();

  return (
    <div className={`${isSheet ? 'px-4 py-4' : 'px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:p-6'} border-b border-gray-100 flex items-start justify-between gap-3`}>
      <div className="min-w-0">
        <h1
          className="text-xl sm:text-2xl font-semibold flex items-center gap-2 text-indigo-900"
          style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif SC', Georgia, serif" }}
        >
          <Logo className="w-7 h-7" />
          <span className="truncate">{t('appTitle')}</span>
        </h1>
        <p
          className="text-sm text-gray-500 mt-1"
          style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif SC', Georgia, serif" }}
        >
          {t('subtitle')}
        </p>
        {isSignedIn && balance !== null && balance !== undefined && (
          <p className="text-xs text-indigo-600 mt-0.5 font-medium">
            {balance} {t('credits')}
          </p>
        )}
      </div>

      {/* Gear icon — desktop sidebar only (not in mobile drawer) */}
      {!isSheet && onSettingsToggle && (
        <button
          type="button"
          onClick={onSettingsToggle}
          aria-label={t('settings')}
          className={`shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            isSettingsOpen
              ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
