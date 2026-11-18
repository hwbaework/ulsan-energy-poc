import { useEffect, useRef, useId, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: ReactNode;
  footer?: ReactNode;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  /** 칸이 많은 표가 들어가는 팝업(배출원 계수 [변경] 등) */
  '2xl': 'max-w-7xl',
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstInput = dialog.querySelector<HTMLElement>(
        'input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
      );
      if (firstInput) {
        firstInput.focus();
        return;
      }
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length) focusable[0]!.focus();
    });

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      trapFocus(e);
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      previousFocus.current?.focus();
    };
  }, [open, trapFocus]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          // 화면 높이를 넘지 않게 — 넘치면 본문만 스크롤(제목 · 아래 버튼은 그대로). 100% 배율에서 긴 팝업이 화면 밖으로 나가던 문제(2026-11-18)
          'flex max-h-[calc(100vh-3rem)] w-full flex-col rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]',
          sizeStyles[size],
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4">
            <h2 id={titleId} className="text-[15px] font-semibold text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6', title ? 'pb-5' : 'py-6')}>{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-white/[0.06] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
