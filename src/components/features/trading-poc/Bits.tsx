'use client';

import { useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import type { ChangeSign, ChangeStatus, Contract, ContractStatus, SignMark, TradeEvent, TradeRequest, TradeRequestStatus } from '@/types/trading-poc';
import {
  CHANGE_STATUS,
  CHANGE_STATE_TONE,
  changeStateOf,
  CONTRACT_STATUS,
  PARTY_LABEL,
  REQUEST_STATUS,
  fmtDateTime,
} from './meta';

/** 제목만 — 부제 없음 (통합관제와 같은 규칙). 브레드크럼은 RE100 › (상위 ›) 화면 */
/** crumb — 경로 표시에 쓸 이름(제목에 기업 이름이 붙는 화면은 메뉴 이름만) */
export function PageHeader({ title, parent, actions, crumb }: { title: string; parent?: string; actions?: ReactNode; crumb?: string }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, ...(parent ? [{ label: parent }] : []), { label: crumb ?? title }]}
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
/** 변경·해지 상태 — 진행 중은 단계, 끝나면 반영 · 해지 · 반려 · 취소 */
export function ChangeStatePill({ ch }: { ch: Parameters<typeof changeStateOf>[0] }) {
  const st = changeStateOf(ch);
  return <StatusPill tone={CHANGE_STATE_TONE[st]} label={st} />;
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
export const TRADE_STEPS = ['신청 접수', '미팅', '전자서명', '승인'] as const;

/** 단계 표기 — 미팅 (2/5) */
/** 금일(이 기기 날짜) YYYY-MM-DD — 미팅일은 금일부터 */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** 글 칸 최대 글자 수 — 비고 · 반려 사유 · 협의 채팅 한 건 */
export const TEXT_MAX = 500;

export const stepLabel = (label: string, i: number) => `${label} (${i + 1}/${TRADE_STEPS.length})`;

/** 지금 단계(TRADE_STEPS 번호). 신청하면 신청 접수, 관리자가 미팅일을 확정하면 미팅(조건 입력), 계약서를 만들면 전자서명, 둘 다 서명하면 승인(둘 다 서명) — TRADE_STEPS.length */
export function tradeStepOf(r: TradeRequest): number {
  switch (r.status) {
    case 'SUBMITTED':
      return 0; // 신청 접수 — 관리자가 미팅일을 확정하면 미팅
    case 'APPROVED':
      return 2;
    case 'SIGNED':
      return TRADE_STEPS.length;
    default:
      return 1; // 미팅 · 반려 · 취소(멈춘 자리)
  }
}

/** 진행 단계 — 번호 원 · 선. 반려 · 취소는 멈춘 자리에 표시 */
/** 단계 표시줄 — 거래 이력 · 거래 승인 · 변경·해지가 같은 모양. step = 지금 단계(0부터), failed = 그 자리에서 반려 · 취소 */
export function StepBar({
  steps,
  step,
  failed,
  labelOf,
  className,
}: {
  steps: readonly string[];
  step: number;
  /** 반려 · 취소 — 그 단계에 빨간 X 와 이 이름 */
  failed?: string;
  /** 단계 이름을 바꿔 보일 때(예: 전자서명 1/2) */
  labelOf?: (label: string, i: number) => string;
  className?: string;
}) {
  return (
    <ol className={cn('flex items-start', className)}>
      {steps.map((label, i) => {
        const bad = !!failed && i === step;
        const state = bad ? 'bad' : i < step ? 'done' : i === step && !failed ? 'now' : 'next';
        return (
          <li key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ring-1',
                  state === 'done' && 'bg-primary text-white ring-primary',
                  state === 'now' && 'bg-primary/20 text-primary ring-primary/50',
                  state === 'bad' && 'bg-red-500/15 text-red-400 ring-red-500/40',
                  state === 'next' && 'bg-white/[0.04] text-slate-500 ring-white/[0.1]',
                )}
              >
                {state === 'done' ? <CheckCircle2 size={17} /> : state === 'bad' ? <XCircle size={17} /> : i + 1}
              </span>
              <span
                className={cn(
                  'mt-2 whitespace-nowrap text-sm',
                  state === 'next'
                    ? 'text-slate-500'
                    : state === 'bad'
                      ? 'text-red-400'
                      : state === 'now'
                        ? 'font-semibold text-white'
                        : 'text-slate-300',
                )}
              >
                {bad ? failed : labelOf ? labelOf(label, i) : label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn('mx-2 mt-[18px] h-px flex-1', i < step && !bad ? 'bg-primary/50' : 'bg-white/[0.08]')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function TradeStepper({
  r,
  signedCount = 0,
  className,
}: {
  r: TradeRequest;
  signedCount?: number;
  className?: string;
}) {
  const failed = r.status === 'REJECTED' ? '반려' : r.status === 'CANCELLED' ? '취소' : undefined;
  return (
    <StepBar
      steps={TRADE_STEPS}
      step={tradeStepOf(r)}
      failed={failed}
      labelOf={(label, i) => (i === 2 && r.status === 'APPROVED' ? `전자서명 ${signedCount}/2` : label)}
      className={className}
    />
  );
}

/* ── 진행 이력 ── */

/**
 * 진행 이력 카드 — 거래 이력 · 거래 승인 · 변경 · 해지 상세가 모두 이 카드를 쓴다.
 * 제목 줄 오른쪽 버튼으로 접고 편다(이력이 길어지면 화면이 너무 길어진다, 2026-11-25 사용자). 처음에는 펼친 상태
 */
export function HistoryCard({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <SectionCard
      title="진행 이력"
      className={cn(className, !open && '!h-auto')}
      noPadding={!open}
      actions={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? '진행 이력 접기' : '진행 이력 펼치기'}
          title={open ? '접기' : '펼치기'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-slate-200 ring-1 ring-white/[0.12] hover:bg-white/[0.12] hover:text-white"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      }
    >
      {open ? children : null}
    </SectionCard>
  );
}

/**
 * 진행 이력 — 누가 했는지는 관리자 / 기업명(companyName 을 주면, 2026-11-19 사용자: '· 기업' 대신 '· 용인금속').
 * 전자서명 줄은 글자('김관리 서명') 대신 서명 그 자체(그린 서명 이미지 또는 서명체 이름) + 이름 (회사) — signs 를 주면
 */
export function EventTimeline({
  events,
  companyName,
  signs,
}: {
  events: TradeEvent[];
  companyName?: string;
  signs?: { spc?: ChangeSign; company?: ChangeSign };
}) {
  const sorted = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.at.localeCompare(a.e.at) || b.i - a.i)
    .map((x) => x.e);
  if (sorted.length === 0) return <p className="text-sm text-slate-500">이력 없음</p>;
  const who = (by: TradeEvent['by']) => (by === 'spc' || !companyName ? PARTY_LABEL[by] : companyName);
  return (
    <ol className="space-y-3">
      {sorted.map((e, i) => {
        const sign = e.label === '전자서명' ? (e.by === 'spc' ? signs?.spc : signs?.company) : undefined;
        return (
          <li key={`${e.at}-${i}`} className="flex gap-3">
            <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', i === 0 ? 'bg-primary' : 'bg-slate-600')} />
            <div className="min-w-0">
              <p className="text-sm text-white">
                {e.label} <span className="text-slate-500">· {who(e.by)}</span>
              </p>
              {sign ? (
                <div className="mt-1">
                  <div className="flex h-12 w-40 items-center justify-center rounded-md bg-[#0d1520] ring-1 ring-white/[0.08]">
                    {sign.image ? (
                      <img src={sign.image} alt={`${sign.name} 서명`} className="h-full object-contain" />
                    ) : (
                      <span className="text-xl text-white" style={{ fontFamily: "'Nanum Pen Script', 'Gaegu', cursive" }}>
                        {sign.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-300">
                    {sign.name} ({who(e.by)}) · {sign.image ? '직접 서명' : '이름 입력'}
                  </p>
                </div>
              ) : (
                e.note && <p className="text-sm text-slate-400 mt-0.5">{e.note}</p>
              )}
              <p className="text-xs text-slate-300 tabular-nums mt-0.5">{fmtDateTime(e.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** 거래 계약의 서명(SignMark) → 진행 이력 서명 표시 */
const markToSign = (m?: SignMark): ChangeSign | undefined =>
  m ? { at: m.at, name: m.person ?? m.typedName ?? '', image: m.method === 'draw' ? m.image : undefined } : undefined;
export const signsOfContract = (c?: Contract) => ({ spc: markToSign(c?.signMarkGenerator), company: markToSign(c?.signMarkConsumer) });

/** 모달 하단 버튼 줄 */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">{children}</div>;
}
