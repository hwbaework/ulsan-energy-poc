'use client';

/**
 * 보고서 2단계 — 선택한 발전소(또는 전체)의 월별 보고서 문서 목록 + 문서 본문 + PDF/Excel.
 * 1단계(발전소 목록)는 reports/page.tsx. 근거: 3차년도 사업계획서 p.42 정기보고, p.139, WBS 1.5.1
 * - 종류 2가지: 발전 실적 · 이상감지. 매월 1건씩 자동 생성
 * - 외부 제출 양식은 없다(내부 보고·검증용)
 */
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Eye } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { RmsAreaChart } from '@/components/ui/Chart';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { commStatusOf, gradeOf, isAnomaly, sourceOf } from '@/lib/design';
import { cn } from '@/lib/utils';
import { exportExcel } from '@/lib/utils';
import * as monitoringApi from '@/api/monitoring/monitoring';
import type { PlantHistoryPoint } from '@/api/monitoring/monitoring';
import { monitoringKeys } from '@/api/queryKeys';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

/* ── 문서 정의 ── */

type ReportKind = 'generation' | 'anomaly';
const KIND_LABEL: Record<ReportKind, string> = { generation: '발전 실적', anomaly: '이상감지' };
const KIND_CLASS: Record<ReportKind, string> = {
  generation: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  anomaly: 'bg-red-500/10 text-red-400 ring-red-500/20',
};

interface ReportDoc {
  id: string;
  kind: ReportKind;
  month: string; // YYYY-MM
  title: string;
  period: string;
  from: string;
  to: string;
  days: string[];
  createdAt: string; // 다음 달 1일 (월 마감 후 생성)
}

const now = new Date();
const THIS_YEAR = now.getFullYear();
const THIS_MONTH = `${THIS_YEAR}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function monthDoc(kind: ReportKind, year: number, m: number): ReportDoc {
  const month = `${year}-${String(m).padStart(2, '0')}`;
  const last = new Date(year, m, 0).getDate();
  const days = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const next = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
  return {
    id: `${kind}-${month}`,
    kind,
    month,
    title: `${year}년 ${m}월 ${KIND_LABEL[kind]} 보고서`,
    period: `${year}년 ${m}월 (1일 ~ ${last}일)`,
    from: days[0]!,
    to: days[last - 1]!,
    days,
    createdAt: month === THIS_MONTH ? '작성 중' : next.replace(/-/g, '.'),
  };
}

/** 이상감지 보고서는 발전소당 1건(전체 기간 누적) — 매달 만들 만큼 이상이 생기지 않는다 */
const ANOMALY_DOC: ReportDoc = {
  id: 'anomaly-all',
  kind: 'anomaly',
  month: '',
  title: '이상감지 보고서',
  period: '전체 기간',
  from: '',
  to: '',
  days: [],
  createdAt: '이상 발생 시 갱신',
};

/** 해당 연도의 문서: 발전 실적은 월별(1월 ~ 올해면 이번 달, 최신순) + 이상감지 1건 */
function docsOfYear(year: number): ReportDoc[] {
  const lastMonth = year === THIS_YEAR ? now.getMonth() + 1 : year < THIS_YEAR ? 12 : 0;
  const docs: ReportDoc[] = [ANOMALY_DOC];
  for (let m = lastMonth; m >= 1; m--) docs.push(monthDoc('generation', year, m));
  return docs;
}

/** 이력 점(시간별) → 일별 발전량·발전시간. dailyEnergy 는 그날 누적값이라 하루 최댓값이 그날 발전량 */
function summarizeDays(points: PlantHistoryPoint[]) {
  const byDay = new Map<string, { energy: number; hours: number }>();
  for (const p of points) {
    const day = p.time.slice(0, 10);
    const d = byDay.get(day) ?? { energy: 0, hours: 0 };
    d.energy = Math.max(d.energy, p.dailyEnergy);
    if (p.acPower > 0) d.hours += 1;
    byDay.set(day, d);
  }
  return byDay;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

const MONTH_OPTIONS = [{ value: 'all', label: '전체' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `${i + 1}월` }))];
const KIND_OPTIONS = [
  { value: 'all', label: '전체 종류' },
  { value: 'generation', label: KIND_LABEL.generation },
  { value: 'anomaly', label: KIND_LABEL.anomaly },
];

/* ── 화면 ── */

export default function ReportsClient() {
  const router = useRouter();
  const { plantId: scope } = useParams<{ plantId: string }>(); // 'all' 또는 발전소 ID
  const [year, setYear] = useState(THIS_YEAR);
  const [monthFilter, setMonthFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');

  /* 범위: 발전소 하나 */
  const { data: allPlants } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const myPlants = useMemo(() => filterPlantsByOwnership(allPlants ?? [], myPlantMatcher), [allPlants, myPlantMatcher]);
  const plants = useMemo(() => (scope === 'all' ? myPlants : myPlants.filter((p) => String(p.plantId) === scope)), [myPlants, scope]);
  // 연료전지·ORC 는 아직 보고서 항목이 정해지지 않아 문서를 만들지 않는다(빈 상태)
  const hasReport = plants.length > 0 && plants.every((p) => p.type === 'SOLAR');

  const docs = useMemo(
    () =>
      hasReport
        ? docsOfYear(year).filter((d) => (kindFilter === 'all' || d.kind === kindFilter) && (d.kind === 'anomaly' || monthFilter === 'all' || d.month.endsWith(`-${monthFilter}`)))
        : [],
    [hasReport, year, monthFilter, kindFilter],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;
  const scopeName = scope === 'all' ? '전체 발전소' : (plants[0]?.name ?? '');
  const titleSuffix = scope === 'all' ? '' : ` · ${scopeName}`;
  const capacityTotal = plants.reduce((s, p) => s + p.capacity, 0);
  const scopeLabel = scope === 'all' ? `발전소 ${plants.length}개` : scopeName;

  /* 선택 문서의 발전 이력 */
  const historyQueries = useQueries({
    queries: plants.map((p) => ({
      queryKey: monitoringKeys.plantHistory(p.plantId, selected?.from ?? '', selected?.to ?? ''),
      queryFn: () => monitoringApi.getPlantHistory(p.plantId, selected!.from, selected!.to),
      enabled: !!selected && selected.kind === 'generation',
      staleTime: 60_000,
    })),
  });

  /* 선택 문서의 이상 목록 */
  const { data: anomalyData } = useAnomalies({ size: 100 });
  const anomalies = useMemo(() => {
    if (!selected) return [];
    const raw: any[] = anomalyData ? (Array.isArray(anomalyData) ? anomalyData : ((anomalyData as any)?.content ?? [])) : [];
    const mine = new Set(plants.map((p) => p.plantId));
    return raw
      .map((a: any) => ({
        id: a.id as number,
        plantId: (a.plantId ?? a.powerStationId ?? 0) as number,
        plantName: (a.plantName ?? a.powerStationName ?? '') as string,
        plantType: (a.detectionType ?? 'SOLAR') as string,
        title: (a.title ?? '') as string,
        severity: (a.severity ?? 'normal') as string,
        status: (a.status ?? 'NORMAL') as string,
        detectedAt: (a.detectedAt ?? a.createdAt ?? '') as string,
      }))
      // 이상감지 보고서는 전체 기간, 발전 실적 보고서는 그 달만
      .filter((a) => isAnomaly(a.severity, a.status) && (selected.kind === 'anomaly' || a.detectedAt.startsWith(selected.month)) && mine.has(a.plantId))
      .sort((x, y) => (x.detectedAt < y.detectedAt ? 1 : -1));
  }, [anomalyData, plants, selected]);

  /* 발전 실적 집계 */
  const generationRows = useMemo(
    () =>
      plants.map((plant, i) => {
        let energy = 0;
        let hours = 0;
        summarizeDays(historyQueries[i]?.data ?? []).forEach((d) => {
          energy += d.energy;
          hours += d.hours;
        });
        return { plant, energy: Math.round(energy), hours, anomalies: anomalies.filter((a) => a.plantId === plant.plantId).length };
      }),
    [plants, historyQueries, anomalies],
  );
  const genTotal = generationRows.reduce((s, r) => s + r.energy, 0);
  const hoursTotal = generationRows.reduce((s, r) => s + r.hours, 0);
  const dailyRows = useMemo(() => {
    if (!selected) return [];
    const total = new Map<string, { energy: number; hours: number }>(selected.days.map((d) => [d, { energy: 0, hours: 0 }]));
    historyQueries.forEach((q) => {
      summarizeDays(q.data ?? []).forEach((v, day) => {
        const t = total.get(day);
        if (t) {
          t.energy += v.energy;
          t.hours = Math.max(t.hours, v.hours);
        }
      });
    });
    return selected.days.map((d) => ({ day: d, ...total.get(d)! })).filter((r) => r.energy > 0);
  }, [historyQueries, selected]);

  /* 이상감지 집계 */
  const anomalyByPlant = plants
    .map((plant) => {
      const list = anomalies.filter((a) => a.plantId === plant.plantId);
      return {
        plant,
        warning: list.filter((a) => a.severity === 'warning').length,
        caution: list.filter((a) => a.severity === 'caution').length,
        commError: list.filter((a) => a.status === 'COMM_ERROR').length,
        total: list.length,
      };
    })
    .filter((r) => r.total > 0);
  const warningTotal = anomalies.filter((a) => a.severity === 'warning').length;
  const commErrorTotal = anomalies.filter((a) => a.status === 'COMM_ERROR').length;

  /* 내보내기 — 선택 문서의 발전소별 표 */
  const exportData = (doc: ReportDoc) => {
    if (doc.kind === 'generation') {
      return {
        file: `${doc.title}${titleSuffix}`,
        sheet: KIND_LABEL.generation,
        headers: ['발전소', '발전원', '설비용량 kW', '발전량 kWh', '발전시간 h', '이상 건수'],
        rows: generationRows.map((r) => [r.plant.name, sourceOf(r.plant.type).label, r.plant.capacity, r.energy, r.hours, r.anomalies]),
      };
    }
    return {
      file: `${doc.title}${titleSuffix}`,
      sheet: KIND_LABEL.anomaly,
      headers: ['감지 시각', '발전소', '발전원', '이상유형', '등급', '상태'],
      rows: anomalies.map((a) => [fmtDateTime(a.detectedAt), a.plantName, sourceOf(a.plantType).label, a.title, gradeOf(a.severity).label, commStatusOf(a.status).label]),
    };
  };
  const onExcel = (doc: ReportDoc) => {
    const d = exportData(doc);
    void exportExcel(d.file, d.sheet, d.headers, d.rows);
  };

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-slate-400';
  const td = 'px-4 py-3 text-sm';
  const num = 'tabular-nums';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '보고서', path: '/monitoring/reports' }, { label: scopeName }]} />
      <div className="flex items-center gap-3">
        {myPlants.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => router.push('/monitoring/reports')} aria-label="발전소 목록으로">
            <ArrowLeft size={16} />
          </Button>
        )}
        <h1 className="text-2xl font-bold text-white">보고서 · {scopeName}</h1>
      </div>

      {/* 연도 · 월 · 종류 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] px-5 py-3">
        <span className="text-sm text-slate-400">연도</span>
        <button type="button" onClick={() => setYear((y) => y - 1)} className="rounded-md p-1.5 text-slate-300 hover:bg-white/[0.06] hover:text-white" aria-label="이전 연도">
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-bold text-white tabular-nums">{year}년</span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= THIS_YEAR}
          className="rounded-md p-1.5 text-slate-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="다음 연도"
        >
          <ChevronRight size={16} />
        </button>
        <span className="ml-3 text-sm text-slate-400">월</span>
        <div className="w-28">
          <Select options={MONTH_OPTIONS} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        </div>
        <div className="w-36">
          <Select options={KIND_OPTIONS} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} />
        </div>
        <span className="ml-auto text-sm text-slate-400">{docs.length}건</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_520px] gap-6 items-start">
        {/* 문서 목록 */}
        <SectionCard title="보고서 목록" noPadding className="min-w-0 !h-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <th className={th}>문서</th>
                  <th className={th}>종류</th>
                  <th className={th}>생성일</th>
                  <th className={th}>미리보기 · Excel</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={cn('cursor-pointer border-b border-white/5 transition-colors', selected?.id === d.id ? 'bg-primary/10' : 'hover:bg-white/[0.03]')}
                  >
                    <td className={cn(td, 'font-medium text-white whitespace-nowrap')}>{d.title}{titleSuffix}</td>
                    <td className={td}>
                      <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 whitespace-nowrap', KIND_CLASS[d.kind])}>{KIND_LABEL[d.kind]}</span>
                    </td>
                    <td className={cn(td, 'text-slate-400 tabular-nums whitespace-nowrap')}>{d.createdAt}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedId(d.id); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" title="미리보기">
                        <Eye size={15} />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedId(d.id); onExcel(d); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" title="Excel">
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">{hasReport ? '보고서가 없습니다' : '보고서 항목이 아직 정해지지 않았습니다'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* 문서 본문 */}
        {selected && (
          <div className="min-w-0 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6 space-y-6 xl:sticky xl:top-4">
            {/* 표지 — 위 줄: 구분 + Excel, 아래: 제목 전체 폭(버튼과 한 줄에 두면 제목이 줄바꿈됨) */}
            <div className="border-b border-white/[0.06] pb-5">
              <div className="flex items-center justify-between gap-4 mb-2">
                <p className="text-sm text-slate-400">통합관제 · 월간 보고서</p>
                <Button size="sm" variant="secondary" onClick={() => onExcel(selected)}>
                  <Download size={14} className="mr-1" /> Excel
                </Button>
              </div>
              <h2 className="text-lg font-bold text-white">{selected.title}{titleSuffix}</h2>
              <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1 text-sm">
                <dt className="text-slate-400">기간</dt>
                <dd className="text-white tabular-nums">{selected.period}</dd>
                <dt className="text-slate-400">대상</dt>
                <dd className="text-white">{scopeLabel} · 설비 {capacityTotal >= 1000 ? `${(capacityTotal / 1000).toFixed(2)} MW` : `${capacityTotal.toLocaleString()} kW`}</dd>
                <dt className="text-slate-400">생성일</dt>
                <dd className="text-white tabular-nums">{selected.createdAt}</dd>
              </dl>
            </div>

            {selected.kind === 'generation' ? (
              <>
                {/* 1. 요약 — 박스 없이 줄글 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">1. 요약</h3>
                  <dl className="grid grid-cols-[96px_1fr] gap-y-1.5 text-sm">
                    <dt className="text-slate-400">총 발전량</dt>
                    <dd className="text-white tabular-nums font-semibold">{genTotal.toLocaleString()} kWh</dd>
                    <dt className="text-slate-400">총 발전시간</dt>
                    <dd className="text-white tabular-nums">{hoursTotal.toLocaleString()} h</dd>
                    <dt className="text-slate-400">이상</dt>
                    <dd className={cn('tabular-nums', anomalies.length > 0 ? 'text-red-400 font-semibold' : 'text-white')}>{anomalies.length} 건</dd>
                  </dl>
                </section>

                {/* 2. 실적 — 발전소 하나면 줄글, 여럿이면 발전소별 표 */}
                {plants.length === 1 ? (
                  <section>
                    <h3 className="text-sm font-bold text-white mb-3">2. 실적</h3>
                    <dl className="grid grid-cols-[96px_1fr] gap-y-1.5 text-sm">
                      <dt className="text-slate-400">발전소</dt>
                      <dd className="text-white">{plants[0]!.name} <span className="text-slate-400">{sourceOf(plants[0]!.type).label}</span></dd>
                      <dt className="text-slate-400">설비용량</dt>
                      <dd className="text-white tabular-nums">{plants[0]!.capacity.toLocaleString()} kW</dd>
                      <dt className="text-slate-400">발전량</dt>
                      <dd className="text-white tabular-nums">{genTotal.toLocaleString()} kWh</dd>
                      <dt className="text-slate-400">발전시간</dt>
                      <dd className="text-white tabular-nums">{hoursTotal} h</dd>
                    </dl>
                  </section>
                ) : (
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">2. 발전소별 실적</h3>
                  <table className="w-full">
                    <thead className="border-b border-white/[0.06]">
                      <tr>
                        <th className={th}>발전소</th>
                        <th className={th}>설비용량</th>
                        <th className={th}>발전량</th>
                        <th className={th}>발전시간</th>
                        <th className={th}>이상</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generationRows.map((r) => (
                        <tr key={r.plant.plantId} className="border-b border-white/5">
                          <td className={cn(td, 'text-white')}>
                            {r.plant.name} <span className="text-xs text-slate-400">{sourceOf(r.plant.type).label}</span>
                          </td>
                          <td className={cn(td, num, 'text-slate-300')}>{r.plant.capacity.toLocaleString()} kW</td>
                          <td className={cn(td, num, 'font-semibold text-white')}>{r.energy.toLocaleString()} kWh</td>
                          <td className={cn(td, num, 'text-slate-300')}>{r.hours} h</td>
                          <td className={cn(td, num, r.anomalies > 0 ? 'text-red-400 font-semibold' : 'text-slate-300')}>{r.anomalies} 건</td>
                        </tr>
                      ))}
                      <tr className="bg-white/[0.02]">
                        <td className={cn(td, 'font-bold text-white')}>합계</td>
                        <td className={cn(td, num, 'font-bold text-white')}>{capacityTotal.toLocaleString()} kW</td>
                        <td className={cn(td, num, 'font-bold text-white')}>{genTotal.toLocaleString()} kWh</td>
                        <td className={cn(td, num, 'font-bold text-white')}>{hoursTotal} h</td>
                        <td className={cn(td, num, 'font-bold text-white')}>{anomalies.length} 건</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
                )}

                {/* 3. 일별 발전량 — 차트로 흐름, 표로 수치 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">3. 일별 발전량</h3>
                  {dailyRows.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">발전 이력이 없습니다</p>
                  ) : (
                    <>
                    <div className="mb-3">
                      <RmsAreaChart
                        data={dailyRows.map((r) => ({ day: r.day.slice(8).replace(/^0/, '') + '일', energy: Math.round(r.energy) }))}
                        xKey="day"
                        areas={[{ key: 'energy', name: '발전량 (kWh)', color: '#10B981' }]}
                        height={180}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full">
                        <thead className="border-b border-white/[0.06] sticky top-0 bg-[#0d1520]">
                          <tr>
                            <th className={th}>일자</th>
                            <th className={th}>발전량</th>
                            <th className={th}>발전시간</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyRows.map((r) => (
                            <tr key={r.day} className="border-b border-white/5">
                              <td className={cn(td, 'text-slate-300 tabular-nums')}>{r.day.replace(/-/g, '.')}</td>
                              <td className={cn(td, num, 'text-white')}>{Math.round(r.energy).toLocaleString()} kWh</td>
                              <td className={cn(td, num, 'text-slate-300')}>{r.hours} h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </section>
              </>
            ) : (
              <>
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">1. 요약</h3>
                  <dl className="grid grid-cols-[96px_1fr] gap-y-1.5 text-sm">
                    <dt className="text-slate-400">이상</dt>
                    <dd className={cn('tabular-nums font-semibold', anomalies.length > 0 ? 'text-red-400' : 'text-white')}>{anomalies.length} 건</dd>
                    <dt className="text-slate-400">경고</dt>
                    <dd className="text-white tabular-nums">{warningTotal} 건</dd>
                    <dt className="text-slate-400">통신오류</dt>
                    <dd className="text-white tabular-nums">{commErrorTotal} 건</dd>
                  </dl>
                </section>

                {plants.length > 1 && (
                  <section>
                    <h3 className="text-sm font-bold text-white mb-3">2. 발전소별 이상</h3>
                    {anomalyByPlant.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">이 달 이상 감지 내역이 없습니다</p>
                    ) : (
                      <table className="w-full">
                        <thead className="border-b border-white/[0.06]">
                          <tr>
                            <th className={th}>발전소</th>
                            <th className={th}>경고</th>
                            <th className={th}>주의</th>
                            <th className={th}>통신오류</th>
                            <th className={th}>합계</th>
                          </tr>
                        </thead>
                        <tbody>
                          {anomalyByPlant.map((r) => (
                            <tr key={r.plant.plantId} className="border-b border-white/5">
                              <td className={cn(td, 'text-white')}>
                                {r.plant.name} <span className="text-xs text-slate-400">{sourceOf(r.plant.type).label}</span>
                              </td>
                              <td className={cn(td, num, 'text-slate-300')}>{r.warning}</td>
                              <td className={cn(td, num, 'text-slate-300')}>{r.caution}</td>
                              <td className={cn(td, num, 'text-slate-300')}>{r.commError}</td>
                              <td className={cn(td, num, 'font-semibold text-white')}>{r.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                )}

                <section>
                  <h3 className="text-sm font-bold text-white mb-3">{plants.length > 1 ? '3. 이상 목록' : '2. 이상 목록'}</h3>
                  {anomalies.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">이상 감지 내역이 없습니다</p>
                  ) : (
                    /* 좁은 패널이라 표 대신 항목 카드: 제목 / 발전소 · 시각 / 등급·상태 칩 */
                    <ul className="space-y-2">
                      {anomalies.map((a) => {
                        const g = gradeOf(a.severity);
                        const s = commStatusOf(a.status);
                        return (
                          <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">{a.title}</p>
                              <p className="mt-0.5 text-sm text-slate-400 tabular-nums">
                                {plants.length > 1 ? `${a.plantName} · ` : ''}{fmtDateTime(a.detectedAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <StatusPill tone={g.tone} label={g.label} />
                              <StatusPill tone={s.tone} label={s.label} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
