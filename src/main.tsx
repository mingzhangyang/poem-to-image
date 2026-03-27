import { Suspense, StrictMode, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { ClerkAuthBridge } from './components/auth/ClerkAuthBridge';
import { NoAuthProvider } from './context/auth';
import App from './App.tsx';
import { ToastProvider } from './components/ToastProvider';
import './index.css';

const AccountPage = lazy(async () => ({ default: (await import('./pages/AccountPage.tsx')).AccountPage }));
const PrivacyPage = lazy(async () => ({ default: (await import('./pages/PrivacyPage.tsx')).PrivacyPage }));
const AboutPage = lazy(async () => ({ default: (await import('./pages/AboutPage.tsx')).AboutPage }));

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <ClerkAuthBridge>
              <AppRoutes />
            </ClerkAuthBridge>
          </ClerkProvider>
        ) : (
          <NoAuthProvider>
            <AppRoutes />
          </NoAuthProvider>
        )}
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
