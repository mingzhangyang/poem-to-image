import { useCallback, useEffect, useState } from 'react';
import { useAppAuth } from '../context/auth';

export interface TransactionItem {
  id: string;
  type: 'topup' | 'generate_debit' | 'refund' | 'admin_adjust';
  amount: number;
  status: string;
  provider: string | null;
  created_at: string;
}

interface UseBillingHistoryResult {
  items: TransactionItem[];
  isLoading: boolean;
  refetch: () => void;
}

export function useBillingHistory(): UseBillingHistoryResult {
  const { isSignedIn, getToken } = useAppAuth();
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!isSignedIn) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/billing/history', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = (await response.json()) as { items: TransactionItem[] };
        setItems(data.items ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return { items, isLoading, refetch: fetch_ };
}
