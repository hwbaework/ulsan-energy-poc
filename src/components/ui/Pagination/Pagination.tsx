import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, totalElements, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav aria-label="페이지네이션" className={cn('flex items-center justify-between', className)}>
      <p className="text-xs text-accent">
        총 <span className="font-medium text-white">{totalElements.toLocaleString()}</span>건
      </p>
      <div className="flex items-center gap-1">
        <NavButton disabled={page === 0} onClick={() => onPageChange(0)} label="첫 페이지">
          <ChevronsLeft size={16} />
        </NavButton>
        <NavButton disabled={page === 0} onClick={() => onPageChange(page - 1)} label="이전 페이지">
          <ChevronLeft size={16} />
        </NavButton>
        {pages.map((p, i) =>
          p === -1 ? (
            <span key={`ellipsis-${i}`} className="px-1 text-accent" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-label={`${p + 1}페이지`}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                p === page ? 'bg-primary text-white' : 'text-accent hover:bg-accent/10 hover:text-white',
              )}
            >
              {p + 1}
            </button>
          ),
        )}
        <NavButton disabled={page === totalPages - 1} onClick={() => onPageChange(page + 1)} label="다음 페이지">
          <ChevronRight size={16} />
        </NavButton>
        <NavButton
          disabled={page === totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
          label="마지막 페이지"
        >
          <ChevronsRight size={16} />
        </NavButton>
      </div>
    </nav>
  );
}

function NavButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded text-accent transition-colors hover:bg-accent/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {children}
    </button>
  );
}

function getPageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current < 3) return [0, 1, 2, 3, 4, -1, total - 1];
  if (current > total - 4) return [0, -1, total - 5, total - 4, total - 3, total - 2, total - 1];
  return [0, -1, current - 1, current, current + 1, -1, total - 1];
}
