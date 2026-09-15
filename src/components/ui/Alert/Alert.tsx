import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const styles: Record<AlertVariant, string> = {
  info: 'border-semantic-blue/30 bg-semantic-blue/5 text-semantic-blue',
  success: 'border-semantic-green/30 bg-semantic-green/5 text-semantic-green',
  warning: 'border-semantic-yellow/30 bg-semantic-yellow/5 text-semantic-yellow',
  error: 'border-semantic-red/30 bg-semantic-red/5 text-semantic-red',
};

export function Alert({ variant = 'info', title, children, onClose, className }: AlertProps) {
  const Icon = icons[variant];

  return (
    <div className={cn('flex gap-3 rounded-lg border px-4 py-3', styles[variant], className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium text-sm text-white">{title}</p>}
        <div className="text-sm text-accent">{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
