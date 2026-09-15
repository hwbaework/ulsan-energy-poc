import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MiniStat({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon size={16} className={iconColor} />
      </span>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-sm font-bold text-white tabular-nums">{value}</p>
      </div>
    </div>
  );
}
