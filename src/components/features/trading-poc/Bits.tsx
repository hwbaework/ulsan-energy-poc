'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import type { ChangeStatus, ContractStatus, TradeEvent, TradeRequestStatus } from '@/types/trading-poc';
import { CHANGE_STATUS, CONTRACT_STATUS, PARTY_LABEL, REQUEST_STATUS, fmtDateTime } from './meta';

/** 제목만 — 부제 없음 (통합관제와 같은 규칙). 브레드크럼은 RE100 › (상위 ›) 화면 */
export function PageHeader({ title, parent, actions }: { title: string; parent?: string; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, ...(parent ? [{ label: parent }] : []), { label: title }]} />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function RequestStatusPill({ status }: { status: TradeRequestStatus }) {
  const m = REQUEST_STATUS[status];
  return <StatusPill tone={m.tone} label={m.label} />;
}
export function ContractStatusPill({ status }: { status: ContractStatus }) {
  const m = CONTRACT_STATUS[status];
  return <StatusPill tone={m.tone} label={m.label} />;
}
export function ChangeStatusPill({ status }: { status: ChangeStatus }) {
  const m = CHANGE_STATUS[status];
  return <StatusPill tone={m.tone} label={m.label} />;
}

/** 라벨 14px · 값 16px — 거래 승인 상세와 같은 꼴 */
export function Info({ label, value, className }: { label: string; value?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className="text-base text-white break-words">{value === undefined || value === null || value === '' ? '-' : value}</p>
    </div>
  );
}

/** 표 셀 텍스트 — 계약 유형 등은 글자만(네모·색 없음) */
export const cell = (v: ReactNode, cls?: string) => <span className={cn('text-sm text-slate-300 whitespace-nowrap', cls)}>{v}</span>;
export const cellStrong = (v: ReactNode) => <span className="text-sm font-medium text-white whitespace-nowrap">{v}</span>;
export const cellNum = (v: ReactNode) => <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{v}</span>;
export const cellMuted = (v: ReactNode) => <span className="text-sm text-slate-400 tabular-nums whitespace-nowrap">{v}</span>;

/* ── 진행 스텝퍼: 신청 접수 → SPC 검토 → 승인 → 전자서명 → 체결 (반려·취소는 끊긴 자리에 표시) ── */
export const DEAL_STEPS = ['신청 접수', 'SPC 검토', '승인', '전자서명', '체결'] as const;

export function stepIndexOf(status: TradeRequestStatus): { current: number; failed?: number } {
  switch (status) {
    case 'SUBMITTED':
      return { current: 1 };
    case 'REVIEW':
      return { current: 1 };
    case 'APPROVED':
      return { current: 3 }; // 서명 진행 — 몇 명 서명했는지는 라벨(n/2)로
    case 'SIGNED':
      return { current: 5 };
    case 'REJECTED':
      return { current: 2, failed: 2 };
    case 'CANCELLED':
      return { current: 1, failed: 1 };
  }
}

export function DealStepper({ status, signedCount, className }: { status: TradeRequestStatus; signedCount: number; className?: string }) {
  const { current, failed } = stepIndexOf(status);
  const label = (i: number) => (i === 3 && status === 'APPROVED' ? `전자서명 ${signedCount}/2` : DEAL_STEPS[i]);
  return (
    <ol className={cn('flex items-center', className)}>
      {DEAL_STEPS.map((_, i) => {
        const done = failed === undefined ? i < current : i < failed;
        const bad = failed !== undefined && i === failed;
        const now = failed === undefined && i === current;
        return (
          <li key={i} className="flex items-center flex-1 last:flex-none">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs whitespace-nowrap',
                bad ? 'text-red-400' : done ? 'text-emerald-400' : now ? 'text-primary' : 'text-slate-600',
              )}
            >
              {bad ? <XCircle size={14} /> : done ? <CheckCircle2 size={14} /> : now ? <Clock size={14} /> : <Circle size={14} />}
              {bad ? (status === 'REJECTED' ? '반려' : '취소') : label(i)}
            </span>
            {i < DEAL_STEPS.length - 1 && <span className={cn('h-px flex-1 mx-2', done ? 'bg-emerald-500/40' : 'bg-white/[0.08]')} />}
          </li>
        );
      })}
    </ol>
  );
}

/* ── 진행 이력 ── */
export function EventTimeline({ events }: { events: TradeEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  if (sorted.length === 0) return <p className="text-sm text-slate-500">이력 없음</p>;
  return (
    <ol className="space-y-3">
      {sorted.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex gap-3">
          <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', i === 0 ? 'bg-primary' : 'bg-slate-600')} />
          <div className="min-w-0">
            <p className="text-sm text-white">
              {e.label} <span className="text-slate-500">· {PARTY_LABEL[e.by]}</span>
            </p>
            {e.note && <p className="text-sm text-slate-400 mt-0.5">{e.note}</p>}
            <p className="text-xs text-slate-500 tabular-nums mt-0.5">{fmtDateTime(e.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** 모달 하단 버튼 줄 */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">{children}</div>;
}
