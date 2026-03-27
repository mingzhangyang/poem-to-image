import { Suspense, lazy, type ReactNode } from 'react';

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const ClerkSignInButton = lazy(async () => ({ default: (await import('@clerk/react')).SignInButton }));
const ClerkUserButton = lazy(async () => ({ default: (await import('@clerk/react')).UserButton }));

interface AuthSignInButtonProps {
  children: ReactNode;
  mode?: 'modal' | 'redirect';
  fallback?: ReactNode;
}

export function AuthSignInButton({ children, mode = 'modal', fallback = null }: AuthSignInButtonProps) {
  if (!CLERK_CONFIGURED) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={fallback}>
      <ClerkSignInButton mode={mode}>{children}</ClerkSignInButton>
    </Suspense>
  );
}

interface AuthUserButtonProps {
  afterSignOutUrl?: string;
  fallback?: ReactNode;
}

export function AuthUserButton({ afterSignOutUrl, fallback = null }: AuthUserButtonProps) {
  if (!CLERK_CONFIGURED) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={fallback}>
      <ClerkUserButton afterSignOutUrl={afterSignOutUrl} />
    </Suspense>
  );
}
