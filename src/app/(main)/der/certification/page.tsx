'use client';

import Link from 'next/link';
import { BadgeCheck, FileClock, Server, Network, ExternalLink, Check, Minus } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVppResources, useEnrollVpp } from '@/hooks/der/useVpp';
import { useDerOnboarding } from '@/hooks/der/useDerCertification';

// 분산에너지 사업자인증 — 설계문서 21 §3.3·§5.
// D1 자격상태·D2 요건체크리스트 = onboarding(DER_OPERATOR), D3 = vpp_resource. 등록심사·승인은 /platform/approvals 재사용.
const STEP_DONE = ['APPROVED', 'SUBMITTED'];

export default function DerCertificationPage() {
  const addToast = useToastStore((s) => s.add);
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);

  // D1·D2 — DER_OPERATOR 온보딩(요건 스텝)
  const onboardingQ = useDerOnboarding(companyId);
  const onboarding = onboardingQ.data?.[0];
  const steps = onboarding?.steps ?? [];
  // 심사 진행 단계 = 완료(승인/제출)된 스텝 수
  const currentStepIdx = steps.filter((s) => STEP_DONE.includes(s.status)).length;
  const registered = onboarding?.status === 'COMPLETED';

  // D3 — VPP 편입(vpp_resource 실 API)
  const vppQ = useVppResources(companyId);
  const enrollMut = useEnrollVpp();
  const vppResources = (vppQ.data ?? []).map((v) => ({
    id: String(v.id),
    resource: v.resource,
    capacity: v.capacity,
    linked: v.linked,
  }));
  const enrolledCount = vppResources.filter((v) => v.linked).length;
  const enroll = (id: string, resource: string) => {
    if (companyId && /^\d+$/.test(id)) enrollMut.mutate(Number(id));
    addToast('success', `${resource}을(를) VPP에 편입 신청했습니다`);
  };

  const CERT_PROCESS = ['자격 확인', '서류 제출', '심사', '등록 완료'];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '분산에너지 사업자인증' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">분산에너지 사업자인증</h1>
        <span className="text-xs text-slate-400">분산에너지 활성화 특별법 · 발전전력 관리·VPP 편입</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            icon: <BadgeCheck size={15} />,
            label: '등록 상태',
            v: registered ? '등록완료' : onboarding ? '진행중' : '미신청',
            tone: registered ? 'text-emerald-400' : 'text-amber-400',
          },
          {
            icon: <FileClock size={15} />,
            label: '요건 완료',
            v: `${currentStepIdx}/${steps.length}`,
            tone: 'text-white',
          },
          { icon: <Server size={15} />, label: '관리 발전설비', v: vppResources.length, tone: 'text-white' },
          { icon: <Network size={15} />, label: 'VPP 편입 자원', v: enrolledCount, tone: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 분산법 등록 심사 — 기존 온보딩/승인 파이프라인 재사용 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">분산법 등록 심사</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              심사·승인은 기업/발전사업자 승인 파이프라인을 재사용합니다. 승인 처리는 승인 관리에서 수행하세요.
            </p>
          </div>
          <Link
            href="/platform/approvals"
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
          >
            승인 관리로 이동 <ExternalLink size={12} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {CERT_PROCESS.map((step, i) => {
            const activeIdx = registered ? CERT_PROCESS.length : Math.min(currentStepIdx, CERT_PROCESS.length - 1);
            const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo';
            return (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    state === 'done'
                      ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                      : state === 'active'
                        ? 'border-primary/40 bg-primary/[0.10]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      state === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : state === 'active'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-white/[0.05] text-slate-400'
                    }`}
                  >
                    {state === 'done' ? <Check size={11} /> : i + 1}
                  </span>
                  <span className={`text-xs ${state === 'todo' ? 'text-slate-400' : 'text-slate-200'}`}>{step}</span>
                </div>
                {i < CERT_PROCESS.length - 1 && <span className="text-slate-600">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 분산법 요건 체크리스트 (D2) — onboarding DER_OPERATOR steps */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">분산법 요건 체크리스트</h3>
          {onboardingQ.isLoading ? (
            <p className="text-xs text-slate-500">불러오는 중…</p>
          ) : steps.length ? (
            <div className="space-y-2.5">
              {steps.map((s) => {
                const done = STEP_DONE.includes(s.status);
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.05] text-slate-500'
                      }`}
                    >
                      {done ? <Check size={12} /> : <Minus size={12} />}
                    </span>
                    <span className={done ? 'text-slate-300' : 'text-slate-500'}>{s.stepName}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              DER_OPERATOR 온보딩이 시작되지 않았습니다. 사업자 등록을 시작하세요.
            </p>
          )}
        </div>

        {/* 자격 상태 현황 (D1) */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">사업자 자격 현황</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">요건 단계</th>
                <th className="px-4 py-3">코드</th>
                <th className="px-4 py-3 text-right">상태</th>
              </tr>
            </thead>
            <tbody>
              {steps.length ? (
                steps.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{s.stepName}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.stepCode}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STEP_DONE.includes(s.status) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-xs text-slate-500">
                    등록된 자격 요건이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 발전전력 관리·VPP 편입 (D3) */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02]">
          <span className="text-sm font-semibold text-white">발전전력 관리 · VPP 편입</span>
          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-400">신규</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">자원</th>
              <th className="px-4 py-3 text-right">용량</th>
              <th className="px-4 py-3 text-right">VPP 편입</th>
            </tr>
          </thead>
          <tbody>
            {vppQ.isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-xs text-slate-500">
                  불러오는 중…
                </td>
              </tr>
            ) : vppResources.length ? (
              vppResources.map((v) => (
                <tr key={v.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{v.resource}</td>
                  <td className="px-4 py-3 text-right">{v.capacity}</td>
                  <td className="px-4 py-3 text-right">
                    {v.linked ? (
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">편입</span>
                    ) : (
                      <button
                        onClick={() => enroll(v.id, v.resource)}
                        className="rounded border border-white/[0.1] px-2 py-0.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                      >
                        편입 신청
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-xs text-slate-500">
                  등록된 발전전력 자원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
