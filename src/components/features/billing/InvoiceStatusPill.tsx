import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InvoiceStatus = 'issued' | 'unissued' | 'paid';

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; tone: string; bg: string; ring: string; icon: typeof CheckCircle2 }
> = {
  issued: {
    label: '발급완료',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.08]',
    ring: 'ring-emerald-500/30',
    icon: CheckCircle2,
  },
  unissued: {
    label: '미발급',
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.08]',
    ring: 'ring-amber-500/30',
    icon: AlertCircle,
  },
  paid: {
    label: '결제완료',
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.08]',
    ring: 'ring-blue-500/30',
    icon: CheckCircle2,
  },
};

export function InvoiceStatusPill({ status, labelOverride }: { status: InvoiceStatus; labelOverride?: string }) {
  const m = INVOICE_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        m.bg,
        m.tone,
        m.ring,
      )}
    >
      <m.icon size={10} />
      {labelOverride ?? m.label}
    </span>
  );
}
