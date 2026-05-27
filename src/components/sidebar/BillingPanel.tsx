import { CreditCard, Loader2, LogIn, Wallet } from 'lucide-react';
import type { BillingSectionProps, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';
import { AuthSignInButton, AuthUserButton } from '../auth/ClerkUi';
import { useAppAuth } from '../../context/auth';

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface BillingPanelProps {
  t: TranslateFn;
  expanded: boolean;
  onToggle: () => void;
  billing: BillingSectionProps;
}

function formatAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : String(amount);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function BillingPanel({ t, expanded, onToggle, billing }: BillingPanelProps) {
  const { isSignedIn, user } = useAppAuth();
  const email = user?.primaryEmailAddress?.emailAddress;

  const typeLabel = (type: string): string => {
    if (type === 'topup') return t('topup');
    if (type === 'generate_debit') return t('generateDebit');
    if (type === 'refund') return t('refund');
    return t('adminAdjust');
  };

  return (
    <ControlSection
      title={t('billing')}
      icon={<Wallet className="w-4 h-4" />}
      tint="var(--app-cat-billing)"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {!isSignedIn ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-(--app-accent-500)">{t('errSignInRequired')}</p>
            {CLERK_CONFIGURED ? (
              <AuthSignInButton mode="modal">
                <button className="app-button-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto">
                  <LogIn className="w-4 h-4" /> {t('signIn')}
                </button>
              </AuthSignInButton>
            ) : (
              <p className="text-xs text-[rgba(34,48,52,0.4)]">Set VITE_CLERK_PUBLISHABLE_KEY to enable auth.</p>
            )}
          </div>
        ) : (
          <>
            {/* User + balance */}
            <div className="app-soft-surface flex items-center justify-between gap-3 p-3 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                {CLERK_CONFIGURED && <AuthUserButton afterSignOutUrl={window.location.href} />}
                {email && <span className="text-sm text-(--app-accent-800) truncate">{email}</span>}
              </div>
              <div className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-[var(--app-accent-700)]">
                {billing.isLoadingBalance ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>
                      {billing.balance !== null ? billing.balance : '—'} {t('credits')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Credit packages */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-(--app-accent-500) mb-2">
                {t('purchaseCredits')}
              </div>
              {billing.isLoadingPackages ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-[rgba(34,48,52,0.4)]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {billing.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="app-soft-surface flex items-center justify-between gap-2 p-3 rounded-xl hover:border-[var(--app-accent-200)] hover:bg-[rgba(237,244,243,0.5)] transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-(--app-ink)">{pkg.name}</div>
                        <div className="text-xs text-(--app-accent-500)">
                          {pkg.credits} {t('creditPackageDesc')}
                        </div>
                      </div>
                      <button
                        onClick={() => billing.onPurchase(pkg.id)}
                        disabled={billing.isPurchasing}
                        className="app-button-primary shrink-0 px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-xs font-medium"
                      >
                        {billing.isPurchasing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          `$${(pkg.priceCents / 100).toFixed(2)}`
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transaction history */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-(--app-accent-500) mb-2">
                {t('transactionHistory')}
              </div>
              {billing.isLoadingHistory ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-[rgba(34,48,52,0.4)]" />
                </div>
              ) : billing.history.length === 0 ? (
                <p className="text-xs text-[rgba(34,48,52,0.4)] text-center py-2">{t('noTransactions')}</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {billing.history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-[rgba(34,48,52,0.04)] last:border-0"
                    >
                      <div className="min-w-0">
                        <span className="text-(--app-accent-800)">{typeLabel(item.type)}</span>
                        {item.provider && (
                          <span className="ml-1 text-[rgba(34,48,52,0.4)] capitalize">({item.provider})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${item.amount > 0 ? 'app-status-positive' : 'app-status-warning'}`}
                        >
                          {formatAmount(item.amount)}
                        </span>
                        <span className="text-[rgba(34,48,52,0.4)]">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ControlSection>
  );
}
