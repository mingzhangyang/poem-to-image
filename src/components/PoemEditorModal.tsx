import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlignCenter, AlignLeft, AlignRight, BookOpenText, SlidersHorizontal, X } from 'lucide-react';
import type { ContentSectionProps, PoemSectionPlacement, TextAlign, TranslateFn } from '../types';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface PoemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslateFn;
  content: ContentSectionProps;
}

interface LayerControlCardProps {
  title: string;
  scale?: number;
  opacity?: number;
  lineHeight?: number;
  letterSpacing?: number;
  bodyGap?: number;
  align?: TextAlign;
  placement?: PoemSectionPlacement | Exclude<PoemSectionPlacement, 'after-author'>;
  onScaleChange?: (value: number) => void;
  onOpacityChange?: (value: number) => void;
  onLineHeightChange?: (value: number) => void;
  onLetterSpacingChange?: (value: number) => void;
  onBodyGapChange?: (value: number) => void;
  onAlignChange?: (value: TextAlign) => void;
  onPlacementChange?: (value: PoemSectionPlacement | Exclude<PoemSectionPlacement, 'after-author'>) => void;
  placementOptions?: Array<{ value: PoemSectionPlacement | Exclude<PoemSectionPlacement, 'after-author'>; label: string }>;
  t: TranslateFn;
}

function LayerControlCard({
  title,
  scale,
  opacity,
  lineHeight,
  letterSpacing,
  bodyGap,
  align,
  placement,
  onScaleChange,
  onOpacityChange,
  onLineHeightChange,
  onLetterSpacingChange,
  onBodyGapChange,
  onAlignChange,
  onPlacementChange,
  placementOptions,
  t,
}: LayerControlCardProps) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.9)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {scale !== undefined ? (
          <span className="rounded-full bg-[rgba(237,244,243,0.88)] px-2.5 py-1 text-[11px] font-medium text-(--app-accent-700)">
            {Math.round(scale * 100)}%
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {scale !== undefined && onScaleChange ? (
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              {t('fontSize')} ({Math.round(scale * 100)}%)
            </label>
            <input
              type="range"
              min="70"
              max="160"
              step="1"
              value={Math.round(scale * 100)}
              onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
              className="app-range"
            />
          </div>
        ) : null}

        {opacity !== undefined && onOpacityChange ? (
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              {t('opacity')} ({Math.round(opacity * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(opacity * 100)}
              onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
              className="app-range"
            />
          </div>
        ) : null}

        {lineHeight !== undefined && onLineHeightChange ? (
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              {t('lineHeight')} ({lineHeight.toFixed(2)})
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={lineHeight}
              onChange={(event) => onLineHeightChange(Number(event.target.value))}
              className="app-range"
            />
          </div>
        ) : null}

        {letterSpacing !== undefined && onLetterSpacingChange ? (
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              {t('letterSpacing')} ({letterSpacing}px)
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={letterSpacing}
              onChange={(event) => onLetterSpacingChange(Number(event.target.value))}
              className="app-range"
            />
          </div>
        ) : null}

        {bodyGap !== undefined && onBodyGapChange ? (
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              {t('sectionGap')} ({bodyGap}px)
            </label>
            <input
              type="range"
              min="0"
              max="120"
              step="1"
              value={bodyGap}
              onChange={(event) => onBodyGapChange(Number(event.target.value))}
              className="app-range"
            />
          </div>
        ) : null}

        {align !== undefined && onAlignChange ? (
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">{t('alignment')}</label>
            <div className="app-segment flex p-1 rounded-lg">
              {([
                { value: 'left', icon: <AlignLeft className="h-4 w-4" />, label: t('alignLeft') },
                { value: 'center', icon: <AlignCenter className="h-4 w-4" />, label: t('alignCenter') },
                { value: 'right', icon: <AlignRight className="h-4 w-4" />, label: t('alignRight') },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAlignChange(option.value)}
                  className={`flex-1 rounded-md py-1.5 flex items-center justify-center transition-all ${
                    align === option.value ? 'app-segment-button-active' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label={option.label}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {placement !== undefined && onPlacementChange && placementOptions ? (
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t('relativePosition')}</label>
            <select
              value={placement}
              onChange={(event) => onPlacementChange(event.target.value as typeof placement)}
              className="app-select text-sm"
            >
              {placementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PoemEditorModal({ isOpen, onClose, t, content }: PoemEditorModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titlePlacementOptions = [
    { value: 'before-body' as const, label: t('positionBeforeBody') },
    { value: 'after-body' as const, label: t('positionAfterBody') },
  ];
  const authorPlacementOptions = [
    { value: 'before-body' as const, label: t('positionBeforeBody') },
    { value: 'after-body' as const, label: t('positionAfterBody') },
  ];
  const sourcePlacementOptions = [
    { value: 'before-body' as const, label: t('positionBeforeBody') },
    { value: 'after-body' as const, label: t('positionAfterBody') },
    { value: 'after-author' as const, label: t('positionAfterAuthor') },
  ];

  useDialogA11y({ isOpen, dialogRef, onClose });

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[90]">
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[rgba(20,29,31,0.45)] backdrop-blur-[4px]"
          onClick={onClose}
          aria-label={t('closeControls')}
        />

        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="relative z-[91] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,253,249,0.995),rgba(255,249,241,0.98))] shadow-[0_32px_100px_rgba(26,44,46,0.24)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="poem-editor-title"
          aria-describedby="poem-editor-description"
          tabIndex={-1}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[rgba(34,48,52,0.06)] px-5 py-5 sm:px-7 lg:px-10">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--app-accent-500)">
                {t('content')}
              </div>
              <h2 id="poem-editor-title" className="mt-2 text-2xl font-semibold text-gray-900">{t('poemEditorTitle')}</h2>
              <p id="poem-editor-description" className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{t('poemEditorHint')}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(34,48,52,0.08)] bg-white/80 text-(--app-accent-700) transition-colors hover:bg-(--app-accent-50)"
              aria-label={t('closeControls')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]">
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 lg:px-10">
              <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--app-accent-500)">
                <BookOpenText className="h-4 w-4" />
                <span>{t('poemEditorTextSection')}</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-gray-500">{t('poemTitle')}</label>
                    <input
                      className="app-input text-sm"
                      value={content.poem.title}
                      onChange={(event) => content.onTitleChange(event.target.value)}
                      placeholder={t('poemTitle')}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-gray-500">{t('poemAuthor')}</label>
                    <input
                      className="app-input text-sm"
                      value={content.poem.author}
                      onChange={(event) => content.onAuthorChange(event.target.value)}
                      placeholder={t('poemAuthor')}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">{t('poemBody')}</label>
                  <textarea
                    className="app-textarea h-[min(56vh,42rem)] resize-none text-sm leading-7"
                    value={content.poem.body}
                    onChange={(event) => content.onBodyChange(event.target.value)}
                    placeholder={t('enterPoem')}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">{t('poemSource')}</label>
                  <input
                    className="app-input text-sm"
                    value={content.poem.sourceNote}
                    onChange={(event) => content.onSourceNoteChange(event.target.value)}
                    placeholder={t('poemSource')}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto border-t border-[rgba(34,48,52,0.06)] bg-[rgba(245,241,232,0.52)] px-5 py-5 sm:px-7 lg:border-l lg:border-t-0 lg:px-8">
              <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--app-accent-500)">
                <SlidersHorizontal className="h-4 w-4" />
                <span>{t('poemLayerStyles')}</span>
              </div>

              <div className="space-y-4">
                <LayerControlCard
                  title={t('poemTitle')}
                  scale={content.poemStyle.titleScale}
                  opacity={content.poemStyle.titleOpacity}
                  onScaleChange={(value) => content.onPoemStyleChange({ titleScale: value })}
                  onOpacityChange={(value) => content.onPoemStyleChange({ titleOpacity: value })}
                  lineHeight={content.poemStyle.titleLineHeight}
                  letterSpacing={content.poemStyle.titleLetterSpacing}
                  bodyGap={content.poemStyle.titleBodyGap}
                  align={content.poemStyle.titleAlign}
                  placement={content.poemStyle.titlePlacement}
                  onLineHeightChange={(value) => content.onPoemStyleChange({ titleLineHeight: value })}
                  onLetterSpacingChange={(value) => content.onPoemStyleChange({ titleLetterSpacing: value })}
                  onBodyGapChange={(value) => content.onPoemStyleChange({ titleBodyGap: value })}
                  onAlignChange={(value) => content.onPoemStyleChange({ titleAlign: value })}
                  onPlacementChange={(value) => content.onPoemStyleChange({ titlePlacement: value as 'before-body' | 'after-body' })}
                  placementOptions={titlePlacementOptions}
                  t={t}
                />

                <LayerControlCard
                  title={t('poemBody')}
                  lineHeight={content.poemStyle.bodyLineHeight}
                  letterSpacing={content.poemStyle.bodyLetterSpacing}
                  align={content.poemStyle.bodyAlign}
                  onLineHeightChange={(value) => content.onPoemStyleChange({ bodyLineHeight: value })}
                  onLetterSpacingChange={(value) => content.onPoemStyleChange({ bodyLetterSpacing: value })}
                  onAlignChange={(value) => content.onPoemStyleChange({ bodyAlign: value })}
                  t={t}
                />

                <LayerControlCard
                  title={t('poemAuthor')}
                  scale={content.poemStyle.authorScale}
                  opacity={content.poemStyle.authorOpacity}
                  onScaleChange={(value) => content.onPoemStyleChange({ authorScale: value })}
                  onOpacityChange={(value) => content.onPoemStyleChange({ authorOpacity: value })}
                  lineHeight={content.poemStyle.authorLineHeight}
                  letterSpacing={content.poemStyle.authorLetterSpacing}
                  bodyGap={content.poemStyle.authorBodyGap}
                  align={content.poemStyle.authorAlign}
                  placement={content.poemStyle.authorPlacement}
                  onLineHeightChange={(value) => content.onPoemStyleChange({ authorLineHeight: value })}
                  onLetterSpacingChange={(value) => content.onPoemStyleChange({ authorLetterSpacing: value })}
                  onBodyGapChange={(value) => content.onPoemStyleChange({ authorBodyGap: value })}
                  onAlignChange={(value) => content.onPoemStyleChange({ authorAlign: value })}
                  onPlacementChange={(value) => content.onPoemStyleChange({ authorPlacement: value as 'before-body' | 'after-body' })}
                  placementOptions={authorPlacementOptions}
                  t={t}
                />

                <LayerControlCard
                  title={t('poemSource')}
                  scale={content.poemStyle.sourceScale}
                  opacity={content.poemStyle.sourceOpacity}
                  lineHeight={content.poemStyle.sourceLineHeight}
                  letterSpacing={content.poemStyle.sourceLetterSpacing}
                  bodyGap={content.poemStyle.sourceGap}
                  align={content.poemStyle.sourceAlign}
                  placement={content.poemStyle.sourcePlacement}
                  onScaleChange={(value) => content.onPoemStyleChange({ sourceScale: value })}
                  onOpacityChange={(value) => content.onPoemStyleChange({ sourceOpacity: value })}
                  onLineHeightChange={(value) => content.onPoemStyleChange({ sourceLineHeight: value })}
                  onLetterSpacingChange={(value) => content.onPoemStyleChange({ sourceLetterSpacing: value })}
                  onBodyGapChange={(value) => content.onPoemStyleChange({ sourceGap: value })}
                  onAlignChange={(value) => content.onPoemStyleChange({ sourceAlign: value })}
                  onPlacementChange={(value) => content.onPoemStyleChange({ sourcePlacement: value as PoemSectionPlacement })}
                  placementOptions={sourcePlacementOptions}
                  t={t}
                />
              </div>

              <button
                type="button"
                onClick={content.onResetPoemStyle}
                className="mt-5 inline-flex rounded-full border border-[rgba(34,48,52,0.08)] bg-white/80 px-4 py-2 text-sm font-medium text-(--app-accent-700) transition-colors hover:bg-(--app-accent-50)"
              >
                {t('resetLayerStyles')}
              </button>
            </div>
          </div>

          <div className="flex justify-end border-t border-[rgba(34,48,52,0.06)] px-5 py-4 sm:px-7">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-(--app-accent-700) px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_var(--app-accent-shadow)] transition-colors hover:bg-(--app-accent-800)"
            >
              {t('doneEditingPoem')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    ,
    document.body,
  );
}
