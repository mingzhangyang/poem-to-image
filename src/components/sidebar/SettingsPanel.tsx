import { ChevronRight, CreditCard, Globe, Info, Loader2, LogIn, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthSignInButton, AuthUserButton } from '../auth/ClerkUi';
import { useAppAuth } from '../../context/auth';
import type { BillingSectionProps, TranslateFn } from '../../types';
import type { Language } from '../../translations';

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
];

interface SettingsPanelProps {
  t: TranslateFn;
  language: Language;
  onLanguageChange: (value: Language) => void;
  billing: BillingSectionProps;
}

function SectionTitle({ icon, label }: { icon: import('react').ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-accent-500)] mb-3">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function SettingsPanel({ t, language, onLanguageChange, billing }: SettingsPanelProps) {
  const { isSignedIn, user } = useAppAuth();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7">

      {/* Language */}
      <section>
        <SectionTitle icon={<Globe className="w-3.5 h-3.5" />} label={t('language')} />
        <div className="grid grid-cols-2 gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => onLanguageChange(lang.value)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                language === lang.value
                  ? 'bg-[var(--app-accent-50)] text-[var(--app-accent-700)] font-medium ring-1 ring-[var(--app-accent-200)]'
                  : 'text-gray-700 hover:bg-[rgba(237,244,243,0.6)]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </section>

      {/* Account — compact status row */}
      <section>
        <SectionTitle icon={<CreditCard className="w-3.5 h-3.5" />} label={t('account')} />
        {!isSignedIn ? (
          <div className="app-soft-surface rounded-xl p-4 text-center space-y-3">
            <p className="text-sm text-gray-500">{t('errSignInRequired')}</p>
            {CLERK_CONFIGURED ? (
              <AuthSignInButton mode="modal">
                <button
                  type="button"
                  className="app-button-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <LogIn className="w-4 h-4" /> {t('signIn')}
                </button>
              </AuthSignInButton>
            ) : (
              <p className="text-xs text-gray-400">Set VITE_CLERK_PUBLISHABLE_KEY to enable auth.</p>
            )}
          </div>
        ) : (
          <Link
            to="/account"
            className="app-soft-surface flex items-center justify-between gap-3 p-3 rounded-xl hover:border-[var(--app-accent-200)] hover:bg-[rgba(237,244,243,0.6)] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {CLERK_CONFIGURED && <AuthUserButton afterSignOutUrl={window.location.href} />}
              {email && <span className="text-sm text-gray-700 truncate">{email}</span>}
            </div>
            <div className="shrink-0 flex items-center gap-2 text-sm font-semibold text-[var(--app-accent-700)]">
              {billing.isLoadingBalance ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>{billing.balance !== null ? billing.balance : '—'} {t('credits')}</span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </Link>
        )}
      </section>

      {/* Pages */}
      <section className="space-y-1">
        <Link
          to="/privacy"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(237,244,243,0.6)] transition-colors text-sm text-gray-700"
        >
          <Shield className="w-4 h-4 text-[var(--app-accent-500)] shrink-0" />
          <span>{t('privacyPolicy')}</span>
        </Link>
        <Link
          to="/about"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(237,244,243,0.6)] transition-colors text-sm text-gray-700"
        >
          <Info className="w-4 h-4 text-[var(--app-accent-500)] shrink-0" />
          <span>{t('about')}</span>
        </Link>
      </section>

    </div>
  );
}
