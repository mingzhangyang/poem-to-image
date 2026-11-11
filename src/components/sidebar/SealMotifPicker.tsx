import { useEffect, useRef } from 'react';
import { Stamp } from 'lucide-react';
import { drawSealMotif, SEAL_MOTIF_IDS } from '../../sealMotifs';
import type { SealMotifId } from '../../sealMotifs';
import type { TranslateFn } from '../../types';

const MOTIF_LABELS: Record<SealMotifId,
  'stampMotifDragon' | 'stampMotifPhoenix' | 'stampMotifPlum' | 'stampMotifBamboo' |
  'stampMotifPine' | 'stampMotifLandscape' | 'stampMotifLotus' | 'stampMotifClouds'> = {
  dragon: 'stampMotifDragon',
  phoenix: 'stampMotifPhoenix',
  plum: 'stampMotifPlum',
  bamboo: 'stampMotifBamboo',
  pine: 'stampMotifPine',
  landscape: 'stampMotifLandscape',
  lotus: 'stampMotifLotus',
  clouds: 'stampMotifClouds',
};

/** Lightweight previews reuse the exact vector paths of the real ink. */
function MotifThumbnail({ motifId }: { motifId: SealMotifId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 112, 112);
    ctx.scale(2, 2);
    ctx.translate(28, 28);
    ctx.scale(0.47, 0.47);
    ctx.strokeStyle = '#ad3328';
    ctx.fillStyle = '#ad3328';
    drawSealMotif(ctx, motifId);
  }, [motifId]);

  return <canvas ref={canvasRef} width={112} height={112}
    aria-hidden="true" className="pointer-events-none h-14 w-14 max-w-full" />;
}

interface SealMotifPickerProps {
  value?: SealMotifId;
  onChange: (value: SealMotifId | undefined) => void;
  t: TranslateFn;
}

/** Phase 4B motif selection; the full seal gallery belongs to Phase 4C. */
export function SealMotifPicker({ value, onChange, t }: SealMotifPickerProps) {
  const buttonStyle = (selected: boolean) => 'min-h-[88px] rounded-lg border p-1.5 ' +
    'flex flex-col items-center justify-center gap-1 text-[11px] leading-tight ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(154,48,37,0.65)] ' +
    (selected ? 'border-[#b1372b] bg-[#fbece5] text-[#8c2922]'
      : 'border-[rgba(34,48,52,0.12)] bg-[#fdf8f2] text-(--app-accent-700) hover:border-[#b1372b]');
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs text-(--app-accent-500)">{t('stampArtwork')}</legend>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" aria-pressed={value === undefined}
          className={buttonStyle(value === undefined)} onClick={() => onChange(undefined)}>
          <span className="flex h-14 w-14 max-w-full items-center justify-center">
            <Stamp aria-hidden="true" className="h-7 w-7" />
          </span>
          <span>{t('stampMotifText')}</span>
        </button>
        {SEAL_MOTIF_IDS.map((motifId) => (
          <button key={motifId} type="button" aria-pressed={value === motifId}
            className={buttonStyle(value === motifId)} onClick={() => onChange(motifId)}>
            <MotifThumbnail motifId={motifId} />
            <span>{t(MOTIF_LABELS[motifId])}</span>
          </button>
        ))}
      </div>
      {value !== undefined && (
        <p className="text-[11px] text-(--app-accent-500)">{t('stampMotifHint')}</p>
      )}
    </fieldset>
  );
}
