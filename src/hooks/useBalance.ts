import { useCallback, useEffect, useState } from 'react';
import { useAppAuth } from '../context/auth';

interface UseBalanceResult {
  balance: number | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useBalance(): UseBalanceResult {
  const { isSignedIn, getToken } = useAppAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!isSignedIn) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/billing/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = (await response.json()) as { balance: number };
        setBalance(data.balance);
      }
    } catch {
      // Silently fail — billing may not be configured
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { balance, isLoading, refetch: fetch_ };
}
