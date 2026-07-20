import { Suspense, lazy, type ReactNode } from 'react';

const runtimeClerkKey = typeof window !== 'undefined'
  ? (window as { __INKPOEM_CLERK_PUBLISHABLE_KEY?: string }).__INKPOEM_CLERK_PUBLISHABLE_KEY
  : undefined;
const CLERK_CONFIGURED = !!(runtimeClerkKey ?? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
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
  fallback?: ReactNode;
}

export function AuthUserButton({ fallback = null }: AuthUserButtonProps) {
  if (!CLERK_CONFIGURED) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={fallback}>
      <ClerkUserButton />
    </Suspense>
  );
}
