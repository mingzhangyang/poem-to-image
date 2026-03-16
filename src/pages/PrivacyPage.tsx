import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/logo';

function Section({ title, children }: { title: string; children: import('react').ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <title>Privacy Policy – InkPoem</title>
      <meta name="description" content="Learn how InkPoem collects, uses, and protects your personal data." />
      <meta property="og:title" content="Privacy Policy – InkPoem" />
      <meta property="og:url" content="https://inkpoem.com/privacy" />
      <link rel="canonical" href="https://inkpoem.com/privacy" />

      {/* Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-indigo-900 font-bold text-lg">
            <Logo className="w-7 h-7" />
            <span>InkPoem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Editor
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mt-1">Effective date: March 16, 2026</p>
        </div>

        <Section title="Overview">
          <p>
            InkPoem ("we", "us", or "our") is committed to protecting your privacy. This policy explains what
            information we collect, how we use it, and your rights regarding your data when you use
            inkpoem.com.
          </p>
        </Section>

        <Section title="Information We Collect">
          <p><strong className="text-gray-700">Account information</strong> — When you sign in, we collect your email address and a unique user ID via Clerk, our authentication provider. We do not store passwords.</p>
          <p><strong className="text-gray-700">Payment information</strong> — Purchases are processed by Stripe. We do not store your card number or payment details; Stripe handles all payment data under their own privacy policy.</p>
          <p><strong className="text-gray-700">Usage data</strong> — We store records of AI generation requests and credit transactions in order to maintain your credit balance and provide transaction history.</p>
          <p><strong className="text-gray-700">Content</strong> — Poem text you submit for AI image generation is sent to AI providers (Google Gemini or OpenAI) to produce the image. We do not permanently store your poem content.</p>
        </Section>

        <Section title="How We Use Your Information">
          <ul className="list-disc list-inside space-y-1">
            <li>To authenticate you and manage your account</li>
            <li>To process payments and maintain your credit balance</li>
            <li>To generate AI images based on your input</li>
            <li>To display your transaction history</li>
            <li>To improve the reliability and performance of the service</li>
          </ul>
        </Section>

        <Section title="Third-Party Services">
          <p>We rely on the following third-party services, each governed by their own privacy policies:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-gray-700">Clerk</strong> — Authentication and user management</li>
            <li><strong className="text-gray-700">Stripe</strong> — Payment processing</li>
            <li><strong className="text-gray-700">Cloudflare</strong> — Hosting, edge computing, and database</li>
            <li><strong className="text-gray-700">Google Gemini</strong> — AI image generation</li>
            <li><strong className="text-gray-700">OpenAI</strong> — AI image generation</li>
          </ul>
        </Section>

        <Section title="Data Retention">
          <p>We retain your account and transaction data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>
        </Section>

        <Section title="Cookies">
          <p>We use cookies and similar technologies only as required by our authentication provider (Clerk) to maintain your session. We do not use cookies for advertising or third-party tracking.</p>
        </Section>

        <Section title="Your Rights">
          <p>Depending on your location, you may have the right to access, correct, or delete your personal data. To exercise these rights, please contact us at the email below.</p>
        </Section>

        <Section title="Contact">
          <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:contact@inkpoem.com" className="text-indigo-600 hover:underline">contact@inkpoem.com</a>.</p>
        </Section>
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 border-t border-gray-200 mt-4">
        <p className="text-xs text-gray-400 text-center">© {new Date().getFullYear()} InkPoem. All rights reserved.</p>
      </footer>
    </div>
  );
}
