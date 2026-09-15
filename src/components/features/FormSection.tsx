import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-md font-semibold text-white">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-accent">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
