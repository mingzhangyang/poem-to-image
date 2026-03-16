import { type ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { AppAuthContext } from '../../context/auth';

/** Bridges Clerk auth state into our AppAuthContext. Must be rendered inside ClerkProvider. */
export function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  return (
    <AppAuthContext.Provider
      value={{
        isLoaded: isLoaded ?? false,
        isSignedIn: isSignedIn ?? false,
        user: user ?? null,
        getToken,
      }}
    >
      {children}
    </AppAuthContext.Provider>
  );
}
