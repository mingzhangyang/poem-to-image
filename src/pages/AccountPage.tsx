import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton, UserButton } from '@clerk/react';
import { ArrowLeft, CreditCard, Loader2, LogIn } from 'lucide-react';
import { useAppAuth } from '../context/auth';
import { useBalance } from '../hooks/useBalance';
import { useBillingPackages } from '../hooks/useBillingPackages';
import { useBillingHistory, type TransactionItem } from '../hooks/useBillingHistory';
import { useCheckoutReturn } from '../hooks/useCheckoutReturn';
import { Logo } from '../components/logo';

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function typeLabel(type: TransactionItem['type']) {
  if (type === 'topup') return 'Top Up';
  if (type === 'generate_debit') return 'AI Generation';
  if (type === 'refund') return 'Refund';
  return 'Adjustment';
}

export function AccountPage() {
  const { isSignedIn, getToken } = useAppAuth();
  const { balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useBalance();
  const { packages, isLoading: isLoadingPackages } = useBillingPackages();
  const { items: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useBillingHistory();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useCheckoutReturn({ getToken, refetchBalance, refetchHistory });

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
        setPurchaseError(data.error ?? 'Failed to start checkout. Please try again.');
        setIsPurchasing(false);
      }
    } catch {
      setPurchaseError('Network error. Please try again.');
      setIsPurchasing(false);
    }
  }, [getToken]);

  return (
    <div className="min-h-screen bg-gray-50">
      <title>Account – InkPoem</title>
      <meta name="robots" content="noindex, nofollow" />

      {/* Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-indigo-900 font-bold text-lg">
            <Logo className="w-7 h-7" />
            <span>InkPoem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Editor
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>

        {!isSignedIn ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
              <LogIn className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Sign in to manage your account</p>
              <p className="text-sm text-gray-500 mt-1">Access credits, purchase history, and more.</p>
            </div>
            {CLERK_CONFIGURED ? (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
              </SignInButton>
            ) : (
              <p className="text-xs text-gray-400">Auth not configured.</p>
            )}
          </div>
        ) : (
          <>
            {/* Profile */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Profile</h2>
              <div className="flex items-center gap-4">
                {CLERK_CONFIGURED && <UserButton afterSignOutUrl="/account" />}
                <div>
                  <p className="text-sm text-gray-500">Manage your profile, security settings, and connected accounts via the avatar menu.</p>
                </div>
              </div>
            </section>

            {/* Credits */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Credits</h2>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Available balance</p>
                  {isLoadingBalance ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-0.5" />
                  ) : (
                    <p className="text-2xl font-bold text-indigo-700">{balance ?? '—'} <span className="text-base font-medium">credits</span></p>
                  )}
                </div>
              </div>

              <p className="text-xs font-medium text-gray-500 mb-3">Purchase Credits</p>
              {isLoadingPackages ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900">{pkg.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{pkg.credits} credits</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={isPurchasing}
                        className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {isPurchasing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `$${(pkg.priceCents / 100).toFixed(2)}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {purchaseError && (
                <p className="text-xs text-red-500 mt-3">{purchaseError}</p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                Gemini (NanoBanana 2) costs 2 credits · OpenAI costs 1 credit per generation
              </p>
            </section>

            {/* Transaction history */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Transaction History</h2>
              {isLoadingHistory ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No transactions yet.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <span className="text-gray-800 font-medium">{typeLabel(item.type)}</span>
                        {item.provider && <span className="ml-1.5 text-xs text-gray-400 capitalize">({item.provider})</span>}
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.created_at)}</p>
                      </div>
                      <span className={`font-semibold ${item.amount > 0 ? 'text-green-600' : 'text-gray-700'}`}>
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
