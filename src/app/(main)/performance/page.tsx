'use client';

import { useMemo, useState } from 'react';
import {
  Gauge,
  ListTree,
  Info,
  Battery,
  Car,
  Database,
  Sun,
  Leaf,
  Users,
  Building2,
  Megaphone,
  Zap,
  Target,
  RefreshCw,
  Loader2,
  Send,
  CheckCircle2,
  FileArchive,
  Save,
} from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  usePerformanceSummary,
  useSaveActual,
  useSubmitActual,
  useApproveActual,
  useAggregateIndicator,
  type PerformanceIndicator,
} from '@/hooks/performance/usePerformance';
import { evidenceExportZipUrl } from '@/hooks/evidence/useEvidence';
import EvidencePanel from './EvidencePanel';
import type { EvidenceType } from '@/hooks/evidence/useEvidence';

// 성과지표 대시보드 — 09 §3.2.1. summary 실소비(자동 5·수기 5).
// 실적 null → "미연동"(가짜 진행률 금지). 수기 지표(1·2·7·9·10)는 입력→제출→승인.
// 목표·산식·아이콘·라벨은 계획서 캐논(불변). 진행률 바는 approved/집계값만.

const YEAR = 2026;
const MANUAL_INDICATORS = new Set([1, 2, 7, 9, 10]); // B유형 수기

// 지표 메타(계획서 캐논: 아이콘·라벨·목표 상수·산식). 실적/진행률은 summary 실값으로 덮어씀.
interface IndicatorMeta {
  no: number;
  label: string;
  icon: React.ReactNode;
  target: string; // 계획서 상수(실값)
  formula: string;
  evidenceType: EvidenceType;
}
const META: IndicatorMeta[] = [
  {
    no: 1,
    label: '재생·분산에너지 보급 용량',
    icon: <Sun size={14} />,
    target: '44.7 MW',
    formula: '연도별 설치 용량(누적) — 연료전지 39.6MW + 태양광 5.1MW',
    evidenceType: 'INSTALL_INSPECTION',
  },
  {
    no: 2,
    label: 'SPC·공급기업 참여',
    icon: <Building2 size={14} />,
    target: '22 개사',
    formula: '부생수소·전력·REC·배열 공급 기업 수(한국에너지공단 확인)',
    evidenceType: 'SUPPLY_CONFIRM',
  },
  {
    no: 3,
    label: '온실가스 감축량',
    icon: <Leaf size={14} />,
    target: '166,457 tCO₂eq',
    formula: '발전량(MWh) × 배출계수 0.4781',
    evidenceType: 'INSTALL_INSPECTION',
  },
  {
    no: 4,
    label: '에너지 자립률',
    icon: <Zap size={14} />,
    target: '1.82 %',
    formula: '감축량 ÷ 산단 총소비 19,120,725 MWh (지표3 파생)',
    evidenceType: 'INSTALL_INSPECTION',
  },
  {
    no: 5,
    label: '데이터 거래·활용',
    icon: <Database size={14} />,
    target: '거래 활성화',
    formula: '(등록 + 1회 이상 이용) ÷ 모집 × 100',
    evidenceType: 'BUILD_PROGRESS_REPORT',
  },
  {
    no: 6,
    label: '수용가 이용률',
    icon: <Users size={14} />,
    target: '80 %',
    formula: '(등록 + 1회 이상 이용) ÷ 모집 수용가 × 100 (3차 80%)',
    evidenceType: 'BUILD_PROGRESS_REPORT',
  },
  {
    no: 7,
    label: '데이터수집 인프라 구축률',
    icon: <Database size={14} />,
    target: '100 %',
    formula: '시스템 구축률 = (구축 / 목표) × 100',
    evidenceType: 'BUILD_PROGRESS_REPORT',
  },
  {
    no: 8,
    label: '에너지 자립률(발전÷소비)',
    icon: <Leaf size={14} />,
    target: 'ISSB 정합',
    formula: '발전량 ÷ 산단소비 19,120,725',
    evidenceType: 'INSTALL_INSPECTION',
  },
  {
    no: 9,
    label: '성과확산 활동',
    icon: <Megaphone size={14} />,
    target: '31 건',
    formula: '결과물 보고서·홍보물·샌드박스 신청 결과 확인(건수)',
    evidenceType: 'RESULT_REPORT',
  },
  {
    no: 10,
    label: '탄소중립 사업모델 발굴',
    icon: <Target size={14} />,
    target: '모델 발굴·확산',
    formula: '설치 검수 + 구축 현장 확인(규모·모델)',
    evidenceType: 'MODEL_DOC',
  },
];

// 지표7·10-3(ESS)·10-4(V2G) 증빙 귀속 카드(캐논 상수)
const EVIDENCE_CARDS = [
  {
    key: '7',
    icon: <Database size={16} />,
    label: '지표7 · 데이터수집 인프라',
    note: '계측·수집 인프라 구축률',
    tone: 'text-sky-400',
    indicatorNo: 7,
  },
  {
    key: '10-3',
    icon: <Battery size={16} />,
    label: '지표10-3 · ESS',
    note: 'PCS 300kW · Battery 270kWh',
    tone: 'text-emerald-400',
    indicatorNo: 10,
  },
  {
    key: '10-4',
    icon: <Car size={16} />,
    label: '지표10-4 · V2G',
    note: 'EV 충전·방전 연계(양방향)',
    tone: 'text-amber-400',
    indicatorNo: 10,
  },
];

const TABS = [
  { key: 'status', label: '지표 현황', icon: <Gauge size={14} /> },
  { key: 'detail', label: '지표 상세 드릴다운', icon: <ListTree size={14} /> },
] as const;

function pct(v: number) {
  return Math.max(0, Math.min(100, v));
}

function sourceBadge(ind: PerformanceIndicator | undefined) {
  if (!ind) return null;
  if (ind.actual == null) {
    return <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-400">미연동</span>;
  }
  if (ind.source === 'auto') {
    return (
      <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
        집계 {ind.lastAggregatedAt?.slice(0, 10) ?? ''}
      </span>
    );
  }
  // manual
  if (ind.status === 'approved') {
    return (
      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
        승인 {ind.approvedAt?.slice(0, 10) ?? ''}
      </span>
    );
  }
  return (
    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
      검토중({ind.status ?? 'draft'})
    </span>
  );
}

export default function PerformanceDashboardPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('status');
  const [openNo, setOpenNo] = useState<number | null>(null);
  const uploadedBy = useAuthStore((s) => (s.user?.id != null ? String(s.user.id) : undefined));

  const summaryQ = usePerformanceSummary(YEAR);
  const byNo = useMemo(() => {
    const m = new Map<number, PerformanceIndicator>();
    (summaryQ.data ?? []).forEach((i) => m.set(i.no, i));
    return m;
  }, [summaryQ.data]);

  const saveM = useSaveActual();
  const submitM = useSubmitActual();
  const approveM = useApproveActual();
  const aggregateM = useAggregateIndicator();

  const [manualVal, setManualVal] = useState('');

  // 성과지표 요약 CSV 내보내기 — 연차평가 종착점(목표·실적·달성률·소스). 클라 생성(추가 API 없음).
  const handleExportCsv = () => {
    const header = ['지표번호', '지표명', '목표', '실적', '달성률(%)', '실적소스'];
    const lines = META.map((meta) => {
      const ind = byNo.get(meta.no);
      const source = MANUAL_INDICATORS.has(meta.no) ? '수기' : '자동';
      const cells = [
        meta.no,
        meta.label,
        ind?.target ?? meta.target ?? '',
        ind?.actual ?? '',
        ind?.progressPct ?? '',
        source,
      ];
      return cells
        .map((c) => {
          const s = String(c ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',');
    });
    const csv = '﻿' + [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `성과지표_${YEAR}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '성과지표 대시보드' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">성과지표 대시보드</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">지표 10종 — 목표 vs 실적 · 증빙</span>
          <a
            href={evidenceExportZipUrl(undefined, YEAR)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04]"
          >
            <FileArchive size={13} /> 증빙 zip
          </a>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04]"
          >
            <FileArchive size={13} /> 지표 CSV
          </button>
        </div>
      </div>

      {/* 요약(계획서 목표 상수=실값) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Sun size={15} />, label: '보급 용량 목표', v: '44.7 MW', tone: 'text-emerald-400' },
          { icon: <Leaf size={15} />, label: '감축량 목표', v: '166,457 tCO₂eq', tone: 'text-sky-400' },
          { icon: <Zap size={15} />, label: '에너지 자립률', v: '1.82 %', tone: 'text-amber-400' },
          { icon: <Building2 size={15} />, label: '참여 기업', v: '22 개사', tone: 'text-white' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.v}</div>
            <div className="text-[11px] text-slate-500">사업계획서 목표(실값)</div>
          </div>
        ))}
      </div>

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

      {tab === 'status' && (
        <div className="space-y-6">
          {summaryQ.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> 지표 요약 불러오는 중…
            </div>
          )}
          {summaryQ.isError && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 text-sm text-rose-300">
              지표 요약을 불러오지 못했습니다. 집계 서비스 연동 상태를 확인하세요.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {META.map((meta) => {
              const ind = byNo.get(meta.no);
              const isManual = MANUAL_INDICATORS.has(meta.no);
              const notWired = ind == null || ind.actual == null;
              const progress = ind?.progressPct ?? null;
              return (
                <div key={meta.no} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-400">
                        지표{meta.no}
                      </span>
                      {meta.icon} {meta.label}
                    </div>
                    {sourceBadge(ind)}
                  </div>
                  <div className="mt-3 flex items-end justify-between text-xs">
                    <div>
                      <div className="text-slate-500">목표(실값)</div>
                      <div className="text-white font-semibold">{ind?.target ?? meta.target}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500">실적</div>
                      <div className="font-semibold text-slate-300">
                        {notWired ? <span className="text-slate-500">미연동</span> : String(ind!.actual)}
                      </div>
                    </div>
                  </div>
                  {/* 진행률 — approved/집계값만. 미연동은 바 없음(가짜 진행률 금지) */}
                  {notWired || progress == null ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      실적 데이터 미연동 — 진행률 표시 없음(정직성).
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 h-2 w-full rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full bg-sky-400" style={{ width: `${pct(progress)}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>진행률 {progress}%</span>
                        <span>{ind?.trend === 'up' ? '▲ 상승' : ind?.trend === 'down' ? '▼ 하락' : '― 유지'}</span>
                      </div>
                    </>
                  )}

                  {/* 액션바 */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-400">
                      증빙 {ind?.evidenceCount ?? 0}건
                    </span>
                    <button
                      onClick={() => {
                        setOpenNo(openNo === meta.no ? null : meta.no);
                        setManualVal('');
                      }}
                      className="rounded-lg border border-white/[0.06] px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[0.04]"
                    >
                      {openNo === meta.no ? '닫기' : '증빙·실적 갱신'}
                    </button>
                    {!isManual && (
                      <button
                        onClick={() => aggregateM.mutate({ indicatorNo: meta.no, year: YEAR })}
                        disabled={aggregateM.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={aggregateM.isPending ? 'animate-spin' : ''} /> 재집계
                      </button>
                    )}
                  </div>

                  {/* Drawer: 수기 입력(승인 흐름) + 증빙 */}
                  {openNo === meta.no && (
                    <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
                      {isManual && (
                        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 space-y-2">
                          <div className="text-xs text-slate-400">수기 실적 입력 — draft → 제출 → 승인</div>
                          <div className="flex items-center gap-2">
                            <input
                              value={manualVal}
                              onChange={(e) => setManualVal(e.target.value)}
                              type="number"
                              placeholder={`실적값 (${meta.target})`}
                              className="w-40 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-sm text-slate-200"
                            />
                            <button
                              onClick={() => {
                                const v = Number(manualVal);
                                if (Number.isNaN(v)) return;
                                saveM.mutate({ no: meta.no, year: YEAR, actualValue: v });
                              }}
                              disabled={saveM.isPending || !manualVal}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-2 text-xs text-slate-200 hover:bg-white/[0.1] disabled:opacity-50"
                            >
                              <Save size={13} /> 저장(draft)
                            </button>
                            <button
                              onClick={() => submitM.mutate({ no: meta.no, year: YEAR })}
                              disabled={submitM.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-2 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
                            >
                              <Send size={13} /> 제출
                            </button>
                            <button
                              onClick={() => approveM.mutate({ no: meta.no, year: YEAR })}
                              disabled={approveM.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 px-2.5 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} /> 승인
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            approved 실적만 리포트에 확정 집계됩니다(정직성).
                          </div>
                        </div>
                      )}
                      <EvidencePanel
                        ownerType="performance_actual"
                        ownerId={String(meta.no)}
                        indicatorNo={meta.no}
                        year={YEAR}
                        evidenceType={meta.evidenceType}
                        uploadedBy={uploadedBy}
                        title={`지표${meta.no} 증빙`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 지표7·10-3(ESS)·10-4(V2G) 증빙 카드 */}
          <div>
            <div className="text-sm font-semibold text-white mb-2">
              전용 화면 없는 지표 증빙 (지표7 · 10-3 ESS · 10-4 V2G)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {EVIDENCE_CARDS.map((c) => (
                <div key={c.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {c.icon} {c.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{c.note}</div>
                  <a
                    href={evidenceExportZipUrl(c.indicatorNo, YEAR)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                  >
                    <FileArchive size={11} /> 증빙 zip
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'detail' && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">지표 상세 드릴다운</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">지표</th>
                <th className="px-4 py-3">항목</th>
                <th className="px-4 py-3 text-right">목표</th>
                <th className="px-4 py-3 text-right">실적</th>
                <th className="px-4 py-3">산식</th>
              </tr>
            </thead>
            <tbody>
              {META.map((meta) => {
                const ind = byNo.get(meta.no);
                return (
                  <tr key={meta.no} className="border-b border-white/[0.04] text-slate-300 align-top">
                    <td className="px-4 py-3">
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-400">
                        지표{meta.no}
                      </span>
                    </td>
                    <td className="px-4 py-3">{meta.label}</td>
                    <td className="px-4 py-3 text-right text-white">{ind?.target ?? meta.target}</td>
                    <td className="px-4 py-3 text-right">
                      {ind?.actual == null ? <span className="text-slate-500">미연동</span> : String(ind.actual)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{ind?.formula ?? meta.formula}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-sky-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-sky-400">정직성 안내</b> — 목표치는 사업계획서 상수(실값). 실적은 성과 집계 서비스
          실소비이며, 실적 데이터가 없는 지표는 <b>미연동</b>으로 정직 표시(가짜 진행률 없음). 수기 지표(1·2·7·9·10)는{' '}
          <b>승인(approved)</b>된 값만 확정 집계됩니다.
        </div>
      </div>
    </div>
  );
}
