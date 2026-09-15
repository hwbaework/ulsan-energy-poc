import { Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

interface StatCardProps {
  icon?: ReactNode;
  label: ReactNode;
  value: string | number;
  /** 실제 증감률/증감개수가 있을 때만 사용. unit 기본값은 '%' */
  change?: { value: number; label: string; unit?: string };
  /** 단순 부가 설명 — 증감률이 아닌 경우 */
  sub?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ icon, label, value, change, sub, loading, onClick, className }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'h-full rounded-lg border border-accent/20 bg-surface-card p-4',
        onClick && 'cursor-pointer hover:border-primary/30 transition-colors',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="text-primary">{icon}</div>}
        <div>
          <span className="block text-xs text-accent">{label}</span>
          {loading ? (
            <Skeleton className="h-7 w-24 mt-0.5" />
          ) : (
            <span className="block text-xl font-semibold text-white">{value}</span>
          )}
        </div>
      </div>
      {change && !loading && (
        <p className={cn('mt-2 text-xs', change.value >= 0 ? 'text-semantic-green' : 'text-semantic-red')}>
          {change.value >= 0 ? '+' : ''}
          {change.value}
          {change.unit ?? '%'} {change.label}
        </p>
      )}
      {!change && sub && !loading && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
      {loading && <Skeleton className="h-3 w-20 mt-2" />}
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

  const items = Children.toArray(children);

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {items.map((child, i) => (
        <div
          key={i}
          className="h-full animate-slideUp opacity-0"
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
