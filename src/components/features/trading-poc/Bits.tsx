'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import type { ChangeStatus, ContractStatus, TradeEvent, TradeRequest, TradeRequestStatus } from '@/types/trading-poc';
import { CHANGE_STATUS, CONTRACT_STATUS, PARTY_LABEL, REQUEST_STATUS, fmtDateTime } from './meta';

/** 제목만 — 부제 없음 (통합관제와 같은 규칙). 브레드크럼은 RE100 › (상위 ›) 화면 */
export function PageHeader({ title, parent, actions }: { title: string; parent?: string; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, ...(parent ? [{ label: parent }] : []), { label: title }]}
      />
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
      <p className="text-base text-white break-words">
        {value === undefined || value === null || value === '' ? '\u00A0' : value}
      </p>
    </div>
  );
}

/** 표 셀 텍스트 — 계약 유형 등은 글자만(네모·색 없음) */
export const cell = (v: ReactNode, cls?: string) => (
  <span className={cn('text-sm text-slate-300 whitespace-nowrap', cls)}>{v}</span>
);
export const cellStrong = (v: ReactNode) => (
  <span className="text-sm font-medium text-white whitespace-nowrap">{v}</span>
);
export const cellNum = (v: ReactNode) => (
  <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{v}</span>
);
export const cellMuted = (v: ReactNode) => (
  <span className="text-sm text-slate-400 tabular-nums whitespace-nowrap">{v}</span>
);

/* ── 진행 단계 — 거래 이력 · 거래 승인이 같은 단계를 쓴다 ── */
export const TRADE_STEPS = ['신청 접수', 'SPC 검토', '현장 실측', '조건 협의', '승인', '전자서명', '체결'] as const;

/** 검토 중 어디까지 왔는지 — 실측이 끝났거나 조건 협의로 넘겼으면 조건 협의, 실측으로 넘겼으면 현장 실측, 아니면 SPC 검토 */
function reviewStepOf(r: TradeRequest) {
  const has = (label: string) => r.events.some((e) => e.label === label);
  if (r.surveyDoneAt || has('조건 협의')) return 3;
  if (has('현장 실측')) return 2;
  return has('검토 시작') ? 1 : 0;
}

/** 지금 단계(TRADE_STEPS 번호). 체결되면 TRADE_STEPS.length — 전부 끝 */
export function tradeStepOf(r: TradeRequest): number {
  switch (r.status) {
    case 'SUBMITTED':
      return 0;
    case 'REVIEW':
      return Math.max(1, reviewStepOf(r));
    case 'APPROVED':
      return 5;
    case 'SIGNED':
      return TRADE_STEPS.length;
    default:
      return reviewStepOf(r); // 반려 · 취소 — 멈춘 단계
  }
}

/** 진행 단계 — 번호 원 · 선. 반려 · 취소는 멈춘 자리에 표시 */
export function TradeStepper({
  r,
  signedCount = 0,
  className,
}: {
  r: TradeRequest;
  signedCount?: number;
  className?: string;
}) {
  const step = tradeStepOf(r);
  const failed = r.status === 'REJECTED' || r.status === 'CANCELLED';
  return (
    <ol className={cn('flex items-start', className)}>
      {TRADE_STEPS.map((label, i) => {
        const bad = failed && i === step;
        const state = bad ? 'bad' : i < step ? 'done' : i === step && !failed ? 'now' : 'next';
        return (
          <li key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ring-1',
                  state === 'done' && 'bg-primary text-white ring-primary',
                  state === 'now' && 'bg-primary/20 text-primary ring-primary/50',
                  state === 'bad' && 'bg-red-500/15 text-red-400 ring-red-500/40',
                  state === 'next' && 'bg-white/[0.04] text-slate-500 ring-white/[0.1]',
                )}
              >
                {state === 'done' ? <CheckCircle2 size={14} /> : state === 'bad' ? <XCircle size={14} /> : i + 1}
              </span>
              <span
                className={cn(
                  'mt-1 whitespace-nowrap text-xs',
                  state === 'next' ? 'text-slate-500' : state === 'bad' ? 'text-red-400' : 'text-slate-300',
                )}
              >
                {bad
                  ? r.status === 'REJECTED'
                    ? '반려'
                    : '취소'
                  : i === 5 && r.status === 'APPROVED'
                    ? `전자서명 ${signedCount}/2`
                    : label}
              </span>
            </div>
            {i < TRADE_STEPS.length - 1 && (
              <span className={cn('mx-1 mt-3.5 h-px flex-1', i < step && !bad ? 'bg-primary/50' : 'bg-white/[0.08]')} />
            )}
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
