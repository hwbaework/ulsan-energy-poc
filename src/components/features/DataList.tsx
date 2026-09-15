import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortValue?: (row: T) => string | number | Date | null;
  render: (row: T, index: number) => ReactNode;
}

type SortDirection = 'asc' | 'desc';
interface SortState {
  key: string;
  direction: SortDirection;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string | number;
  className?: string;
  defaultSort?: SortState;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = '데이터가 없습니다',
  onRowClick,
  rowKey,
  className,
  defaultSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const getValue = col.sortValue;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [data, sort, columns]);

  if (loading) {
    return <SkeletonTable rows={5} columns={columns.length} className={className} />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  const hasFixedWidths = columns.some((col) => col.width);

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-accent/20', className)}>
      <table className={cn('w-full text-sm', hasFixedWidths && 'table-fixed')}>
        {hasFixedWidths && (
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={col.width ? { width: col.width } : undefined} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-accent/20 bg-surface-elevated">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 font-medium text-accent text-left',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right',
                  col.sortable && 'cursor-pointer select-none hover:text-white transition-colors',
                )}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                aria-sort={sort?.key === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="inline-flex text-accent/50">
                      {sort?.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={14} className="text-primary" />
                        ) : (
                          <ArrowDown size={14} className="text-primary" />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-accent/10 transition-colors',
                rowIndex % 2 === 1 && 'bg-white/[0.1]',
                onRowClick && 'cursor-pointer hover:bg-surface-elevated/50',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-white truncate',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                  )}
                >
                  {col.render(row, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
