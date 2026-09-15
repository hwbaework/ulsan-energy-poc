import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variants = {
  primary: 'bg-primary',
  success: 'bg-semantic-green',
  warning: 'bg-semantic-yellow',
  danger: 'bg-semantic-red',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  variant = 'primary',
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-accent">{label}</span>}
          {showValue && <span className="text-white">{percent.toFixed(0)}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-accent/20">
        <div
          className={cn('h-full rounded-full transition-all duration-300', variants[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
