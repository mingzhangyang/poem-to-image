import { useEffect } from 'react';

interface CheckoutStatusResponse {
  fulfilled?: boolean;
}

interface UseCheckoutReturnParams {
  getToken: () => Promise<string | null>;
  refetchBalance: () => void | Promise<void>;
  refetchHistory?: () => void | Promise<void>;
}

function cleanupBillingSearchParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete('billing');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function refreshBillingState(
  refetchBalance: () => void | Promise<void>,
  refetchHistory?: () => void | Promise<void>,
) {
  await Promise.all([Promise.resolve(refetchBalance()), Promise.resolve(refetchHistory?.())]);
}

export function useCheckoutReturn({
  getToken,
  refetchBalance,
  refetchHistory,
}: UseCheckoutReturnParams) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get('billing');
    const sessionId = params.get('session_id');

    if (billingStatus !== 'success' && billingStatus !== 'cancel') {
      return;
    }

    let cancelled = false;

    if (billingStatus === 'cancel') {
      cleanupBillingSearchParams();
      return;
    }

    const pollCheckoutStatus = async () => {
      if (!sessionId) {
        await refreshBillingState(refetchBalance, refetchHistory);
        cleanupBillingSearchParams();
        return;
      }

      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        try {
          const token = await getToken();
          const response = await fetch(
            `/api/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );

          if (response.ok) {
            const payload = (await response.json()) as CheckoutStatusResponse;
            await refreshBillingState(refetchBalance, refetchHistory);

            if (payload.fulfilled) {
              break;
            }
          }
        } catch {
          // Fall back to local refetch below.
        }

        if (attempt < 4) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      }

      if (!cancelled) {
        await refreshBillingState(refetchBalance, refetchHistory);
        cleanupBillingSearchParams();
      }
    };

    void pollCheckoutStatus();

    return () => {
      cancelled = true;
    };
  }, [getToken, refetchBalance, refetchHistory]);
}