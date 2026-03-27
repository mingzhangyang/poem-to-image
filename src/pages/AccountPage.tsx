import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton, UserButton } from '@clerk/react';
import { ArrowLeft, CreditCard, Loader2, LogIn } from 'lucide-react';
import { useAppAuth } from '../context/auth';
import { useBalance } from '../hooks/useBalance';
import { useBillingPackages } from '../hooks/useBillingPackages';
import { useBillingHistory, type TransactionItem } from '../hooks/useBillingHistory';
import { useCheckoutReturn } from '../hooks/useCheckoutReturn';
import { useLang } from '../hooks/useLang';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { Logo } from '../components/logo';

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function AccountPage() {
  const { isSignedIn, getToken } = useAppAuth();
  const { balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useBalance();
  const { packages, isLoading: isLoadingPackages } = useBillingPackages();
  const { items: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useBillingHistory();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const { t } = useLang();
  usePageMetadata({
    title: 'Account – InkPoem',
    robots: 'noindex, nofollow',
  });

  useCheckoutReturn({ getToken, refetchBalance, refetchHistory });

  function typeLabel(type: TransactionItem['type']) {
    if (type === 'topup') return t('topup');
    if (type === 'generate_debit') return t('generateDebit');
    if (type === 'refund') return t('refund');
    return t('adminAdjust');
  }

  const handlePurchase = useCallback(async (packageId: string) => {
    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ packageId, returnPath: window.location.pathname }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setPurchaseError(data.error ?? t('checkoutFailed'));
        setIsPurchasing(false);
      }
    } catch {
      setPurchaseError(t('networkError'));
      setIsPurchasing(false);
    }
  }, [getToken, t]);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Nav */}
      <header className="bg-[rgba(255,253,249,0.92)] border-b border-[rgba(34,48,52,0.08)] sticky top-0 z-10 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-(--app-accent-900) font-bold text-lg">
            <Logo className="w-7 h-7" />
            <span>InkPoem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-(--app-accent-800) transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t('backToEditor')}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('account')}</h1>

        {!isSignedIn ? (
          <div className="app-panel-surface rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-(--app-accent-50) rounded-full flex items-center justify-center mx-auto">
              <LogIn className="w-6 h-6 text-(--app-accent-600)" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{t('signInToManage')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('signInForCredits')}</p>
            </div>
            {CLERK_CONFIGURED ? (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="app-button-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                >
                  <LogIn className="w-4 h-4" /> {t('signIn')}
                </button>
              </SignInButton>
            ) : (
              <p className="text-xs text-gray-400">{t('authNotConfigured')}</p>
            )}
          </div>
        ) : (
          <>
            {/* Profile */}
            <section className="app-panel-surface rounded-2xl p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">{t('profile')}</h2>
              <div className="flex items-center gap-4">
                {CLERK_CONFIGURED && <UserButton afterSignOutUrl="/account" />}
                <div>
                  <p className="text-sm text-gray-500">{t('manageProfileDesc')}</p>
                </div>
              </div>
            </section>

            {/* Credits */}
            <section className="app-panel-surface rounded-2xl p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">{t('credits')}</h2>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-(--app-accent-50) rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-(--app-accent-600)" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('availableBalance')}</p>
                  {isLoadingBalance ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-0.5" />
                  ) : (
                    <p className="text-2xl font-bold text-(--app-accent-700)">{balance ?? '—'} <span className="text-base font-medium">{t('creditPackageDesc')}</span></p>
                  )}
                </div>
              </div>

              <p className="text-xs font-medium text-gray-500 mb-3">{t('purchaseCredits')}</p>
              {isLoadingPackages ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="app-soft-surface flex flex-col gap-3 p-4 rounded-xl hover:border-(--app-accent-200) hover:bg-[rgba(237,244,243,0.5)] transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900">{pkg.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{pkg.credits} {t('creditPackageDesc')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={isPurchasing}
                        className="app-button-primary mt-auto w-full py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isPurchasing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `$${(pkg.priceCents / 100).toFixed(2)}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {purchaseError && (
                <p className="app-status-warning inline-flex rounded-full px-3 py-1 text-xs mt-3">{purchaseError}</p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {t('creditCostInfo')}
              </p>
            </section>

            {/* Transaction history */}
            <section className="app-panel-surface rounded-2xl p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">{t('transactionHistory')}</h2>
              {isLoadingHistory ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('noTransactions')}</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <span className="text-gray-800 font-medium">{typeLabel(item.type)}</span>
                        {item.provider && <span className="ml-1.5 text-xs text-gray-400 capitalize">({item.provider})</span>}
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.created_at)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 font-semibold ${item.amount > 0 ? 'app-status-positive' : 'app-status-warning'}`}>
                        {item.amount > 0 ? `+${item.amount}` : item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
