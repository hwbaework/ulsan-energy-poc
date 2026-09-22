'use client';

/**
 * 보고서 — 월별로 생성되는 통합관제 보고서 문서 (근거: 3차년도 사업계획서 p.42 정기보고, p.139, WBS 1.5.1)
 * - 종류 2가지: 발전 실적 보고서 · 이상감지 보고서. 매월 1건씩 자동 생성(내 발전소 전체 대상)
 * - 왼쪽 목록에서 문서를 고르면 오른쪽에 문서 본문(제목·기간·요약·발전소별 표·목록). PDF / Excel 내려받기
 * - 외부 제출 양식은 없다(내부 보고·검증용)
 */
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { commStatusOf, gradeOf, isAnomaly, sourceOf } from '@/lib/design';
import { cn } from '@/lib/utils';
import { exportExcel, exportPdf } from '@/lib/utils';
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
  period: string; // YYYY.MM.DD ~ YYYY.MM.DD
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
    period: `${year}.${String(m).padStart(2, '0')}.01 ~ ${year}.${String(m).padStart(2, '0')}.${String(last).padStart(2, '0')}`,
    from: days[0]!,
    to: days[last - 1]!,
    days,
    createdAt: month === THIS_MONTH ? '작성 중' : next.replace(/-/g, '.'),
  };
}

/** 해당 연도의 문서: 1월 ~ (올해면 이번 달) · 최신순 · 종류별 1건 */
function docsOfYear(year: number): ReportDoc[] {
  const lastMonth = year === THIS_YEAR ? now.getMonth() + 1 : year < THIS_YEAR ? 12 : 0;
  const docs: ReportDoc[] = [];
  for (let m = lastMonth; m >= 1; m--) {
    docs.push(monthDoc('generation', year, m), monthDoc('anomaly', year, m));
  }
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

/* ── 페이지 ── */

export default function ReportsPage() {
  const [year, setYear] = useState(THIS_YEAR);
  const [monthFilter, setMonthFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');

  const docs = useMemo(
    () => docsOfYear(year).filter((d) => (monthFilter === 'all' || d.month.endsWith(`-${monthFilter}`)) && (kindFilter === 'all' || d.kind === kindFilter)),
    [year, monthFilter, kindFilter],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;

  /* 내 발전소 */
  const { data: allPlants } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const plants = useMemo(() => filterPlantsByOwnership(allPlants ?? [], myPlantMatcher), [allPlants, myPlantMatcher]);

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
      .filter((a) => isAnomaly(a.severity, a.status) && a.detectedAt.startsWith(selected.month) && mine.has(a.plantId))
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
  const capacityTotal = plants.reduce((s, p) => s + p.capacity, 0);
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
        file: `${doc.title}`,
        sheet: KIND_LABEL.generation,
        headers: ['발전소', '발전원', '설비용량 kW', '발전량 kWh', '발전시간 h', '이상 건수'],
        rows: generationRows.map((r) => [r.plant.name, sourceOf(r.plant.type).label, r.plant.capacity, r.energy, r.hours, r.anomalies]),
      };
    }
    return {
      file: `${doc.title}`,
      sheet: KIND_LABEL.anomaly,
      headers: ['감지 시각', '발전소', '발전원', '이상유형', '등급', '상태'],
      rows: anomalies.map((a) => [fmtDateTime(a.detectedAt), a.plantName, sourceOf(a.plantType).label, a.title, gradeOf(a.severity).label, commStatusOf(a.status).label]),
    };
  };
  const onPdf = (doc: ReportDoc) => {
    const d = exportData(doc);
    void exportPdf(d.file, doc.title, d.headers, d.rows);
  };
  const onExcel = (doc: ReportDoc) => {
    const d = exportData(doc);
    void exportExcel(d.file, d.sheet, d.headers, d.rows);
  };

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-slate-400';
  const td = 'px-4 py-3 text-sm';
  const num = 'text-right tabular-nums';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '보고서' }]} />
      <h1 className="text-xl font-bold text-white">보고서</h1>

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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_480px] gap-6 items-start">
        {/* 문서 목록 */}
        <SectionCard title="보고서 목록" noPadding>
          <table className="w-full">
            <thead className="border-b border-white/[0.06]">
              <tr>
                <th className={th}>기간</th>
                <th className={th}>종류</th>
                <th className={th}>문서</th>
                <th className={th}>대상</th>
                <th className={th}>생성일</th>
                <th className={cn(th, 'text-right')}>내려받기</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    'cursor-pointer border-b border-white/5 transition-colors',
                    selected?.id === d.id ? 'bg-primary/10' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <td className={cn(td, 'text-slate-300 tabular-nums whitespace-nowrap')}>{d.period}</td>
                  <td className={td}>
                    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 whitespace-nowrap', KIND_CLASS[d.kind])}>{KIND_LABEL[d.kind]}</span>
                  </td>
                  <td className={cn(td, 'font-medium text-white whitespace-nowrap')}>{d.title}</td>
                  <td className={cn(td, 'text-slate-300 whitespace-nowrap')}>발전소 {plants.length}개</td>
                  <td className={cn(td, 'text-slate-400 tabular-nums whitespace-nowrap')}>{d.createdAt}</td>
                  <td className={cn(td, 'text-right whitespace-nowrap')}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedId(d.id); onPdf(d); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" title="PDF">
                      <FileText size={15} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedId(d.id); onExcel(d); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" title="Excel">
                      <Download size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">보고서가 없습니다</td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>

        {/* 문서 본문 */}
        {selected && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6 space-y-6 xl:sticky xl:top-4">
            {/* 표지 */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
              <div>
                <p className="text-xs text-slate-400 mb-1">통합관제 · 월간 보고서</p>
                <h2 className="text-lg font-bold text-white">{selected.title}</h2>
                <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1 text-sm">
                  <dt className="text-slate-400">기간</dt>
                  <dd className="text-white tabular-nums">{selected.period}</dd>
                  <dt className="text-slate-400">대상</dt>
                  <dd className="text-white">발전소 {plants.length}개 · 설비 {(capacityTotal / 1000).toFixed(2)} MW</dd>
                  <dt className="text-slate-400">생성일</dt>
                  <dd className="text-white tabular-nums">{selected.createdAt}</dd>
                </dl>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => onPdf(selected)}>
                  <FileText size={14} className="mr-1" /> PDF
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onExcel(selected)}>
                  <Download size={14} className="mr-1" /> Excel
                </Button>
              </div>
            </div>

            {selected.kind === 'generation' ? (
              <>
                {/* 1. 요약 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">1. 요약</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-xs text-slate-400">총 발전량</p>
                      <p className="text-lg font-bold text-white tabular-nums">{genTotal.toLocaleString()} kWh</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-xs text-slate-400">총 발전시간</p>
                      <p className="text-lg font-bold text-white tabular-nums">{hoursTotal.toLocaleString()} h</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-xs text-slate-400">이상</p>
                      <p className="text-lg font-bold text-white tabular-nums">{anomalies.length} 건</p>
                    </div>
                  </div>
                </section>

                {/* 2. 발전소별 실적 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">2. 발전소별 실적</h3>
                  <table className="w-full">
                    <thead className="border-b border-white/[0.06]">
                      <tr>
                        <th className={th}>발전소</th>
                        <th className={cn(th, 'text-right')}>설비용량</th>
                        <th className={cn(th, 'text-right')}>발전량</th>
                        <th className={cn(th, 'text-right')}>발전시간</th>
                        <th className={cn(th, 'text-right')}>이상</th>
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

                {/* 3. 일별 발전량 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">3. 일별 발전량</h3>
                  {dailyRows.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">발전 이력이 없습니다</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full">
                        <thead className="border-b border-white/[0.06] sticky top-0 bg-[#0d1520]">
                          <tr>
                            <th className={th}>일자</th>
                            <th className={cn(th, 'text-right')}>발전량</th>
                            <th className={cn(th, 'text-right')}>발전시간</th>
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
                  )}
                </section>
              </>
            ) : (
              <>
                {/* 1. 요약 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">1. 요약</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-xs text-slate-400">이상</p>
                      <p className="text-lg font-bold text-white tabular-nums">{anomalies.length} 건</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-xs text-slate-400">경고</p>
                      <p className="text-lg font-bold text-white tabular-nums">{warningTotal} 건</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-xs text-slate-400">통신오류</p>
                      <p className="text-lg font-bold text-white tabular-nums">{commErrorTotal} 건</p>
                    </div>
                  </div>
                </section>

                {/* 2. 발전소별 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">2. 발전소별 이상</h3>
                  {anomalyByPlant.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">이 달 이상 감지 내역이 없습니다</p>
                  ) : (
                    <table className="w-full">
                      <thead className="border-b border-white/[0.06]">
                        <tr>
                          <th className={th}>발전소</th>
                          <th className={cn(th, 'text-right')}>경고</th>
                          <th className={cn(th, 'text-right')}>주의</th>
                          <th className={cn(th, 'text-right')}>통신오류</th>
                          <th className={cn(th, 'text-right')}>합계</th>
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

                {/* 3. 이상 목록 */}
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">3. 이상 목록</h3>
                  {anomalies.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">이 달 이상 감지 내역이 없습니다</p>
                  ) : (
                    <table className="w-full">
                      <thead className="border-b border-white/[0.06]">
                        <tr>
                          <th className={th}>시간</th>
                          <th className={th}>발전소</th>
                          <th className={th}>이상유형</th>
                          <th className={th}>등급</th>
                          <th className={th}>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalies.map((a) => {
                          const g = gradeOf(a.severity);
                          const s = commStatusOf(a.status);
                          return (
                            <tr key={a.id} className="border-b border-white/5 align-top">
                              <td className={cn(td, 'text-slate-300 tabular-nums whitespace-nowrap')}>{fmtDateTime(a.detectedAt)}</td>
                              <td className={cn(td, 'text-white whitespace-nowrap')}>{a.plantName}</td>
                              <td className={cn(td, 'text-white')}>{a.title}</td>
                              <td className={td}><StatusPill tone={g.tone} label={g.label} /></td>
                              <td className={td}><StatusPill tone={s.tone} label={s.label} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
