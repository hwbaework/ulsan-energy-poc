'use client';

// 이행 포트폴리오 `/re100/portfolio` — doc04 §2-6 「이행 포트폴리오 | ct·a | 전략(measureMix) ▸ 보고서 연계(Report)」.
// 06 §13.12 확정 스펙(P4): measureMix 편집·저장·프리필·Report 딥링크. BE portfolio는 후속(P4) — 프레임 유지·미구축 명시.
// 진입 시 usePortfolio 소비(있으면 실데이터, 없으면 empty 정직). 대시보드 갭 처방 소스(19-01 §3).

import { useState } from 'react';
import { Layers, FileText, TrendingUp, ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePortfolio, type Measure } from '@/hooks/re100/useAchievements';

const MEASURE_LABEL: Record<Measure, string> = {
  PPA_DIRECT: '직접 PPA (온사이트)',
  PPA_THIRD: '제3자 PPA',
  SELF_CONSUME: '자가발전(자가소비)',
  REC: '인증서(REC)',
  GREEN_PREMIUM: '녹색프리미엄',
  EQUITY: '지분투자·자가건설',
};

export default function Re100PortfolioPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const [tab, setTab] = useState<'STRATEGY' | 'REPORT'>('STRATEGY');

  const portfolioQ = usePortfolio(companyId);
  const lines = portfolioQ.data?.measureMix ?? [];
  const totalReduction = lines.reduce((s, l) => s + (l.ghgReduction ?? 0), 0);
  const totalPlanned = lines.reduce((s, l) => s + (l.plannedMWh ?? 0), 0);
  const share = (mwh: number) => (totalPlanned > 0 ? Math.round((mwh / totalPlanned) * 100) : 0);

  const loading = portfolioQ.isLoading;
  const empty = !loading && lines.length === 0; // BE 미구축 시 empty(정직)

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: '이행 포트폴리오' }]} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">이행 포트폴리오</h1>
          <p className="mt-1 text-sm text-slate-400">전략(measureMix) · 보고서 연계 (계획서 p.166 · 19-09)</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['STRATEGY', '전략 (measureMix)'],
            ['REPORT', '보고서 연계'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k as 'STRATEGY' | 'REPORT')}
            className={`rounded-lg px-3 py-1.5 text-xs ${tab === k ? 'bg-primary/20 text-primary' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'STRATEGY' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Layers size={15} /> 이행수단 수
              </div>
              <div className="mt-1 text-xl font-bold text-white">
                {lines.length}
                <span className="text-sm text-slate-400"> 종</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp size={15} /> 계획 발전량 합계
              </div>
              <div className="mt-1 text-xl font-bold text-white">
                {totalPlanned.toLocaleString()}
                <span className="text-sm text-slate-400"> MWh</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">예상 감축량</div>
              <div className="mt-1 text-xl font-bold text-sky-400">
                {totalReduction.toLocaleString()} <span className="text-sm text-slate-400">tCO₂</span>
              </div>
            </div>
          </div>

          {empty ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
                <Info size={15} /> 이행 포트폴리오 전략(measureMix) 데이터가 아직 없습니다.
              </div>
              <div className="text-[11px] text-slate-500">
                measureMix 편집·저장 기능은 후속(P4)으로 구축 예정입니다. 확정된 목표값은 대시보드 이행률 소스가
                됩니다(19-01 §3).
              </div>
              <Link
                href="/re100?from=portfolio"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-4 py-2 text-xs text-primary"
              >
                대시보드로 이동 <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">
                measureMix 전략 (단가·비용·감축)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                    <th className="px-4 py-3">이행수단</th>
                    <th className="px-4 py-3 text-right">목표 배분</th>
                    <th className="px-4 py-3 text-right">단가(₩/kWh)</th>
                    <th className="px-4 py-3 text-right">비용</th>
                    <th className="px-4 py-3 text-right">감축(추정)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.measure} className="border-b border-white/[0.04] text-slate-300">
                      <td className="px-4 py-3">{MEASURE_LABEL[l.measure] ?? l.measure}</td>
                      <td className="px-4 py-3 text-right">
                        {share(l.plannedMWh)}% ({l.plannedMWh.toLocaleString()} MWh)
                      </td>
                      <td className="px-4 py-3 text-right">{l.unitCost > 0 ? l.unitCost : '—'}</td>
                      <td className="px-4 py-3 text-right">₩{(l.cost ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{(l.ghgReduction ?? 0).toLocaleString()} tCO₂</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            measureMix = 수단선호도(현장조사) 반영 PortfolioLine. 이 화면의 목표값이 대시보드·이행수단의 목표 이행률
            소스(19-01 §3). 편집·저장 UI는 후속(P4).
          </p>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[11px] text-slate-400">
            전략보고서(ConsultationReport 승인) → REPORT_APPROVED 이벤트 → Re100Roadmap 반영(19-09 §계약
            Report→Roadmap).
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
              <FileText size={15} /> 보고서 연계는 후속(P4)으로 구축 예정입니다.
            </div>
            <div className="text-[11px] text-slate-500">
              승인된 ConsultationReport → Roadmap upsert 상태를 이 탭에서 딥링크로 연결합니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
