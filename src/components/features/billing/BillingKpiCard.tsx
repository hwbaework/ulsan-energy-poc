import { cn } from '@/lib/utils';

export function BillingKpiCard({
  label,
  value,
  valueColor = 'text-white',
  sub,
  badge,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  badge?: { text: string; tone: 'amber' | 'emerald' };
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-surface-card p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', valueColor)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      {badge && (
        <span
          className={cn(
            'mt-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
            badge.tone === 'amber' && 'bg-amber-500/[0.12] text-amber-300',
            badge.tone === 'emerald' && 'bg-emerald-500/[0.12] text-emerald-300',
          )}
        >
          {badge.text}
        </span>
      )}
    </div>
  );
}
