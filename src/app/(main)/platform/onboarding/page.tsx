'use client';

import { CheckCircle2, XCircle, Clock, FileCheck2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  useOnboardingReviewQueue,
  useApproveStep,
  useRejectStep,
  useCompleteOnboarding,
} from '@/hooks/common/useOnboarding';
import type { Onboarding, OnboardingStep } from '@/types/onboarding';

// 온보딩 관리(심사 큐) — 운영자가 전체 업체 온보딩의 제출 단계를 승인/반려하고 완료 처리. 설계 doc 10 P1-3.
const ONB_STATUS: Record<string, { label: string; cls: string }> = {
  IN_PROGRESS: { label: '진행중', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
  COMPLETED: { label: '완료', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  REJECTED: { label: '반려', cls: 'bg-rose-500/10 text-rose-400 ring-rose-500/20' },
};

const STEP_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '대기', cls: 'text-slate-400' },
  SUBMITTED: { label: '제출됨', cls: 'text-sky-400' },
  APPROVED: { label: '승인', cls: 'text-emerald-400' },
  REJECTED: { label: '반려', cls: 'text-rose-400' },
};

export default function OnboardingReviewQueuePage() {
  const userId = useAuthStore((s) => (s.user?.id != null ? Number(s.user.id) : 0));
  const toast = useToastStore((s) => s.add);
  const q = useOnboardingReviewQueue();
  const rows = (q.data ?? []) as Onboarding[];

  const approveM = useApproveStep();
  const rejectM = useRejectStep();
  const completeM = useCompleteOnboarding();

  const onApprove = (stepId: number) =>
    approveM.mutate({ stepId, reviewedBy: userId }, { onSuccess: () => toast('success', '단계를 승인했습니다.') });

  const onReject = (stepId: number) => {
    const reason = window.prompt('반려 사유를 입력하세요');
    if (!reason) return;
    rejectM.mutate(
      { stepId, reviewedBy: userId, reason },
      { onSuccess: () => toast('success', '단계를 반려했습니다.') },
    );
  };

  const onComplete = (id: number) =>
    completeM.mutate(id, {
      onSuccess: () => toast('success', '온보딩을 완료 처리했습니다.'),
    });

  const allApproved = (o: Onboarding) => o.steps.length > 0 && o.steps.every((s) => s.status === 'APPROVED');
  const pendingCount = rows.filter((o) => o.status === 'IN_PROGRESS').length;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '온보딩 관리' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">온보딩 관리 · 심사 큐</h1>
        <span className="text-xs text-slate-400">
          진행중 {pendingCount}건 · 전체 {rows.length}건
        </span>
      </div>

      {q.isLoading ? (
        <p className="py-10 text-center text-xs text-slate-500">심사 큐를 불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-500">심사 대상 온보딩이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((o) => {
            const st = ONB_STATUS[o.status] ?? { label: o.status, cls: 'bg-white/[0.05] text-slate-300 ring-white/10' };
            return (
              <div key={o.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <FileCheck2 className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">업체 #{o.companyId}</span>
                    <span className="text-xs text-slate-400">· {o.businessType}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] ring-1 ${st.cls}`}>{st.label}</span>
                  </div>
                  {o.status === 'IN_PROGRESS' && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!allApproved(o) || completeM.isPending}
                      onClick={() => onComplete(o.id)}
                    >
                      온보딩 완료
                    </Button>
                  )}
                </div>

                <div className="mt-3 divide-y divide-white/[0.04] rounded-lg border border-white/[0.05]">
                  {o.steps.map((s: OnboardingStep) => {
                    const ss = STEP_STATUS[s.status] ?? { label: s.status, cls: 'text-slate-400' };
                    return (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          {s.status === 'APPROVED' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : s.status === 'REJECTED' ? (
                            <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                          )}
                          <span className="text-slate-200">{s.stepName}</span>
                          {s.required && <span className="text-[10px] text-slate-500">(필수)</span>}
                          <span className={`ml-1 ${ss.cls}`}>{ss.label}</span>
                          {s.status === 'REJECTED' && s.rejectionReason && (
                            <span className="text-rose-400/70">— {s.rejectionReason}</span>
                          )}
                        </div>
                        {s.status === 'SUBMITTED' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onApprove(s.id)}
                              disabled={approveM.isPending}
                              className="rounded-md border border-emerald-500/20 px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/[0.08]"
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(s.id)}
                              disabled={rejectM.isPending}
                              className="rounded-md border border-rose-500/20 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-500/[0.08]"
                            >
                              반려
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {o.steps.length === 0 && (
                    <div className="px-3 py-2.5 text-xs text-slate-500">등록된 단계가 없습니다.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        제출된(SUBMITTED) 단계만 승인·반려할 수 있습니다. 모든 단계가 승인되면 온보딩을 완료 처리할 수 있습니다.
      </p>
    </div>
  );
}
