'use client';

import { Network, Zap, Leaf, Factory, Sun, Flame } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVppDashboard, useVppMarketPrices, useVppReports, useVppRec } from '@/hooks/der/useVpp';

// VPP 대시보드 — 사업계획서 기반 재구축(doc 20_통합기획/04 §4).
// 설비 축 = 계획서 목표: 지표1 44.7MW(연료전지 39.6 + 태양광 5.1) + ORC 1.8MW(지표10 연계) — 캐논 단일성(doc 00).
// 수익원 3축 = REC / CHPS(수소입찰) / PPA (계획서 §SPC 정산 p.41 연동).
// 목표치는 계획서 상수(실값), 편입·정산은 백엔드 실데이터. iframe 폐기(doc 19 완전 통합).

const PLAN_TARGETS = [
  {
    key: 'FC',
    icon: <Flame size={15} />,
    label: '연료전지',
    targetMw: 39.6,
    indicator: '지표1',
    note: 'RPS 19.8 + CHPS 19.8',
  },
  {
    key: 'PVS',
    icon: <Sun size={15} />,
    label: '태양광',
    targetMw: 5.1,
    indicator: '지표1',
    note: '자가 0.9 + 거래 4.2 · SPC 80%',
  },
  { key: 'ORC', icon: <Factory size={15} />, label: 'ORC', targetMw: 1.8, indicator: '지표10', note: '배열 회수' },
] as const;

export default function VppDashboardPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const dashQ = useVppDashboard(companyId);
  const reportsQ = useVppReports(companyId);
  const pricesQ = useVppMarketPrices();
  const recQ = useVppRec(companyId);

  const d = dashQ.data;
  const r = reportsQ.data;
  const prices = pricesQ.data ?? [];
  const recs = recQ.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: 'VPP 대시보드' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">VPP 대시보드</h1>
        <span className="text-xs text-slate-400">분산에너지 효율화 — 자원 편입·발전량 예측·수요반응(DR) 효율 운영</span>
      </div>

      {/* 사업계획서 설비 목표 — 계획서 상수(실값). 지표1 합계 44.7MW(연료+태양광), ORC는 지표10 연계 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_TARGETS.map((t) => (
          <div key={t.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {t.icon} {t.label} <span className="text-slate-600">· {t.note}</span>
              </div>
              <span className="rounded px-1.5 py-0.5 text-[10px] bg-white/[0.05] text-slate-400">{t.indicator}</span>
            </div>
            <div className="mt-1 text-xl font-bold text-white">{t.targetMw} MW</div>
            <div className="text-[11px] text-slate-500">사업계획서 목표</div>
          </div>
        ))}
      </div>

      {/* 운영 실적 — 백엔드 실데이터 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            icon: <Network size={15} />,
            label: '편입 자원',
            v: d ? `${d.enrolledResources}/${d.totalResources}` : '—',
            tone: 'text-emerald-400',
          },
          {
            icon: <Zap size={15} />,
            label: '발전량(연)',
            v: r ? `${Number(r.totalGenerationKwh).toLocaleString()} kWh` : '—',
            tone: 'text-white',
          },
          {
            icon: <Leaf size={15} />,
            label: '온실가스 저감(추정)',
            v: r ? `${r.estimatedCo2ReductionTons} tCO₂` : '—',
            tone: 'text-sky-400',
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 자원 현황 */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">발전 자원 현황</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">자원</th>
                <th className="px-4 py-3 text-right">용량</th>
                <th className="px-4 py-3 text-right">VPP 편입</th>
              </tr>
            </thead>
            <tbody>
              {(d?.resources ?? []).map((res) => (
                <tr key={res.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{res.resource}</td>
                  <td className="px-4 py-3 text-right">{res.capacity}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${res.enrolled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-slate-400'}`}
                    >
                      {res.enrolled ? '편입됨' : '미편입'}
                    </span>
                  </td>
                </tr>
              ))}
              {!d?.resources?.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    {dashQ.isLoading ? '불러오는 중…' : '등록된 자원이 없습니다. 자원 관리에서 등록·편입하세요.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 수익원 — 시장가격·REC */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">시장가격 (SMP·REC)</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                  <th className="px-4 py-3">일자</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3 text-right">가격</th>
                </tr>
              </thead>
              <tbody>
                {prices.slice(0, 5).map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3 text-xs">{p.priceDate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${p.priceType === 'SMP' ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                      >
                        {p.priceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(p.price).toLocaleString()} {p.unit}
                    </td>
                  </tr>
                ))}
                {!prices.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-500">
                      {pricesQ.isLoading ? '불러오는 중…' : '시장가격 데이터가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-sm font-semibold text-white mb-2">발전 자원·효율 요약</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-400">
                  {d ? `${d.enrolledResources}/${d.totalResources}` : '—'}
                </div>
                <div className="text-[11px] text-slate-500">편입 자원</div>
              </div>
              <div>
                <div className="text-lg font-bold text-sky-400">{recs.length}</div>
                <div className="text-[11px] text-slate-500">REC 보유</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-400">{r ? r.estimatedCo2ReductionTons : '—'}</div>
                <div className="text-[11px] text-slate-500">tCO₂ 저감</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        설비 목표는 사업계획서 상수, 편입·발전량·감축량은 백엔드 실데이터. 감축량 = 발전량×배출계수(잠정, MRV 확정 전).
      </p>
    </div>
  );
}
