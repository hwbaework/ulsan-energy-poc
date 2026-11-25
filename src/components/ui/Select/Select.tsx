import { useState, useRef, useEffect, useLayoutEffect, useId, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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
  /** 펼친 목록 위에 검색 칸 — 선택지가 많을 때(기업 1,000곳 등) */
  searchable?: boolean;
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
  searchable,
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
  // 펼친 목록은 body 에 따로 그린다 — 팝업 본문처럼 스크롤되는 칸 안에 있으면 목록이 그 안에 갇혀 잘리거나 칸이 스크롤된다(2026-11-25 사용자).
  // 자리는 버튼 바로 아래(아래가 모자라면 위), 화면이 움직이면 다시 잰다
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const need = 280; // 목록 최대 높이 + 여백
      const up = r.bottom + need > window.innerHeight && r.top > need;
      setPos(up ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 } : { left: r.left, width: r.width, top: r.bottom + 6 });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === selectedValue);
  const [q, setQ] = useState('');
  const word = q.trim();
  const shown = searchable && word ? options.filter((o) => o.label.includes(word)) : options;
  const searchRef = useRef<HTMLInputElement>(null);
  const hasPos = !!pos;
  useEffect(() => {
    if (!open) setQ('');
    else if (searchable) searchRef.current?.focus();
    // 목록은 자리를 잰 뒤에 그려지므로(pos) 그때 검색 칸에 커서를 둔다
  }, [open, searchable, hasPos]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(t) && !dropRef.current?.contains(t)) {
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
        if (e.key === ' ' && e.target === searchRef.current) break;
        e.preventDefault();
        if (open && focusedIdx >= 0) {
          if (shown[focusedIdx]) select(shown[focusedIdx]);
        } else {
          setOpen(true);
          setFocusedIdx(shown.findIndex((o) => o.value === selectedValue));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setFocusedIdx(0);
        } else {
          setFocusedIdx((i) => Math.min(i + 1, shown.length - 1));
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
          ref={buttonRef}
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

        {/* Dropdown — body 에 그린다(팝업 위에도 보이게 z 는 팝업보다 높게) */}
        {open &&
          pos &&
          typeof document !== 'undefined' &&
          createPortal(
        <div
          ref={dropRef}
          style={pos}
          className="fixed z-[1100] rounded-xl border border-white/[0.08] bg-[#0d1520] p-1 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)]"
        >
          {searchable && (
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setFocusedIdx(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="검색"
              className="mb-1 h-8 w-full rounded-md border border-accent/30 bg-surface-dark px-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary/60 focus:outline-none"
            />
          )}
          <ul ref={listRef} id={listboxId} role="listbox" className="overflow-auto" style={{ maxHeight: 220 }}>
            {shown.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">
                {searchable && word ? '검색 결과 없음' : '옵션 없음'}
              </li>
            ) : (
              shown.map((opt, i) => (
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
        </div>,
            document.body,
          )}
      </div>
      {errorMessage && <p className="text-xs text-semantic-red">{errorMessage}</p>}
    </div>
  );
}

Select.displayName = 'Select';
