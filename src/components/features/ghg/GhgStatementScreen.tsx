'use client';

// E-데이터마켓 › 온실가스 인벤토리 › 명세서 (3.1.5)
// 한 달 × 계약 하나 = 명세서 한 장(형태 고정). 한일튜브는 한일튜브(자가소비) · 한일튜브(PPA) 각각.
// 세금계산서 화면과 같은 구성 — 위 연도 · 월 · 기업, 왼쪽 목록(기간 · 기업), 오른쪽 A4 미리보기(PDF 는 미리보기 머리에).
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCompany } from '@/hooks/platform/useCompanies';
import { useEnergySettings } from '@/hooks/common/useSettings';
import { factorSource } from '@/components/features/settings/FactorSettings';
import { sourceOf } from '@/lib/design';
import { GHG_TODAY, YEARS, fmt, fmtT, monthsBetween, totalsOf, yearRange } from '@/lib/ghg-reduction';
import { fitA4, generateGhgStatementHtml, periodText, printGhgStatement, type GhgFormData } from '@/lib/utils/ghgStatementForm';
import { GhgHeader, contractGroups, useGhgRole, useRows } from './GhgScreens';

const cell = (v: string, cls = 'text-slate-300') => <span className={`text-sm ${cls}`}>{v}</span>;
const num = (v: string) => <span className="text-sm tabular-nums text-slate-300">{v}</span>;
const strong = (v: string) => <span className="text-sm font-semibold tabular-nums text-white">{v}</span>;
const arrowBtn =
  'flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white disabled:opacity-30';
const PAPER = { height: '80vh', minHeight: 640, border: 'none' } as const;

export function GhgStatementScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const [year, setYear] = useState(YEARS[0] ?? GHG_TODAY.slice(0, 4));
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const [selKey, setSelKey] = useState<string | null>(null);
  const [y0, y1] = yearRange(year);
  const months = monthsBetween(y0, y1);
  const shiftYear = (by: number) => {
    const y = String(Number(year) + by);
    if (YEARS.includes(y)) {
      setYear(y);
      setMonth('');
    }
  };

  // 계약 단위 — 한일튜브(자가소비) · 한일튜브(PPA) 각각
  const groups = contractGroups(role.facilities);
  // 왼쪽 목록 — 달 × 계약 하나 = 명세서 한 장. 최근 달이 위
  const list = [...months]
    .reverse()
    .filter((m) => !month || m === month)
    .flatMap((m) =>
      groups
        .filter((g) => !q.trim() || g.name.includes(q.trim()))
        .map((g) => {
          const t = totalsOf(rows.filter((r) => r.month === m && g.ids.has(r.facility.id)));
          return { key: `${m}-${g.key}`, month: m, g, kwh: t.kwh, tco2: t.tco2 };
        })
        .filter((x) => x.kwh > 0),
    );
  type L = (typeof list)[number];
  const sel = list.find((x) => x.key === selKey) ?? list[0];
  const cols: Column<L>[] = [
    { key: 'month', header: '기간', width: '110px', sortable: true, sortValue: (x) => x.month, render: (x) => strong(x.month) },
    { key: 'name', header: '기업', render: (x) => cell(x.g.name, 'text-white') },
    { key: 'kwh', header: '발전량 (kWh)', align: 'right', sortable: true, sortValue: (x) => x.kwh, render: (x) => num(fmt(x.kwh)) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', align: 'right', sortable: true, sortValue: (x) => x.tco2, render: (x) => num(fmtT(x.tco2)) },
  ];

  // 미리보기 — 고른 달 · 계약
  const f = sel?.g.fs[0];
  const { data: co } = useCompany(sel?.g.companyId ?? 0);
  const { data: es } = useEnergySettings();
  const form: GhgFormData | null = useMemo(() => {
    if (!sel || !f) return null;
    return {
      month: sel.month,
      writtenAt: GHG_TODAY,
      company: {
        name: co?.name ?? f.company,
        bizNo: co?.businessNumber ?? '',
        representative: co?.representativeName ?? '',
        industry: co?.bizType ?? '',
        address: co?.address ?? f.address,
      },
      facility: {
        name: '태양광 발전설비',
        kind: f.kind,
        source: sourceOf(f.source).label,
        kw: sel.g.fs.reduce((a, x) => a + x.kw, 0),
        startDate: f.startDate,
        kwh: sel.kwh,
        tco2: sel.tco2,
      },
      co2Factor: fx.co2,
      co2Source: factorSource(es, 'CO2_EMISSION_FACTOR'),
    };
  }, [sel, f, co, fx.co2, es]);
  const html = form ? generateGhgStatementHtml(form) : '';

  return (
    <div className="space-y-6">
      <GhgHeader title="명세서" />

      {/* 위 — 연도 · 월(기업은 목록 위 검색) */}
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
      </div>

      {/* 목록 왼쪽 · 문서 오른쪽 — 줄을 누르면 오른쪽 명세서가 그 달 · 계약으로 */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:grid-cols-[minmax(0,1fr)_560px]">
        <SectionCard
          title="명세서"
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
            rowKey={(x) => x.key}
            emptyMessage="명세서 없음"
            onRowClick={(x) => setSelKey(x.key)}
            rowClassName={(x) => (x.key === sel?.key ? '!bg-primary/10' : '')}
          />
        </SectionCard>

        {sel && form && (
          <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">미리보기</p>
                <p className="truncate text-sm font-semibold text-white">
                  {periodText(sel.month).name} 명세서 · {sel.g.name}
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
