// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Star, Clock, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProposalsByCompany, useAcceptProposal, useDeclineProposal } from '@/hooks/consulting/useConsultations';

type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

const STATUS_MAP: Record<ProposalStatus, { variant: 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
  PENDING: { variant: 'warning', label: '검토 대기' },
  ACCEPTED: { variant: 'success', label: '수락됨' },
  DECLINED: { variant: 'danger', label: '거절됨' },
  EXPIRED: { variant: 'default', label: '만료' },
};

interface ApiProposal {
  id: number;
  profileId: number;
  consultantName: string | null;
  consultationId: number | null;
  domain: string;
  proposedScope: string;
  estimatedCost: number;
  estimatedDuration: string | null;
  coverLetter: string | null;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

function parseScope(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return raw ? [raw] : [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  } catch {
    return '';
  }
}

export default function ProposalsPage() {
  const router = useRouter();
  const toast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;

  const { data: rawProposalsData, isLoading } = useProposalsByCompany(companyId);
  const rawProposals = useMemo(
    () => (Array.isArray(rawProposalsData) ? (rawProposalsData as ApiProposal[]) : []),
    [rawProposalsData],
  );
  const acceptMutation = useAcceptProposal();
  const declineMutation = useDeclineProposal();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'ARCHIVED'>('ALL');

  const proposals = useMemo(() => {
    return rawProposals.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rawProposals]);

  const matchesFilter = (p: ApiProposal) => {
    if (filter === 'ALL') return true;
    if (filter === 'ARCHIVED') return p.status === 'DECLINED' || p.status === 'EXPIRED';
    return p.status === filter;
  };
  const visibleProposals = useMemo(() => proposals.filter(matchesFilter), [proposals, filter]);

  const effectiveSelectedId =
    selectedId != null && visibleProposals.some((p) => p.id === selectedId)
      ? selectedId
      : (visibleProposals[0]?.id ?? null);
  const selected = proposals.find((p) => p.id === effectiveSelectedId) ?? null;

  const closeConfirm = () => {
    setConfirmAction(null);
    setDeclineReason('');
  };

  const pendingCount = proposals.filter((p) => p.status === 'PENDING').length;
  const acceptedCount = proposals.filter((p) => p.status === 'ACCEPTED').length;
  const archivedCount = proposals.filter((p) => p.status === 'DECLINED' || p.status === 'EXPIRED').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '받은 제안' }]} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">받은 제안</h1>
          <p className="mt-1 text-sm text-slate-400">컨설턴트들이 보낸 맞춤 컨설팅 제안을 확인하세요</p>
        </div>
        <div className="text-center py-16">
          <Mail size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-sm text-slate-400 mb-2">아직 받은 제안이 없습니다</p>
          <p className="text-xs text-slate-500 mb-4">무료 진단을 완료하면 컨설턴트 제안을 받을 수 있습니다</p>
          <Button size="sm" onClick={() => router.push('/consulting/diagnosis')}>
            무료 진단 시작
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '받은 제안' }]} />
      </div>
      <div>
        <h1 className="text-xl font-bold text-white">받은 제안</h1>
        <p className="mt-1 text-sm text-slate-400">컨설턴트가 보낸 맞춤 제안 — 수락하면 컨설팅이 시작됩니다</p>
      </div>

      <div className="flex items-center gap-2 border-b border-white/[0.06]">
        {(
          [
            { key: 'ALL', label: '전체', count: proposals.length },
            { key: 'PENDING', label: '대기중', count: pendingCount },
            { key: 'ACCEPTED', label: '수락', count: acceptedCount },
            { key: 'ARCHIVED', label: '거절·만료', count: archivedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              filter === tab.key
                ? 'border-primary text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200',
            )}
          >
            {tab.label}
            <span className={cn('ml-1.5 text-xs', filter === tab.key ? 'text-primary' : 'text-slate-500')}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── 좌측: 제안 목록 ── */}
        <div className="xl:col-span-5 space-y-3">
          {visibleProposals.length === 0 && (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] py-12 text-center">
              <p className="text-sm text-slate-500">해당하는 제안이 없습니다</p>
            </div>
          )}
          {visibleProposals.map((p) => {
            const status = STATUS_MAP[p.status] ?? STATUS_MAP.EXPIRED;
            const isSelected = p.id === effectiveSelectedId;
            const scope = parseScope(p.proposedScope);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  'w-full rounded-xl ring-1 p-5 text-left transition-all',
                  isSelected
                    ? 'bg-primary/[0.06] ring-primary/40'
                    : 'bg-[#0d1520] ring-white/[0.06] hover:ring-white/[0.16]',
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-400">
                      {(p.consultantName ?? '?')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{p.consultantName ?? '컨설턴트'}</p>
                      <p className="text-xs text-slate-500">{p.domain} 전문</p>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{p.coverLetter ?? '제안 내용이 없습니다.'}</p>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-3 text-slate-500">
                    {p.estimatedCost > 0 && (
                      <span>
                        비용 <span className="text-white font-medium">₩{p.estimatedCost.toLocaleString()}</span>
                      </span>
                    )}
                    {p.estimatedDuration && (
                      <span>
                        기간 <span className="text-white font-medium">{p.estimatedDuration}</span>
                      </span>
                    )}
                  </div>
                  {p.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Clock size={11} />
                      검토 대기
                    </span>
                  ) : p.status === 'ACCEPTED' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 size={11} />
                      수락됨
                    </span>
                  ) : p.status === 'DECLINED' ? (
                    <span className="inline-flex items-center gap-1 text-red-300">
                      <XCircle size={11} />
                      거절됨
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[10px] text-slate-600 tabular-nums">받은 날짜 {formatDate(p.createdAt)}</p>
              </button>
            );
          })}
        </div>

        {/* ── 우측: 제안 상세 ── */}
        {selected && (
          <div className="xl:col-span-7 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden sticky top-6">
            {/* 컨설턴트 헤더 */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                  {(selected.consultantName ?? '?')[0]}
                </div>
                <div>
                  <p className="text-base font-semibold text-white flex items-center gap-2">
                    {selected.consultantName ?? '컨설턴트'}
                  </p>
                  <p className="text-xs text-slate-400">{selected.domain} 전문</p>
                </div>
              </div>
              <Badge variant={(STATUS_MAP[selected.status] ?? STATUS_MAP.EXPIRED).variant}>
                {(STATUS_MAP[selected.status] ?? STATUS_MAP.EXPIRED).label}
              </Badge>
            </div>

            {/* 제안 내용 */}
            <div className="px-6 py-4 border-b border-white/[0.06] space-y-4">
              <div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {selected.coverLetter ?? '제안 내용이 없습니다.'}
                </p>
              </div>
              {parseScope(selected.proposedScope).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">제안 문서</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseScope(selected.proposedScope).map((s) => (
                      <span key={s} className="text-[11px] bg-white/[0.05] text-slate-300 rounded-md px-2 py-1">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {selected.estimatedCost > 0 && (
                  <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                    <p className="text-xs text-slate-400">예상 비용</p>
                    <p className="text-base font-semibold text-white tabular-nums">
                      ₩{selected.estimatedCost.toLocaleString()}
                    </p>
                  </div>
                )}
                {selected.estimatedDuration && (
                  <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                    <p className="text-xs text-slate-400">예상 기간</p>
                    <p className="text-base font-semibold text-white">{selected.estimatedDuration}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 액션 — 수락 / 거절 */}
            {selected.status === 'PENDING' ? (
              <div className="px-6 py-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">수락 시 컨설팅이 시작됩니다</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmAction('decline')}>
                    거절
                  </Button>
                  <Button variant="primary" onClick={() => setConfirmAction('accept')}>
                    <CheckCircle2 size={14} className="mr-1.5" />
                    제안 수락
                  </Button>
                </div>
              </div>
            ) : selected.status === 'ACCEPTED' ? (
              <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-emerald-300">수락된 제안입니다 — 컨설팅이 진행 중입니다.</p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    router.push(
                      selected.consultationId ? `/consulting/status/${selected.consultationId}` : '/consulting/status',
                    )
                  }
                >
                  내 컨설팅에서 진행 보기
                </Button>
              </div>
            ) : selected.status === 'DECLINED' ? (
              <div className="px-6 py-4">
                <p className="text-xs text-slate-500">거절한 제안입니다.</p>
              </div>
            ) : (
              <div className="px-6 py-4">
                <p className="text-xs text-slate-500">종료된 제안입니다.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 수락/거절 확인 팝업 ── */}
      {confirmAction && selected && (
        <Modal
          open={!!confirmAction}
          onClose={closeConfirm}
          title={confirmAction === 'accept' ? '제안 수락 확인' : '제안 거절'}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={closeConfirm}>
                돌아가기
              </Button>
              {confirmAction === 'accept' ? (
                <Button
                  variant="primary"
                  loading={acceptMutation.isPending}
                  onClick={() => {
                    acceptMutation.mutate(selected.id, {
                      onSuccess: () => {
                        toast('success', `${selected.consultantName ?? '컨설턴트'}의 제안을 수락했습니다`);
                        closeConfirm();
                        if (selected.consultationId) {
                          router.push(`/consulting/status/${selected.consultationId}`);
                        } else {
                          router.push('/consulting/status');
                        }
                      },
                      onError: () => {
                        toast('error', '제안 수락에 실패했습니다. 다시 시도해주세요.');
                      },
                    });
                  }}
                >
                  수락 확정
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={!declineReason.trim()}
                  loading={declineMutation.isPending}
                  onClick={() => {
                    declineMutation.mutate(selected.id, {
                      onSuccess: () => {
                        toast('warning', '제안을 거절했습니다');
                        closeConfirm();
                      },
                      onError: () => {
                        toast('error', '제안 거절에 실패했습니다. 다시 시도해주세요.');
                      },
                    });
                  }}
                >
                  거절 확정
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">컨설턴트</span>
                <span className="text-sm text-white font-medium">
                  {selected.consultantName ?? '컨설턴트'} ({selected.domain} 전문)
                </span>
              </div>
              {selected.estimatedCost > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">예상 비용</span>
                  <span className="text-sm text-white tabular-nums">₩{selected.estimatedCost.toLocaleString()}</span>
                </div>
              )}
              {selected.estimatedDuration && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">예상 기간</span>
                  <span className="text-sm text-white">{selected.estimatedDuration}</span>
                </div>
              )}
            </div>

            {confirmAction === 'accept' ? (
              <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 px-4 py-3">
                <p className="text-xs text-emerald-200">
                  수락 시 컨설팅이 시작되며, 내 컨설팅 페이지에서 진행 상황을 확인할 수 있습니다.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">거절 사유 *</label>
                <Textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="예: 예상 비용이 예산을 초과합니다."
                />
                <p className="text-[11px] text-slate-500 mt-1">사유는 컨설턴트에게 전달됩니다.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
