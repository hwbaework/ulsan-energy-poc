import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean | string;
}

const base =
  'h-10 w-full rounded border bg-surface-dark pl-3 pr-10 text-sm text-white placeholder:text-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ error, className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const hasError = !!error;
  const errorMsg = typeof error === 'string' ? error : undefined;

  return (
    <div>
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={hasError || undefined}
          className={cn(base, hasError ? 'border-semantic-red' : 'border-accent/30 hover:border-accent/50', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-accent hover:text-white transition-colors"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {errorMsg && <p className="mt-1.5 text-xs text-semantic-red">{errorMsg}</p>}
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';
