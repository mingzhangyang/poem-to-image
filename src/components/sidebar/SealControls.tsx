import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getVerifiedSealFont } from '../../sealFontSources';
import { reconcileStampGlyphEdits } from '../../sealGlyphEditing';
import { replaceSealVariantAt } from '../../sealVariantChoices';
import { useSealFontInspection } from '../../hooks/useSealFontInspection';
import { getStampCharacters, getStampShapeRatio, isExtendedStampStyle, limitStampText } from '../../stampRendering';
import { getNaturalSealSeed } from '../../naturalSealTexture';
import { CNS_SEAL_FONT_STACK, isSealScriptFont, isTraditionalStamp } from '../../sealTypography';
import type { DecorationsSectionProps, StampStyle, TranslateFn } from '../../types';
import { getSealStyleDesignUpdates } from '../../sealStyleCatalog';
import { isSealMotifId } from '../../sealMotifs';
import { SealCompositionControls } from './SealCompositionControls';
import { SealFontControls } from './SealFontControls';
import { SealGlyphFineEditor } from './SealGlyphFineEditor';
import { SealInkControls } from './SealInkControls';
import { SealMotifPicker } from './SealMotifPicker';
import { SealStyleGallery } from './SealStyleGallery';

interface SealControlsProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Seal toggle and, when the seal is shown, every seal setting. */
export function SealControls({ t, decorations }: SealControlsProps) {
  const isComposingRef = useRef(false);
  const [stampInputText, setStampInputText] = useState(decorations.stamp.text);
  // Default open keeps familiar, testable editor controls accessible;
  // readers can collapse glyph-level adjustments for a simpler view.
  const [showAdvancedSealSettings, setShowAdvancedSealSettings] = useState(true);

  useEffect(() => {
    if (!isComposingRef.current) {
      setStampInputText(decorations.stamp.text);
    }
  }, [decorations.stamp.text]);

  const applyStampText = (text: string) => {
    const next = limitStampText(text);
    const leaveName = decorations.stamp.compositionMode === 'name'
      && getStampCharacters(next).length !== 3;
    decorations.onStampChange({
      text: next,
      ...(decorations.stamp.glyphEdits
        ? { glyphEdits: reconcileStampGlyphEdits(decorations.stamp.text, next, decorations.stamp.glyphEdits) }
        : {}),
      ...(leaveName ? { compositionMode: 'whole' as const, compositionVariant: 0 as const } : {}),
    });
  };
  const verifiedFace = getVerifiedSealFont(decorations.stamp.fontFamily);
  const inspected = useSealFontInspection(
    decorations.stamp.fontFamily, decorations.stamp.text,
    decorations.showStamp && decorations.stampSupported && !isSealMotifId(decorations.stamp.motifId),
    true,
  );

  return (
    <>
      {decorations.stampSupported ? (
        <div className="flex items-center justify-between">
          <label className="text-xs text-(--app-accent-700) flex items-center gap-2">
            <input
              type="checkbox"
              checked={decorations.showStamp}
              onChange={(event) => decorations.onShowStampChange(event.target.checked)}
              className="app-checkbox rounded"
            />
            {t('showStamp')}
          </label>
          {decorations.showStamp ? (
            <span className="text-[11px] font-medium rounded-full bg-[rgba(155,95,67,0.12)] px-2 py-1 text-[#8a523b]">{t('dragStampHint')}</span>
          ) : null}
        </div>
      ) : null}

      {decorations.showStamp && decorations.stampSupported ? (
        <div className="rounded-xl bg-white border border-[rgba(34,48,52,0.08)] p-3 space-y-3">
          <SealStyleGallery
            stamp={decorations.stamp}
            t={t}
            onSelect={(id) => decorations.onStampChange({
              ...getSealStyleDesignUpdates(id),
              // The selected design changes visual defaults, never identity.
              textureSeed: getNaturalSealSeed(decorations.stamp),
            })}
            onUseSampleText={applyStampText}
          />

          <div>
            <label className="mb-1 block text-xs text-(--app-accent-500)">{t('stampMode')}</label>
            <select
              aria-label={t('stampMode')}
              value={decorations.stamp.mode ?? 'modern'}
              onChange={(event) => {
                const mode = event.target.value as 'zhuwen' | 'baiwen' | 'modern';
                // Preserve the hidden text font while changing a graphic seal's face.
                const textSeal = !isSealMotifId(decorations.stamp.motifId);
                decorations.onStampChange({
                  mode,
                  ...(mode === 'zhuwen' ? { colorScheme: 'outline' as const } : {}),
                  ...(mode === 'baiwen' ? { colorScheme: 'filled' as const } : {}),
                  ...(textSeal && mode !== 'modern' && !isSealScriptFont(decorations.stamp.fontFamily)
                    ? { fontFamily: CNS_SEAL_FONT_STACK } : {}),
                  ...(textSeal && mode === 'modern' && isSealScriptFont(decorations.stamp.fontFamily)
                    ? { fontFamily: '"Ma Shan Zheng", cursive' } : {}),
                });
              }}
              className="app-select text-sm"
            >
              <option value="modern">{t('stampModeModern')}</option>
              <option value="zhuwen">{t('stampColorOutline')}</option>
              <option value="baiwen">{t('stampColorFilled')}</option>
            </select>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <label className="text-xs text-(--app-accent-500)">{t(isSealMotifId(decorations.stamp.motifId) ? 'stampArtwork' : 'stampText')}</label>
            <button
              type="button"
              onClick={decorations.onResetStampPosition}
              className="text-[11px] font-medium"
              style={{ color: 'var(--app-accent-600)' }}
            >
              {t('resetStampPosition')}
            </button>
            {!isSealMotifId(decorations.stamp.motifId) && (
              <input
                type="text"
                aria-label={t('stampText')}
                value={stampInputText}
                onChange={(event) => {
                  const newValue = isComposingRef.current
                    ? event.target.value
                    : limitStampText(event.target.value);
                  setStampInputText(newValue);
                  if (!isComposingRef.current) {
                    applyStampText(newValue);
                  }
                }}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={(event) => {
                  isComposingRef.current = false;
                  const finalValue = limitStampText((event.target as HTMLInputElement).value);
                  setStampInputText(finalValue);
                  applyStampText(finalValue);
                }}
                className="app-input col-span-2 text-sm text-center"
                placeholder={t('stampText')}
              />
            )}
          </div>
          {!isSealMotifId(decorations.stamp.motifId) && verifiedFace && inspected.suggestions.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 space-y-2"
              role="region" aria-label={t('stampVariantHeading')}>
              <p className="text-xs font-semibold text-amber-950">{t('stampVariantHeading')}</p>
              {inspected.suggestions.map((row) => (
                <div key={row.index} className="space-y-1 text-xs text-amber-950">
                  <p>{row.index + 1}. {row.original} — {row.required ? t('stampVariantRequired') : t('stampVariantOptional')}</p>
                  <div className="flex flex-wrap gap-1">
                    {row.choices.map((choice) => (
                      <button type="button" key={choice.character}
                        className="rounded border border-amber-400 bg-white px-2 py-1 font-medium hover:bg-amber-100"
                        onClick={() => {
                          const next = replaceSealVariantAt(decorations.stamp.text, row.index, row.original, choice.character);
                          if (next !== decorations.stamp.text) applyStampText(next);
                        }}>
                        {row.original} → {choice.character}{choice.gloss ? ' (' + choice.gloss + ')' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-amber-800">{t('stampVariantConfirmation')}</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-(--app-accent-500) mb-1">{t('stampStyle')}</label>
            <select
              aria-label={t('stampStyle')}
              value={decorations.stamp.style}
              onChange={(event) => decorations.onStampChange({ style: event.target.value as StampStyle })}
              className="app-select text-sm"
            >
              <option value="square">{t('stampStyleSquare')}</option>
              <option value="round">{t('stampStyleRound')}</option>
              <option value="brush">{t('stampStyleBrush')}</option>
              <option value="rect-vertical">{t('stampStyleRectVertical')}</option>
              <option value="rect-horizontal">{t('stampStyleRectHorizontal')}</option>
              <option value="oval">{t('stampStyleOval')}</option>
            </select>
          </div>

          {!isSealMotifId(decorations.stamp.motifId) && isTraditionalStamp(decorations.stamp) && (
            <SealCompositionControls
              stamp={decorations.stamp}
              t={t}
              onChange={decorations.onStampChange}
            />
          )}

          {!isSealMotifId(decorations.stamp.motifId) && isTraditionalStamp(decorations.stamp) && (
            <SealGlyphFineEditor
              stamp={decorations.stamp}
              t={t}
              onChange={decorations.onStampChange}
            />
          )}

          {isExtendedStampStyle(decorations.stamp.style) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
                <span>{t('stampShapeRatio')}</span>
                <span>{Math.round(getStampShapeRatio(decorations.stamp) * 100)}%</span>
              </div>
              <input
                type="range"
                aria-label={t('stampShapeRatio')}
                aria-valuetext={`${Math.round(getStampShapeRatio(decorations.stamp) * 100)}%`}
                min="45"
                max="90"
                step="1"
                value={Math.round(getStampShapeRatio(decorations.stamp) * 100)}
                onChange={(event) => decorations.onStampChange({ shapeRatio: Number(event.target.value) / 100 })}
                className="app-range app-range-warm"
              />
            </div>
          )}

          <SealMotifPicker
            value={isSealMotifId(decorations.stamp.motifId) ? decorations.stamp.motifId : undefined}
            onChange={(motifId) => decorations.onStampChange({ motifId })}
            t={t}
          />

          <SealInkControls
            stamp={decorations.stamp}
            t={t}
            onChange={decorations.onStampChange}
          />

          <button
            type="button"
            aria-expanded={showAdvancedSealSettings}
            onClick={() => setShowAdvancedSealSettings((previous) => !previous)}
            className="flex w-full items-center justify-between rounded-lg border border-[rgba(34,48,52,0.12)] bg-[rgba(244,230,217,0.24)] px-3 py-2 text-xs font-medium text-(--app-accent-700)"
          >
            {t('stampAdvancedSettings')}
            {showAdvancedSealSettings
              ? <ChevronUp aria-hidden="true" className="h-4 w-4" />
              : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
          </button>

          {showAdvancedSealSettings && !isSealMotifId(decorations.stamp.motifId) && (
            <SealFontControls
              stamp={decorations.stamp}
              t={t}
              onChange={decorations.onStampChange}
              inspected={inspected}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
              <span>{t('stampSize')}</span>
              <span>{decorations.stamp.size}px</span>
            </div>
            <input
              type="range"
              aria-label={t('stampSize')}
              aria-valuetext={`${decorations.stamp.size}px`}
              min="56"
              max="180"
              value={decorations.stamp.size}
              onChange={(event) => decorations.onStampChange({ size: Number(event.target.value) })}
              className="app-range app-range-warm"
            />
          </div>

          {showAdvancedSealSettings && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
                  <span>{t('stampRotation')}</span>
                  <span>{decorations.stamp.rotation}°</span>
                </div>
                <input
                  type="range"
                  aria-label={t('stampRotation')}
                  aria-valuetext={`${decorations.stamp.rotation}°`}
                  min="-45"
                  max="45"
                  value={decorations.stamp.rotation}
                  onChange={(event) => decorations.onStampChange({ rotation: Number(event.target.value) })}
                  className="app-range app-range-warm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-(--app-accent-500)">
                  <span>{t('stampOpacity')}</span>
                  <span>{Math.round(decorations.stamp.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label={t('stampOpacity')}
                  aria-valuetext={`${Math.round(decorations.stamp.opacity * 100)}%`}
                  min="35"
                  max="100"
                  value={Math.round(decorations.stamp.opacity * 100)}
                  onChange={(event) => decorations.onStampChange({ opacity: Number(event.target.value) / 100 })}
                  className="app-range app-range-warm"
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
