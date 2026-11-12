import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { drawStampImpression } from '../../export/stampDraw';
import {
  SEAL_STYLE_DESIGN_IDS, SEAL_STYLE_DESIGN_INFO,
  getActiveSealStyleDesign, getSealStyleDesignPreview,
} from '../../sealStyleCatalog';
import type { SealStyleDesignGroup, SealStyleDesignId } from '../../sealStyleCatalog';
import type { StampConfig, TranslateFn } from '../../types';

type LibraryFilter = 'all' | SealStyleDesignGroup;

/**
 * Each card is a real miniature seal impression (not an emoji or a second
 * renderer). This does not request fonts, images or network resources; if a
 * user already selected a seal-script font, the browser may reuse it.
 */
function SealStyleThumbnail({ id }: { id: SealStyleDesignId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preview = useMemo(() => getSealStyleDesignPreview(id), [id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      // Never initiate a new font fetch on behalf of the sample previews.
      // Repaint if the real text editor has since loaded a traditional face.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 192, 192);
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.translate(48, 48);
      drawStampImpression(ctx, preview, {
        pixelScale: 2,
        applyTransform: false,
        applyOpacity: false,
      });
    };
    paint();
    document.fonts?.addEventListener?.('loadingdone', paint);
    void document.fonts?.ready.then(paint);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', paint);
    };
  }, [preview]);

  return <canvas ref={canvasRef} width={192} height={192}
    aria-hidden="true" className="pointer-events-none h-20 w-20 max-w-full shrink-0" />;
}

export interface SealStyleGalleryProps {
  stamp: StampConfig;
  t: TranslateFn;
  onSelect: (id: SealStyleDesignId) => void;
  onUseSampleText: (text: string) => void;
}

/**
 * Usage categories are separate from shape and actual motif. Applying a card
 * keeps the user's text and never writes gallery examples into the draft.
 */
export function SealStyleGallery({ stamp, t, onSelect, onUseSampleText }: SealStyleGalleryProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [expanded, setExpanded] = useState(true);
  const activeDesign = getActiveSealStyleDesign(stamp);
  const activeInfo = activeDesign ? SEAL_STYLE_DESIGN_INFO[activeDesign] : null;
  const visibleIds = SEAL_STYLE_DESIGN_IDS.filter((id) =>
    filter === 'all' || SEAL_STYLE_DESIGN_INFO[id].group === filter);

  const filters: Array<{ value: LibraryFilter; label: string }> = [
    { value: 'all', label: t('stampLibraryAll') },
    { value: 'text', label: t('stampLibraryText') },
    { value: 'graphic', label: t('stampLibraryGraphic') },
  ];

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[rgba(34,48,52,0.12)] bg-[rgba(244,230,217,0.3)] px-3 py-2 text-left text-xs font-medium text-(--app-accent-700)"
      >
        <span>{t('stampLibraryTitle')}</span>
        <span className="ml-auto min-w-0 truncate text-[11px] text-[#a04434]">
          {activeInfo ? t(activeInfo.labelKey) : t('stampLibraryAll')}
        </span>
        {expanded
          ? <ChevronUp aria-hidden="true" className="h-4 w-4 shrink-0" />
          : <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />}
      </button>
      {expanded && (
        <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('stampLibraryFilter')}>
        {filters.map((item) => (
          <button key={item.value} type="button"
            aria-pressed={filter === item.value}
            className={'rounded-full border px-3 py-1.5 text-xs font-medium ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(154,48,37,0.65)] ' +
              (filter === item.value
                ? 'border-[#af3b2b] bg-[#f8e8dd] text-[#8e3328]'
                : 'border-[rgba(34,48,52,0.14)] bg-[#fffdfa] text-(--app-accent-700)')}
            onClick={() => setFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('stampLibraryTitle')}>
        {visibleIds.map((id) => {
          const info = SEAL_STYLE_DESIGN_INFO[id];
          const selected = activeDesign === id;
          return (
            <button key={id} type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelect(id);
                // After choosing a design, reveal text/shape/ink controls without
                // forcing the user past ten large cards every time they edit.
                setExpanded(false);
              }}
              className={'flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-xl border p-1.5 ' +
                'text-center text-xs font-medium transition-colors ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(154,48,37,0.65)] ' +
                (selected
                  ? 'border-[#ae3428] bg-[#fceee7] text-[#893227]'
                  : 'border-[rgba(34,48,52,0.12)] bg-[#fffdfa] text-(--app-accent-700) hover:border-[#ae3428]')}>
              <SealStyleThumbnail id={id} />
              <span>{t(info.labelKey)}</span>
            </button>
          );
        })}
      </div>
        </>
      )}

      {activeInfo?.sampleText && activeInfo.group === 'text' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[rgba(244,230,217,0.35)] px-2.5 py-2">
          <span className="text-xs text-(--app-accent-500)">
            {t('stampLibrarySampleHint')}: {activeInfo.sampleText}
          </span>
          <button type="button" onClick={() => onUseSampleText(activeInfo.sampleText!)}
            className="rounded-md border border-[rgba(154,48,37,0.25)] px-2.5 py-1.5 text-xs font-medium text-[#8e3328]">
            {t('stampLibraryUseSample')}
          </button>
        </div>
      )}
    </div>
  );
}
