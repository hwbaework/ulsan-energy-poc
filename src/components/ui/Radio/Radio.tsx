import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({ label, className, ...props }, ref) => (
  <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
    <input
      ref={ref}
      type="radio"
      className="h-4 w-4 border-accent/30 bg-surface-dark text-primary focus:ring-primary/50 focus:ring-2"
      {...props}
    />
    <span className="text-sm text-accent">{label}</span>
  </label>
));

Radio.displayName = 'Radio';
