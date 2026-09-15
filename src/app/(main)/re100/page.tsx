'use client';

// RE100 대시보드 `/re100` — doc04 §2-1 「RE100 대시보드 | c | 이행률·3트랙·다음 액션」.
// 06 §13.1 확정 스펙: 게이지·3트랙·갭 처방·최근정산·desk 위젯 실훅화(예시 상수 제거).
// 불변식(06 §13.0.1): actualPct·mwh·contribPct는 표시만 — FE 재계산·재조인 금지. 되먹임은 staleTime=0 재조회(useAchievements*).
// 폐곡선 진입점(06 §13.0.3): 갭 처방→measures(highlight&from), 최근정산→generation, desk→desk.

import { useState } from 'react';
import {
  Leaf,
  Target,
  TrendingUp,
  ArrowRight,
  Zap,
  Award,
  Handshake,
  Send,
  HelpCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRecHoldings } from '@/hooks/re100/useRe100Ext';
import { useRoadmap } from '@/hooks/trading/useRe100';
import {
  useAchievements,
  useAchievementsLatest,
  usePortfolio,
  useCreateDeskTicket,
  trackMwh,
  type Measure,
} from '@/hooks/re100/useAchievements';

const CATEGORIES = ['제도', '이행수단', '거래', '인증', '기타'] as const;

// 이행수단 3트랙(19-01 §1) — 트랙 대표 화면 링크(06 §13.1.1-4).
const TRACK_META = [
  {
    key: 'A',
    icon: <Zap size={16} className="text-emerald-400" />,
    label: '자가발전·PPA',
    desc: '물리적 조달 (PPA_DIRECT · PPA_THIRD · SELF_CONSUME)',
    href: '/re100/measures',
    tone: 'text-emerald-400',
  },
  {
    key: 'B',
    icon: <Award size={16} className="text-sky-400" />,
    label: 'REC·녹색프리미엄',
    desc: '증서·요금 기반 (REC · GREEN_PREMIUM)',
    href: '/re100/rec',
    tone: 'text-sky-400',
  },
  {
    key: 'C',
    icon: <Handshake size={16} className="text-violet-400" />,
    label: '컨설팅·교육·인증',
    desc: '이행지원 (컨설팅 6단계 · 교육 · K-RE100 인증)',
    href: '/consulting',
    tone: 'text-violet-400',
  },
] as const;

// 갭 처방 top1 매핑 — portfolio measureMix 최저 unitCost 수단의 measures highlight 코드.
const MEASURE_LABEL: Record<Measure, string> = {
  PPA_DIRECT: '직접 PPA (온사이트)',
  PPA_THIRD: '제3자 PPA',
  SELF_CONSUME: '자가발전(자가소비)',
  REC: '인증서(REC) 구매',
  GREEN_PREMIUM: '녹색프리미엄',
  EQUITY: '지분투자·자가건설',
};

const NEXT_ACTIONS = [
  { label: '이행수단 포트폴리오 재점검', to: '/re100/measures?from=dashboard', hint: '재생E/CFE 토글·5종 selector' },
  { label: '자가발전·PPA 정산 실적 확인', to: '/re100/generation?from=dashboard', hint: '전력거래형·자가소비형 실측' },
  { label: '컨설팅 데스크 문의하기', to: '/re100/desk?tab=my', hint: 'RE100 Q&A·실무지원' },
] as const;

export default function Re100DashboardPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const currentYear = new Date().getFullYear();

  const roadmapQ = useRoadmap(companyId ?? 0);
  const recQ = useRecHoldings(companyId);
  const achQ = useAchievements(companyId, currentYear);
  const latestQ = useAchievementsLatest(companyId, 3);
  const portfolioQ = usePortfolio(companyId);
  const createDesk = useCreateDeskTicket();

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('제도');
  const [question, setQuestion] = useState('');
  const [deskDone, setDeskDone] = useState(false);

  // 이행률·목표 = roadmap 파생값 표시(재계산 금지). 당해년도 로드맵.
  const roadmap = roadmapQ.data ?? [];
  const currentRoadmap =
    roadmap.find((r) => r.targetYear === currentYear) ?? roadmap.slice().sort((a, b) => b.targetYear - a.targetYear)[0];
  const actualPct = currentRoadmap?.actualPct ?? 0;
  const targetPct = currentRoadmap?.targetPct ?? 0;
  const annualDemandMWh = portfolioQ.data?.annualDemandMWh ?? 0;

  const totalRec = (recQ.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  // 3트랙 집계 — achievements mwh 합산(표시용). 하드코딩 62/28/10 제거.
  const tracks = trackMwh(achQ.data);
  const contribPct = (mwh: number) => (tracks.total > 0 ? Math.round((mwh / tracks.total) * 100) : 0);
  const trackValues = [tracks.A, tracks.B, 0]; // C(이행지원)는 achievements 밖 — 별도 소스, 현재 미집계 → 0

  // 갭 처방(06 §13.1.1-5): 잔여 필요 MWh(roadmap 파생 표시) + 최저단가 보완 수단 top1.
  const remainPct = Math.max(0, targetPct - actualPct);
  const remainMwh = annualDemandMWh > 0 ? Math.round((annualDemandMWh * remainPct) / 100) : null;
  const measureMix = portfolioQ.data?.measureMix ?? [];
  const cheapest = measureMix.filter((l) => l.unitCost > 0).sort((a, b) => a.unitCost - b.unitCost)[0];

  const latest = latestQ.data ?? [];

  const roadmapLoading = roadmapQ.isLoading;
  const roadmapError = roadmapQ.isError;
  // 빈 원장 정직(Risk §1): roadmap 없음 → empty 안내.
  const roadmapEmpty = !roadmapLoading && !roadmapError && roadmap.length === 0;

  const submitDesk = () => {
    if (!companyId || !question.trim()) return;
    createDesk.mutate(
      { companyId, category, question: question.trim() },
      {
        onSuccess: () => {
          setQuestion('');
          setDeskDone(true);
        },
      },
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: 'RE100 대시보드' }]} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">RE100 대시보드</h1>
          <p className="mt-1 text-sm text-slate-400">이행률 · 이행수단 3트랙 · 다음 액션 (계획서 p.166 이행률 확인)</p>
        </div>
      </div>

      {roadmapError && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <span className="text-sm text-red-300">이행률 데이터를 불러오지 못했습니다.</span>
          <button
            onClick={() => roadmapQ.refetch()}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"
          >
            <RefreshCw size={13} /> 재시도
          </button>
        </div>
      )}

      {roadmapEmpty ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <div className="text-sm text-slate-300">아직 이행 데이터가 없습니다.</div>
          <Link
            href="/consulting"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-4 py-2 text-xs text-primary"
          >
            컨설팅 시작하기 <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <>
          {/* 이행률 게이지 + 핵심 지표 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Leaf size={15} /> 현재 RE100 이행률
                </div>
                <span className="text-[11px] text-slate-500">목표 {targetPct}%</span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                {roadmapLoading ? (
                  <div className="h-8 w-24 animate-pulse rounded bg-white/[0.06]" />
                ) : (
                  <div className="text-3xl font-bold text-white">
                    {actualPct}
                    <span className="text-lg text-slate-400">%</span>
                  </div>
                )}
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-sky-400"
                  style={{ width: `${targetPct > 0 ? Math.min(100, (actualPct / targetPct) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                달성률 {targetPct > 0 ? ((actualPct / targetPct) * 100).toFixed(0) : 0}% (목표 대비) · 잔여{' '}
                {remainPct.toFixed(1)}%p
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Target size={15} /> {currentRoadmap?.targetYear ?? currentYear}년 목표
                </div>
                <div className="mt-1 text-xl font-bold text-white">{roadmapLoading ? '···' : `${targetPct}%`}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <TrendingUp size={15} /> 보유 REC
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {totalRec.toLocaleString()} <span className="text-sm text-slate-400">REC</span>
                </div>
              </div>
            </div>
          </div>

          {/* 이행 갭 처방 (06 §13.1.1-5) */}
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles size={15} className="text-emerald-400" /> 이행 갭 처방
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <div className="text-xs text-slate-400">잔여 필요 MWh</div>
                <div className="mt-1 text-xl font-bold text-amber-400">
                  {remainMwh != null ? `${remainMwh.toLocaleString()} MWh` : '—'}
                </div>
                {remainMwh == null && (
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    연간 수요·목표배분 확정 후 표시(portfolio 미구축)
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-400">가장 저렴한 보완 수단</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {cheapest ? `${MEASURE_LABEL[cheapest.measure]} (₩${cheapest.unitCost}/kWh)` : '—'}
                </div>
                {!cheapest && (
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    전략(measureMix) 수립 후 추천(portfolio 미구축)
                  </div>
                )}
              </div>
              <div className="sm:text-right">
                <Link
                  href={`/re100/measures?highlight=${cheapest?.measure ?? ''}&from=dashboard`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-2 text-xs text-primary hover:bg-primary/30"
                >
                  이 수단 보완하기 <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* 이행수단 3트랙 요약 */}
          <div>
            <div className="mb-2 text-sm font-semibold text-white">
              이행수단 3트랙 요약{' '}
              <span className="text-[11px] font-normal text-slate-500">(19-01 IA · achievements 집계)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TRACK_META.map((t, i) => (
                <Link
                  key={t.key}
                  href={`${t.href}${t.href.includes('?') ? '&' : '?'}from=dashboard`}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12]"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {t.icon} 트랙 {t.key}. {t.label}
                  </div>
                  <div className={`mt-2 text-2xl font-bold ${t.tone}`}>
                    {achQ.isLoading ? '···' : t.key === 'C' ? '—' : `${contribPct(trackValues[i] ?? 0)}`}
                    {t.key !== 'C' && <span className="text-sm text-slate-400">%</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{t.desc}</div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-slate-200">
                    바로가기 <ArrowRight size={12} />
                  </div>
                </Link>
              ))}
            </div>
            {tracks.total === 0 && !achQ.isLoading && (
              <p className="mt-2 text-[11px] text-slate-500">
                아직 확정 이행 실적이 없습니다 — 정산 확정 시 트랙 비중이 채워집니다.
              </p>
            )}
          </div>

          {/* 최근 정산 실적 (06 §13.1.1-6) */}
          <div>
            <div className="mb-2 text-sm font-semibold text-white">
              최근 정산 실적 <span className="text-[11px] font-normal text-slate-500">(achievements latest=3)</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                    <th className="px-4 py-3">설비</th>
                    <th className="px-4 py-3">이행수단</th>
                    <th className="px-4 py-3 text-right">발전량</th>
                    <th className="px-4 py-3 text-right">기여 델타</th>
                    <th className="px-4 py-3">확정일</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((r, i) => (
                    <tr
                      key={i}
                      className="cursor-pointer border-b border-white/[0.04] text-slate-300 hover:bg-white/[0.02]"
                      onClick={() => {
                        window.location.href = '/re100/generation?from=dashboard';
                      }}
                    >
                      <td className="px-4 py-3">{r.plantName}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{MEASURE_LABEL[r.measure] ?? r.measure}</td>
                      <td className="px-4 py-3 text-right">{r.mwh.toLocaleString()} MWh</td>
                      <td className="px-4 py-3 text-right text-emerald-400">+{r.contribDeltaPct}%p</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.confirmedAt}</td>
                    </tr>
                  ))}
                  {latest.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                        {latestQ.isLoading ? '불러오는 중…' : '아직 확정된 정산 실적이 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 데스크 문의하기 quick-form (06 §13.1.1-7) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <HelpCircle size={15} /> 컨설팅 데스크 문의하기
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as (typeof CATEGORIES)[number]);
                  setDeskDone(false);
                }}
                className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setDeskDone(false);
                }}
                placeholder="한 줄로 문의를 남겨주세요."
                className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <button
                onClick={submitDesk}
                disabled={!question.trim() || !companyId || createDesk.isPending}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/20 px-3 py-2 text-xs text-primary disabled:opacity-40"
              >
                <Send size={13} /> 등록
              </button>
            </div>
            {deskDone && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                문의가 접수되었습니다.{' '}
                <Link href="/re100/desk?tab=my" className="underline">
                  내 문의 보기
                </Link>
              </div>
            )}
            {createDesk.isError && <div className="text-[11px] text-red-300">문의 등록에 실패했습니다.</div>}
          </div>

          {/* 다음 액션 */}
          <div>
            <div className="mb-2 text-sm font-semibold text-white">다음 액션</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {NEXT_ACTIONS.map((a) => (
                <Link
                  key={a.to}
                  href={a.to}
                  className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12]"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{a.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{a.hint}</div>
                  </div>
                  <ArrowRight size={16} className="text-slate-500 group-hover:text-slate-200" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
