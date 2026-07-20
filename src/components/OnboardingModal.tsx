import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, X, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import type { EditorTemplateId, TemplateSectionProps, TranslateFn } from '../types';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { TemplatePreview } from './TemplatePreview';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartEditing: () => void;
  t: TranslateFn;
  templates: TemplateSectionProps;
}

export function OnboardingModal({ isOpen, onClose, onStartEditing, t, templates }: OnboardingModalProps) {
  const [mobilePage, setMobilePage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogA11y({ isOpen, dialogRef, onClose });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleApplyTemplate = (id: EditorTemplateId) => {
    templates.onApplyTemplate(id);
    onStartEditing();
  };

  const steps = [t('templates'), t('content'), t('exportImage')];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        />

        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative flex min-h-[500px] max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:min-h-[600px] lg:flex-row"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-modal-title"
          aria-describedby="onboarding-modal-description"
          tabIndex={-1}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white/80 transition-colors hover:bg-white/30 hover:text-white lg:bg-[rgba(237,244,243,0.7)] lg:text-(--app-accent-500) lg:hover:bg-(--app-accent-100) lg:hover:text-(--app-accent-800)"
            aria-label={t('closeControls')}
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className={`
              relative flex-1 flex-col justify-center overflow-y-auto bg-[#0d9488] p-8 text-white lg:flex lg:flex-[0.618] lg:p-12
              ${isMobile && mobilePage !== 1 ? 'hidden' : 'flex'}
            `}
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)' }}
          >
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 id="onboarding-modal-title" className="mb-4 text-3xl font-bold tracking-tight lg:text-4xl">
              {t('onboardingWelcome')}
            </h2>
            <div className="space-y-6">
              <p className="text-lg leading-relaxed font-medium text-white/90">
                {t('onboardingTitle')}
              </p>
              <div className="h-1 w-12 rounded-full bg-white/40" />
              <p id="onboarding-modal-description" className="text-base leading-relaxed text-white/80">
                {t('onboardingSubtitle')}
              </p>
              <p className="text-sm leading-relaxed text-white/70 italic">
                {t('onboardingDescription')}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3" aria-hidden="true">
              <div className="rounded-2xl border border-white/15 bg-black/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{t('bgAI')}</div>
                <div className="mt-3 font-serif text-xl tracking-[0.18em] text-white/55 line-through decoration-white/40">P0?m A#t</div>
              </div>
              <div className="rounded-2xl border border-white/30 bg-white/15 p-4 shadow-lg">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  <span>{t('appTitle')}</span>
                  <Check className="h-4 w-4" />
                </div>
                <div className="mt-3 font-serif text-xl tracking-[0.08em] text-white">Poem Art</div>
              </div>
            </div>

            {isMobile ? (
              <div className="mt-12 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="h-1.5 w-6 rounded-full bg-white" />
                  <div className="h-1.5 w-2 rounded-full bg-white/30" />
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePage(2)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0d9488] shadow-lg transition-transform active:scale-95"
                >
                  {t('onboardingNext')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div
            className={`
              flex-1 flex-col overflow-y-auto bg-white p-8 lg:flex lg:flex-[0.382] lg:p-10
              ${isMobile && mobilePage !== 2 ? 'hidden' : 'flex'}
            `}
          >
            <div className="flex-1">
              <div className="mb-6">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0d9488]">
                  {t('appTitle')}
                </div>
                <h3 className="mt-2 text-xl font-bold text-(--app-ink)">
                  {t('onboardingWorkflowTitle')}
                </h3>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-4 rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[rgba(237,244,243,0.5)] p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2dd4bf]/10 text-xs font-bold text-[#0d9488]">
                      {index + 1}
                    </div>
                    <span className="flex-1 text-sm font-semibold text-(--app-accent-900)">{step}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div className="mb-4 text-xs font-bold uppercase tracking-wider text-[rgba(34,48,52,0.4)]">
                  {t('builtInTemplates')}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {templates.templates.slice(0, 3).map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => handleApplyTemplate(template.id)}
                      className="group flex items-center gap-3 rounded-2xl border border-[rgba(34,48,52,0.06)] p-3 transition-all hover:translate-y-[-1px] hover:border-[#2dd4bf] hover:shadow-md"
                    >
                      <TemplatePreview template={template} className="h-10 w-10 rounded-xl shadow-sm" />
                      <span className="flex-1 text-left text-sm font-medium text-(--app-accent-800) group-hover:text-(--app-ink)">
                        {t(template.nameKey)}
                      </span>
                      <Check className="h-4 w-4 text-[#0d9488] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#2dd4bf]/20 bg-[#f0fdfc] p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                <p className="text-xs leading-relaxed text-(--app-accent-700)">{t('onboardingFreemiumFree')}</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                <p className="text-xs leading-relaxed text-(--app-accent-700)">{t('onboardingFreemiumPaid')}</p>
              </div>
            </div>

            <div className="mt-4">
              {isMobile ? (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMobilePage(1)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-(--app-accent-500) hover:text-(--app-accent-800)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('onboardingPrevious')}
                  </button>
                  <button
                    type="button"
                    onClick={onStartEditing}
                    className="rounded-full bg-[#0d9488] px-8 py-3 text-sm font-bold text-white shadow-lg active:scale-95"
                  >
                    {t('onboardingStart')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onStartEditing}
                  className="w-full rounded-2xl bg-[#0d9488] py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-[#115e59] hover:shadow-[#0d9488]/20 focus:outline-none focus:ring-4 focus:ring-[#2dd4bf]/20 active:scale-[0.98]"
                >
                  {t('onboardingStart')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
