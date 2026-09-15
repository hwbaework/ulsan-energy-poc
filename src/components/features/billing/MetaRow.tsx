import { cn } from '@/lib/utils';

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-200 truncate">{value}</span>
    </div>
  );
}

export function MiniStatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={cn('text-sm tabular-nums text-right', valueClass ?? 'text-white')}>{value}</span>
    </div>
  );
}
