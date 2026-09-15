'use client';

// 자가발전·PPA 실적 `/re100/generation` — doc04 §2-1 「전체 ▸ 전력거래형 ▸ 자가소비형」.
// 06 §13.3 확정 스펙: 실적 StatCard×3·설비 테이블·정산 딥링크 실훅화(source=SETTLEMENT).
// 실적 = 정산데이터(재입력 금지, D3). achievements 파생값 소비 — 직접 조인 금지(06 §13.3.2).
// 되먹임(06 §13.3.4): 진입 시 achievements staleTime=0 재조회. refSettlementId 진입 시 설비 행 강조.

import { useState } from 'react';
import { Zap, Coins, Leaf, Factory, Sun, ArrowRight, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAchievements, type Measure } from '@/hooks/re100/useAchievements';

type Kind = 'ALL' | 'TRADE' | 'SELF';

// SPC 설비 2종 ↔ 이행수단 매핑(19-03 §3, 계획서 용량 상수). 실적 mwh는 achievements measure별 합산.
const FACILITIES: {
  id: string;
  kind: Exclude<Kind, 'ALL'>;
  facility: string;
  measures: Measure[];
  settlementHref: string;
}[] = [
  {
    id: 'S1',
    kind: 'TRADE',
    facility: '전력거래형 (4.2MW)',
    measures: ['PPA_DIRECT', 'PPA_THIRD'],
    settlementHref: '/ppa/billing/settlement',
  },
  {
    id: 'S2',
    kind: 'SELF',
    facility: '자가소비형 (0.9MW)',
    measures: ['SELF_CONSUME'],
    settlementHref: '/lease/billing/settlement',
  },
];

const TABS: { key: Kind; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'TRADE', label: '전력거래형' },
  { key: 'SELF', label: '자가소비형' },
];

// tCO₂ 산정 계수(edata inventory 계수 정합 — 06 §13.3.1-5·§15-4). 표시 툴팁용.
const CO2_FACTOR_TON_PER_MWH = 0.4594;

export default function Re100GenerationPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const currentYear = new Date().getFullYear();
  const searchParams = useSearchParams();
  const refSettlementId = searchParams.get('refSettlementId');

  const [tab, setTab] = useState<Kind>('ALL');
  // source=SETTLEMENT 파생값(06 §13.3.2). achievements는 measure×quarter×mwh — 여기선 정산형 measure만 사용.
  const achQ = useAchievements(companyId, currentYear);
  const items = (achQ.data ?? []).filter((a) => a.source === 'SETTLEMENT');

  const mwhOf = (measures: Measure[]) =>
    items.filter((a) => measures.includes(a.measure)).reduce((s, a) => s + (a.mwh ?? 0), 0);

  const rows = FACILITIES.filter((f) => tab === 'ALL' || f.kind === tab).map((f) => {
    const genMwh = mwhOf(f.measures);
    return { ...f, genMwh, co2: Math.round(genMwh * CO2_FACTOR_TON_PER_MWH) };
  });

  const totalGen = rows.reduce((s, r) => s + r.genMwh, 0);
  const totalCo2 = rows.reduce((s, r) => s + r.co2, 0);

  const achLoading = achQ.isLoading;
  const achError = achQ.isError;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: '자가발전·PPA 실적' }]} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">자가발전·PPA 실적</h1>
          <p className="mt-1 text-sm text-slate-400">RE100 실적 = SPC·VPP 정산데이터 (계획서 p.42 · 19-03)</p>
        </div>
        {/* RE100↔전력거래 양방향 seam 헤더 링크 */}
        <Link
          href="/ppa/billing/settlement?from=generation"
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:text-white"
        >
          정산 원장 보기 <ArrowRight size={13} />
        </Link>
      </div>

      {/* 탭: 전체 ▸ 전력거래형 ▸ 자가소비형 */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-xs ${tab === t.key ? 'bg-primary/20 text-primary' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {achError && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <span className="text-sm text-red-300">정산 실적을 불러오지 못했습니다.</span>
          <button
            onClick={() => achQ.refetch()}
            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"
          >
            재시도
          </button>
        </div>
      )}

      {/* 실적 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <Zap size={15} />, label: '정산 발전량', v: `${totalGen.toLocaleString()} MWh`, tone: 'text-white' },
          { icon: <Coins size={15} />, label: '정산 이행 실적', v: `${rows.length} 설비`, tone: 'text-white' },
          {
            icon: <Leaf size={15} />,
            label: '온실가스 저감(추정)',
            v: `${totalCo2.toLocaleString()} tCO₂`,
            tone: 'text-sky-400',
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{achLoading ? '···' : s.v}</div>
          </div>
        ))}
      </div>

      {/* 정산 흐름 안내 (19-03 §2) */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[11px] text-slate-400">
        발전설비 ─① 계측─▶ VPP ─② 정산─▶ SPC ─③ 공급─▶ 수용가(PPA/자가소비) · ④ 정산 확정 = RE100 이행실적 확정
      </div>

      {/* 정산 실적 테이블 */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">정산 실적 (설비별)</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">설비</th>
              <th className="px-4 py-3">이행수단</th>
              <th className="px-4 py-3 text-right">발전량</th>
              <th
                className="px-4 py-3 text-right"
                title={`tCO₂ = 발전량(MWh) × ${CO2_FACTOR_TON_PER_MWH} (edata inventory 배출계수 정합)`}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  저감(추정) <HelpCircle size={11} />
                </span>
              </th>
              <th className="px-4 py-3">정산</th>
            </tr>
          </thead>
          <tbody>
            {achLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-white/[0.04] text-slate-300 ${refSettlementId === r.id ? 'ring-1 ring-emerald-400/50 bg-emerald-500/[0.04]' : ''}`}
                >
                  <td className="px-4 py-3 flex items-center gap-2">
                    {r.kind === 'TRADE' ? (
                      <Factory size={14} className="text-emerald-400" />
                    ) : (
                      <Sun size={14} className="text-amber-400" />
                    )}
                    {r.facility}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.measures.join(' · ')}</td>
                  <td className="px-4 py-3 text-right">{r.genMwh.toLocaleString()} MWh</td>
                  <td className="px-4 py-3 text-right">{r.co2.toLocaleString()} tCO₂</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`${r.settlementHref}?from=generation`}
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
                    >
                      정산 상세 <ArrowRight size={11} />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  해당 유형의 정산 실적이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        전력거래형(4.2MW)=PPA(SMP+REC 수익), 자가소비형(0.9MW)=SELF_CONSUME(전력비 절감액 내부정산). 실적은 정산 확정
        파생 — RE100 화면에서 재입력하지 않음(19-03 D3). 저감 계수 {CO2_FACTOR_TON_PER_MWH} tCO₂/MWh(edata inventory
        정합).
      </p>
    </div>
  );
}
