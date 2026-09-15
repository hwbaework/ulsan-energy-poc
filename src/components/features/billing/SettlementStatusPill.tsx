import { Clock, CheckCircle2 } from 'lucide-react';

export type SettlementStatus = 'pending' | 'completed';

const DEFAULT_LABELS = { pending: '대기', completed: '완료' };

export function SettlementStatusPill({
  status,
  labels = DEFAULT_LABELS,
}: {
  status: SettlementStatus;
  labels?: { pending: string; completed: string };
}) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.08] px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30">
        <Clock size={10} /> {labels.pending}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
      <CheckCircle2 size={10} /> {labels.completed}
    </span>
  );
}
