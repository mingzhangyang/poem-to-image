import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/logo';
import { usePageMetadata } from '../hooks/usePageMetadata';

function Section({ title, children }: { title: string; children: import('react').ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  usePageMetadata({
    title: 'Privacy Policy – InkPoem',
    description: 'Learn how InkPoem collects, uses, and protects your personal data.',
    canonical: 'https://inkpoem.com/privacy',
    ogTitle: 'Privacy Policy – InkPoem',
    ogUrl: 'https://inkpoem.com/privacy',
    robots: 'index, follow',
  });

  return (
    <div className="min-h-screen bg-transparent">
      {/* Nav */}
      <header className="bg-[rgba(255,253,249,0.92)] border-b border-[rgba(34,48,52,0.08)] sticky top-0 z-10 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-(--app-accent-900) font-bold text-lg">
            <Logo className="w-7 h-7" />
            <span>InkPoem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-(--app-accent-800) transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Editor
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mt-1">Effective date: October 28, 2026</p>
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
          <p><strong className="text-gray-700">Editor and AI content</strong> — Poem text sent for AI image generation is shared with the chosen provider (Google Gemini or OpenAI). Your ordinary unpublished editor drafts remain in this browser; we do not intentionally persist submitted poem text for AI generation.</p>
          <p><strong className="text-gray-700">Artwork you choose to publish</strong> — When you explicitly publish a shareable artwork link, we store a flattened image of your artwork, its social-preview image, the title and author you entered, and the creation time on Cloudflare R2/D1. This publication is publicly accessible to anyone with the link. Publishing does not upload your editable editor project.</p>
          <p><strong className="text-gray-700">Publishing abuse protection</strong> — We use a hashed, pseudonymous network address identifier for temporary per-hour and per-day publishing rate limits; expired counters are periodically deleted.</p>
        </Section>

        <Section title="How We Use Your Information">
          <ul className="list-disc list-inside space-y-1">
            <li>To authenticate you and manage your account</li>
            <li>To process payments and maintain your credit balance</li>
            <li>To generate AI images based on your input</li>
            <li>To display your transaction history</li>
            <li>To improve the reliability and performance of the service</li>
            <li>To serve public artwork you deliberately publish and generate its share-preview metadata</li>
            <li>To enforce temporary anonymous publication limits</li>
          </ul>
        </Section>

        <Section title="Third-Party Services">
          <p>We rely on the following third-party services, each governed by their own privacy policies:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-gray-700">Clerk</strong> — Authentication and user management</li>
            <li><strong className="text-gray-700">Stripe</strong> — Payment processing</li>
            <li><strong className="text-gray-700">Cloudflare</strong> — Hosting, edge computing, D1 database and private R2 storage for public artwork snapshots</li>
            <li><strong className="text-gray-700">Google Gemini</strong> — AI image generation</li>
            <li><strong className="text-gray-700">OpenAI</strong> — AI image generation</li>
          </ul>
        </Section>

        <Section title="Data Retention">
          <p>We retain account and transaction records for account and billing operations. You can request access or deletion by contacting us, subject to applicable recordkeeping requirements.</p>
          <p>Published artworks remain available until you revoke their share using the deletion capability saved in the publishing browser. Revocation immediately removes public access and clears the stored title and author. We delete the corresponding artwork images from storage, retrying failed deletions during scheduled maintenance; a non-content revocation tombstone remains in the database. Copies already downloaded by visitors or cached by third-party social platforms cannot be recalled.</p>
        </Section>

        <Section title="Cookies">
          <p>Authentication sessions use cookies and similar technologies required by Clerk. We also use localStorage for editor drafts, language preferences and the anonymous share-deletion capability; this allows the publishing browser to revoke its links. We do not use these items for advertising or third-party tracking.</p>
        </Section>

        <Section title="Your Rights">
          <p>Depending on your location, you may have the right to access, correct, or delete your personal data. To exercise these rights, please contact us at the email below.</p>
        </Section>

        <Section title="Contact">
          <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:contact@inkpoem.com" className="app-accent-link hover:underline">contact@inkpoem.com</a>.</p>
        </Section>
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 border-t border-[rgba(34,48,52,0.08)] mt-4">
        <p className="text-xs text-gray-400 text-center">© {new Date().getFullYear()} InkPoem. All rights reserved.</p>
      </footer>
    </div>
  );
}
