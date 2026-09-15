import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, indeterminate, className, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const el = innerRef.current;
      if (el) el.indeterminate = !!indeterminate;
    }, [indeterminate]);

    function setRefs(node: HTMLInputElement | null) {
      (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }

    const input = (
      <input
        ref={setRefs}
        type="checkbox"
        className="h-4 w-4 rounded border-accent/30 bg-surface-dark text-primary focus:ring-primary/50 focus:ring-2"
        {...props}
      />
    );

    if (!label) return input;

    return (
      <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
        {input}
        <span className="text-sm text-accent">{label}</span>
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
