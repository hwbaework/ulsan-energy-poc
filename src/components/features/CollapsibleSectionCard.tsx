'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/** SectionCard와 같은 룩에 헤더 클릭으로 본문을 접고 펼 수 있는 카드 */
export function CollapsibleSectionCard({
  title,
  description,
  actions,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-xl bg-[#1a2332] ring-1 ring-white/[0.06] animate-fadeIn', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-4 px-5 py-3 text-left',
          open && 'border-b border-white/[0.06]',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown size={15} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <h3 className="text-md font-semibold text-white truncate">
              {title}
            </h3>
            {description && <p className="mt-0.5 text-xs text-slate-400 truncate">{description}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()} role="presentation">
            {actions}
          </div>
        )}
      </button>
      {open && children}
    </div>
  );
}
