import { Link } from 'react-router-dom';
import { ArrowLeft, Cpu, Globe, ImageIcon, Layers, Sparkles, Zap } from 'lucide-react';
import { Logo } from '../components/logo';
import { useLang } from '../hooks/useLang';
import { usePageMetadata } from '../hooks/usePageMetadata';

function FeatureCard({ icon, title, description }: { icon: import('react').ReactNode; title: string; description: string }) {
  return (
    <div className="app-panel-surface flex gap-4 p-4 rounded-2xl">
      <div className="w-10 h-10 bg-[var(--app-accent-50)] rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function PoweredByBadge({ name, description }: { name: string; description: string }) {
  return (
    <div className="app-panel-surface px-4 py-3 rounded-xl">
      <p className="font-semibold text-gray-900 text-sm">{name}</p>
      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
    </div>
  );
}

export function AboutPage() {
  const { t } = useLang();
  usePageMetadata({
    title: 'About InkPoem – AI Poetry Art Generator',
    description: 'InkPoem turns your poems into beautiful visual art using AI. Learn about our features, technology, and how it works.',
    canonical: 'https://inkpoem.com/about',
    ogTitle: 'About InkPoem – AI Poetry Art Generator',
    ogDescription: 'InkPoem turns your poems into beautiful visual art using AI. Learn about our features, technology, and how it works.',
    ogUrl: 'https://inkpoem.com/about',
    robots: 'index, follow',
  });

  return (
    <div className="min-h-screen bg-transparent">
      {/* Nav */}
      <header className="bg-[rgba(255,253,249,0.92)] border-b border-[rgba(34,48,52,0.08)] sticky top-0 z-10 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-[var(--app-accent-900)] font-bold text-lg">
            <Logo className="w-7 h-7" />
            <span>InkPoem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--app-accent-800)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t('backToEditor')}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-4 py-4">
          <Logo className="w-20 h-20 mx-auto" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">InkPoem</h1>
            <p className="text-gray-500 mt-2 text-lg">{t('aboutDescription')}</p>
          </div>
          <Link
            to="/"
            className="app-button-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            {t('openEditor')}
          </Link>
        </div>

        {/* Features */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">{t('features')}</h2>
          <div className="space-y-3">
            <FeatureCard
              icon={<ImageIcon className="w-5 h-5 text-[var(--app-accent-600)]" />}
              title={t('featureAiImageGen')}
              description={t('featureAiImageGenDesc')}
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5 text-[var(--app-accent-600)]" />}
              title={t('featureCustomization')}
              description={t('featureCustomizationDesc')}
            />
            <FeatureCard
              icon={<Globe className="w-5 h-5 text-[var(--app-accent-600)]" />}
              title={t('featureMultilingual')}
              description={t('featureMultilingualDesc')}
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5 text-[var(--app-accent-600)]" />}
              title={t('featureExport')}
              description={t('featureExportDesc')}
            />
            <FeatureCard
              icon={<Cpu className="w-5 h-5 text-[var(--app-accent-600)]" />}
              title={t('featureEdgeNative')}
              description={t('featureEdgeNativeDesc')}
            />
          </div>
        </section>

        {/* Powered by */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">{t('poweredBy')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <PoweredByBadge name="Google Gemini" description={t('poweredByGeminiDesc')} />
            <PoweredByBadge name="OpenAI" description={t('poweredByOpenAIDesc')} />
            <PoweredByBadge name="Cloudflare Workers" description={t('poweredByCloudflareDesc')} />
            <PoweredByBadge name="Clerk" description={t('poweredByClerkDesc')} />
            <PoweredByBadge name="Stripe" description={t('poweredByStripeDesc')} />
            <PoweredByBadge name="React + Vite" description={t('poweredByReactDesc')} />
          </div>
        </section>

        {/* Links */}
        <section className="flex flex-wrap gap-3 text-sm">
          <Link to="/privacy" className="app-accent-link hover:underline">{t('privacyPolicy')}</Link>
          <Link to="/account" className="app-accent-link hover:underline">{t('account')}</Link>
          <a href="mailto:contact@inkpoem.com" className="app-accent-link hover:underline">{t('contact')}</a>
        </section>

      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 border-t border-[rgba(34,48,52,0.08)] mt-4">
        <p className="text-xs text-gray-400 text-center">© {new Date().getFullYear()} InkPoem. {t('allRightsReserved')}</p>
      </footer>
    </div>
  );
}
