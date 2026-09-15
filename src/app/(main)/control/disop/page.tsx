'use client';

import { useState } from 'react';
import { useSopActions } from '@/hooks/control/useControl';
import { AlertTriangle, Activity, CheckCircle2, Radio, ArrowRight } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAdvanceSop, useCloseSop, useSopEvents, useSopScenarios } from '@/hooks/control/useControl';

// DiSOP — 설계 v2/docs/12 §2 + 백엔드 배선(17). 재난 시나리오·Workflow·라우팅.
// 프로덕션 mock 폴백 제거(캐논 useGhg 패턴): 실데이터/빈/오류 상태만 노출.
export default function DisopPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const eventsQ = useSopEvents(companyId);
  const scenQ = useSopScenarios(companyId);
  const advanceSop = useAdvanceSop();
  const closeSop = useCloseSop();
  const SOP_EVENTS = eventsQ.data;
  const SOP_SCENARIOS = scenQ.data;
  // 회사 미귀속 / 호출 실패를 정확히 구분(mock 폴백 없음).
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 관제 데이터를 불러올 수 없습니다'
      : eventsQ.isError || scenQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  // 선택은 id로 추적. 시나리오가 없으면 선택 대상도 없음.
  const [selId, setSelId] = useState<number | null>(null);
  // V105: 조치 이력 — 활성(또는 최신) 이벤트 기준. 이벤트가 없으면 조회 비활성(빈상태).
  const actionEvent = SOP_EVENTS.find((e) => e.status !== '종료') ?? SOP_EVENTS[0];
  const actionsQ = useSopActions(actionEvent?.id);
  const sel =
    SOP_SCENARIOS.find((s) => String(s.id) === String(selId)) ??
    SOP_SCENARIOS.find((s) => s.active) ??
    SOP_SCENARIOS[0];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '통합관제' }, { label: 'DiSOP' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">DiSOP · 표준운영절차 관제</h1>
        <span className="text-xs text-slate-400">Digital SOP · 시나리오 기반 재난 대응</span>
      </div>
      {guardReason && <p className="text-xs text-amber-400">{guardReason}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Radio size={15} />, label: '활성 상황', v: SOP_EVENTS.filter((e) => e.status !== '종료').length },
          { icon: <AlertTriangle size={15} />, label: '금일 이벤트', v: SOP_EVENTS.length },
          { icon: <Activity size={15} />, label: '처리중', v: SOP_EVENTS.filter((e) => e.status === '대응중').length },
          { icon: <CheckCircle2 size={15} />, label: '종료', v: SOP_EVENTS.filter((e) => e.status === '종료').length },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className="mt-1 text-xl font-bold text-white">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">표준운영절차(SOP) 시나리오</h3>
          {SOP_SCENARIOS.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
              등록된 SOP 시나리오가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {SOP_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelId(s.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${sel && String(sel.id) === String(s.id) ? 'bg-primary/15 text-primary' : 'bg-white/[0.03] text-slate-300'}`}
                >
                  <span className="flex items-center justify-between">
                    {s.type}
                    {s.active && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">활성</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            {sel ? `${sel.type} — 대응 Workflow` : '대응 Workflow'}
          </h3>
          {sel ? (
            <div className="flex flex-wrap items-center gap-2">
              {sel.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-slate-300">
                    {i + 1}. {step}
                  </span>
                  {i < sel.steps.length - 1 && <ArrowRight size={14} className="text-slate-600" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
              표시할 대응 절차가 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">
          이벤트 감지 → SOP 매칭 → 운영자 라우팅
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">감지 이벤트</th>
              <th className="px-4 py-3">매칭 SOP</th>
              <th className="px-4 py-3">담당 운영자</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">시각</th>
              <th className="px-4 py-3">워크플로</th>
            </tr>
          </thead>
          <tbody>
            {SOP_EVENTS.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                  {guardReason ? '이벤트를 불러올 수 없습니다.' : '감지된 이벤트가 없습니다.'}
                </td>
              </tr>
            ) : (
              SOP_EVENTS.map((e) => {
                // 실 이벤트(number id) 활성 상황만 전이/종료 액션 노출.
                const live = e.status !== '종료';
                return (
                  <tr key={e.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{e.event}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">{e.matchedSop}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{e.operator}</td>
                    <td className="px-4 py-3">
                      {e.status}
                      {e.currentStep != null && e.status !== '종료' && (
                        <span className="ml-1 text-xs text-slate-500">(단계 {e.currentStep})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{e.at}</td>
                    <td className="px-4 py-3">
                      {live ? (
                        <span className="flex gap-1.5">
                          <button
                            onClick={() => advanceSop.mutate(e.id)}
                            disabled={advanceSop.isPending}
                            className="rounded bg-primary/15 px-2 py-1 text-xs text-primary hover:bg-primary/25 disabled:opacity-50"
                          >
                            다음 단계
                          </button>
                          <button
                            onClick={() => closeSop.mutate(e.id)}
                            disabled={closeSop.isPending}
                            className="rounded bg-white/[0.05] px-2 py-1 text-xs text-slate-400 hover:bg-white/[0.1] disabled:opacity-50"
                          >
                            종료
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">
          설비관제 · 조치 이력{actionEvent ? ` — ${actionEvent.event}` : ''}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">조치</th>
              <th className="px-4 py-3">이전 상태</th>
              <th className="px-4 py-3">이후 상태</th>
              <th className="px-4 py-3">메모</th>
              <th className="px-4 py-3">시각</th>
            </tr>
          </thead>
          <tbody>
            {!actionEvent || actionsQ.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  {actionsQ.isError ? '조치 이력을 불러올 수 없습니다.' : '기록된 조치 이력이 없습니다.'}
                </td>
              </tr>
            ) : (
              actionsQ.data.map((a) => (
                <tr key={a.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{a.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{a.fromStatus ?? '-'}</td>
                  <td className="px-4 py-3">{a.toStatus}</td>
                  <td className="px-4 py-3 text-slate-400">{a.note ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{a.at ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
