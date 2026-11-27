import { useId } from 'react';
import type { ControlSectionProps } from '../types';

/**
 * One control panel. The sidebar shows one panel at a time (picked from the
 * desktop rail or the mobile dock), so it is always open.
 *
 * In the mobile drawer it is a floating card. From lg up it only ever renders
 * in the desktop sidebar (the drawer is lg:hidden), where it fills the panel
 * column flat and keeps its heading pinned while the controls scroll.
 */
export function ControlSection({ title, icon, summary, action, children, tint }: ControlSectionProps) {
  const headingId = useId();
  const iconStyle = tint ? { color: tint } : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-[1.5rem] border border-white/60 bg-[rgba(255,250,242,0.72)] shadow-[0_18px_45px_var(--app-accent-shadow)] backdrop-blur-xl lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5 lg:sticky lg:top-0 lg:z-10 lg:bg-(--app-surface-strong) lg:px-6 lg:pt-5">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-(--app-ink)">
            <span className={tint ? '' : 'text-[var(--app-accent-600)]'} style={iconStyle}>{icon}</span>
            <span style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif SC', Georgia, serif" }}>{title}</span>
          </h2>
          {summary ? (
            <p className="mt-1.5 text-xs leading-5 text-[color:rgba(51,88,87,0.82)]" data-section-summary>
              {summary}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="border-t border-[rgba(34,48,52,0.06)] px-4 pb-4 pt-4 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6 lg:pt-5">{children}</div>
    </section>
  );
}
