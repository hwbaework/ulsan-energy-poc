'use client';

import { useState } from 'react';
import { Zap, Leaf, BadgeCheck } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVppReports } from '@/hooks/der/useVpp';

// 보고서 — VPP 효율 운영 보고(doc 04 §4). 연간 발전량·REC·감축량 요약. 성과지표 연계(발전량=지표1, 감축량=지표3).
export default function VppReportsPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const [year, setYear] = useState(2026);
  const q = useVppReports(companyId, year);
  const r = q.data;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '보고서' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">운영 보고서</h1>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white"
        >
          {[2026, 2025, 2024].map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          {
            icon: <Zap size={15} />,
            label: '발전량 · 지표1',
            v: r ? `${Number(r.totalGenerationKwh).toLocaleString()} kWh` : '—',
          },
          { icon: <BadgeCheck size={15} />, label: 'REC 보유', v: r ? `${r.recHoldingCount}건` : '—' },
          {
            icon: <Leaf size={15} />,
            label: 'CO₂ 저감(추정) · 지표3',
            v: r ? `${r.estimatedCo2ReductionTons} t` : '—',
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className="mt-1 text-lg font-bold text-white">{s.v}</div>
          </div>
        ))}
      </div>

      {r ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-semibold text-white">
            보고서 요약 · 성과지표 귀속
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">항목</th>
                <th className="px-4 py-2.5 text-right">값</th>
                <th className="px-4 py-2.5 text-right">성과지표</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-white/[0.04]">
                <td className="px-4 py-2.5">총 발전량</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {Number(r.totalGenerationKwh).toLocaleString()} kWh
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-slate-500">지표1 (신재생 융복합)</td>
              </tr>
              <tr className="border-b border-white/[0.04]">
                <td className="px-4 py-2.5">REC 보유</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.recHoldingCount}건</td>
                <td className="px-4 py-2.5 text-right text-xs text-slate-500">RE100 이행수단</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5">CO₂ 저감(추정)</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.estimatedCo2ReductionTons} t</td>
                <td className="px-4 py-2.5 text-right text-xs text-slate-500">지표3 (온실가스 감축)</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] px-4 py-10 text-center text-xs text-slate-500">
          {q.isLoading ? '불러오는 중…' : '해당 연도의 운영 데이터가 없습니다.'}
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        성과지표 귀속: 발전량→지표1(신재생 융복합 발전 시스템), 감축량→지표3(온실가스 감축). 감축량 =
        발전량×배출계수(잠정, MRV 확정 전).
      </p>
    </div>
  );
}
