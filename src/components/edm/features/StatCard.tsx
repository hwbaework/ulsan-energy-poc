import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon?: ReactNode;
  label: ReactNode;
  value: string | number;
  /** 실제 증감률이 있을 때만 사용 (전월·전년 대비 등) */
  change?: { value: number; label: string };
  /** 단순 부가 설명 — 증감률이 아닌 경우 */
  sub?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ icon, label, value, change, sub, onClick, className }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-accent/20 bg-surface-card p-4',
        onClick && 'cursor-pointer hover:border-primary/30 transition-colors',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="text-primary">{icon}</div>}
        <div>
          <p className="text-xs text-accent">{label}</p>
          <p className="text-xl font-semibold text-white">{value}</p>
        </div>
      </div>
      {change && (
        <p className={cn('mt-2 text-xs', change.value >= 0 ? 'text-semantic-green' : 'text-semantic-red')}>
          {change.value >= 0 ? '+' : ''}
          {change.value}% {change.label}
        </p>
      )}
      {!change && sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

interface StatsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const gridCols: Record<NonNullable<StatsGridProps['columns']>, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return <div className={cn('grid gap-4', gridCols[columns], className)}>{children}</div>;
}
