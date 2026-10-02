import { cn } from '@/lib/utils';
import { IN_TABLE } from '@/components/ui/Design';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-accent/20 text-accent',
  primary: 'bg-primary/20 text-primary',
  success: 'bg-semantic-green/20 text-semantic-green',
  warning: 'bg-semantic-yellow/20 text-semantic-yellow',
  danger: 'bg-semantic-red/20 text-semantic-red',
  info: 'bg-semantic-blue/20 text-semantic-blue',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        IN_TABLE,
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
