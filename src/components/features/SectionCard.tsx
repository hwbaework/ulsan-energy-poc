import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: ReactNode;
  /** 제목 옆 카운트 chip — `{count}{countUnit}` 으로 표시. 모든 SectionCard에서 동일한 표준 chip 사용. */
  count?: number;
  countUnit?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  count,
  countUnit = '건',
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
            {count !== undefined && (
              <Badge variant="primary" className="ml-2">
                {count}
                {countUnit}
              </Badge>
            )}
          </h3>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className={noPadding ? undefined : 'px-5 py-4'}>{children}</div>
    </div>
  );
}
