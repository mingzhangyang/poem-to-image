import { Suspense, StrictMode, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppAuthContext, NoAuthProvider, type AppAuthContextValue } from './context/auth';
import { ToastProvider } from './components/ToastProvider';
import { installStaleBundleRecovery } from './staleBundleRecovery';
import './index.css';

installStaleBundleRecovery();

const App = lazy(async () => ({ default: (await import('./App.tsx')).default }));
const ClerkProvider = lazy(async () => ({ default: (await import('@clerk/react')).ClerkProvider }));
const ClerkAuthBridge = lazy(async () => ({ default: (await import('./components/auth/ClerkAuthBridge')).ClerkAuthBridge }));
const AccountPage = lazy(async () => ({ default: (await import('./pages/AccountPage.tsx')).AccountPage }));
const PrivacyPage = lazy(async () => ({ default: (await import('./pages/PrivacyPage.tsx')).PrivacyPage }));
const AboutPage = lazy(async () => ({ default: (await import('./pages/AboutPage.tsx')).AboutPage }));

const ShareViewerPage = lazy(async () => ({ default: (await import('./pages/ShareViewerPage.tsx')).default }));
const GalleryPage = lazy(async () => ({ default: (await import('./pages/GalleryPage.tsx')).default }));

const runtimeClerkKey = typeof window !== 'undefined'
  ? (window as { __INKPOEM_CLERK_PUBLISHABLE_KEY?: string }).__INKPOEM_CLERK_PUBLISHABLE_KEY
  : undefined;
const clerkPublishableKey = runtimeClerkKey ?? (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined);

// Development server only (stripped from production builds): Playwright specs
// set this to sign in a fixed test account, so cloud-backed flows can run
// against route-intercepted APIs without a Clerk instance.
const devTestAccount = import.meta.env.DEV && typeof window !== 'undefined'
  ? (window as { __INKPOEM_DEV_TEST_ACCOUNT?: { userId: string; token: string } }).__INKPOEM_DEV_TEST_ACCOUNT
  : undefined;
const devTestAuth: AppAuthContextValue | null = devTestAccount
  ? {
    isLoaded: true,
    isSignedIn: true,
    userId: devTestAccount.userId,
    user: null,
    getToken: async () => devTestAccount.token,
  }
  : null;

function RouteFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center text-sm text-[var(--app-accent-700)]">
      Loading...
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Suspense>
  );
}

function EditorWithAuth() {
  if (devTestAuth) {
    return <AppAuthContext.Provider value={devTestAuth}><AppRoutes /></AppAuthContext.Provider>;
  }
  return clerkPublishableKey ? (
    <Suspense fallback={<RouteFallback />}>
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        <ClerkAuthBridge><AppRoutes /></ClerkAuthBridge>
      </ClerkProvider>
    </Suspense>
  ) : (
    <NoAuthProvider><AppRoutes /></NoAuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/s/:id" element={<Suspense fallback={<RouteFallback />}><ShareViewerPage /></Suspense>} />
          <Route path="/gallery" element={<Suspense fallback={<RouteFallback />}><GalleryPage /></Suspense>} />
          <Route path="/*" element={<EditorWithAuth />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
