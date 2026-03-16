import { Sparkles } from 'lucide-react';
import type { ExpandedSections, TemplateSectionProps, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface TemplatesPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['templates'];
  onToggle: () => void;
  templates: TemplateSectionProps;
}

export function TemplatesPanel({ t, expanded, onToggle, templates }: TemplatesPanelProps) {
  const activeTemplate = templates.templates.find((template) => template.id === templates.activeTemplateId);

  return (
    <ControlSection
      title={t('templates')}
      icon={<Sparkles className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      summary={activeTemplate ? t(activeTemplate.nameKey) : t('templatesHint')}
      highlighted={!templates.activeTemplateId}
    >
      <div className="space-y-3">
        <p className="text-xs leading-5 text-gray-500">{t('templatesHint')}</p>

        <div className="grid gap-3">
          {templates.templates.map((template) => {
            const isActive = templates.activeTemplateId === template.id;

            return (
              <button
                key={template.id}
                onClick={() => templates.onApplyTemplate(template.id)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div
                  className="h-16 rounded-xl mb-3"
                  style={{
                    background: `linear-gradient(135deg, ${template.accentFrom}, ${template.accentTo})`,
                  }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t(template.nameKey)}</div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{t(template.descriptionKey)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {isActive ? t('templateApplied') : t('applyTemplate')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ControlSection>
  );
}