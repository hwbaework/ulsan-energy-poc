'use client';

// E-데이터마켓 › 온실가스 인벤토리 › 명세서 (3.1.5)
// 「온실가스 배출권거래제의 배출량 보고 및 인증에 관한 지침」 [별지 제11호 서식] 온실가스 배출량 및 에너지 사용량 명세서.
// 세금계산서 화면과 같은 구성 — 위 연도 · 기업, KPI 4개, 왼쪽 기업 목록, 오른쪽 A4 미리보기(PDF 는 미리보기 머리에).
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCompany } from '@/hooks/platform/useCompanies';
import { GHG_TODAY, YEARS, fmt, fmtT, monthsBetween, pick, totalsOf, yearRange, type Facility } from '@/lib/ghg-reduction';
import {
  fitA4,
  generateGhgStatementHtml,
  printGhgStatement,
  type GhgFormData,
} from '@/lib/utils/ghgStatementForm';
import { GhgHeader, useGhgRole, useRows } from './GhgScreens';

const cell = (v: string, cls = 'text-slate-300') => <span className={`text-sm ${cls}`}>{v}</span>;
const num = (v: string) => <span className="text-sm tabular-nums text-slate-300">{v}</span>;
const strong = (v: string) => <span className="text-sm font-semibold tabular-nums text-white">{v}</span>;
const arrowBtn =
  'flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white disabled:opacity-30';
const PAPER = { height: '80vh', minHeight: 640, border: 'none' } as const;

/** 그 해 설비가 돌아간 시간(h) — 부하율 분모. 가동일 · 해지 달 · 금일까지 */
function hoursOf(f: Facility, from: string, to: string) {
  const start = [`${from}-01`, f.startDate].sort()[1]!;
  const lastDay = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const endMonthDay = f.endMonth
    ? new Date(Date.UTC(Number(f.endMonth.slice(0, 4)), Number(f.endMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)
    : lastDay;
  const end = [lastDay, endMonthDay, GHG_TODAY].sort()[0]!;
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  return Math.max(0, days) * 24;
}

export function GhgStatementScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const [year, setYear] = useState(YEARS[0] ?? GHG_TODAY.slice(0, 4));
  const [company, setCompany] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  // 월 — 전체면 그 해, 고르면 그 달만
  const [month, setMonth] = useState('');
  const [y0, y1] = yearRange(year);
  const months = monthsBetween(y0, y1);
  const [from, to] = month ? [month, month] : [y0, y1];
  const period = month || year;
  const shiftYear = (by: number) => {
    const y = String(Number(year) + by);
    if (YEARS.includes(y)) {
      setYear(y);
      setMonth('');
    }
  };

  const shown = role.companies.filter(
    (c) => (company == null || c.id === company) && (!q.trim() || c.name.includes(q.trim())),
  );
  const yearRows = pick(rows, from, to).filter((r) => shown.some((c) => c.id === r.facility.companyId));
  const t = totalsOf(yearRows);

  // 왼쪽 목록 — 기업(법인) 하나 = 명세서 하나
  const list = shown
    .map((c) => {
      const rs = yearRows.filter((r) => r.facility.companyId === c.id);
      const fs = role.facilities.filter((f) => f.companyId === c.id && rs.some((r) => r.facility.id === f.id));
      return { ...c, fs, sum: totalsOf(rs) };
    })
    .filter((c) => c.fs.length);
  type L = (typeof list)[number];
  const sel = list.find((c) => c.id === selId) ?? list[0];
  const cols: Column<L>[] = [
    { key: 'name', header: '기업', render: (c) => cell(c.name, 'font-medium text-white') },
    { key: 'fs', header: '배출시설', width: '90px', render: (c) => num(`${c.fs.length}개`) },
    { key: 'kw', header: '설비 용량 (kW)', align: 'right', render: (c) => num(fmt(c.fs.reduce((a, f) => a + f.kw, 0), 2)) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', align: 'right', render: (c) => strong(fmtT(c.sum.tco2)) },
  ];

  // 미리보기 — 고른 기업의 별지 제11호 8. 감축실적(사업장명 = 기업명)
  const { data: co } = useCompany(sel?.id ?? 0);
  const form: GhgFormData | null = useMemo(() => {
    if (!sel) return null;
    return {
      year: period,
      company: {
        name: co?.name ?? sel.name,
        bizNo: co?.businessNumber ?? '',
        industry: co?.bizType ?? '',
      },
      facilities: sel.fs.map((f, i) => {
        const s = totalsOf(yearRows.filter((r) => r.facility.id === f.id));
        const h = hoursOf(f, from, to);
        return {
          no: String(i + 1).padStart(2, '0'),
          name: `태양광 발전설비(${f.kind})`,
          kw: f.kw,
          startDate: f.startDate,
          kwh: s.kwh,
          tco2: s.tco2,
          loadRate: h ? (s.kwh / (f.kw * h)) * 100 : 0,
        };
      }),
      co2Factor: fx.co2,
    };
  }, [sel, co, period, yearRows, from, to, fx.co2]);
  const html = form ? generateGhgStatementHtml(form) : '';

  return (
    <div className="space-y-6">
      <GhgHeader title="명세서" />

      {/* 위 — 연도 · 기업 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-4 py-3 ring-1 ring-white/[0.06]">
        <span className="text-sm text-slate-400">연도</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="전년" onClick={() => shiftYear(-1)} disabled={!YEARS.includes(String(Number(year) - 1))} className={arrowBtn}>
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[72px] text-center text-base font-semibold tabular-nums text-white">{year}년</span>
          <button type="button" aria-label="내년" onClick={() => shiftYear(1)} disabled={!YEARS.includes(String(Number(year) + 1))} className={arrowBtn}>
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="ml-2 text-sm text-slate-400">월</span>
        <div className="w-28">
          <Select
            options={[{ value: '', label: '전체' }, ...[...months].reverse().map((m) => ({ value: m, label: `${Number(m.slice(5))}월` }))]}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        {role.isAdmin && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-400">기업</span>
            <div className="w-52">
              <Select
                options={[{ value: '', label: '전체' }, ...role.companies.map((c) => ({ value: String(c.id), label: c.name }))]}
                value={company == null ? '' : String(company)}
                onChange={(e) => setCompany(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        )}
      </div>

      <StatsGrid columns={4}>
        <StatCard label="자가소비 발전량" value={`${fmt(t.mwh, 1)} MWh`} />
        <StatCard label="감축량" value={`${fmtT(t.tco2)} tCO₂eq`} />
        <StatCard label="소나무 식재" value={`${fmt(t.pine)} 그루`} />
        <StatCard label="화석에너지 대체" value={`${fmtT(t.toe)} TOE`} />
      </StatsGrid>

      {/* 목록 왼쪽 · 문서 오른쪽 — 줄을 누르면 오른쪽 명세서가 그 기업으로 */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:grid-cols-[minmax(0,1fr)_560px]">
        <SectionCard
          title={`명세서 (${list.length})`}
          actions={
            role.isAdmin ? (
              <div className="relative w-64">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
              </div>
            ) : undefined
          }
          noPadding
          className="min-w-0 !h-auto"
        >
          <DataTable
            columns={cols}
            data={list}
            rowKey={(c) => c.id}
            emptyMessage="명세서 없음"
            onRowClick={(c) => setSelId(c.id)}
            rowClassName={(c) => (c.id === sel?.id ? '!bg-primary/10' : '')}
          />
        </SectionCard>

        {sel && form && (
          <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">미리보기</p>
                <p className="truncate text-sm font-semibold text-white">
                  {period} 명세서 · {sel.name}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => printGhgStatement(html)}>
                  <FileText size={14} className="mr-1" /> PDF
                </Button>
              </div>
            </div>
            {/* 문서는 iframe 안에서 흰 종이로 — 화면 테마와 섞이지 않는다 */}
            <iframe srcDoc={fitA4(html)} title="명세서 미리보기" className="w-full bg-white" style={PAPER} />
          </div>
        )}
      </div>
    </div>
  );
}
