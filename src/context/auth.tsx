import { createContext, useContext, type ReactNode } from 'react';

export interface AppAuthUser {
  primaryEmailAddress?: { emailAddress: string } | null;
}

export interface AppAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AppAuthUser | null;
  getToken: () => Promise<string | null>;
}

const FALLBACK: AppAuthContextValue = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
  getToken: async () => null,
};

export const AppAuthContext = createContext<AppAuthContextValue>(FALLBACK);

export function useAppAuth(): AppAuthContextValue {
  return useContext(AppAuthContext);
}

export function NoAuthProvider({ children }: { children: ReactNode }) {
  return <AppAuthContext.Provider value={FALLBACK}>{children}</AppAuthContext.Provider>;
}
