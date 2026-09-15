import { useEffect, useRef, useId, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
}

const FOCUSABLE = 'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'primary',
  loading,
}: ConfirmDialogProps) {
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

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable?.length) focusable[0]!.focus();
    });
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      trapFocus(e);
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      previousFocus.current?.focus();
    };
  }, [open, onClose, trapFocus]);

  if (!open) return null;
  const isDanger = variant === 'danger';

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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
      >
        <div className="p-5 text-center">
          <div
            className={cn(
              'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
              isDanger ? 'bg-red-500/10 ring-1 ring-red-500/20' : 'bg-blue-500/10 ring-1 ring-blue-500/20',
            )}
          >
            {isDanger ? (
              <AlertTriangle size={22} className="text-red-400" />
            ) : (
              <HelpCircle size={22} className="text-blue-400" />
            )}
          </div>
          <h3 id={titleId} className="text-[15px] font-semibold text-white">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{message}</p>
        </div>

        <div className="flex border-t border-white/[0.06]">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 text-sm font-medium text-slate-400 transition-colors hover:text-white hover:bg-white/[0.03] disabled:opacity-50 rounded-bl-xl"
          >
            {cancelLabel}
          </button>
          <div className="w-px bg-white/[0.06]" />
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors rounded-br-xl disabled:opacity-50',
              isDanger
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/[0.06]'
                : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/[0.06]',
            )}
          >
            {loading && (
              <svg className="inline-block h-3.5 w-3.5 animate-spin mr-1.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
