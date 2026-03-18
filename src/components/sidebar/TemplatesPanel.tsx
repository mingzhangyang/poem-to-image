import { Sparkles, BookmarkPlus, Trash2, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import type { ExpandedSections, TemplateSectionProps, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';

interface TemplatesPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['templates'];
  onToggle: () => void;
  templates: TemplateSectionProps;
  currentBackgroundType: string;
}

export function TemplatesPanel({ t, expanded, onToggle, templates, currentBackgroundType }: TemplatesPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeBuiltIn = templates.templates.find((template) => template.id === templates.activeTemplateId);
  const activeCustom = templates.customTemplates.find((t) => t.id === templates.activeCustomTemplateId);
  const activeName = activeCustom?.name ?? (activeBuiltIn ? t(activeBuiltIn.nameKey) : null);

  const isImageOrAiBg = currentBackgroundType === 'image' || currentBackgroundType === 'ai';

  const handleSave = () => {
    const name = templateName.trim();
    templates.onSaveCustomTemplate(name);
    setTemplateName('');
    setIsSaving(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setIsSaving(false); setTemplateName(''); }
  };

  return (
    <ControlSection
      title={t('templates')}
      icon={<Sparkles className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      summary={activeName ?? t('templatesHint')}
      highlighted={!templates.activeTemplateId && !templates.activeCustomTemplateId}
    >
      <div className="space-y-4">
        <p className="text-xs leading-5 text-gray-500">{t('templatesHint')}</p>

        {/* My Templates — shown first, higher priority */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('myTemplates')}</span>
            {!isSaving && (
              <button
                onClick={() => setIsSaving(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                {t('saveAsTemplate')}
              </button>
            )}
          </div>

          {isSaving && (
            <div className="mb-3 space-y-2">
              {isImageOrAiBg && (
                <p className="text-xs text-amber-600 leading-4">{t('bgNotSavedNote')}</p>
              )}
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('templateNamePlaceholder')}
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {t('saveTemplate')}
                </button>
                <button
                  onClick={() => { setIsSaving(false); setTemplateName(''); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {templates.customTemplates.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">{t('noCustomTemplates')}</p>
          ) : (
            <div className="grid gap-2">
              {templates.customTemplates.map((template) => {
                const isActive = templates.activeCustomTemplateId === template.id;
                const isConfirmingDelete = deletingId === template.id;

                return (
                  <div
                    key={template.id}
                    className={`rounded-xl border p-3 transition-all ${
                      isActive
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Color swatch */}
                      <div
                        className="w-10 h-10 rounded-lg shrink-0"
                        style={{
                          background: template.accentFrom === template.accentTo
                            ? template.accentFrom
                            : `linear-gradient(135deg, ${template.accentFrom}, ${template.accentTo})`,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{template.name}</div>
                      </div>
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { void templates.onDeleteCustomTemplate(template.id).then(() => setDeletingId(null)); }}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
                          >
                            {t('deleteTemplate')}
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => templates.onApplyCustomTemplate(template.id)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {isActive ? t('templateApplied') : t('applyTemplate')}
                          </button>
                          <button
                            onClick={() => setDeletingId(template.id)}
                            className="p-1 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Built-in templates */}
        <div>
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('builtInTemplates')}</span>
          </div>
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
      </div>
    </ControlSection>
  );
}
