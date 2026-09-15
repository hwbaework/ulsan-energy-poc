import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, description, actions, children, className }: SectionCardProps) {
  return (
    <div className={cn('rounded-lg border border-accent/20 bg-surface-card', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-accent/20 px-6 py-4">
        <div>
          <h3 className="text-md font-semibold text-white">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-accent">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
