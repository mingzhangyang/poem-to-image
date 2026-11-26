import { Trash2 } from 'lucide-react';
import { SIGNATURE_FONTS } from '../../signatureRendering';
import type { DecorationsSectionProps, SignatureFlourish, TranslateFn } from '../../types';

interface SignatureListProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Controls for each handwritten signature on the card. */
export function SignatureList({ t, decorations }: SignatureListProps) {
  if (decorations.signatures.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-(--app-accent-500) uppercase tracking-wider">{t('signatures')}</div>
      {decorations.signatures.map((sig) => (
        <div key={sig.id} className="app-soft-surface p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              defaultValue={sig.text}
              key={sig.id + '-text'}
              onBlur={(e) => decorations.onSignatureChange(sig.id, { text: e.target.value })}
              className="app-input flex-1 p-1.5 text-sm"
              placeholder={t('signatureText')}
            />
            <button
              onClick={() => decorations.onSignatureRemove(sig.id)}
              className="p-1.5 text-[#8a523b] hover:bg-[rgba(155,95,67,0.12)] rounded transition-colors"
              aria-label={t('deleteTemplate')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-(--app-accent-500) mb-1">{t('signatureFont')}</label>
            <select
              aria-label={t('signatureFont')}
              value={sig.font}
              onChange={(e) => decorations.onSignatureChange(sig.id, { font: e.target.value })}
              className="app-select text-sm"
              style={{ fontFamily: `"${sig.font}", cursive` }}
            >
              {SIGNATURE_FONTS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: `"${f.value}", cursive` }}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t('signatureColor')}
              value={sig.color}
              onChange={(e) => decorations.onSignatureChange(sig.id, { color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
            />
            <input
              type="range"
              aria-label={t('signatureSize')}
              aria-valuetext={`${sig.fontSize}px`}
              min="30"
              max="160"
              value={sig.fontSize}
              onChange={(e) => decorations.onSignatureChange(sig.id, { fontSize: Number(e.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8">{sig.fontSize}px</span>
          </div>

          <div>
            <label className="block text-xs text-(--app-accent-500) mb-1">{t('signatureFlourish')}</label>
            <select
              aria-label={t('signatureFlourish')}
              value={sig.flourish}
              onChange={(e) => decorations.onSignatureChange(sig.id, { flourish: e.target.value as SignatureFlourish })}
              className="app-select text-sm"
            >
              <option value="none">{t('flourishNone')}</option>
              <option value="swoosh">{t('flourishSwoosh')}</option>
              <option value="double">{t('flourishDouble')}</option>
              <option value="loop">{t('flourishLoop')}</option>
              <option value="strike">{t('flourishStrike')}</option>
              <option value="wave">{t('flourishWave')}</option>
              <option value="underline">{t('flourishUnderline')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-10">{t('signatureSlant')}</span>
            <input
              type="range"
              aria-label={t('signatureSlant')}
              aria-valuetext={`${sig.slant}°`}
              min="-30"
              max="30"
              value={sig.slant}
              onChange={(e) => decorations.onSignatureChange(sig.id, { slant: Number(e.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{sig.slant}°</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-10">{t('signatureThickness')}</span>
            <input
              type="range"
              aria-label={t('signatureThickness')}
              aria-valuetext={String(sig.thickness)}
              min="0"
              max="5"
              value={sig.thickness}
              onChange={(e) => decorations.onSignatureChange(sig.id, { thickness: Number(e.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{sig.thickness}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-10">{t('signatureRotation')}</span>
            <input
              type="range"
              aria-label={t('signatureRotation')}
              aria-valuetext={`${sig.rotation}°`}
              min="-180"
              max="180"
              value={sig.rotation}
              onChange={(e) => decorations.onSignatureChange(sig.id, { rotation: Number(e.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{sig.rotation}°</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-10">{t('signatureOpacity')}</span>
            <input
              type="range"
              aria-label={t('signatureOpacity')}
              aria-valuetext={`${Math.round(sig.opacity * 100)}%`}
              min="0"
              max="100"
              value={Math.round(sig.opacity * 100)}
              onChange={(e) => decorations.onSignatureChange(sig.id, { opacity: Number(e.target.value) / 100 })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{Math.round(sig.opacity * 100)}%</span>
          </div>

          <p className="text-[11px] font-medium rounded-full bg-[rgba(20, 169, 155,0.1)] px-2 py-1 text-[rgba(20, 169, 155,0.9)] text-center">
            {t('dragSignatureHint')}
          </p>
        </div>
      ))}
    </div>
  );
}
