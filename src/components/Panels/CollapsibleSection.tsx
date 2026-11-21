import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  rightBadge?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  open,
  onToggle,
  rightBadge,
  children,
}) => {
  return (
    <div className="bg-[#0f1115] border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-2 bg-[#13161d] border-b border-slate-800/60">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex items-center gap-1.5 text-left text-[11px] font-semibold text-slate-200 hover:text-white flex-1"
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span>{title}</span>
        </button>
        {rightBadge && <div className="shrink-0 ml-2">{rightBadge}</div>}
      </div>
      {open && <div className="p-2.5 space-y-2.5">{children}</div>}
    </div>
  );
};
