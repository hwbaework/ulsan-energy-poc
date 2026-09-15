import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ className, variant = 'text', width, height, lines }: SkeletonProps) {
  const base = 'animate-pulse bg-white/[0.06] rounded';

  if (lines && lines > 1) {
    return (
      <div className={cn('space-y-2.5', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={cn(base, 'h-3.5 rounded-md', i === lines - 1 && 'w-3/4')} />
        ))}
      </div>
    );
  }

  const variantStyles = {
    text: 'h-3.5 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return <div className={cn(base, variantStyles[variant], className)} style={{ width, height }} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl bg-surface-card ring-1 ring-white/[0.06] p-5 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-9 w-9 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-1/3" />
          <Skeleton className="w-1/2" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-accent/20', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-accent/20 bg-surface-elevated">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} className="border-b border-accent/10">
              {Array.from({ length: columns }).map((_, ci) => (
                <td key={ci} className="px-4 py-3">
                  <Skeleton className={cn('h-3.5', ci === 0 ? 'w-28' : 'w-16')} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4', `grid-cols-${count}`, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-card ring-1 ring-white/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="h-7 w-7 shrink-0" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonStats />
      <SkeletonTable />
    </div>
  );
}
