import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface LoadingProps {
  fullPage?: boolean;
  text?: string;
  className?: string;
}

export function Loading({ fullPage, text, className }: LoadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullPage ? 'fixed inset-0 z-50 bg-surface-dark/80' : 'py-16',
        className,
      )}
    >
      <Spinner size="lg" />
      {text && <p className="text-sm text-accent">{text}</p>}
    </div>
  );
}
