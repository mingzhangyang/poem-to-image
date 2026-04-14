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
    <div className={`${isSheet ? 'px-4 py-4' : 'px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:p-6'} border-b border-[rgba(34,48,52,0.06)] flex items-start justify-between gap-3 bg-[linear-gradient(180deg,rgba(255,250,242,0.92),rgba(255,253,249,0.4))]`}>
      <div className="min-w-0">
        <h1
          className="text-xl sm:text-2xl font-semibold flex items-center gap-2 text-(--app-accent-900)"
          style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif SC', Georgia, serif" }}
        >
          <Logo className="w-7 h-7" />
          <span className="truncate">{t('appTitle')}</span>
        </h1>
        <p
          className="text-sm text-(--app-accent-500) mt-1"
          style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif SC', Georgia, serif" }}
        >
          {t('subtitle')}
        </p>
        {isSignedIn && balance !== null && balance !== undefined && (
          <p className="text-xs text-(--app-accent-600) mt-0.5 font-medium">
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
              ? 'border-(--app-accent-200) bg-(--app-accent-50) text-(--app-accent-600)'
              : 'border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.8)] text-(--app-accent-500) hover:bg-(--app-accent-50) hover:text-(--app-accent-700)'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
