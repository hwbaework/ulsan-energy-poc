import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  error?: boolean;
  label?: string;
  errorMessage?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  onChange?: (e: { target: { name?: string; value: string } }) => void;
}

export function Select({
  options,
  value: controlledValue,
  defaultValue = '',
  placeholder,
  error,
  label,
  errorMessage,
  required,
  disabled,
  className,
  name,
  onChange,
}: SelectProps) {
  const uid = useId();
  const selectId = label?.toLowerCase().replace(/\s+/g, '-') ?? uid;
  const listboxId = `${selectId}-listbox`;

  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlledValue ?? internalValue;

  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === selectedValue);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && focusedIdx >= 0) {
      const el = listRef.current?.children[focusedIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, focusedIdx]);

  function select(opt: SelectOption) {
    setInternalValue(opt.value);
    onChange?.({ target: { name, value: opt.value } });
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && focusedIdx >= 0) {
          if (options[focusedIdx]) select(options[focusedIdx]);
        } else {
          setOpen(true);
          setFocusedIdx(options.findIndex((o) => o.value === selectedValue));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setFocusedIdx(0);
        } else {
          setFocusedIdx((i) => Math.min(i + 1, options.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setFocusedIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-accent">
          {label}
          {required && <span className="ml-0.5 text-semantic-red">*</span>}
        </label>
      )}
      <div className="relative">
        <input type="hidden" name={name} value={selectedValue} />
        <button
          type="button"
          id={selectId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={open && focusedIdx >= 0 ? `${selectId}-opt-${focusedIdx}` : undefined}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-10 w-full rounded-lg border bg-surface-dark px-3 text-left text-sm transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            error
              ? 'border-semantic-red'
              : open
                ? 'border-primary/60 ring-2 ring-primary/20'
                : 'border-accent/30 hover:border-accent/50',
            selectedOption ? 'text-white' : 'text-slate-500',
            className,
          )}
        >
          {selectedOption?.label ?? placeholder ?? ' '}
        </button>

        {/* Chevron */}
        <div
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-accent transition-transform duration-200',
            open && 'rotate-180',
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Dropdown */}
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute z-50 mt-1.5 w-full overflow-auto rounded-xl border border-white/[0.08] bg-[#0d1520] p-1 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-sm',
            'origin-top transition-all duration-200',
            open ? 'scale-100 opacity-100 translate-y-0' : 'pointer-events-none scale-95 opacity-0 -translate-y-1',
          )}
          style={{ maxHeight: 220 }}
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">옵션 없음</li>
          ) : (
            options.map((opt, i) => (
              <li
                key={opt.value}
                id={`${selectId}-opt-${i}`}
                role="option"
                aria-selected={opt.value === selectedValue}
                onMouseEnter={() => setFocusedIdx(i)}
                onClick={() => select(opt)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors duration-100',
                  i === focusedIdx && 'bg-white/[0.06]',
                  opt.value === selectedValue ? 'text-primary font-medium' : 'text-slate-300 hover:text-white',
                )}
              >
                {opt.label}
                {opt.value === selectedValue && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary shrink-0">
                    <path
                      d="M3 7.5L5.5 10L11 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
      {errorMessage && <p className="text-xs text-semantic-red">{errorMessage}</p>}
    </div>
  );
}

Select.displayName = 'Select';
