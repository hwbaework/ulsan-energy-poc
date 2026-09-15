import { useState, useRef, useEffect, useCallback, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  closeOnItemClick?: boolean;
}

type MenuPos = { top: number; left?: number; right?: number };

export function Dropdown({ trigger, children, align = 'left', className, closeOnItemClick = true }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // 메뉴는 portal(body)로 띄워 테이블 셀의 overflow:hidden / overflow-x-auto 에 잘리지 않게 함.
  // position:fixed 라 트리거의 화면 좌표를 매번 계산해서 붙인다.
  const [pos, setPos] = useState<MenuPos | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (align === 'right') {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    } else {
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [align]);

  // 바깥 클릭 시 닫기 — 메뉴는 portal 이라 ref 밖에 있으므로 menuRef 도 함께 검사
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 열릴 때 위치 계산, 스크롤/리사이즈 시 닫기(좌표 어긋남 방지)
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      setPos(null);
      return;
    }
    updatePosition();
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (items?.length && activeIndex >= 0) items[activeIndex]?.focus();
  }, [open, activeIndex]);

  const getItems = useCallback(() => {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
        return;
      }

      if (!open) return;

      const items = getItems();
      const count = items.length;
      if (count === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + count) % count);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(count - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].click();
      }
    },
    [open, activeIndex, getItems],
  );

  return (
    <div ref={ref} className={cn('relative inline-block', className)} onKeyDown={handleKeyDown}>
      <div ref={triggerRef} onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}>
        {trigger}
      </div>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-activedescendant={activeIndex >= 0 ? `dropdown-item-${activeIndex}` : undefined}
            onKeyDown={handleKeyDown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right }}
            className="z-50 min-w-[160px] rounded-lg border border-accent/20 bg-surface-card py-1 shadow-elevation-2 animate-slideDown"
            onClick={closeOnItemClick ? () => setOpen(false) : undefined}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function DropdownItem({ onClick, danger, disabled, children }: DropdownItemProps) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors outline-none',
        'focus:bg-accent/10 focus:text-white',
        disabled && 'opacity-40 cursor-not-allowed',
        danger ? 'text-semantic-red hover:bg-semantic-red/10' : 'text-accent hover:bg-accent/10 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
