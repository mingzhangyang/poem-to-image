import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { ClerkAuthBridge } from './components/auth/ClerkAuthBridge';
import { NoAuthProvider } from './context/auth';
import App from './App.tsx';
import './index.css';

// Set VITE_CLERK_PUBLISHABLE_KEY in your .env file to enable auth and billing.
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ClerkAuthBridge>
          <App />
        </ClerkAuthBridge>
      </ClerkProvider>
    ) : (
      <NoAuthProvider>
        <App />
      </NoAuthProvider>
    )}
  </StrictMode>,
);
