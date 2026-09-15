import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DescriptionItem {
  label: string;
  value: ReactNode;
}

interface DescriptionListProps {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}

export function DescriptionList({ items, columns = 2, className }: DescriptionListProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <dl className={cn('grid gap-4', gridCols[columns], className)}>
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <dt className="text-xs font-medium text-accent">{item.label}</dt>
          <dd className="text-sm text-white">{item.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}
