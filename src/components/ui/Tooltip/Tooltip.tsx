import { useState, useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
  /** Allow text wrapping for longer descriptions */
  wide?: boolean;
}

export function Tooltip({ content, children, position = 'top', className, wide }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <div
      className={cn('relative inline-block', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <div aria-describedby={visible ? tooltipId : undefined}>{children}</div>
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 rounded bg-surface-elevated px-2 py-1 text-xs text-white shadow-lg pointer-events-none',
            wide ? 'w-52 whitespace-normal' : 'whitespace-nowrap',
            position === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-1'
              : 'top-full left-1/2 -translate-x-1/2 mt-1',
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
