'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star, Clock, CheckCircle2, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useProposals, useAcceptProposal } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';

interface ProposalView {
  id: number;
  consultantName: string;
  initial: string;
  experience: number;
  rating: number;
  estimatedCost: number;
  estimatedDuration: string;
  availableFrom: string;
  coverLetter: string;
  scope: string[];
  status: string;
}

const SCOPE_LABELS: Record<string, string> = {
  diagnosis: '에너지 현황 진단',
  strategy: '전환 전략 수립',
  roadmap: '이행 로드맵',
  ppa: 'PPA 계약 지원',
};

function formatCost(n: number) {
  if (n >= 10000) return `${(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

export default function QuoteComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">로딩 중...</div>}>
      <QuoteCompareContent />
    </Suspense>
  );
}

function QuoteCompareContent() {
  const { id } = useParams<{ id: string }>();
  const consultationId = Number(id);
  const router = useRouter();
  const toast = useToastStore((s) => s.add);

  const { data: apiProposals = [], isLoading } = useProposals(consultationId);
  const acceptProposal = useAcceptProposal();

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const proposals: ProposalView[] = (apiProposals as any[]).map((p: any) => {
    let scope: string[] = [];
    try {
      scope = typeof p.proposedScope === 'string' ? JSON.parse(p.proposedScope) : (p.proposedScope ?? []);
    } catch {
      /* JSON parse fallback */
    }
    return {
      id: p.id,
      consultantName: p.consultantName ?? '컨설턴트',
      initial: (p.consultantName ?? '?').charAt(0),
      experience: 0,
      rating: 0,
      estimatedCost: p.estimatedCost ?? 0,
      estimatedDuration: p.estimatedDuration ?? '',
      availableFrom: '',
      coverLetter: p.coverLetter ?? '',
      scope,
      status: p.status ?? 'PENDING',
    };
  });

  const pendingProposals = proposals.filter((p) => p.status === 'PENDING');
  const hasAccepted = proposals.some((p) => p.status === 'ACCEPTED');

  const handleAccept = (proposalId: number) => {
    acceptProposal.mutate(proposalId, {
      onSuccess: () => {
        toast('success', '제안을 수락했습니다. 사전 상담을 예약하세요.');
        router.push(`/consulting/pre-consultation/${consultationId}`);
      },
      onError: () => toast('error', '수락에 실패했습니다'),
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-5xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '견적 비교' }]} />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">제안서 비교</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {pendingProposals.length > 0
                ? `${pendingProposals.length}건의 제안서가 도착했습니다. 비교하고 선택하세요.`
                : '아직 제안서가 도착하지 않았습니다.'}
            </p>
          </div>
          <button
            onClick={() => router.push('/consulting')}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center gap-3">
            {['견적 요청', '제안서 비교', '사전 상담', '계약 체결'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                      i < 1 && 'bg-emerald-500/20 text-emerald-400',
                      i === 1 && 'bg-primary/20 text-primary ring-2 ring-primary/30',
                      i > 1 && 'bg-white/[0.04] text-slate-500',
                    )}
                  >
                    {i < 1 ? <CheckCircle2 size={10} /> : i + 1}
                  </div>
                  <span
                    className={cn('text-xs whitespace-nowrap', i === 1 ? 'text-primary font-medium' : 'text-slate-500')}
                  >
                    {step}
                  </span>
                </div>
                {i < 3 && <div className={cn('h-px w-8', i < 1 ? 'bg-emerald-500/40' : 'bg-white/[0.08]')} />}
              </div>
            ))}
          </div>

          {/* Empty state */}
          {proposals.length === 0 && (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-12 text-center">
              <Clock size={40} className="mx-auto text-slate-600 mb-4" />
              <p className="text-sm font-medium text-white">제안서를 기다리고 있습니다</p>
              <p className="text-xs text-slate-500 mt-2">
                컨설턴트가 견적을 검토 중입니다. 보통 1~3 영업일이 소요됩니다.
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => router.push('/consulting')}>
                컨설팅 홈으로
              </Button>
            </div>
          )}

          {/* Proposal cards */}
          {proposals.length > 0 && (
            <div className="space-y-4">
              {proposals.map((proposal) => {
                const isSelected = selectedId === proposal.id;
                const isAccepted = proposal.status === 'ACCEPTED';
                const isPending = proposal.status === 'PENDING';

                return (
                  <div
                    key={proposal.id}
                    onClick={() => isPending && setSelectedId(proposal.id)}
                    className={cn(
                      'rounded-xl ring-1 overflow-hidden transition-all',
                      isAccepted && 'ring-emerald-500/30 bg-emerald-500/5',
                      isSelected && !isAccepted && 'ring-primary/40 bg-primary/5',
                      !isSelected && !isAccepted && 'ring-white/[0.06] bg-[#0d1520] hover:ring-white/[0.12]',
                      isPending && 'cursor-pointer',
                    )}
                  >
                    {/* Proposal header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {proposal.initial}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{proposal.consultantName}</p>
                          {proposal.experience > 0 && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">경력 {proposal.experience}년</span>
                              {proposal.rating > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-slate-500">
                                  <Star size={10} className="text-amber-400 fill-amber-400" /> {proposal.rating}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant={isAccepted ? 'success' : isPending ? 'primary' : 'default'}>
                        {isAccepted ? '수락됨' : isPending ? '검토 가능' : proposal.status}
                      </Badge>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 divide-x divide-white/[0.06] px-6 py-4">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">예상 비용</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {proposal.estimatedCost > 0 ? formatCost(proposal.estimatedCost) : '협의'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">예상 기간</p>
                        <p className="text-xl font-bold text-white mt-1">{proposal.estimatedDuration || '협의'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">시작 가능일</p>
                        <p className="text-xl font-bold text-white mt-1">{proposal.availableFrom || '협의'}</p>
                      </div>
                    </div>

                    {/* Cover letter */}
                    {proposal.coverLetter && (
                      <div className="px-6 py-4 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare size={12} className="text-slate-500" />
                          <p className="text-[10px] text-slate-500 font-medium">컨설턴트 메시지</p>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{proposal.coverLetter}</p>
                      </div>
                    )}

                    {/* Scope */}
                    {proposal.scope.length > 0 && (
                      <div className="px-6 py-3 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                        {proposal.scope.map((s) => (
                          <Badge key={s} variant="default" className="text-[10px]">
                            {SCOPE_LABELS[s] ?? s}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {isPending && isSelected && (
                      <div className="px-6 py-4 border-t border-white/[0.06] bg-primary/[0.03] flex gap-3">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(proposal.id);
                          }}
                          disabled={acceptProposal.isPending}
                        >
                          {acceptProposal.isPending ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 size={12} className="mr-1" />
                          )}
                          제안 수락
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/consulting/pre-consultation/${consultationId}?proposalId=${proposal.id}`);
                          }}
                        >
                          <MessageSquare size={12} className="mr-1" /> 사전 상담 먼저
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Already accepted */}
          {hasAccepted && (
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-[#0d1520] ring-1 ring-emerald-500/20 p-5 text-center">
              <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">제안서가 수락되었습니다</p>
              <p className="text-xs text-slate-400 mt-1">사전 상담을 예약하고 계약을 진행하세요</p>
              <Button className="mt-4" onClick={() => router.push(`/consulting/pre-consultation/${consultationId}`)}>
                사전 상담 예약하기 <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
