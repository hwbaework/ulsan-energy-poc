import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  label?: string;
  hint?: string;
  errorMessage?: string;
  required?: boolean;
}

const base =
  'h-10 w-full rounded border bg-surface-dark px-3 text-sm text-white placeholder:text-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, hint, errorMessage, required, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;
    const displayError = typeof error === 'string' ? error : errorMessage;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-accent">
            {label}
            {required && <span className="ml-0.5 text-semantic-red">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          className={cn(
            base,
            hasError ? 'border-semantic-red bg-semantic-red/10' : 'border-accent/30 hover:border-accent/50',
            className,
          )}
          {...props}
        />
        {displayError && <p className="text-xs text-semantic-red">{displayError}</p>}
        {!displayError && hint && <p className="text-xs text-accent/60">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
