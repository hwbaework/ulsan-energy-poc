'use client';

/**
 * 보고서 2단계 — 선택한 발전소(또는 전체)의 월별 보고서 문서 목록 + 문서 본문 + PDF/Excel.
 * 1단계(발전소 목록)는 reports/page.tsx. 근거: 3차년도 사업계획서 p.42 정기보고, p.139, WBS 1.5.1
 * - 종류 2가지: 발전 실적 · 이상감지. 매월 1건씩 자동 생성
 * - 외부 제출 양식은 없다(내부 보고·검증용)
 */
import { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { isAnomaly, sourceOf } from '@/lib/design';
import { cn } from '@/lib/utils';
import { exportExcel, exportPdf, generateReportHtml, type ReportPreviewDoc, type ReportPreviewSection } from '@/lib/utils';
import * as monitoringApi from '@/api/monitoring/monitoring';
import type { PlantHistoryPoint } from '@/api/monitoring/monitoring';
import { monitoringKeys } from '@/api/queryKeys';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { expandByContract } from '@/lib/contract-plants';
import type { PlantContractKind } from '@/types/monitoring';

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
  const contract = useSearchParams().get('contract') as PlantContractKind | null; // 계약 하나만 볼 때
  const [year, setYear] = useState(THIS_YEAR);
  const [monthFilter, setMonthFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');

  /* 범위: 발전소 하나 */
  const { data: allPlants } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const myPlants = useMemo(() => filterPlantsByOwnership(allPlants ?? [], myPlantMatcher), [allPlants, myPlantMatcher]);
  // 계약 하나 = 항목 하나 — 이름은 "한일튜브(onsite)", 값은 계약 용량 몫(share)
  const plants = useMemo(() => {
    const items = expandByContract(scope === 'all' ? myPlants : myPlants.filter((p) => String(p.plantId) === scope));
    const picked = items.filter((c) => c.contractKind === contract);
    return picked.length > 0 ? picked : items;
  }, [myPlants, scope, contract]);
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
  // 처음부터 맨 위 문서가 열려 있고, 다른 행을 누르면 오른쪽이 그 문서로 바뀐다
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;
  const scopeName = scope === 'all' ? '전체 발전소' : (plants[0]?.displayName ?? '');
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
          energy += d.energy * plant.share; // 계약 용량 몫
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
    historyQueries.forEach((q, i) => {
      const share = plants[i]?.share ?? 1;
      summarizeDays(q.data ?? []).forEach((v, day) => {
        const t = total.get(day);
        if (t) {
          t.energy += v.energy * share;
          t.hours = Math.max(t.hours, v.hours);
        }
      });
    });
    return selected.days.map((d) => ({ day: d, ...total.get(d)! })).filter((r) => r.energy > 0);
  }, [historyQueries, selected]);

  /* 이상감지 집계 — 요약 건수만 */
  const warningTotal = anomalies.filter((a) => a.severity === 'warning').length;
  const commErrorTotal = anomalies.filter((a) => a.status === 'COMM_ERROR').length;

  /* 내보내기 — 선택 문서의 발전소별 표 */
  const exportData = (doc: ReportDoc) => {
    if (doc.kind === 'generation') {
      return {
        file: `${doc.title}${titleSuffix}`,
        sheet: KIND_LABEL.generation,
        headers: ['발전소', '발전원', '설비용량 kW', '발전량 kWh', '발전시간 h', '이상 건수'],
        rows: generationRows.map((r) => [r.plant.displayName, sourceOf(r.plant.type).label, r.plant.capacity, r.energy, r.hours, r.anomalies]),
      };
    }
    // 이상감지 보고서는 요약만 — 건수 집계
    return {
      file: `${doc.title}${titleSuffix}`,
      sheet: KIND_LABEL.anomaly,
      headers: ['항목', '건수'],
      rows: [
        ['이상', anomalies.length],
        ['경고', warningTotal],
        ['주의', anomalies.filter((a) => a.severity === 'caution').length],
        ['통신오류', commErrorTotal],
      ],
    };
  };
  const onPdf = (doc: ReportDoc) => {
    const d = exportData(doc);
    void exportPdf(d.file, `${doc.title}${titleSuffix}`, d.headers, d.rows);
  };
  const onExcel = (doc: ReportDoc) => {
    const d = exportData(doc);
    void exportExcel(d.file, d.sheet, d.headers, d.rows);
  };
  /* 미리보기에 그릴 문서 — PDF·Excel 로 받는 내용과 같은 구성 */
  const previewDoc = useMemo<ReportPreviewDoc | null>(() => {
    if (!selected) return null;
    const cap = capacityTotal >= 1000 ? `${(capacityTotal / 1000).toFixed(2)} MW` : `${capacityTotal.toLocaleString()} kW`;
    const meta: [string, string][] = [
      ['기간', selected.period],
      ['대상', `${scopeLabel} · 설비 ${cap}`],
      ['생성일', selected.createdAt],
    ];
    const title = `${selected.title}${titleSuffix}`;

    // 이상감지 보고서는 요약만 — 개별 이상 목록·편차 수치는 산출 근거가 없어 넣지 않는다
    if (selected.kind === 'anomaly') {
      return {
        title,
        kindLabel: '통합관제 · 이상감지 보고서',
        meta,
        sections: [
          {
            heading: '요약',
            rows: [
              ['이상', `${anomalies.length} 건`],
              ['경고', `${warningTotal} 건`],
              ['주의', `${anomalies.filter((a) => a.severity === 'caution').length} 건`],
              ['통신오류', `${commErrorTotal} 건`],
            ],
          },
        ],
        note: '이상감지 관리에 기록된 이상(등급 주의·경고 또는 통신오류)을 전체 기간으로 집계한 보고서입니다.',
      };
    }

    const sections: ReportPreviewSection[] = [
      {
        heading: '요약',
        rows: [
          ['총 발전량', `${genTotal.toLocaleString()} kWh`],
          ['총 발전시간', `${hoursTotal.toLocaleString()} h`],
          ['이상', `${anomalies.length} 건`],
        ],
      },
    ];
    if (plants.length === 1) {
      const p = plants[0]!;
      sections.push({
        heading: '실적',
        rows: [
          ['발전소', `${p.displayName} (${sourceOf(p.type).label})`],
          ['설비용량', `${p.capacity.toLocaleString()} kW`],
          ['발전량', `${genTotal.toLocaleString()} kWh`],
          ['발전시간', `${hoursTotal} h`],
        ],
      });
    } else {
      sections.push({
        heading: '발전소별 실적',
        headers: ['발전소', '설비용량', '발전량', '발전시간', '이상'],
        rows: [
          ...generationRows.map((r) => [
            `${r.plant.displayName} (${sourceOf(r.plant.type).label})`,
            `${r.plant.capacity.toLocaleString()} kW`,
            `${r.energy.toLocaleString()} kWh`,
            `${r.hours} h`,
            `${r.anomalies} 건`,
          ]),
          ['합계', `${capacityTotal.toLocaleString()} kW`, `${genTotal.toLocaleString()} kWh`, `${hoursTotal} h`, `${anomalies.length} 건`],
        ],
        emphasizeLast: true,
      });
    }
    sections.push({
      heading: '일별 발전량',
      headers: ['일자', '발전량', '발전시간'],
      rows: dailyRows.map((r) => [r.day.replace(/-/g, '.'), `${Math.round(r.energy).toLocaleString()} kWh`, `${r.hours} h`]),
    });

    return {
      title,
      kindLabel: '통합관제 · 월간 보고서',
      meta,
      sections,
      note: '통합관제에서 수집한 발전 이력을 월 단위로 집계한 보고서입니다. 월 마감 후 자동 생성됩니다.',
    };
  }, [selected, capacityTotal, scopeLabel, titleSuffix, anomalies, warningTotal, commErrorTotal, genTotal, hoursTotal, plants, generationRows, dailyRows]);

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-slate-400';
  const td = 'px-4 py-3 text-sm';

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
      </div>

      {/* 목록 왼쪽 · 미리보기 문서 오른쪽 — 창이 좁아도(768px~) 옆에 붙는다 */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:grid-cols-[minmax(0,1fr)_480px] gap-6 items-start">
        {/* 문서 목록 */}
        <SectionCard title="보고서 목록" noPadding className="min-w-0 !h-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <th className={th}>문서</th>
                  <th className={th}>종류</th>
                  <th className={th}>생성일</th>
                  <th className={th}>PDF · Excel</th>
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
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">{hasReport ? '보고서가 없습니다' : '보고서 항목이 아직 정해지지 않았습니다'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* 문서 미리보기 — 실제 문서(종이) 모습 그대로. 행을 누르면 이 자리가 그 문서로 바뀐다 */}
        {selected && previewDoc && (
          <div className="min-w-0 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden md:sticky md:top-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">미리보기</p>
                <p className="truncate text-sm font-semibold text-white">{selected.title}{titleSuffix}</p>
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
            {/* 문서는 iframe 안에서 흰 종이로 — 화면 테마와 섞이지 않는다 */}
            <iframe
              srcDoc={generateReportHtml(previewDoc)}
              title="보고서 미리보기"
              className="w-full bg-white"
              style={{ height: '72vh', minHeight: 560, border: 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
