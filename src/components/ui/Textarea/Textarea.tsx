import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  label?: string;
  errorMessage?: string;
  required?: boolean;
}

const base =
  'w-full rounded border bg-surface-dark px-3 py-2.5 text-sm text-white placeholder:text-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y min-h-[100px]';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, label, errorMessage, required, className, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-accent">
            {label}
            {required && <span className="ml-0.5 text-semantic-red">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(base, error ? 'border-semantic-red' : 'border-accent/30 hover:border-accent/50', className)}
          {...props}
        />
        {errorMessage && <p className="text-xs text-semantic-red">{errorMessage}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
