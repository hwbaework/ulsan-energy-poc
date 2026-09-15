import { cn } from '@/lib/utils';

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 border-t border-accent/20" />
        <span className="text-xs text-accent">{label}</span>
        <div className="flex-1 border-t border-accent/20" />
      </div>
    );
  }

  return <hr className={cn('border-accent/20', className)} />;
}
