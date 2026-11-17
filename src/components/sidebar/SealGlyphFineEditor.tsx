import { useState } from 'react';
import { ChevronDown, ChevronUp, Lock, LockOpen, RotateCcw } from 'lucide-react';
import { getStampCharacters } from '../../stampRendering';
import { isWholeSealComposition } from '../../sealWholeComposition';
import {
  getActiveStampGlyphEdits, getStampGlyphEdit, resetStampGlyphEdit,
  resetUnlockedStampGlyphEdits, updateStampGlyphEdit,
} from '../../sealGlyphEditing';
import type { StampConfig, StampGlyphEdit, TranslateFn } from '../../types';

interface SealGlyphFineEditorProps {
  stamp: StampConfig;
  t: TranslateFn;
  onChange: (updates: Partial<StampConfig>) => void;
}

const controls = [
  { key: 'offsetX', label: 'stampGlyphOffsetX', min: -20, max: 20, step: 1, unit: '%' },
  { key: 'offsetY', label: 'stampGlyphOffsetY', min: -20, max: 20, step: 1, unit: '%' },
  { key: 'widthPct', label: 'stampGlyphWidth', min: 70, max: 130, step: 5, unit: '%' },
  { key: 'heightPct', label: 'stampGlyphHeight', min: 70, max: 130, step: 5, unit: '%' },
] as const;

/** Accessible, mobile-friendly numeric glyph edits. The stamp's single
 * persisted document owns all values; no parallel mutable canvas state. */
export function SealGlyphFineEditor({ stamp, t, onChange }: SealGlyphFineEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  if (!isWholeSealComposition(stamp)) return null;
  const characters = getStampCharacters(stamp.text);
  const index = Math.min(selectedIndex, characters.length - 1);
  const edit = getStampGlyphEdit(stamp, index);
  const edits = getActiveStampGlyphEdits(stamp);
  const hasUnlockedEdits = edits.some(item => !item.locked);
  const hasSelectedEdit = edits.some(item => item.index === index);
  const change = (patch: Partial<Pick<StampGlyphEdit,
    'offsetX' | 'offsetY' | 'widthPct' | 'heightPct' | 'locked'>>) => {
    onChange({ glyphEdits: updateStampGlyphEdit(stamp, index, patch) });
  };
  return (
    <div className="rounded-lg border border-[rgba(34,48,52,0.12)] bg-white/65 p-2.5 space-y-2">
      <button type="button" className="flex w-full min-h-11 items-center justify-between text-left text-xs font-semibold text-(--app-accent-700)"
        onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <span>{t('stampGlyphEditor')}</span>
        {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> :
          <ChevronDown aria-hidden="true" className="h-4 w-4" />}
      </button>
      {expanded && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('stampGlyphSelect')}>
            {characters.map((character, glyphIndex) => {
              const glyphEdit = getStampGlyphEdit(stamp, glyphIndex);
              return (
                <button key={glyphIndex} type="button"
                  aria-label={t('stampGlyphSelect') + ' ' + (glyphIndex + 1) + ': ' + character}
                  aria-pressed={index === glyphIndex}
                  className={'min-h-11 min-w-11 rounded-lg border px-2 text-base font-medium ' +
                    (index === glyphIndex
                      ? 'border-(--app-accent-700) bg-(--app-accent-700) text-white'
                      : 'border-(--app-accent-200) bg-white text-(--app-accent-700)')}
                  onClick={() => setSelectedIndex(glyphIndex)}>
                  {character}{glyphEdit.locked ? <Lock className="inline ms-1 h-3 w-3" aria-hidden="true"/> : null}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-(--app-accent-500)" aria-live="polite">
            {t('stampGlyphSelect')} {index + 1}/{characters.length} · {characters[index]}
          </p>
          <button type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--app-accent-200) px-3 text-xs font-semibold text-(--app-accent-700)"
            aria-pressed={edit.locked}
            onClick={() => change({ locked: !edit.locked })}>
            {edit.locked ? <Lock className="h-4 w-4" aria-hidden="true"/> :
              <LockOpen className="h-4 w-4" aria-hidden="true"/>}
            {t(edit.locked ? 'stampGlyphUnlock' : 'stampGlyphLock')}
          </button>
          <div className="grid grid-cols-1 gap-2">
            {controls.map(({ key, label, min, max, step, unit }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs text-(--app-accent-500)">
                  <label htmlFor={'seal-glyph-' + key}>{t(label)}</label>
                  <span>{edit[key]}{unit}</span>
                </div>
                <input type="range" id={'seal-glyph-' + key} min={min} max={max}
                  step={step} value={edit[key]} disabled={edit.locked}
                  aria-valuetext={String(edit[key]) + unit}
                  className="app-range app-range-warm w-full disabled:opacity-50"
                  onChange={event => change({ [key]: Number(event.target.value) } as Partial<StampGlyphEdit>)}/>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!hasSelectedEdit || edit.locked}
              className="min-h-11 rounded-lg border border-(--app-accent-200) px-3 text-xs disabled:opacity-50"
              onClick={() => onChange({ glyphEdits: resetStampGlyphEdit(stamp, index) })}>
              <RotateCcw className="me-1 inline h-3.5 w-3.5" aria-hidden="true"/>
              {t('stampGlyphReset')}
            </button>
            <button type="button" disabled={!hasUnlockedEdits}
              className="min-h-11 rounded-lg border border-(--app-accent-200) px-3 text-xs disabled:opacity-50"
              onClick={() => onChange({ glyphEdits: resetUnlockedStampGlyphEdits(stamp) })}>
              {t('stampGlyphResetUnlocked')}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-(--app-accent-500)" role="note">
            {t('stampGlyphEditingHelp')}
          </p>
        </>
      )}
    </div>
  );
}
