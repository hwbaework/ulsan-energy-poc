'use client';

import { useState } from 'react';
import { Leaf, Zap, Info } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useGhgFactors } from '@/hooks/edm/useGhgExt';
import { useGenerationAggregate } from '@/hooks/edm/useGenerationAggregate';

// 감축량·자립률 산정 — doc 04 §3 `/reduction`(감축량 대사 ▸ 자립률 기여). 지표3·8.
// 발전량 × 배출계수(0.4781 기본) → 감축량 대사, 자립률 = 자체 발전량 ÷ 산단 총소비 × 100.
// 계수는 useGhgFactors의 GHG_ELEC(실값) 소비. 미조회 시 국가 기본계수 0.4781(참조상수).
// 발전량은 monitoring/plants/compare(발전 실적 집계) 실데이터 소비 — 하드코딩·"예시" 제거.
// ghg 테이블 직접 조인 금지(ghg 도메인 API).

const DENOMINATOR_MWH = 19_120_725; // 산단 총소비(계획서 상수, 자립률 분모)
const SELF_SUFFICIENCY_PCT = 1.82; // 자립률 기여 목표(계획서 상수)

const TABS = [
  { key: 'recon', label: '감축량 대사', icon: <Leaf size={14} /> },
  { key: 'self', label: '자립률 기여', icon: <Zap size={14} /> },
] as const;

export default function ReductionPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('recon');
  const { data: factors, isLive, isError } = useGhgFactors();
  const generation = useGenerationAggregate();

  // 배출계수 — useGhgFactors의 GHG_ELEC(실값) 소비. 미조회 시 국가 기본계수 0.4781(참조상수) 적용.
  const elecFactor = factors.find((f) => f.code === 'GHG_ELEC')?.factor ?? 0.4781;

  // 발전 실적(실데이터) × 계수 = 감축량(tCO₂eq)
  const rows = generation.data.rows.map((g) => ({
    ...g,
    reductionTon: g.generationMwh * elecFactor,
  }));
  const totalGenerationMwh = generation.data.totalGenerationMwh;
  const totalReduction = totalGenerationMwh * elecFactor;

  // 자립률 기여 = 자체 발전량 ÷ 산단 총소비 × 100
  const selfPct = (totalGenerationMwh / DENOMINATOR_MWH) * 100;

  const genLive = generation.isLive;
  const genBadge = genLive
    ? { text: '실시간', cls: 'bg-emerald-500/10 text-emerald-400' }
    : generation.isError
      ? { text: '불러오기 실패', cls: 'bg-red-500/10 text-red-400' }
      : { text: '발전 실적 없음', cls: 'bg-slate-500/10 text-slate-400' };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'E-데이터' }, { label: '감축량·자립률' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">감축량·자립률 산정</h1>
        <span className="text-xs text-slate-400">사업계획서 지표3·8 — 발전량×배출계수 감축 대사·자립률 기여</span>
      </div>

      {/* 계수·목표 요약(실값) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: '전력 배출계수',
            v: `${elecFactor} tCO₂eq/MWh`,
            tone: 'text-sky-400',
            note: isLive ? 'ghg 도메인(실시간)' : isError ? '불러오기 실패 — 국가 기본계수' : '국가 기본계수',
          },
          { label: '자립률 기여 목표', v: `${SELF_SUFFICIENCY_PCT} %`, tone: 'text-emerald-400', note: '계획서 상수' },
          {
            label: '자립률 분모(총소비)',
            v: `${DENOMINATOR_MWH.toLocaleString()} MWh`,
            tone: 'text-white',
            note: '계획서 상수',
          },
          {
            label: '실적 발전량(합계)',
            v: genLive ? `${Math.round(totalGenerationMwh).toLocaleString()} MWh` : '-',
            tone: 'text-amber-400',
            note: genLive ? '발전 실적(실시간)' : genBadge.text,
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs text-slate-400">{s.label}</div>
            <div className={`mt-1 text-lg font-bold ${s.tone}`}>{s.v}</div>
            <div className="text-[11px] text-slate-500">{s.note}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 감축량 대사 — 실적 발전량 × 계수 */}
      {tab === 'recon' && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center justify-between">
            <span>감축량 대사 (발전 실적 × 배출계수 {elecFactor})</span>
            <span className={`rounded px-2 py-0.5 text-[10px] ${genBadge.cls}`}>{genBadge.text}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">발전자원</th>
                <th className="px-4 py-3 text-right">설비용량(kW)</th>
                <th className="px-4 py-3 text-right">실적 발전량(MWh)</th>
                <th className="px-4 py-3 text-right">실적 감축(tCO₂eq)</th>
              </tr>
            </thead>
            <tbody>
              {generation.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : generation.isError ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">
                    발전 실적을 불러오지 못했습니다 — 다시 로그인하세요
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">
                    집계된 발전 실적이 없습니다.
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((r) => (
                    <tr key={r.plantId} className="border-b border-white/[0.04] text-slate-300">
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-right">{Math.round(r.capacityKw).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{Math.round(r.generationMwh).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sky-400">
                        {Math.round(r.reductionTon).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="text-slate-100 font-semibold bg-white/[0.02]">
                    <td className="px-4 py-3">합계</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">{Math.round(totalGenerationMwh).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sky-400">{Math.round(totalReduction).toLocaleString()}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <div className="px-4 py-3 text-[11px] text-slate-500">
            감축량 = 실적 발전량 × 배출계수 {elecFactor} tCO₂eq/MWh (계수 실값). 발전량은 monitoring 발전 실적 집계
            실데이터.
          </div>
        </div>
      )}

      {/* 자립률 기여 */}
      {tab === 'self' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">에너지 자립률 기여</div>
              <span className={`rounded px-2 py-0.5 text-[10px] ${genBadge.cls}`}>{genBadge.text}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{SELF_SUFFICIENCY_PCT}%</div>
                <div className="text-[11px] text-slate-500">계획 목표 기여(실값)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-sky-400">{genLive ? `${selfPct.toFixed(2)}%` : '-'}</div>
                <div className="text-[11px] text-slate-500">{genLive ? '실적 발전 기준' : genBadge.text}</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs text-slate-300">
              <span className="text-slate-500">산식 </span>
              자립률 기여 = 자체 발전량{' '}
              {genLive ? `${Math.round(totalGenerationMwh).toLocaleString()} MWh` : '(발전 실적)'} ÷ 산단 총소비{' '}
              {DENOMINATOR_MWH.toLocaleString()} MWh × 100
              <span className="text-slate-500"> → 실적 </span>
              <b className="text-sky-400">{genLive ? `${selfPct.toFixed(2)}%` : '-'}</b>
              <span className="text-slate-500"> (목표 {SELF_SUFFICIENCY_PCT}%)</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-amber-400">산정 안내</b> — 배출계수 <b>{elecFactor}</b> tCO₂eq/MWh(ghg 도메인 계수), 자립률
          기여 목표 <b>{SELF_SUFFICIENCY_PCT}%</b>, 분모 <b>{DENOMINATOR_MWH.toLocaleString()} MWh</b>는 계획서
          상수(실값). 발전량 대사·자립률은 monitoring 발전 실적 집계 실데이터를 소비하며, ghg 테이블 직접 조인 없이 ghg
          도메인 API 계수를 사용합니다.
        </div>
      </div>
    </div>
  );
}
