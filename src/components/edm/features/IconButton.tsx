import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline';
}

const sizes = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'ghost', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded transition-colors',
        'text-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'outline' && 'border border-accent/30 hover:border-accent/50',
        variant === 'ghost' && 'hover:bg-accent/10',
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = 'IconButton';
