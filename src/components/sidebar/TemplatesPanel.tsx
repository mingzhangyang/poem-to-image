import { BookmarkPlus, Expand, Pencil, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { ExpandedSections, TemplateSectionProps, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { getTemplatePreviewStyle } from '../../templates/preview-style';
import { TemplatePreview } from '../TemplatePreview';
import { getTemplateDefinition, resolveTemplateForLanguage } from '../../templates';
import { groupGalleryTemplates, matchesGallerySearch } from '../../templates/gallery';
import type { Language, TranslationKey } from '../../translations';
import { getTemplateSyncMessages } from '../../templateSyncMessages';

const BUILT_IN_PREVIEW_LIMIT = 2;

type BuiltInTemplate = TemplateSectionProps['templates'][number];

interface TemplatesPanelProps {
  t: TranslateFn;
  language: Language;
  expanded: ExpandedSections['templates'];
  onToggle: () => void;
  templates: TemplateSectionProps;
  currentBackgroundType: string;
}

interface BuiltInTemplateCardProps {
  key?: string | number;
  t: TranslateFn;
  language: Language;
  template: BuiltInTemplate;
  isActive: boolean;
  onApply: (id: BuiltInTemplate['id']) => void;
  variant?: 'compact' | 'library';
}

function GalleryFilterChip({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${selected ? 'border-(--app-accent-700) bg-(--app-accent-700) text-white' : 'border-[rgba(34,48,52,0.12)] bg-white text-(--app-accent-700) hover:bg-(--app-accent-50)'}`}
    >
      {label} <span className="text-xs opacity-75">{count}</span>
    </button>
  );
}

function BuiltInTemplateCard({ t, language, template, isActive, onApply, variant = 'compact' }: BuiltInTemplateCardProps) {
  const previewTemplate = resolveTemplateForLanguage(template.id, language) ?? template;
  if (variant === 'library') {
    return (
      <button
        type="button"
        key={template.id}
        onClick={() => onApply(template.id)}
        aria-pressed={isActive}
        className={`group relative flex h-[380px] w-full flex-col overflow-hidden rounded-2xl border bg-[#fdfbf7] text-left transition-all sm:h-[420px] ${
          isActive
            ? 'border-(--app-accent-300) shadow-[0_16px_36px_var(--app-accent-shadow)]'
            : 'border-[rgba(34,48,52,0.08)] hover:border-(--app-accent-200)'
        }`}
      >
        {/* Keep the artwork and sample above the translated caption. */}
        <div
          data-testid={template.id === 'graceful-whitespace' ? 'graceful-gallery-artwork' : 'template-gallery-artwork'}
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          <TemplatePreview template={previewTemplate} language={language} showPoemSample className="absolute inset-0" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.04)_0%,rgba(9,14,23,0.2)_100%)]" />

          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-[rgba(255,255,255,0.35)] bg-[rgba(255,255,255,0.9)] px-2 py-1 text-[10px] font-semibold text-(--app-accent-700) sm:left-3 sm:top-3 sm:text-xs" title={t(template.seriesKey)}>
            {t(template.seriesKey)}
          </span>
        </div>

        <div
          data-testid={template.id === 'graceful-whitespace' ? 'graceful-gallery-caption' : 'template-gallery-caption'}
          className="relative z-10 mx-2 mb-2 min-h-[104px] shrink-0 rounded-xl border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.92)] px-2.5 py-2.5 shadow-[0_10px_24px_rgba(26,44,46,0.1)] sm:mx-3 sm:mb-3 sm:px-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="line-clamp-2 min-w-0 break-words text-sm font-semibold leading-5 text-(--app-ink)" title={t(template.nameKey)}>{t(template.nameKey)}</div>
            {isActive && (
              <span className="shrink-0 rounded-full bg-(--app-accent-700) px-2 py-1 text-[10px] font-semibold text-white">
                {t('templateApplied')}
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-(--app-accent-600)" title={t(template.descriptionKey)}>
            {t(template.descriptionKey)}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      key={template.id}
      onClick={() => onApply(template.id)}
      aria-pressed={isActive}
      className={`flex min-h-28 w-full items-stretch gap-3 rounded-2xl border p-3 text-left transition-all ${
        isActive
          ? 'border-(--app-accent-300) bg-(--app-accent-50) shadow-[0_10px_24px_var(--app-accent-shadow)]'
          : 'border-[rgba(34,48,52,0.08)] bg-white hover:border-(--app-accent-200) hover:bg-(--app-accent-50)'
      }`}
    >
      <TemplatePreview
        template={previewTemplate}
        language={language}
        className="h-auto w-20 shrink-0 rounded-xl border border-[rgba(34,48,52,0.06)]"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold leading-5 text-(--app-ink)">{t(template.nameKey)}</div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isActive ? 'bg-(--app-accent-700) text-white' : 'bg-(--app-accent-50) text-(--app-accent-700)'
              }`}
            >
              {isActive ? t('templateApplied') : t('applyTemplate')}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--app-accent-600)">{t(template.descriptionKey)}</p>
        </div>
        {template.usesBackgroundImage ? (
          <span className="w-fit rounded-full border border-[rgba(37,99,235,0.24)] bg-[rgba(59,130,246,0.08)] px-2 py-0.5 text-xs font-semibold text-[#1d4ed8]">
            {t('templateImageBadge')}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function TemplatesPanel({ t, language, expanded, onToggle, templates, currentBackgroundType }: TemplatesPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<TranslationKey | 'all' | 'custom'>('all');
  const [librarySearch, setLibrarySearch] = useState('');
  const libraryDialogRef = useRef<HTMLDivElement>(null);
  const libraryResultsRef = useRef<HTMLDivElement>(null);

  const activeBuiltIn = templates.templates.find((template) => template.id === templates.activeTemplateId);
  // A previously selected template may no longer be in the featured gallery.
  // Keep its name and compact preview available without advertising it to new users.
  const activeLegacyTemplate = !activeBuiltIn && templates.activeTemplateId
    ? getTemplateDefinition(templates.activeTemplateId)
    : null;
  const activeCustom = templates.customTemplates.find((item) => item.id === templates.activeCustomTemplateId);
  const activeSavedTemplate = activeBuiltIn ?? activeLegacyTemplate;
  const activeName = activeCustom?.name ?? (activeSavedTemplate ? t(activeSavedTemplate.nameKey) : null);

  const groupedTemplates = useMemo(() => groupGalleryTemplates(templates.templates), [templates.templates]);
  const matchingGroups = groupedTemplates.map((group) => ({
    ...group,
    items: group.items.filter((template) => matchesGallerySearch(librarySearch, [
      t(template.nameKey), t(template.descriptionKey), t(template.seriesKey), t(group.key),
    ])),
  }));
  const matchingCustomTemplates = templates.customTemplates.filter((template) =>
    matchesGallerySearch(librarySearch, [template.name, t('myTemplates')]),
  );
  const visibleGroups = matchingGroups.filter((group) =>
    group.items.length > 0 && (libraryCategory === 'all' || libraryCategory === group.key),
  );
  const visibleCustomTemplates = libraryCategory === 'all' || libraryCategory === 'custom' ? matchingCustomTemplates : [];
  const totalMatching = matchingGroups.reduce((total, group) => total + group.items.length, matchingCustomTemplates.length);
  const visibleCount = visibleGroups.reduce((total, group) => total + group.items.length, visibleCustomTemplates.length);

  const selectLibraryCategory = (category: TranslationKey | 'all' | 'custom') => {
    setLibraryCategory(category);
    if (libraryResultsRef.current) libraryResultsRef.current.scrollTop = 0;
  };

  const previewBuiltIns = useMemo(() => {
    const current = activeBuiltIn ?? activeLegacyTemplate;
    if (!current) {
      return templates.templates.slice(0, BUILT_IN_PREVIEW_LIMIT);
    }

    return [
      current,
      ...templates.templates.filter((template) => template.id !== current.id),
    ].slice(0, BUILT_IN_PREVIEW_LIMIT);
  }, [activeBuiltIn, activeLegacyTemplate, templates.templates]);

  const isImageOrAiBg = currentBackgroundType === 'image' || currentBackgroundType === 'ai';
  const syncMessages = getTemplateSyncMessages(language);

  const handleSave = () => {
    const name = templateName.trim();
    templates.onSaveCustomTemplate(name);
    setTemplateName('');
    setIsSaving(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSave();
    if (event.key === 'Escape') {
      setIsSaving(false);
      setTemplateName('');
    }
  };

  const startRenaming = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setDeletingId(null);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      void templates.onRenameCustomTemplate(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitRename();
    if (event.key === 'Escape') setRenamingId(null);
  };

  const handleApplyTemplate = (id: BuiltInTemplate['id']) => {
    templates.onApplyTemplate(id);
    setIsLibraryOpen(false);
  };

  useDialogA11y({ isOpen: isLibraryOpen, dialogRef: libraryDialogRef, onClose: () => setIsLibraryOpen(false) });

  return (
    <>
      <ControlSection
        title={t('templates')}
        icon={<Sparkles className="w-4 h-4" />}
        tint="var(--app-cat-templates)"
        expanded={expanded}
        onToggle={onToggle}
        summary={activeName ?? t('templatesHint')}
        highlighted={!templates.activeTemplateId && !templates.activeCustomTemplateId}
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-(--app-accent-500) uppercase tracking-wide">{t('myTemplates')}</span>
              {!isSaving && (
                <button
                  onClick={() => setIsSaving(true)}
                  className="flex items-center gap-1 text-xs font-medium text-(--app-accent-600) hover:text-(--app-accent-800)"
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
                    onChange={(event) => setTemplateName(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('templateNamePlaceholder')}
                    className="app-input flex-1 text-sm"
                  />
                  <button
                    onClick={handleSave}
                    className="app-button-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    {t('saveTemplate')}
                  </button>
                  <button
                    onClick={() => {
                      setIsSaving(false);
                      setTemplateName('');
                    }}
                    className="p-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) rounded-lg hover:bg-(--app-accent-50)"
                    aria-label={t('closeControls')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {templates.customTemplateSyncError ? (
              <div role="alert" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <p>{templates.customTemplateSyncError === 'load'
                  ? syncMessages.loadFailed
                  : templates.customTemplateSyncError === 'mutation'
                    ? syncMessages.mutationFailed : syncMessages.cacheFailed}</p>
                <button
                  type="button"
                  onClick={templates.onRetryCustomTemplateSync}
                  className="mt-2 min-h-9 rounded-lg border border-amber-500 px-3 font-semibold"
                >
                  {syncMessages.retry}
                </button>
              </div>
            ) : templates.customTemplatesSyncing ? (
              <p role="status" className="mb-3 text-xs text-(--app-accent-600)">{syncMessages.syncing}</p>
            ) : null}
            {templates.hasLegacyCustomTemplates ? (
              <div className="mb-3 rounded-xl border border-(--app-accent-200) bg-(--app-accent-50) p-3 text-xs text-(--app-accent-800)">
                <p>{syncMessages.legacyWarning}</p>
                <button
                  type="button"
                  onClick={templates.onImportLegacyCustomTemplates}
                  disabled={!templates.canImportLegacyCustomTemplates}
                  className="mt-2 min-h-10 rounded-lg border border-(--app-accent-400) px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncMessages.importLegacy}
                </button>
                {!templates.canImportLegacyCustomTemplates ? (
                  <p role="status" className="mt-2">{syncMessages.legacyImportBlocked}</p>
                ) : null}
              </div>
            ) : null}

            {templates.customTemplates.length === 0 ? (
              <p className="text-xs text-[rgba(34,48,52,0.4)] py-2">{t('noCustomTemplates')}</p>
            ) : (
              <div className="grid gap-2">
                {templates.customTemplates.map((template) => {
                  const isActive = templates.activeCustomTemplateId === template.id;
                  const isConfirmingDelete = deletingId === template.id;
                  const isRenaming = renamingId === template.id;

                  return (
                    <div
                      key={template.id}
                      className={`rounded-xl border p-3 transition-all ${
                        isActive
                          ? 'border-(--app-accent-300) bg-(--app-accent-50) shadow-[0_10px_24px_var(--app-accent-shadow)]'
                          : 'border-[rgba(34,48,52,0.08)] bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg shrink-0"
                          style={getTemplatePreviewStyle(template)}
                        />
                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={handleRenameKeyDown}
                              className="app-input w-full text-sm py-0.5"
                              autoFocus
                            />
                          ) : (
                            <div className="text-sm font-semibold text-(--app-ink) truncate">{template.name}</div>
                          )}
                        </div>
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                void templates.onDeleteCustomTemplate(template.id).then(() => setDeletingId(null));
                              }}
                              className="text-[11px] font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                              {t('deleteTemplate')}
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="p-1 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) rounded-lg hover:bg-(--app-accent-50)"
                              aria-label={t('closeControls')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isRenaming ? null : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => templates.onApplyCustomTemplate(template.id)}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                isActive ? 'bg-(--app-accent-700) text-white' : 'bg-(--app-accent-50) text-(--app-accent-700) hover:bg-(--app-accent-100)'
                              }`}
                            >
                              {isActive ? t('templateApplied') : t('applyTemplate')}
                            </button>
                            <button
                              onClick={() => startRenaming(template.id, template.name)}
                              className="p-1 text-[rgba(34,48,52,0.25)] hover:text-(--app-accent-500) rounded-lg hover:bg-(--app-accent-50) transition-colors"
                              title={t('renameTemplate')}
                              aria-label={t('renameTemplate')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingId(template.id)}
                              className="p-1 text-[rgba(34,48,52,0.25)] hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                              aria-label={t('deleteTemplate')}
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

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-(--app-accent-500) uppercase tracking-wide">{t('builtInTemplates')}</span>
              <button
                type="button"
                onClick={() => {
                  setLibraryCategory('all');
                  setLibrarySearch('');
                  setIsLibraryOpen(true);
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-(--app-accent-600) px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:bg-(--app-accent-700) hover:shadow-md active:scale-95"
              >
                <Expand className="h-3.5 w-3.5" />
                {t('quickMore')} ({templates.templates.length})
              </button>
            </div>

            <div className="grid gap-3">
              {previewBuiltIns.map((template) => (
                <BuiltInTemplateCard
                  language={language}
                  key={template.id}
                  t={t}
                  template={template}
                  isActive={templates.activeTemplateId === template.id}
                  onApply={handleApplyTemplate}
                />
              ))}
            </div>
          </div>
        </div>
      </ControlSection>

      {isLibraryOpen ? createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[90]">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(20,29,31,0.45)] backdrop-blur-[4px]"
              onClick={() => setIsLibraryOpen(false)}
              aria-label={t('closeControls')}
            />

            <motion.div
              ref={libraryDialogRef}
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              className="relative z-[91] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,253,249,0.995),rgba(255,249,241,0.98))] shadow-[0_32px_100px_rgba(26,44,46,0.24)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="template-library-title"
              aria-describedby="template-library-description"
              tabIndex={-1}
            >
              <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7 lg:px-10 lg:pb-5">
                <div className="min-w-0">
                  <div className="hidden text-[11px] font-semibold uppercase tracking-[0.24em] text-(--app-accent-500) lg:block">
                    {t('templates')}
                  </div>
                  <h2 id="template-library-title" className="text-xl font-semibold text-(--app-ink) lg:mt-2 lg:text-2xl">{t('builtInTemplates')}</h2>
                  <p id="template-library-description" className="mt-1 max-w-2xl text-xs leading-5 text-(--app-accent-500) lg:mt-2 lg:text-sm">{t('templateLibraryHint')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(false)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(34,48,52,0.08)] bg-white/80 text-(--app-accent-700) transition-colors hover:bg-(--app-accent-50)"
                  aria-label={t('closeControls')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 border-b border-[rgba(34,48,52,0.08)] px-5 pb-3 sm:space-y-3 sm:px-7 lg:px-10">
                <div className="relative max-w-lg">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--app-accent-500)" />
                  <input
                    type="search"
                    aria-label={t('templateSearch')}
                    placeholder={t('templateSearch')}
                    value={librarySearch}
                    onChange={(event) => {
                      setLibrarySearch(event.target.value);
                      if (libraryResultsRef.current) libraryResultsRef.current.scrollTop = 0;
                    }}
                    className="app-input min-h-11 w-full rounded-xl text-sm"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                <div className="relative">
                  <div role="group" aria-label={t('templateFilterCategories')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pr-7 lg:flex-wrap lg:overflow-visible lg:pr-1">
                    <GalleryFilterChip label={t('templateFilterAll')} count={totalMatching} selected={libraryCategory === 'all'} onClick={() => selectLibraryCategory('all')} />
                    {templates.customTemplates.length > 0 && (
                      <GalleryFilterChip label={t('myTemplates')} count={matchingCustomTemplates.length} selected={libraryCategory === 'custom'} onClick={() => selectLibraryCategory('custom')} />
                    )}
                    {matchingGroups.map((group) => (
                      <GalleryFilterChip
                        key={group.key}
                        label={t(group.key)}
                        count={group.items.length}
                        selected={libraryCategory === group.key}
                        onClick={() => selectLibraryCategory(group.key)}
                      />
                    ))}
                  </div>
                  <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-11 w-6 bg-gradient-to-l from-[#fffdf9] to-transparent lg:hidden" />
                </div>
              </div>

              <div ref={libraryResultsRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pt-5 lg:px-10">
                <p role="status" aria-live="polite" className="mb-4 text-xs text-(--app-accent-500)">{t('templateResults')}: {visibleCount}</p>
                {visibleCount === 0 && <p className="rounded-2xl border border-[rgba(34,48,52,0.08)] bg-white/70 px-4 py-8 text-sm text-(--app-accent-600)">{t('templateNoResults')}</p>}
                <div className="space-y-6">
                  {visibleCustomTemplates.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-(--app-accent-500) uppercase tracking-wide">{t('myTemplates')}</span>
                        <span className="text-[10px] text-[rgba(34,48,52,0.4)]">{visibleCustomTemplates.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
                        {visibleCustomTemplates.map((template) => {
                          const isActive = templates.activeCustomTemplateId === template.id;
                          const previewStyle = getTemplatePreviewStyle(template);

                          return (
                            <button
                              key={template.id}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => {
                                templates.onApplyCustomTemplate(template.id);
                                setIsLibraryOpen(false);
                              }}
                              className={`group relative h-[300px] w-full overflow-hidden rounded-2xl border text-left transition-all ${
                                isActive
                                  ? 'border-(--app-accent-300) shadow-[0_16px_36px_var(--app-accent-shadow)]'
                                  : 'border-[rgba(34,48,52,0.08)] hover:border-(--app-accent-200)'
                              }`}
                            >
                              <div className="absolute inset-0" style={previewStyle} />
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.04)_0%,rgba(9,14,23,0.2)_100%)]" />
                              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.92)] px-3 py-2.5 shadow-[0_10px_24px_rgba(26,44,46,0.1)]">
                                <div className="flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-(--app-ink)" title={template.name}>{template.name}</div>
                                    <p className="mt-0.5 text-[11px] leading-4 text-(--app-accent-500)">{t('myTemplates')}</p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    isActive ? 'bg-(--app-accent-700) text-white' : 'bg-(--app-accent-50) text-(--app-accent-700)'
                                  }`}>
                                    {isActive ? t('templateApplied') : t('applyTemplate')}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {visibleGroups.map((group) => (
                    <div key={group.key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-(--app-accent-600) uppercase tracking-wide">{t(group.key)}</h3>
                        <span className="text-[10px] text-[rgba(34,48,52,0.4)]">{group.items.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
                        {group.items.map((template) => (
                          <BuiltInTemplateCard
                            language={language}
                            key={template.id}
                            t={t}
                            template={template}
                            isActive={templates.activeTemplateId === template.id}
                            onApply={handleApplyTemplate}
                            variant="library"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body,
      ) : null}
    </>
  );
}
