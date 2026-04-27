import { useCallback, useState } from 'react';
import { useToast } from '../components/ToastProvider';
import type { TranslateFn } from '../types';
import { useBalance } from './useBalance';
import { useBillingHistory } from './useBillingHistory';
import { useBillingPackages } from './useBillingPackages';
import { useCheckoutReturn } from './useCheckoutReturn';

interface UseBillingStateParams {
  getToken: () => Promise<string | null>;
  t: TranslateFn;
}

export function useBillingState({ getToken, t }: UseBillingStateParams) {
  const { showToast } = useToast();
  const { balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useBalance();
  const { packages, isLoading: isLoadingPackages } = useBillingPackages();
  const { items: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useBillingHistory();
  const [isPurchasing, setIsPurchasing] = useState(false);

  useCheckoutReturn({ getToken, refetchBalance, refetchHistory });

  const handlePurchase = useCallback(
    async (packageId: string) => {
      setIsPurchasing(true);
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
        if (response.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }

        showToast(data.error ?? t('checkoutFailed'), 'error');
      } catch {
        showToast(t('networkError'), 'error');
      } finally {
        setIsPurchasing(false);
      }
    },
    [getToken, showToast, t],
  );

  return {
    balance,
    isLoadingBalance,
    packages,
    isLoadingPackages,
    history,
    isLoadingHistory,
    isPurchasing,
    refetchBalance,
    handlePurchase,
  };
}
