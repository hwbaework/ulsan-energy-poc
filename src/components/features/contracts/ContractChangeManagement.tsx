'use client';

import { useMemo, useState } from 'react';
import { RefreshCw, FileEdit, XCircle, CheckCircle2, Loader2, Clock, Inbox } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import {
  useAllContractChanges,
  useApproveContractChange,
  useRejectContractChange,
  useGeneratorApproveChange,
  useGeneratorRejectChange,
  useCancelContractChange,
} from '@/hooks/ppa/usePpa';

type Persona = 'consumer' | 'generator' | 'spc';

const CHANGE_META: Record<string, { label: string; icon: typeof RefreshCw; tone: string }> = {
  RENEWAL: { label: '갱신', icon: RefreshCw, tone: 'text-blue-300' },
  MODIFICATION: { label: '변경', icon: FileEdit, tone: 'text-violet-300' },
  TERMINATION: { label: '해지', icon: XCircle, tone: 'text-rose-300' },
};
const changeMeta = (t: string) => CHANGE_META[t] ?? { label: t, icon: FileEdit, tone: 'text-slate-300' };

const STATUS_META: Record<string, { label: string; tone: string; bg: string; ring: string }> = {
  REQUESTED: { label: '검토 중', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
  COMPLETED: { label: '확정', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', ring: 'ring-emerald-500/30' },
  REJECTED: { label: '거절', tone: 'text-rose-300', bg: 'bg-rose-500/[0.08]', ring: 'ring-rose-500/30' },
  CANCELLED: { label: '취소됨', tone: 'text-slate-400', bg: 'bg-slate-500/[0.08]', ring: 'ring-slate-500/30' },
  SUPERSEDED: { label: '대체됨', tone: 'text-slate-400', bg: 'bg-slate-500/[0.08]', ring: 'ring-slate-500/30' },
};
const statusMeta = (s: string) =>
  STATUS_META[s] ?? { label: s, tone: 'text-slate-300', bg: 'bg-slate-500/[0.08]', ring: 'ring-slate-500/30' };

function formatChangeDetail(c: any): string | null {
  if (c.changeType === 'TERMINATION') return null;
  const parts: string[] = [];
  if (c.newUnitPriceKrw != null) parts.push(`단가 → ₩${Number(c.newUnitPriceKrw).toLocaleString()}/kWh`);
  if (c.newCapacityKw != null) parts.push(`용량 → ${Number(c.newCapacityKw).toLocaleString()} kW`);
  if (c.newEndDate) parts.push(`종료일 → ${String(c.newEndDate).slice(0, 10)}`);
  return parts.length ? parts.join(' · ') : null;
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        m.bg,
        m.tone,
        m.ring,
      )}
    >
      {m.label}
    </span>
  );
}

/* 변경·해지 진행 스텝퍼 — 신청 → 상대방 동의 → SPC 확정 → 계약 반영 */
function ChangeSteps({ change, counterpartyLabel }: { change: any; counterpartyLabel: string }) {
  const consent = change.generatorApprovalStatus;
  const completed = change.status === 'COMPLETED';
  const rejected = change.status === 'REJECTED' || consent === 'REJECTED';
  const consentDone = consent === 'APPROVED' || consent === 'NOT_REQUIRED';
  const steps = [
    { label: '신청 접수', done: true, current: false, bad: false },
    {
      label: consent === 'NOT_REQUIRED' ? '동의 불필요' : `${counterpartyLabel} 동의`,
      done: consentDone,
      current: consent === 'PENDING' && !rejected,
      bad: consent === 'REJECTED',
    },
    {
      label: 'SPC 확정',
      done: completed,
      current: consentDone && !completed && !rejected,
      bad: change.status === 'REJECTED',
    },
    { label: '계약 반영', done: completed, current: false, bad: false },
  ];
  return (
    <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-white/[0.05]">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center flex-1 last:flex-none">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] whitespace-nowrap',
              s.bad ? 'text-rose-300' : s.done ? 'text-emerald-300' : s.current ? 'text-primary' : 'text-slate-600',
            )}
          >
            {s.bad ? (
              <XCircle size={11} />
            ) : s.done ? (
              <CheckCircle2 size={11} />
            ) : s.current ? (
              <Clock size={11} />
            ) : (
              <span className="inline-block h-[11px] w-[11px] rounded-full ring-1 ring-current" />
            )}
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={cn('h-px flex-1 mx-1.5', s.done ? 'bg-emerald-500/30' : 'bg-white/[0.08]')} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ContractChangeManagement() {
  const showToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const persona: Persona = (() => {
    const p = getPersona(user);
    if (p === 'generator') return 'generator';
    if (p === 'spc' || p === 'admin' || p === 'operator' || p === 'agency') return 'spc';
    return 'consumer';
  })();

  const { data, isLoading } = useAllContractChanges();
  const changes = useMemo(() => ((data as any) ?? []) as any[], [data]);

  const approveMut = useApproveContractChange();
  const rejectMut = useRejectContractChange();
  const genApproveMut = useGeneratorApproveChange();
  const genRejectMut = useGeneratorRejectChange();
  const cancelMut = useCancelContractChange();

  const [filter, setFilter] = useState<'all' | 'active' | 'REQUESTED' | 'COMPLETED' | 'REJECTED'>('all');

  const counts = useMemo(() => {
    const c = { all: changes.length, REQUESTED: 0, COMPLETED: 0, REJECTED: 0 };
    for (const x of changes) {
      if (x.status === 'REQUESTED') c.REQUESTED++;
      else if (x.status === 'COMPLETED') c.COMPLETED++;
      else if (x.status === 'REJECTED') c.REJECTED++;
    }
    return c;
  }, [changes]);

  const filtered = useMemo(
    () => (filter === 'all' ? changes : changes.filter((c) => c.status === filter)),
    [changes, filter],
  );

  const busy =
    approveMut.isPending ||
    rejectMut.isPending ||
    genApproveMut.isPending ||
    genRejectMut.isPending ||
    cancelMut.isPending;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast('success', ok);
    } catch {
      showToast('error', '처리에 실패했습니다');
    }
  };

  const title = persona === 'spc' ? '변경·해지 처리' : persona === 'generator' ? '변경·해지 동의' : '내 변경·해지 신청';
  const intro =
    persona === 'spc'
      ? '들어온 변경·해지 요청을 검토하고 승인/거절합니다. (해지는 발전사 동의 후 승인)'
      : persona === 'generator'
        ? '나에게 동의 요청된 변경·해지 건을 검토하고 동의/거절합니다.'
        : '내가 신청한 변경·해지의 진행 상태를 확인합니다.';

  const BOARD: { key: typeof filter; label: string; n: number }[] = [
    { key: 'all', label: '전체', n: counts.all },
    { key: 'REQUESTED', label: '검토 중', n: counts.REQUESTED },
    { key: 'COMPLETED', label: '확정', n: counts.COMPLETED },
    { key: 'REJECTED', label: '거절', n: counts.REJECTED },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래' }, { label: '변경·해지' }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{intro}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {BOARD.map((b) => (
          <button
            key={b.key}
            onClick={() => setFilter(b.key)}
            className={cn(
              'flex flex-1 min-w-[110px] flex-col items-start gap-1 rounded-lg border bg-surface-card px-4 py-3 text-left transition-all',
              filter === b.key
                ? 'border-primary/60 ring-1 ring-primary/30'
                : 'border-white/[0.06] hover:border-white/[0.15]',
            )}
          >
            <span className="text-xs text-slate-400">{b.label}</span>
            <span className="text-2xl font-bold text-white tabular-nums">{b.n}</span>
          </button>
        ))}
      </div>

      <SectionCard title={`요청 ${filtered.length}건`}>
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox size={26} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">처리할 변경·해지 요청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const cm = changeMeta(c.changeType);
              const isOpen = c.status === 'REQUESTED';
              const consent = c.generatorApprovalStatus; // '상대방 동의' 의미로 일반화
              // 신청자/상대방 — requestedByRole 기준. 상대방이 동의 대상.
              const requesterPersona: Persona = c.requestedByRole === 'GENERATOR' ? 'generator' : 'consumer';
              const counterpartyPersona: Persona = requesterPersona === 'generator' ? 'consumer' : 'generator';
              const counterpartyLabel = counterpartyPersona === 'generator' ? '발전사' : '수용가';
              // 상대방 동의 액션 (PENDING 일 때 상대방 페르소나만)
              const canCounterpartyAct = persona === counterpartyPersona && consent === 'PENDING' && isOpen;
              // SPC 확정 — 상대방 동의 완료/불필요일 때만. 반려는 진행중이면 언제든.
              const spcApprovable = persona === 'spc' && isOpen && ['APPROVED', 'NOT_REQUIRED'].includes(consent);
              const spcWaitingCounterparty = persona === 'spc' && isOpen && consent === 'PENDING';
              const spcCanReject = persona === 'spc' && isOpen;
              const iAmRequester = persona === requesterPersona;

              return (
                <div key={c.id} className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <cm.icon size={15} className={cm.tone} />
                        <span className="text-sm font-semibold text-white">{cm.label}</span>
                        <span className="text-xs text-slate-300 tabular-nums">{c.contractNumber}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        신청: {requesterPersona === 'generator' ? '발전사' : '수용가'} · {c.generatorCompanyName} ↔{' '}
                        {c.consumerCompanyName} · {c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : ''}
                      </p>
                      {formatChangeDetail(c) && (
                        <p className="text-xs text-slate-200 mt-1">
                          <span className="text-slate-500">요청 내용: </span>
                          {formatChangeDetail(c)}
                        </p>
                      )}
                      {c.changeType === 'TERMINATION' && c.terminationFee != null && (
                        <p className="text-xs text-rose-300 mt-1">
                          예상 위약금: ₩{Number(c.terminationFee).toLocaleString()}
                        </p>
                      )}
                      {c.description && <p className="text-xs text-slate-400 mt-1">사유: {c.description}</p>}
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canCounterpartyAct && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              act(() => genApproveMut.mutateAsync(c.id), '동의했습니다 — SPC 확정 단계로 진행됩니다')
                            }
                          >
                            <CheckCircle2 size={13} className="mr-1" /> 동의
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-400 hover:text-rose-300"
                            disabled={busy}
                            onClick={() => act(() => genRejectMut.mutateAsync(c.id), '거절했습니다')}
                          >
                            거절
                          </Button>
                        </>
                      )}
                      {spcApprovable && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act(() => approveMut.mutateAsync(c.id), '확정했습니다 — 계약에 반영되었습니다')
                          }
                        >
                          <CheckCircle2 size={13} className="mr-1" /> 확정
                        </Button>
                      )}
                      {spcWaitingCounterparty && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                          <Clock size={11} /> {counterpartyLabel} 동의 대기
                        </span>
                      )}
                      {spcCanReject && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          disabled={busy}
                          onClick={() => act(() => rejectMut.mutateAsync(c.id), '반려했습니다')}
                        >
                          반려
                        </Button>
                      )}
                      {iAmRequester && isOpen && (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                            <Clock size={11} /> 진행 중
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-white"
                            disabled={busy}
                            onClick={() => act(() => cancelMut.mutateAsync(c.id), '신청을 취소했습니다')}
                          >
                            취소
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 진행 스텝퍼 — 신청 → 상대방 동의 → SPC 확정 → 반영 */}
                  <ChangeSteps change={c} counterpartyLabel={counterpartyLabel} />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
