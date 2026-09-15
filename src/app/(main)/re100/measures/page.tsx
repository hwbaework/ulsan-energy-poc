'use client';

// RE100 이행수단 `/re100/measures` — doc04 §2-1 「이행수단 | 재생E ▸ 무탄소E(CFE) (집계 토글)」.
// 06 §13.2 확정 스펙: StatCard×4·이행수단 6행·실행 CTA 실훅화(예시 상수 제거).
// 산식 재계산 금지(06 §13.2.2) — achievements mwh·roadmap actualPct/targetPct 표시만.
// 폐곡선 처방→실행 seam(06 §13.0.3·13.0.2 taxonomy 딥링크).

import { useEffect, useState } from 'react';
import { Target, Gauge, Zap, PieChart, ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRoadmap } from '@/hooks/trading/useRe100';
import {
  useAchievements,
  usePortfolio,
  sumMwhByMeasure,
  type Measure,
  type EnergyType,
} from '@/hooks/re100/useAchievements';

// 운용 5종 + 지분투자 보류 (06 §13.0.2 taxonomy 정본 — 변경 금지). CTA 딥링크 포함.
const MEASURES: {
  code: Measure;
  label: string;
  track: string;
  badge: string;
  cta?: { href: string; label: string };
}[] = [
  {
    code: 'PPA_DIRECT',
    label: '직접 PPA (온사이트)',
    track: 'A',
    badge: '실측',
    cta: { href: '/lease/dashboard', label: '온사이트 현황 보기' },
  },
  {
    code: 'PPA_THIRD',
    label: '제3자 PPA',
    track: 'A',
    badge: '실측',
    cta: { href: '/ppa/trading', label: '이 수단으로 계약 신청' },
  },
  {
    code: 'SELF_CONSUME',
    label: '자가발전(자가소비)',
    track: 'A',
    badge: '실측',
    cta: { href: '/lease/dashboard', label: '자가소비 현황 보기' },
  },
  {
    code: 'REC',
    label: '인증서(REC) 구매',
    track: 'B',
    badge: '등록',
    cta: { href: '/re100/rec?tab=rec&action=register', label: 'REC 등록하기' },
  },
  {
    code: 'GREEN_PREMIUM',
    label: '녹색프리미엄',
    track: 'B',
    badge: '등록',
    cta: { href: '/re100/rec?tab=green&action=register', label: '녹색프리미엄 등록' },
  },
  { code: 'EQUITY', label: '지분투자·자가건설', track: '—', badge: '보류·수기등록' }, // CTA 비노출(06 §13.0.2 보류)
];

const BADGE_TONE: Record<string, string> = {
  실측: 'bg-emerald-500/10 text-emerald-400',
  등록: 'bg-sky-500/10 text-sky-400',
  '보류·수기등록': 'bg-white/[0.05] text-slate-400',
};

export default function Re100MeasuresPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const currentYear = new Date().getFullYear();
  const searchParams = useSearchParams();
  const highlight = searchParams.get('highlight') as Measure | null;

  // 재생E / 무탄소E(CFE) 집계 토글 → energyType 재질의(06 §13.2.3, 로컬 탭·라우트 불변).
  const [track, setTrack] = useState<'RE' | 'CFE'>('RE');
  const [selected, setSelected] = useState<Measure>('PPA_DIRECT');
  const isCfe = track === 'CFE';
  const energyType: EnergyType = isCfe ? 'CARBON_FREE' : 'RENEWABLE';

  useEffect(() => {
    if (highlight && MEASURES.some((m) => m.code === highlight)) setSelected(highlight);
  }, [highlight]);

  const roadmapQ = useRoadmap(companyId ?? 0);
  const achQ = useAchievements(companyId, currentYear, energyType);
  const portfolioQ = usePortfolio(companyId);

  const roadmap = roadmapQ.data ?? [];
  const currentRoadmap =
    roadmap.find((r) => r.targetYear === currentYear) ?? roadmap.slice().sort((a, b) => b.targetYear - a.targetYear)[0];
  const targetPct = currentRoadmap?.targetPct ?? 0;
  const actualPct = currentRoadmap?.actualPct ?? 0;
  const annualDemandMWh = portfolioQ.data?.annualDemandMWh ?? 0;
  const remainMwh =
    annualDemandMWh > 0 ? Math.round((annualDemandMWh * Math.max(0, targetPct - actualPct)) / 100) : null;

  // 이행수단별 mwh(표시용 합산) + 비중.
  const byMeasure = sumMwhByMeasure(achQ.data);
  const totalMwh = MEASURES.reduce((s, m) => s + (byMeasure[m.code] ?? 0), 0);
  const share = (mwh: number) => (totalMwh > 0 ? Math.round((mwh / totalMwh) * 100) : 0);

  const selectedMeasure = MEASURES.find((m) => m.code === selected) ?? MEASURES[0]!;
  const achLoading = achQ.isLoading;
  const achError = achQ.isError;
  const achEmpty = !achLoading && !achError && totalMwh === 0;

  const stats = [
    {
      icon: <Target size={15} />,
      label: `목표 ${isCfe ? 'CFE' : '재생E'} 이행률`,
      v: `${targetPct}%`,
      tone: 'text-sky-400',
    },
    { icon: <Gauge size={15} />, label: '현재 이행률', v: `${actualPct}%`, tone: 'text-emerald-400' },
    {
      icon: <Zap size={15} />,
      label: `연간 ${isCfe ? '무탄소E' : '재생E'} 사용량`,
      v: annualDemandMWh > 0 ? `${annualDemandMWh.toLocaleString()} MWh` : '—',
      tone: 'text-white',
    },
    {
      icon: <PieChart size={15} />,
      label: '잔여 필요량',
      v: remainMwh != null ? `${remainMwh.toLocaleString()} MWh` : '—',
      tone: 'text-amber-400',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: '이행수단' }]} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">이행수단</h1>
          <p className="mt-1 text-sm text-slate-400">운용 5종 · 3트랙 · 포트폴리오 (계획서 p.14·167)</p>
        </div>
      </div>

      {/* 재생E / 무탄소E(CFE) 집계 토글 → energyType 재질의 */}
      <div className="flex items-center gap-2">
        {(['RE', 'CFE'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            className={`rounded-lg px-3 py-1.5 text-xs ${track === t ? 'bg-primary/20 text-primary' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}
          >
            {t === 'RE' ? '재생E (RE100)' : '무탄소E (CFE)'}
          </button>
        ))}
        <span className="text-[11px] text-slate-500">
          {isCfe ? 'CFE = 모든 무탄소원(원전·수소·연료전지·ORC 포함, 19-05)' : 'RE100 = 재생에너지 100%'}
        </span>
      </div>

      {/* 상단 지표 4종 (06 §13.2.1-1) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{roadmapQ.isLoading ? '···' : s.v}</div>
          </div>
        ))}
      </div>

      {achError && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <span className="text-sm text-red-300">이행수단 실적을 불러오지 못했습니다.</span>
          <button
            onClick={() => achQ.refetch()}
            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"
          >
            재시도
          </button>
        </div>
      )}

      {/* 5종 이행수단 selector + 상세 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-white/[0.06] overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">이행수단 (운용 5종 + 보류)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">이행수단</th>
                <th className="px-4 py-3">트랙</th>
                <th className="px-4 py-3 text-right">기여</th>
                <th className="px-4 py-3 text-right">비중</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {achLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-white/[0.06]" />
                    </td>
                  </tr>
                ))
              ) : achEmpty ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                    아직 이행 실적이 없습니다.
                  </td>
                </tr>
              ) : (
                MEASURES.map((m) => {
                  const mwh = byMeasure[m.code] ?? 0;
                  return (
                    <tr
                      key={m.code}
                      onClick={() => setSelected(m.code)}
                      className={`cursor-pointer border-b border-white/[0.04] text-slate-300 hover:bg-white/[0.02] ${selected === m.code ? 'bg-white/[0.03]' : ''} ${highlight === m.code ? 'ring-1 ring-emerald-400/40' : ''}`}
                    >
                      <td className="px-4 py-3">{m.label}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.track}</td>
                      <td className="px-4 py-3 text-right">{mwh.toLocaleString()} MWh</td>
                      <td className="px-4 py-3 text-right">{share(mwh)}%</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-[11px] ${BADGE_TONE[m.badge]}`}>{m.badge}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 선택 수단 상세 + 실행 CTA + 포트폴리오 비중 바 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs text-slate-400">선택 이행수단</div>
            <div className="mt-1 text-lg font-bold text-white">{selectedMeasure.label}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[11px] ${BADGE_TONE[selectedMeasure.badge]}`}>
                {selectedMeasure.badge}
              </span>
              <span className="text-[11px] text-slate-500">트랙 {selectedMeasure.track}</span>
            </div>
            <div className="mt-3 text-sm text-slate-300">
              {(byMeasure[selectedMeasure.code] ?? 0).toLocaleString()} MWh · 비중{' '}
              {share(byMeasure[selectedMeasure.code] ?? 0)}%
            </div>
            {selectedMeasure.cta ? (
              <Link
                href={`${selectedMeasure.cta.href}${selectedMeasure.cta.href.includes('?') ? '&' : '?'}from=measures&measure=${selectedMeasure.code}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-2 text-xs text-primary hover:bg-primary/30"
              >
                {selectedMeasure.cta.label} <ArrowRight size={13} />
              </Link>
            ) : (
              <div className="mt-4 flex items-start gap-1.5 text-[11px] text-slate-500">
                <Info size={12} className="mt-0.5" /> 데이터 소스 확보 후 편입(보류) — 현재 실행 경로 미노출.
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 text-xs text-slate-400">이행 포트폴리오 비중</div>
            {totalMwh === 0 ? (
              <div className="text-[11px] text-slate-500">실적 확정 시 비중이 채워집니다.</div>
            ) : (
              <div className="space-y-2">
                {MEASURES.filter((m) => (byMeasure[m.code] ?? 0) > 0).map((m) => {
                  const pct = share(byMeasure[m.code] ?? 0);
                  return (
                    <div key={m.code}>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{m.label}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-sky-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        실측 3종(PPA_DIRECT·PPA_THIRD·SELF_CONSUME)은 정산 파생(19-03), 등록 2종(REC·녹색프리미엄)은 수단 등록.
        지분투자는 데이터 소스 확보 후 편입(보류). 값은 achievements 응답(재계산 없음, 19-03 §6 P0 교정 결과 표시).
      </p>
    </div>
  );
}
