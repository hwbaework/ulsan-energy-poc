import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, type ToastType } from '@/stores/useToastStore';

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success: 'border-semantic-green/40 bg-semantic-green/10 text-semantic-green',
  error: 'border-semantic-red/40 bg-semantic-red/10 text-semantic-red',
  warning: 'border-semantic-yellow/40 bg-semantic-yellow/10 text-semantic-yellow',
  info: 'border-semantic-blue/40 bg-semantic-blue/10 text-semantic-blue',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80" role="region" aria-label="알림">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            role="alert"
            aria-live="assertive"
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-right',
              styles[toast.type],
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm text-white">{toast.message}</p>
            <button
              onClick={() => remove(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
