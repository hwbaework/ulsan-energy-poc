import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 text-accent/40">{icon ?? <Inbox size={48} />}</div>
      <h3 className="text-md font-medium text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-accent">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
