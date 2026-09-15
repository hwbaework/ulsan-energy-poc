'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Zap, Sun, ChevronRight, Percent, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useTradingRequests, useUpdateRequestStatus, useAllTradingMatches } from '@/hooks/trading/useTrading';
import { useToastStore } from '@/stores/useToastStore';

/* ─── 타입·상수 (거래 현황 발전사업자 탭과 동일 규칙) ─── */
type DealType = 'offsite-ppa' | 'onsite-ppa' | 'savings-share';
type Status = 'SUBMITTED' | 'APPROVED' | 'MATCHING' | 'MATCHED' | 'CANCELLED';

const DEAL_TYPE_META: Record<DealType, { label: string; icon: any; tone: string; bg: string; ring: string }> = {
  'offsite-ppa': {
    label: '직접 PPA - Offsite PPA',
    icon: Zap,
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
    ring: 'ring-blue-500/30',
  },
  'onsite-ppa': {
    label: '직접 PPA - Onsite PPA',
    icon: Percent,
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
  },
  'savings-share': {
    label: '직접 PPA',
    icon: Sun,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ring: 'ring-violet-500/30',
  },
};

const STATUS_META: Record<Status, { label: string; bg: string; tone: string; ring: string }> = {
  SUBMITTED: { label: '신청 접수', bg: 'bg-rose-500/[0.10]', tone: 'text-rose-300', ring: 'ring-rose-500/30' },
  APPROVED: { label: '승인 완료', bg: 'bg-blue-500/[0.10]', tone: 'text-blue-300', ring: 'ring-blue-500/30' },
  MATCHING: { label: '매칭 중', bg: 'bg-amber-500/[0.10]', tone: 'text-amber-300', ring: 'ring-amber-500/30' },
  MATCHED: { label: '매칭 완료', bg: 'bg-emerald-500/[0.10]', tone: 'text-emerald-300', ring: 'ring-emerald-500/30' },
  CANCELLED: { label: '취소', bg: 'bg-slate-500/[0.10]', tone: 'text-slate-300', ring: 'ring-slate-500/30' },
};
const STATUSES: Status[] = ['SUBMITTED', 'MATCHING', 'MATCHED'];

const dealTypeMap: Record<string, DealType> = {
  PPA: 'offsite-ppa',
  SAVINGS_SHARE: 'savings-share',
};

const parseResourceFromNotes = (notes?: string): string => {
  const m = notes?.match(/자원:\s*([^/]+)/);
  return m?.[1]?.trim() ?? '태양광';
};

interface GeneratorRequest {
  id: string;
  companyId: number;
  companyName: string;
  plantName?: string;
  region?: string;
  dealType: DealType;
  status: Status;
  capacityKw: number;
  durationYears: number;
  desiredUnitPrice: number;
  submittedAt: string;
  notes?: string;
}

export default function GeneratorApprovalsPage() {
  const { data: tradingData } = useTradingRequests({ page: 0, size: 200 });
  const storeRequests = ((tradingData as any)?.content ?? []) as any[];
  const { data: matchData } = useAllTradingMatches();
  const storeMatches = (matchData as any[]) ?? [];
  const updateRequestStatusMut = useUpdateRequestStatus();

  // 발전사 신청 — requesterType === 'GENERATOR'
  const ALL_GEN_REQUESTS: GeneratorRequest[] = useMemo(() => {
    return storeRequests
      .filter((r) => r.status !== 'CANCELLED' && r.requesterType === 'GENERATOR')
      .map(
        (r): GeneratorRequest => ({
          id: `api-${r.id}`,
          companyId: r.companyId,
          companyName: r.companyName,
          plantName: r.plantName,
          region: r.region,
          dealType: dealTypeMap[r.dealType] ?? 'offsite-ppa',
          status: r.status as Status,
          capacityKw: r.capacityKw,
          durationYears: r.durationYears,
          desiredUnitPrice: r.desiredUnitPrice ?? 0,
          submittedAt: (r.submittedAt ?? r.createdAt ?? '').slice(0, 10),
          notes: r.notes,
        }),
      );
  }, [storeRequests]);

  // 승인 모달
  const [approvalTarget, setApprovalTarget] = useState<GeneratorRequest | null>(null);
  const [approvalRejectReason, setApprovalRejectReason] = useState('');
  const toRequestId = (id: string) => Number(String(id).replace(/^api-/, ''));
  const closeApproval = () => {
    setApprovalTarget(null);
    setApprovalRejectReason('');
  };

  // 재제안 모달 — 거절된 매칭에 새 단가/메모로 재제안
  const [resubmitTarget, setResubmitTarget] = useState<{ request: any; declinedMatch: any } | null>(null);
  const [resubmitPrice, setResubmitPrice] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');
  const closeResubmit = () => {
    setResubmitTarget(null);
    setResubmitPrice('');
    setResubmitNote('');
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: '전력거래', path: '/platform/trading' }, { label: '자원 관리/승인' }]} />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">자원 관리/승인</h1>
          <p className="text-sm text-slate-400">발전사 공급 자원 등록 검토 · 승인 · 매칭 풀/거래 진행 모니터링</p>
        </div>
      </div>

      {/* 단계 카운트 카드들 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {(() => {
          const pendingApprovalCount = ALL_GEN_REQUESTS.filter((g) => g.status === 'SUBMITTED').length;
          return (
            <div
              className={cn(
                'rounded-xl px-4 py-3 ring-1',
                pendingApprovalCount > 0
                  ? 'border border-amber-500/30 bg-amber-500/[0.06] ring-amber-500/30'
                  : 'border border-white/[0.06] bg-surface-card ring-white/[0.06]',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md',
                      pendingApprovalCount > 0 ? 'bg-amber-500/[0.15]' : 'bg-white/[0.04]',
                    )}
                  >
                    <AlertCircle size={12} className={pendingApprovalCount > 0 ? 'text-amber-300' : 'text-slate-500'} />
                  </span>
                  <p
                    className={cn('text-sm font-semibold', pendingApprovalCount > 0 ? 'text-white' : 'text-slate-400')}
                  >
                    자원 등록 승인
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  pendingApprovalCount > 0 ? 'text-amber-300' : 'text-slate-600',
                )}
              >
                {pendingApprovalCount}
                <span className="text-xs font-normal ml-0.5">건</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {pendingApprovalCount > 0 ? 'SPC 검토 필요' : '신규 등록 없음'}
              </p>
            </div>
          );
        })()}

        <div className="rounded-xl border border-white/[0.06] bg-surface-card px-4 py-3 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={cn('flex h-6 w-6 items-center justify-center rounded-md', DEAL_TYPE_META['offsite-ppa'].bg)}
              >
                <Zap size={12} className={DEAL_TYPE_META['offsite-ppa'].tone} />
              </span>
              <p className="text-sm font-semibold text-white">PPA 공급</p>
            </div>
            <p className="text-xs text-slate-400">
              <span className="text-white font-bold tabular-nums">{ALL_GEN_REQUESTS.length}</span>건
            </p>
          </div>
          <div className="flex items-stretch gap-1">
            {STATUSES.map((s, i) => {
              const sMeta = STATUS_META[s];
              const cnt = ALL_GEN_REQUESTS.filter((g) => g.status === s).length;
              const active = cnt > 0;
              return (
                <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
                  <div
                    className={cn(
                      'rounded-md px-2 py-2 flex-1 min-w-0 text-center ring-1',
                      active ? 'bg-white/[0.04] ring-white/[0.08]' : 'bg-transparent ring-white/[0.04]',
                    )}
                  >
                    <p className={cn('text-[10px] truncate', active ? 'text-slate-400' : 'text-slate-600')}>
                      {sMeta.label}
                    </p>
                    <p
                      className={cn(
                        'text-lg font-bold tabular-nums leading-tight mt-0.5',
                        active ? 'text-white' : 'text-slate-700',
                      )}
                    >
                      {cnt}
                    </p>
                  </div>
                  {i < STATUSES.length - 1 && <ChevronRight size={10} className="text-slate-600 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-surface-card px-4 py-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
            <Sun size={14} className="text-slate-500" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-400">Lease는 수용가 주도</p>
            <p className="mt-0.5 text-xs text-slate-400">발전사는 PPA만 신청 가능</p>
          </div>
        </div>
      </div>

      {/* 안내 — 공급 신청은 매칭이 아니라 승인 프로세스 */}
      <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/30 px-4 py-3 flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-300" />
        <div className="text-xs text-slate-300">
          <p className="text-amber-200 font-medium">
            ① 자원 등록 → ② SPC 승인 → ③ 희망가격 기입(발전사) → 매칭 풀 → 수용가 매칭 → 계약
          </p>
          <p className="text-slate-400 mt-0.5">
            승인 + 희망가격 기입 완료된 발전소만 매칭 후보 풀에 등록됩니다. 매칭은 거래 관리(수용가)에서 진행.
          </p>
        </div>
      </div>

      {/* ───── 1) 자원 등록 승인 — SPC 액션 영역 (SUBMITTED만) ───── */}
      {(() => {
        const pendingList = ALL_GEN_REQUESTS.filter((g) => g.status === 'SUBMITTED');
        return (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-md font-semibold text-white">자원 등록 승인 ({pendingList.length}건)</h3>
              <p className="text-[11px] text-slate-500">SPC 검토가 필요한 신규 등록</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-4 py-2 text-left font-medium">등록일</th>
                    <th className="px-4 py-2 text-left font-medium">발전사</th>
                    <th className="px-4 py-2 text-left font-medium">용량</th>
                    <th className="px-4 py-2 text-left font-medium">승인</th>
                    <th className="px-4 py-2 text-left font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                        승인 대기 중인 자원 등록이 없습니다
                      </td>
                    </tr>
                  ) : (
                    pendingList.map((g) => (
                      <tr key={g.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{g.submittedAt?.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm">{g.companyName}</p>
                          <p className="text-[11px] text-slate-500">
                            {g.plantName ?? '—'} · {parseResourceFromNotes(g.notes)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                          {g.capacityKw.toLocaleString()} kW
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-amber-500/[0.10] text-amber-300 ring-amber-500/30">
                            승인 대기
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setApprovalTarget(g);
                              setApprovalRejectReason('');
                            }}
                          >
                            승인 검토
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ───── 2) 매칭 풀·거래 진행 — 모니터링 영역 (APPROVED/MATCHING/MATCHED) ───── */}
      {(() => {
        const tradeList = ALL_GEN_REQUESTS.filter((g) => g.status !== 'SUBMITTED' && g.status !== 'CANCELLED');
        return (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-md font-semibold text-white">매칭 풀·거래 진행 ({tradeList.length}건)</h3>
              <p className="text-[11px] text-slate-500">승인된 자원의 매칭/거래 모니터링</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-4 py-2 text-left font-medium">등록일</th>
                    <th className="px-4 py-2 text-left font-medium">발전사</th>
                    <th className="px-4 py-2 text-left font-medium">용량</th>
                    <th className="px-4 py-2 text-left font-medium">희망 단가</th>
                    <th className="px-4 py-2 text-left font-medium">거래</th>
                    <th className="px-4 py-2 text-left font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                        매칭 풀에 등록된 자원이 없습니다
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const orderOf = (g: any) => {
                        const ms = storeMatches.filter(
                          (m) => m.generatorRequestId === Number(String(g.id).replace('api-', '')),
                        );
                        if (ms.some((m) => m.status === 'DECLINED')) return 0;
                        if (ms.some((m) => m.status === 'PROPOSED' || m.status === 'GEN_ACCEPTED')) return 1;
                        if (g.status === 'MATCHED' || ms.some((m) => m.status === 'ACCEPTED')) return 3;
                        return 2;
                      };
                      const sorted = [...tradeList].sort((a, b) => orderOf(a) - orderOf(b));
                      return sorted.map((g) => {
                        const gMatches = storeMatches.filter(
                          (m) => m.generatorRequestId === Number(String(g.id).replace('api-', '')),
                        );
                        const hasAccepted = gMatches.some((m) => m.status === 'ACCEPTED');
                        const declined = gMatches.find((m) => m.status === 'DECLINED');
                        const inProgress = gMatches.filter(
                          (m) => m.status === 'PROPOSED' || m.status === 'GEN_ACCEPTED',
                        ).length;
                        const activeMatch =
                          gMatches.find((m) => m.status === 'PROPOSED' || m.status === 'GEN_ACCEPTED') ??
                          gMatches.find((m) => m.status === 'ACCEPTED') ??
                          declined;
                        const subTypeLabel =
                          activeMatch?.ppaSubType === 'onsite'
                            ? 'Onsite PPA'
                            : activeMatch?.ppaSubType === 'offsite'
                              ? 'Offsite PPA'
                              : null;
                        const subTypeBadge = subTypeLabel && (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 w-fit',
                              activeMatch?.ppaSubType === 'onsite'
                                ? 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30'
                                : 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30',
                            )}
                          >
                            {subTypeLabel}
                          </span>
                        );
                        return (
                          <tr key={g.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                              {g.submittedAt?.slice(0, 10)}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white font-medium text-sm">{g.companyName}</p>
                              <p className="text-[11px] text-slate-500">
                                {g.plantName ?? '—'} · {parseResourceFromNotes(g.notes)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                              {g.capacityKw.toLocaleString()} kW
                            </td>
                            <td className="px-4 py-3 text-slate-300 tabular-nums">
                              {g.desiredUnitPrice > 0 ? (
                                <>₩{g.desiredUnitPrice}/kWh</>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {declined ? (
                                <div className="flex flex-col gap-0.5 max-w-[260px]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 w-fit bg-rose-500/[0.10] text-rose-300 ring-rose-500/30">
                                      거절 — 재매칭 필요
                                    </span>
                                    {subTypeBadge}
                                  </div>
                                  <span className="text-[10px] text-rose-200/80">
                                    {declined.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 leading-snug">
                                    사유: {declined.declineReason}
                                  </span>
                                </div>
                              ) : g.status === 'APPROVED' ? (
                                <span className="text-slate-400">희망가 기입 대기</span>
                              ) : hasAccepted || g.status === 'MATCHED' ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-emerald-300">계약 체결</span>
                                  {subTypeBadge}
                                </div>
                              ) : inProgress > 0 ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-amber-300">매칭 진행 {inProgress}건</span>
                                  {subTypeBadge}
                                </div>
                              ) : (
                                <span className="text-slate-400">매칭 대기</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {declined ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setResubmitTarget({ request: g, declinedMatch: declined });
                                    setResubmitPrice(String(declined.proposedPriceKrw ?? ''));
                                    setResubmitNote('');
                                  }}
                                >
                                  재제안
                                </Button>
                              ) : (
                                <span className="text-[11px] text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─────────────── 공급 신청 승인 모달 ─────────────── */}
      {approvalTarget && (
        <Modal
          open={!!approvalTarget}
          onClose={closeApproval}
          title={`공급 신청 승인 검토 — ${approvalTarget.companyName}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={closeApproval}>
                닫기
              </Button>
              <Button
                variant="danger"
                disabled={!approvalRejectReason.trim() || updateRequestStatusMut.isPending}
                onClick={async () => {
                  const t = approvalTarget;
                  try {
                    await updateRequestStatusMut.mutateAsync({ id: toRequestId(t.id), status: 'CANCELLED' });
                    useToastStore
                      .getState()
                      .add('warning', `${t.plantName ?? '공급 신청'} 반려 — 사유: ${approvalRejectReason.trim()}`);
                    closeApproval();
                  } catch {
                    useToastStore.getState().add('error', '공급 신청 반려에 실패했습니다');
                  }
                }}
              >
                반려
              </Button>
              <Button
                variant="primary"
                disabled={updateRequestStatusMut.isPending}
                onClick={async () => {
                  const t = approvalTarget;
                  try {
                    await updateRequestStatusMut.mutateAsync({ id: toRequestId(t.id), status: 'APPROVED' });
                    useToastStore
                      .getState()
                      .add('success', `${t.plantName ?? '공급 신청'} 승인 완료 — 수용가 매칭 풀에 등록됩니다`);
                    closeApproval();
                  } catch {
                    useToastStore.getState().add('error', '공급 신청 승인에 실패했습니다');
                  }
                }}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {updateRequestStatusMut.isPending ? '처리 중...' : '승인 확정'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              아래 공급 신청 내용을 검토해주세요. 승인 시 수용가 매칭 후보 풀에 등록됩니다.
            </p>
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전사</span>
                <span className="text-sm text-white font-medium">{approvalTarget.companyName}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전소 · 자원</span>
                <span className="text-sm text-white">
                  {approvalTarget.plantName ?? '—'} · {parseResourceFromNotes(approvalTarget.notes)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">설비 용량</span>
                <span className="text-sm text-white tabular-nums">{approvalTarget.capacityKw.toLocaleString()} kW</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">소재 지역</span>
                <span className="text-sm text-white">{approvalTarget.region ?? '—'}</span>
              </div>
            </div>
            <p className="text-[11px] text-accent/70">
              희망 단가는 승인 후 발전사가 직접 기입합니다 — 기입 완료 시 매칭 풀에 등록됩니다.
            </p>
            <div>
              <label className="text-xs text-accent block mb-1.5">
                반려 사유 <span className="text-slate-500">(반려 시 필수)</span>
              </label>
              <Textarea
                value={approvalRejectReason}
                onChange={(e) => setApprovalRejectReason(e.target.value)}
                placeholder="예: 설비 인증 서류 미비 — REC 발급 자격 증빙 후 재신청 바랍니다."
              />
              <p className="text-[11px] text-accent/70 mt-1">반려 사유는 발전사에 전달됩니다.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────── 재제안 모달 — 거절된 매칭에 새 단가/메모로 재제안 ─────────────── */}
      {resubmitTarget && (
        <Modal
          open={!!resubmitTarget}
          onClose={closeResubmit}
          title={`재제안 — ${resubmitTarget.request.plantName ?? resubmitTarget.request.companyName}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={closeResubmit}>
                닫기
              </Button>
              <Button
                variant="primary"
                disabled={!resubmitPrice || !resubmitNote.trim()}
                onClick={() => {
                  useToastStore
                    .getState()
                    .add(
                      'success',
                      `${resubmitTarget.request.plantName ?? '재제안'} — ₩${resubmitPrice}/kWh 로 재제안 전송됨 (TODO(API): 재매칭 mutation 연결)`,
                    );
                  closeResubmit();
                }}
              >
                재제안 전송
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-4 py-3">
              <p className="text-xs text-rose-200 font-medium mb-1">
                이전 제안 거절 —{' '}
                {resubmitTarget.declinedMatch.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'}
              </p>
              <p className="text-xs text-slate-300">
                이전 단가:{' '}
                <span className="text-white tabular-nums">₩{resubmitTarget.declinedMatch.proposedPriceKrw}/kWh</span>
              </p>
              <p className="text-xs text-slate-300 mt-1">사유: {resubmitTarget.declinedMatch.declineReason}</p>
            </div>
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전사</span>
                <span className="text-sm text-white font-medium">{resubmitTarget.request.companyName}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전소</span>
                <span className="text-sm text-white">{resubmitTarget.request.plantName ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전사 희망 단가</span>
                <span className="text-sm text-emerald-300 font-bold tabular-nums">
                  ₩{resubmitTarget.request.desiredUnitPrice}/kWh
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">새 제안 단가 (₩/kWh) *</label>
              <input
                type="number"
                step="0.1"
                value={resubmitPrice}
                onChange={(e) => setResubmitPrice(e.target.value)}
                placeholder="예: 154"
                className="w-full h-10 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">협상 내용 *</label>
              <Textarea
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                placeholder="예: 거절 사유 반영하여 단가 조정했습니다. 재검토 부탁드립니다."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
