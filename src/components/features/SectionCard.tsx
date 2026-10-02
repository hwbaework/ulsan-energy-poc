import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  noPadding,
}: SectionCardProps) {
  return (
    <div className={cn('h-full rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] animate-fadeIn', className)}>
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
        <div>
          <h3 className="text-md font-semibold text-white">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {/* 본문에 표(DataTable)가 바로 들어가면 여백 없이 카드 끝까지 — 모든 화면 공통 */}
      <div className={cn(!noPadding && 'px-5 py-4', 'has-[>[data-table]]:p-0')}>{children}</div>
    </div>
  );
}
