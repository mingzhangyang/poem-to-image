import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { DecorationsSectionProps, TranslateFn } from '../../types';

interface LogoListProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Controls for each uploaded logo. Ornaments are image layers too, but OrnamentLibrary owns them. */
export function LogoList({ t, decorations }: LogoListProps) {
  const logos = decorations.logos.filter(item => !item.ornamentId);
  if (logos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-(--app-accent-500) uppercase tracking-wider">{t('logos')}</div>
      {logos.map((logo) => (
        <div key={logo.id} className="app-soft-surface p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <img
              src={logo.imageUrl}
              alt="Logo"
              className="w-8 h-8 object-contain rounded"
            />
            <span className="text-xs text-(--app-accent-500) flex-1 truncate">Logo {logo.id.slice(-4)}</span>
            <button
              onClick={() => decorations.onLogoRemove(logo.id)}
              className="p-1.5 text-[#8a523b] hover:bg-[rgba(155,95,67,0.12)] rounded transition-colors"
              aria-label={t('deleteTemplate')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-8">{t('size')}</span>
            <input
              type="range"
              aria-label={t('size')}
              aria-valuetext={`${logo.size}px`}
              min="50"
              max="300"
              value={logo.size}
              onChange={(event) => decorations.onLogoChange(logo.id, { size: Number(event.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8">{logo.size}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-8">{t('angle')}</span>
            <input
              type="range"
              aria-label={t('angle')}
              aria-valuetext={`${logo.rotation}°`}
              min="-180"
              max="180"
              value={logo.rotation}
              onChange={(event) => decorations.onLogoChange(logo.id, { rotation: Number(event.target.value) })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{logo.rotation}°</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--app-accent-500) w-8">{t('opacity')}</span>
            <input
              type="range"
              aria-label={t('opacity')}
              aria-valuetext={`${Math.round(logo.opacity * 100)}%`}
              min="0"
              max="100"
              value={Math.round(logo.opacity * 100)}
              onChange={(event) => decorations.onLogoChange(logo.id, { opacity: Number(event.target.value) / 100 })}
              className="app-range flex-1"
            />
            <span className="text-xs text-(--app-accent-500) w-8 text-right">{Math.round(logo.opacity * 100)}%</span>
          </div>
          <div className="flex items-center justify-between border-t border-[rgba(34,48,52,0.06)] pt-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider text-[rgba(34,48,52,0.4)] font-semibold">{t('layers')}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => decorations.onLogoReorder(logo.id, 'bottom')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('sendToBack')}
                aria-label={t('sendToBack')}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => decorations.onLogoReorder(logo.id, 'down')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('moveDown')}
                aria-label={t('moveDown')}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => decorations.onLogoReorder(logo.id, 'up')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('moveUp')}
                aria-label={t('moveUp')}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => decorations.onLogoReorder(logo.id, 'top')}
                className="p-1 px-1.5 text-[rgba(34,48,52,0.4)] hover:text-(--app-accent-700) hover:bg-(--app-accent-50) rounded transition-colors"
                title={t('bringToFront')}
                aria-label={t('bringToFront')}
              >
                <ArrowUpToLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
