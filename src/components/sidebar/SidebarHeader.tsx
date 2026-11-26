import type { TranslateFn } from '../../types';
import { useAppAuth } from '../../context/auth';
import { Logo } from '../logo';

interface SidebarHeaderProps {
  t: TranslateFn;
  balance?: number | null;
}

/** App title, subtitle and credits at the top of the mobile Settings sheet. */
export function SidebarHeader({ t, balance }: SidebarHeaderProps) {
  const { isSignedIn } = useAppAuth();

  return (
    <div className="px-4 py-4 border-b border-[rgba(34,48,52,0.06)] flex items-start justify-between gap-3 bg-[linear-gradient(180deg,rgba(255,250,242,0.92),rgba(255,253,249,0.4))]">
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
    </div>
  );
}
