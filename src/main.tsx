import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { ClerkAuthBridge } from './components/auth/ClerkAuthBridge';
import { NoAuthProvider } from './context/auth';
import App from './App.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { PrivacyPage } from './pages/PrivacyPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import './index.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </StrictMode>,
);
