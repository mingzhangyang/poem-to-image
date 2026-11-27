import { useContext, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Flower2 } from 'lucide-react';
import { getOrnamentContentBox, getOrnamentContentExtents } from '../../ornaments/contentBox';
import { OrnamentSelection } from '../../ornaments/selection';
import manifest from '../../ornaments/manifest.json';
import { getOrnamentName, ORNAMENT_CATEGORIES, ORNAMENT_MOODS, type OrnamentManifestItem } from '../../ornaments/taxonomy';
import type { DecorationsSectionProps, LogoConfig, TranslateFn } from '../../types';
import type { TranslationKey } from '../../translations';

const ANCHORS: Array<[anchor: string, label: TranslationKey]> = [
  ['tl', 'ornamentAnchorTopLeft'],
  ['tr', 'ornamentAnchorTopRight'],
  ['bl', 'ornamentAnchorBottomLeft'],
  ['br', 'ornamentAnchorBottomRight'],
  ['bc', 'ornamentAnchorBottomCenter'],
];

const chipClassName = 'rounded-full border border-[rgba(34,48,52,0.14)] bg-[#fffdfa] px-2.5 py-1 text-xs font-medium text-(--app-accent-700) transition-colors hover:border-(--app-accent-300) aria-pressed:border-(--app-accent-700) aria-pressed:bg-(--app-accent-700) aria-pressed:text-white';

interface OrnamentLibraryProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Ornament gallery and the controls for the selected ornament, shown inside the Decorations panel. */
export function OrnamentLibrary({ t, decorations }: OrnamentLibraryProps) {
  const [expanded, setExpanded] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [selected, setSelected] = useContext(OrnamentSelection);
  const layers = decorations.logos.filter(item => item.ornamentId);
  const active = layers.find(item => item.id === selected) ?? layers.at(-1);
  const name = (ornamentId: string) => getOrnamentName(ornamentId, decorations.language);
  const placement = decorations.getPlacementArea;

  // Selecting an ornament on the canvas reveals its controls.
  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  /**
   * Places the ornament's visible ink, not its transparent margin, 3% inside
   * the chosen corner or edge of the canvas. Canvas padding is for text, so
   * ornaments may sit in it; positions stay percentages of the poem frame.
   */
  function position(anchor: string, ornament: Pick<LogoConfig, 'ornamentId' | 'size' | 'rotation' | 'flipped'>) {
    const area = placement();
    const reach = getOrnamentContentExtents(
      getOrnamentContentBox(ornament.ornamentId, ornament.flipped), ornament.size, ornament.rotation,
    );
    // Image centre in canvas pixels along one axis.
    const place = (side: 'start' | 'end' | 'center', before: number, after: number, canvasSize: number) => {
      const margin = canvasSize * 0.03;
      return side === 'start' ? margin + before
        : side === 'end' ? canvasSize - margin - after
          : canvasSize / 2 + (before - after) / 2;
    };
    const x = place(anchor.endsWith('l') ? 'start' : anchor.endsWith('r') ? 'end' : 'center', reach.left, reach.right, area.canvasWidth);
    const y = place(anchor.startsWith('t') ? 'start' : anchor.startsWith('b') ? 'end' : 'center', reach.top, reach.bottom, area.canvasHeight);
    return {
      positionX: (x - area.left) / area.width * 100,
      positionY: (y - area.top) / area.height * 100,
    };
  }
  function add(item: OrnamentManifestItem) {
    const { width, height } = placement();
    const size = Math.min(width, height) * item.default_scale;
    setSelected(decorations.onAddOrnament(item.file, {
      ornamentId: item.id, size, ...position(item.default_anchor, { ornamentId: item.id, size, rotation: 0 }),
    }));
  }
  function update(changes: Partial<LogoConfig>) {
    if (active) decorations.onLogoChange(active.id, changes);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="flex w-full items-center gap-2 rounded-lg border border-[rgba(34,48,52,0.12)] bg-[rgba(237,244,243,0.5)] px-3 py-2 text-left text-xs font-medium text-(--app-accent-700)"
      >
        <Flower2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{t('ornaments')}</span>
        {layers.length > 0 ? (
          <span className="ml-auto rounded-full bg-(--app-accent-50) px-2 text-[11px] text-(--app-accent-600)">{layers.length}</span>
        ) : <span className="ml-auto" />}
        {expanded
          ? <ChevronUp aria-hidden="true" className="h-4 w-4 shrink-0" />
          : <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />}
      </button>

      {expanded ? (
        <div className="space-y-3">
          <div aria-live="polite" className="space-y-1 text-xs text-(--app-accent-500) empty:hidden">
            {layers.length > 2 && <p>{t('ornamentsHintFew')}</p>}
            {layers.length > 4 && <p>{t('ornamentsHintMany')}</p>}
          </div>

          <div className="flex flex-wrap gap-1">
            <button type="button" className={chipClassName} aria-pressed={mood === null} onClick={() => setMood(null)}>
              {t('ornamentMoodAll')}
            </button>
            {Object.entries(ORNAMENT_MOODS).map(([key, label]) => (
              <button type="button" className={chipClassName} key={key} aria-pressed={mood === key} onClick={() => setMood(key)}>
                {t(label)}
              </button>
            ))}
          </div>

          <div className="app-sidebar-scrollbar max-h-64 space-y-3 overflow-y-auto">
            {Object.entries(ORNAMENT_CATEGORIES).map(([key, label]) => {
              const items = manifest.filter(item => item.category === key && (mood === null || item.moods.includes(mood)));
              return items.length > 0 && (
                <section key={key}>
                  <h4 className="mb-1 text-xs font-medium text-(--app-accent-500)">{t(label)}</h4>
                  <div className="grid grid-cols-3 gap-1">
                    {items.map(item => (
                      <button type="button" key={item.id} onClick={() => add(item)}
                        className="rounded-md p-1 text-xs text-(--app-accent-800) transition-colors hover:bg-(--app-accent-50)">
                        <img loading="lazy" className="mb-1 h-16 w-full rounded bg-[#eeece6] object-contain" src={'/ornaments/thumbs/' + item.id + '.webp'} alt="" />
                        {name(item.id)}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {active ? (
            <div className="app-soft-surface space-y-2 rounded-lg p-3 text-xs text-(--app-accent-700)">
              <select className="app-select w-full text-sm" aria-label={t('placedOrnaments')} value={active.id} onChange={event => setSelected(event.target.value)}>
                {layers.map((layer, index) => (
                  <option key={layer.id} value={layer.id}>{index + 1}. {name(layer.ornamentId!)}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1">
                {ANCHORS.map(([anchor, label]) => (
                  <button type="button" key={anchor} className={chipClassName} onClick={() => update(position(anchor, active))}>{t(label)}</button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-2">
                {t('size')}
                <input type="range" className="app-range flex-1" min="12" max={Math.max(active.size, Math.min(placement().width, placement().height))} value={active.size} onChange={event => update({ size: +event.target.value })} />
              </label>
              <label className="flex items-center justify-between gap-2">
                {t('ornamentRotation')}
                <input type="range" className="app-range flex-1" min="-180" max="180" value={active.rotation} onChange={event => update({ rotation: +event.target.value })} />
              </label>
              <label className="flex items-center justify-between gap-2">
                {t('opacity')}
                <input type="range" className="app-range flex-1" min="0" max="1" step=".01" value={active.opacity} onChange={event => update({ opacity: +event.target.value })} />
              </label>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={chipClassName} aria-pressed={!!active.flipped} onClick={() => update({ flipped: !active.flipped })}>{t('ornamentFlip')}</button>
                <button type="button" className={chipClassName} onClick={() => update({ aboveText: !active.aboveText })}>
                  {active.aboveText ? t('ornamentBelowText') : t('ornamentAboveText')}
                </button>
                <button type="button" className={chipClassName}
                  onClick={() => setSelected(decorations.onAddOrnament(active.imageUrl, { ...active, positionX: Math.min(97, active.positionX + 2) }))}>
                  {t('ornamentDuplicate')}
                </button>
                <button type="button" className={chipClassName} onClick={() => decorations.onLogoRemove(active.id)}>{t('ornamentDelete')}</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
