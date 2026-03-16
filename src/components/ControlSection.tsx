import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ControlSectionProps } from '../types';

export function ControlSection({ title, icon, expanded, onToggle, summary, highlighted = false, action, children }: ControlSectionProps) {
  const containerClassName = expanded
    ? 'border-[var(--app-accent-200)] bg-[rgba(255,253,249,0.98)] shadow-[0_18px_45px_var(--app-accent-shadow)]'
    : highlighted
      ? 'border-[var(--app-accent-200)] bg-[rgba(237,244,243,0.72)] shadow-[0_12px_30px_var(--app-accent-shadow)]'
      : 'border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.92)] hover:border-[var(--app-accent-200)]';

  return (
    <section className={`overflow-hidden rounded-[1.5rem] border transition-all duration-200 ${containerClassName}`}>
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <button
          onClick={onToggle}
          className="flex-1 text-left transition-colors"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className={`flex items-center gap-2 text-sm font-semibold ${expanded || highlighted ? 'text-gray-900' : 'text-gray-700'}`}>
                <span className={expanded || highlighted ? 'text-[var(--app-accent-600)]' : 'text-gray-400'}>{icon}</span>
                <span>{title}</span>
              </span>
              {summary ? (
                <span className={`mt-1.5 block text-xs leading-5 ${expanded ? 'text-[color:rgba(51,88,87,0.82)]' : 'text-gray-500'}`}>
                  {summary}
                </span>
              ) : null}
            </span>
            <span className={`mt-0.5 shrink-0 rounded-full border p-1.5 transition-colors ${expanded ? 'border-[var(--app-accent-200)] bg-[var(--app-accent-50)] text-[var(--app-accent-600)]' : 'border-gray-200 bg-white text-gray-400'}`}>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          </span>
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {expanded ? <div className="border-t border-[rgba(34,48,52,0.06)] px-4 pb-4 pt-4 sm:px-5 sm:pb-5">{children}</div> : null}
    </section>
  );
}