import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({ onSearch, className, ...props }, ref) => (
  <div className={cn('relative', className)}>
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/40" />
    <input
      ref={ref}
      type="search"
      role="searchbox"
      aria-label="검색"
      className="h-10 w-full rounded border border-accent/30 bg-surface-dark pl-9 pr-3 text-sm text-white placeholder:text-accent/40 transition-colors hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSearch) {
          onSearch(e.currentTarget.value);
        }
      }}
      {...props}
    />
  </div>
));

SearchInput.displayName = 'SearchInput';
