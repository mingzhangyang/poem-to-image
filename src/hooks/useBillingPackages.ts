import { useEffect, useState } from 'react';

export interface BillingPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
}

interface UseBillingPackagesResult {
  packages: BillingPackage[];
  isLoading: boolean;
}

export function useBillingPackages(): UseBillingPackagesResult {
  const [packages, setPackages] = useState<BillingPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetch('/api/billing/packages')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setPackages((data as { packages: BillingPackage[] }).packages ?? []);
        }
      })
      .catch(() => {
        // Silently fail — billing may not be configured
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { packages, isLoading };
}
