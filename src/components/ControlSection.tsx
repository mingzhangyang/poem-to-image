import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ControlSectionProps } from '../types';

export function ControlSection({ title, icon, expanded, onToggle, action, children }: ControlSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {action}
      </div>
      {expanded ? children : null}
    </section>
  );
}