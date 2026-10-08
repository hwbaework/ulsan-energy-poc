'use client';

// E-데이터마켓 › 온실가스 인벤토리 — 태양광으로 줄인 탄소(감축량)만.
// 입력 없음: 발전 데이터를 가져와 보여 주고 내려받기만. 관리자는 전체 기업(기업별로 나눠), 기업 계정은 자기 회사만.
// 메뉴 이름은 그대로(배출시설 정보 · 배출원 등록 · 배출계수 관리 · 배출량 산정 · 명세서 · 보고서), 내용만 감축량 기준.

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, FileText, Settings } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { RmsBarChart, RmsPieChart } from '@/components/ui/Chart';
import { getPersona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  COMPANIES,
  FACILITIES,
  FIRST_MONTH,
  LAST_MONTH,
  YEARS,
  fmt,
  fmtT,
  monthsBetween,
  pick,
  reductionRows,
  totalsOf,
  useGhgFactorValues,
  yearRange,
  type Facility,
  type GhgFactors,
  type ReductionRow,
} from '@/lib/ghg-reduction';
import {
  exportGhgReportPdf,
  exportGhgStatementExcel,
  exportGhgStatementPdf,
  type GhgDocData,
} from '@/lib/utils/exportGhgReduction';

/* ── 공통 ── */
const ENERGY_SETTINGS = '/platform/energy-settings';
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`whitespace-nowrap text-sm ${cls}`}>{v}</span>;
const num = (v: ReactNode) => <span className="whitespace-nowrap text-sm tabular-nums text-slate-300">{v}</span>;
const strong = (v: ReactNode) => (
  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white">{v}</span>
);
const ALL_MONTHS = monthsBetween(FIRST_MONTH, LAST_MONTH);
const MONTH_OPTIONS = ALL_MONTHS.map((m) => ({ value: m, label: m }));
const YEAR_OPTIONS = YEARS.map((y) => ({ value: y, label: `${y}년` }));
const kindBadge = (f: Facility) => <Badge variant={f.kind === 'onsite' ? 'info' : 'default'}>{f.kind}</Badge>;

/** 화면 제목 — E-데이터마켓 › 온실가스 인벤토리 › 화면 */
function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'E-데이터마켓', path: '/e-data/inventory' }, { label: '온실가스 인벤토리' }, { label: title }]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function Info({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-sm text-slate-400">{label}</p>
      <p className="break-words text-base text-white">{value === undefined || value === '' ? ' ' : value}</p>
    </div>
  );
}

/** 역할 — 관리자(플랫폼 · SPC)는 전체 기업, 그 밖의 계정은 자기 회사만 */
export function useGhgRole() {
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const isAdmin = persona === 'admin' || persona === 'spc';
  const myId = user?.companyId ?? 0;
  /** 이 계정이 볼 수 있는 기업 */
  const companies = isAdmin ? COMPANIES : COMPANIES.filter((c) => c.id === myId);
  return { isAdmin, myId, companies, myName: user?.companyName ?? '' };
}
export type Role = ReturnType<typeof useGhgRole>;

/** 산정 줄 전체 — 계수가 바뀌면(에너지 설정) 다시 계산 */
export function useRows() {
  const fx = useGhgFactorValues();
  const rows = useMemo(() => reductionRows(fx), [fx.co2, fx.toe, fx.pine]); // eslint-disable-line react-hooks/exhaustive-deps
  return { fx, rows };
}

/** 기업 셀렉트 — 관리자만(전체 + 기업마다). 기업 계정은 자기 회사로 고정 */
function CompanySelect({ role, value, onChange }: { role: Role; value: number | null; onChange: (v: number | null) => void }) {
  if (!role.isAdmin) return null;
  return (
    <div className="w-48">
      <Select
        options={[{ value: '', label: '전체 기업' }, ...role.companies.map((c) => ({ value: String(c.id), label: c.name }))]}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </div>
  );
}

/** 기간 — 시작 달 ~ 종료 달을 직접 고른다 */
export function MonthRange({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">기간</span>
      <div className="w-32">
        <Select options={MONTH_OPTIONS.filter((o) => o.value <= to)} value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <span className="text-slate-500">~</span>
      <div className="w-32">
        <Select options={MONTH_OPTIONS.filter((o) => o.value >= from)} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
    </div>
  );
}

/** 처음 기간 — 올해 첫 달 ~ 마지막 달 */
export function useMonthRange() {
  const [y0, y1] = yearRange(LAST_MONTH.slice(0, 4));
  const [from, setFrom] = useState(y0);
  const [to, setTo] = useState(y1);
  return { from, to, setFrom, setTo };
}

/** 기업 하나의 범위 — 관리자가 고른 기업 / 기업 계정은 자기 회사 */
const scopeOf = (role: Role, chosen: number | null) => (role.isAdmin ? chosen : role.myId);

/** 기업별 합계 */
function byCompany(rows: ReductionRow[], companies: { id: number; name: string }[]) {
  return companies.map((c) => {
    const rs = rows.filter((r) => r.facility.companyId === c.id);
    const kw = FACILITIES.filter((f) => f.companyId === c.id).reduce((a, f) => a + f.kw, 0);
    return { id: c.id, company: c.name, kw: Math.round(kw * 100) / 100, ...totalsOf(rs) };
  });
}
/** 월별 합계 */
function byMonth(rows: ReductionRow[], months: string[]) {
  return months.map((m) => ({ month: m, ...totalsOf(rows.filter((r) => r.month === m)) }));
}

/** 명세서 · 보고서 문서 데이터 */
function docData(
  rows: ReductionRow[],
  fx: GhgFactors,
  from: string,
  to: string,
  target: { id: number; name: string; address: string } | null,
  companies: { id: number; name: string }[],
): GhgDocData {
  return {
    target: target?.name ?? '전체 기업',
    address: target?.address,
    from,
    to,
    lines: rows.map((r) => ({
      company: r.facility.company,
      kind: r.facility.kind,
      month: r.month,
      kw: r.facility.kw,
      kwh: r.kwh,
      tco2: r.tco2,
      toe: r.toe,
      pine: r.pine,
    })),
    sum: totalsOf(rows),
    factors: fx,
    byCompany: target ? undefined : byCompany(rows, companies),
    byMonth: byMonth(rows, monthsBetween(from, to)),
  };
}

/* ══ 3.1.1 배출시설 정보 — 감축 현황 ══ */
export function GhgOverviewScreen() {
  const role = useGhgRole();
  const { rows } = useRows();
  const range = useMonthRange();
  const [company, setCompany] = useState<number | null>(null);
  const me = scopeOf(role, company);
  const picked = pick(rows, range.from, range.to, me);
  const t = totalsOf(picked);
  const months = monthsBetween(range.from, range.to);
  const shown = me == null ? role.companies : role.companies.filter((c) => c.id === me);
  const perCompany = byCompany(picked, shown);
  const kw = FACILITIES.filter((f) => shown.some((c) => c.id === f.companyId)).reduce((a, f) => a + f.kw, 0);

  // 월별 감축량 — 전체면 기업마다 쌓고, 하나면 설비마다
  const groups =
    me == null
      ? shown.map((c) => ({ key: `c${c.id}`, name: c.name, match: (r: ReductionRow) => r.facility.companyId === c.id }))
      : FACILITIES.filter((f) => f.companyId === me).map((f) => ({
          key: `f${f.id}`,
          name: `${f.company} ${f.kind}`,
          match: (r: ReductionRow) => r.facility.id === f.id,
        }));
  const chart = months.map((m) => {
    const inM = picked.filter((r) => r.month === m);
    return {
      month: m.slice(2),
      ...Object.fromEntries(groups.map((g) => [g.key, Math.round(totalsOf(inM.filter(g.match)).tco2 * 100) / 100])),
    };
  });

  const cols: Column<(typeof perCompany)[number]>[] = [
    { key: 'company', header: '기업', render: (c) => cell(c.company, 'font-medium text-white') },
    { key: 'kw', header: '설비 용량 (kW)', align: 'right', render: (c) => num(fmt(c.kw, 2)) },
    { key: 'kwh', header: '발전량 (kWh)', align: 'right', sortable: true, sortValue: (c) => c.kwh, render: (c) => num(fmt(c.kwh)) },
    {
      key: 'tco2',
      header: '감축량 (tCO₂eq)',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.tco2,
      render: (c) => strong(fmtT(c.tco2)),
    },
    { key: 'toe', header: '화석에너지 대체 (TOE)', align: 'right', render: (c) => num(fmtT(c.toe)) },
    { key: 'pine', header: '소나무 식재 (그루)', align: 'right', render: (c) => num(fmt(c.pine)) },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="배출시설 정보"
        actions={
          <>
            <MonthRange {...range} />
            <CompanySelect role={role} value={company} onChange={setCompany} />
          </>
        }
      />
      <StatsGrid columns={4}>
        <StatCard label="감축량" value={`${fmtT(t.tco2)} tCO₂eq`} />
        <StatCard label="자가소비 발전량" value={`${fmt(t.mwh, 1)} MWh`} sub={`설비 용량 ${fmt(kw, 2)} kW`} />
        <StatCard label="화석에너지 대체" value={`${fmtT(t.toe)} TOE`} />
        <StatCard label="소나무 식재" value={`${fmt(t.pine)} 그루`} />
      </StatsGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="월별 감축량" className="lg:col-span-2">
          <RmsBarChart
            data={chart}
            xKey="month"
            bars={groups.map((g) => ({ key: g.key, name: g.name }))}
            stacked
            height={280}
          />
        </SectionCard>
        <SectionCard title={me == null ? '기업별 감축량' : '설비별 감축량'}>
          <RmsPieChart
            donut
            height={280}
            data={groups.map((g) => ({ name: g.name, value: Math.round(totalsOf(picked.filter(g.match)).tco2 * 100) / 100 }))}
          />
        </SectionCard>
      </div>

      <SectionCard title={`기업별 감축 실적 (${perCompany.length})`}>
        <DataTable
          data={perCompany}
          columns={cols}
          rowKey={(c) => c.id}
          defaultSort={{ key: 'tco2', direction: 'desc' }}
        />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.2 배출원 등록 — 감축 설비(태양광). 설비는 계약에서 자동으로 들어온다 ══ */
export function GhgSourcesScreen() {
  const role = useGhgRole();
  const { rows } = useRows();
  const [company, setCompany] = useState<number | null>(null);
  const me = scopeOf(role, company);
  const list = FACILITIES.filter((f) => role.companies.some((c) => c.id === f.companyId) && (me == null || f.companyId === me));
  const kw = list.reduce((a, f) => a + f.kw, 0);
  const lastOf = (f: Facility) => rows.filter((r) => r.facility.id === f.id && r.month === LAST_MONTH);

  const cols: Column<Facility>[] = [
    { key: 'company', header: '기업명', render: (f) => cell(f.company, 'font-medium text-white') },
    { key: 'address', header: '기업 주소', render: (f) => cell(f.address) },
    { key: 'name', header: '배출원', render: () => cell('태양광 발전설비') },
    { key: 'kind', header: '설비 구분', render: kindBadge },
    { key: 'scope', header: 'Scope', render: () => cell('Scope 2 · 전기') },
    { key: 'kw', header: '설비 용량 (kW)', align: 'right', sortable: true, sortValue: (f) => f.kw, render: (f) => num(fmt(f.kw, 2)) },
    { key: 'from', header: '수집 시작', render: () => num(FIRST_MONTH) },
    {
      key: 'last',
      header: `최근 발전량 (kWh)`,
      align: 'right',
      render: (f) => num(fmt(lastOf(f).reduce((a, r) => a + r.kwh, 0))),
    },
    { key: 'input', header: '입력방식', render: () => cell('연동') },
  ];

  return (
    <div className="space-y-6">
      <Header title="배출원 등록" actions={<CompanySelect role={role} value={company} onChange={setCompany} />} />
      <StatsGrid columns={3}>
        <StatCard label="배출원" value={`${list.length}개`} />
        <StatCard label="설비 용량" value={`${fmt(kw, 2)} kW`} />
        <StatCard label="기업" value={`${new Set(list.map((f) => f.companyId)).size}곳`} />
      </StatsGrid>
      <SectionCard title={`배출원 목록 (${list.length})`}>
        <DataTable data={list} columns={cols} rowKey={(f) => f.id} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.3 배출계수 관리 — 관리 › 에너지 설정 값을 그대로 보여 준다(값은 거기서만 바꾼다) ══ */
export function GhgFactorsScreen() {
  const role = useGhgRole();
  const fx = useGhgFactorValues();
  const list = [
    {
      key: 'co2',
      name: '전력 배출계수',
      value: String(fx.co2),
      unit: 'tCO₂eq/MWh',
      use: '감축량 = 발전량(MWh) × 계수',
      basis: `${fx.year}년 기준 · ${fx.published} 공표 (국가 전력 배출계수)`,
    },
    {
      key: 'toe',
      name: '화석에너지 대체',
      value: String(fx.toe),
      unit: 'TOE/MWh',
      use: '화석에너지 대체 = 발전량(MWh) × 계수',
      basis: '전력 1MWh당 석유환산톤',
    },
    {
      key: 'pine',
      name: '소나무 식재',
      value: String(fx.pine),
      unit: '그루/tCO₂',
      use: '소나무 식재 = 감축량(tCO₂eq) × 계수',
      basis: '20년생 소나무 연간 흡수량 기준',
    },
  ];
  type F = (typeof list)[number];
  const cols: Column<F>[] = [
    { key: 'name', header: '계수', render: (f) => cell(f.name, 'font-medium text-white') },
    { key: 'value', header: '값', align: 'right', render: (f) => strong(f.value) },
    { key: 'unit', header: '단위', render: (f) => cell(f.unit) },
    { key: 'use', header: '산식', render: (f) => cell(f.use) },
    { key: 'basis', header: '기준', render: (f) => cell(f.basis, 'text-slate-400') },
  ];
  return (
    <div className="space-y-6">
      <Header
        title="배출계수 관리"
        actions={
          role.isAdmin && (
            <Link href={ENERGY_SETTINGS}>
              <Button variant="secondary" size="sm">
                <Settings size={15} /> 에너지 설정
              </Button>
            </Link>
          )
        }
      />
      <StatsGrid columns={3}>
        <StatCard label="전력 배출계수" value={`${fx.co2} tCO₂eq/MWh`} sub={`${fx.year}년 기준`} />
        <StatCard label="화석에너지 대체" value={`${fx.toe} TOE/MWh`} />
        <StatCard label="소나무 식재" value={`${fx.pine} 그루/tCO₂`} />
      </StatsGrid>
      <SectionCard title={`배출계수 (${list.length})`}>
        <DataTable data={list} columns={cols} rowKey={(f) => f.key} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.4 배출량 산정 — 연도 · 기업을 고르면 월마다 발전량 × 계수 = 감축량 ══ */
export function GhgCalculationScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const [year, setYear] = useState(LAST_MONTH.slice(0, 4));
  const [company, setCompany] = useState<number | null>(null);
  const me = scopeOf(role, company);
  const [from, to] = yearRange(year);
  const months = monthsBetween(from, to);
  const picked = pick(rows, from, to, me).filter((r) => role.companies.some((c) => c.id === r.facility.companyId));
  const t = totalsOf(picked);
  const monthly = byMonth(picked, months);
  const shown = me == null ? role.companies : role.companies.filter((c) => c.id === me);

  // 설비 × 1월 ~ 12월 감축량
  const facilities = FACILITIES.filter((f) => shown.some((c) => c.id === f.companyId));
  const matrix = facilities.map((f) => {
    const rs = picked.filter((r) => r.facility.id === f.id);
    return { f, byM: Object.fromEntries(rs.map((r) => [r.month, r.tco2])), sum: totalsOf(rs) };
  });
  type M = (typeof matrix)[number];
  const matrixCols: Column<M>[] = [
    { key: 'company', header: '기업명', render: (x) => cell(x.f.company, 'font-medium text-white') },
    { key: 'kind', header: '설비 구분', render: (x) => kindBadge(x.f) },
    { key: 'kw', header: '용량 (kW)', align: 'right', render: (x) => num(fmt(x.f.kw, 2)) },
    ...months.map((m) => ({
      key: m,
      header: `${Number(m.slice(5))}월`,
      align: 'right' as const,
      render: (x: M) => num(x.byM[m] == null ? '' : fmtT(x.byM[m])),
    })),
    { key: 'sum', header: '합계', align: 'right', render: (x) => strong(fmtT(x.sum.tco2)) },
  ];

  type Mo = (typeof monthly)[number];
  const monthCols: Column<Mo>[] = [
    { key: 'month', header: '월', render: (m) => num(m.month) },
    { key: 'kwh', header: '발전량 (kWh)', align: 'right', render: (m) => num(fmt(m.kwh)) },
    { key: 'mwh', header: '발전량 (MWh)', align: 'right', render: (m) => num(fmt(m.mwh, 3)) },
    { key: 'f', header: '배출계수 (tCO₂eq/MWh)', align: 'right', render: () => num(fx.co2) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', align: 'right', render: (m) => strong(fmtT(m.tco2)) },
    { key: 'toe', header: '화석에너지 대체 (TOE)', align: 'right', render: (m) => num(fmtT(m.toe)) },
    { key: 'pine', header: '소나무 식재 (그루)', align: 'right', render: (m) => num(fmt(m.pine)) },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="배출량 산정"
        actions={
          <>
            <div className="w-32">
              <Select options={YEAR_OPTIONS} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <CompanySelect role={role} value={company} onChange={setCompany} />
          </>
        }
      />
      <StatsGrid columns={4}>
        <StatCard label="감축량" value={`${fmtT(t.tco2)} tCO₂eq`} />
        <StatCard label="자가소비 발전량" value={`${fmt(t.mwh, 1)} MWh`} />
        <StatCard label="배출계수" value={`${fx.co2} tCO₂eq/MWh`} />
        <StatCard label="산정 기간" value={`${from} ~ ${to}`} />
      </StatsGrid>
      <SectionCard title={`설비별 월 감축량 (${matrix.length})`}>
        <div className="overflow-x-auto" data-table>
          <DataTable data={matrix} columns={matrixCols} rowKey={(x) => x.f.id} />
        </div>
      </SectionCard>
      <SectionCard title={`월별 산정 (${monthly.length})`}>
        <DataTable data={monthly} columns={monthCols} rowKey={(m) => m.month} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.5 명세서 — 산정값 그대로. 기업 · 설비 · 월마다 한 줄, PDF · Excel 내려받기 ══ */
export function GhgStatementScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const toast = useToastStore((s) => s.add);
  const [year, setYear] = useState(LAST_MONTH.slice(0, 4));
  const [company, setCompany] = useState<number | null>(null);
  const me = scopeOf(role, company);
  const [from, to] = yearRange(year);
  const picked = pick(rows, from, to, me).filter((r) => role.companies.some((c) => c.id === r.facility.companyId));
  const t = totalsOf(picked);
  const target = me == null ? null : (COMPANIES.find((c) => c.id === me) ?? null);
  const data = docData(picked, fx, from, to, target, role.companies);
  const fileBase = `온실가스_감축실적_명세서_${target?.name ?? '전체기업'}_${year}`;
  const run = async (kind: 'pdf' | 'xlsx') => {
    try {
      if (kind === 'pdf') await exportGhgStatementPdf(fileBase, data);
      else await exportGhgStatementExcel(fileBase, data);
    } catch {
      toast('error', '내려받기에 실패했습니다');
    }
  };

  const cols: Column<ReductionRow>[] = [
    { key: 'company', header: '기업명', render: (r) => cell(r.facility.company, 'font-medium text-white') },
    { key: 'kind', header: '설비 구분', render: (r) => kindBadge(r.facility) },
    { key: 'month', header: '월', render: (r) => num(r.month) },
    { key: 'kw', header: '설비 용량 (kW)', align: 'right', render: (r) => num(fmt(r.facility.kw, 2)) },
    { key: 'kwh', header: '발전량 (kWh)', align: 'right', render: (r) => num(fmt(r.kwh)) },
    { key: 'f', header: '배출계수', align: 'right', render: () => num(fx.co2) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', align: 'right', render: (r) => strong(fmt(r.tco2, 3)) },
    { key: 'toe', header: '화석에너지 대체 (TOE)', align: 'right', render: (r) => num(fmt(r.toe, 3)) },
    { key: 'pine', header: '소나무 식재 (그루)', align: 'right', render: (r) => num(fmt(r.pine, 1)) },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="명세서"
        actions={
          <>
            <div className="w-32">
              <Select options={YEAR_OPTIONS} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <CompanySelect role={role} value={company} onChange={setCompany} />
            <Button variant="secondary" size="sm" onClick={() => void run('xlsx')}>
              <FileSpreadsheet size={15} /> Excel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void run('pdf')}>
              <Download size={15} /> PDF
            </Button>
          </>
        }
      />
      <SectionCard title="감축 실적 명세서">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="대상" value={target?.name ?? `전체 기업 (${role.companies.length}곳)`} />
          <Info label="기업 주소" value={target?.address} />
          <Info label="기간" value={`${from} ~ ${to}`} />
          <Info label="배출계수" value={`${fx.co2} tCO₂eq/MWh (${fx.year}년 기준)`} />
          <Info label="감축량" value={`${fmtT(t.tco2)} tCO₂eq`} />
          <Info label="자가소비 발전량" value={`${fmt(t.kwh)} kWh`} />
          <Info label="화석에너지 대체" value={`${fmtT(t.toe)} TOE`} />
          <Info label="소나무 식재" value={`${fmt(t.pine)} 그루`} />
        </div>
      </SectionCard>
      <SectionCard title={`명세 (${picked.length})`}>
        <DataTable data={picked} columns={cols} rowKey={(r) => r.key} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.6 보고서 — ① 유형 ② 기간 · 기업 ③ 확인 → 보고서(미리보기 + PDF) ══ */
const REPORT_STEPS = ['유형', '기간 · 기업', '보고서'];

function ReportSteps({ at }: { at: number }) {
  return (
    <div className="flex items-center gap-2">
      {REPORT_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`flex h-7 items-center rounded-full px-3 text-sm ${
              i === at
                ? 'bg-primary text-white'
                : i < at
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-white/[0.04] text-slate-400'
            }`}
          >
            {i + 1}. {s}
          </span>
          {i < REPORT_STEPS.length - 1 && <span className="h-px w-6 bg-white/[0.1]" />}
        </div>
      ))}
    </div>
  );
}

export function GhgReportScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const toast = useToastStore((s) => s.add);
  const [step, setStep] = useState(0);
  const range = useMonthRange();
  const [company, setCompany] = useState<number | null>(null);
  const me = scopeOf(role, company);
  const picked = pick(rows, range.from, range.to, me).filter((r) => role.companies.some((c) => c.id === r.facility.companyId));
  const target = me == null ? null : (COMPANIES.find((c) => c.id === me) ?? null);
  const data = docData(picked, fx, range.from, range.to, target, role.companies);
  const download = async () => {
    try {
      await exportGhgReportPdf(`온실가스_감축실적_보고서_${data.target}_${range.from}_${range.to}`, data);
    } catch {
      toast('error', '내려받기에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title="보고서"
        actions={
          step === 2 && (
            <Button variant="primary" size="sm" onClick={() => void download()}>
              <Download size={15} /> PDF
            </Button>
          )
        }
      />
      <ReportSteps at={step} />

      {step === 0 && (
        <div className="max-w-md rounded-xl bg-[#0d1520] p-6 ring-1 ring-primary/40">
          <p className="flex items-center gap-2 text-lg font-semibold text-sky-300">
            <FileText size={18} /> 감축 실적 보고서
          </p>
          <p className="mt-2 text-sm text-slate-300">태양광 자가소비로 줄인 탄소를 기간 · 기업별로 정리한 보고서</p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
            <li>· 감축량 · 자가소비 발전량 · 화석에너지 대체 · 소나무 식재 요약</li>
            <li>· 월별 감축량 그래프 · 기업별 · 월별 실적 표</li>
            <li>· 산정 기준(배출계수 · 산식) · PDF 내려받기</li>
          </ul>
          <Button variant="primary" className="mt-5 w-full" onClick={() => setStep(1)}>
            선택 <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {step === 1 && (
        <SectionCard title="기간 · 기업">
          <div className="flex flex-wrap items-center gap-4">
            <MonthRange {...range} />
            {role.isAdmin ? (
              <CompanySelect role={role} value={company} onChange={setCompany} />
            ) : (
              <span className="text-sm text-slate-300">기업 · {role.myName}</span>
            )}
          </div>
          <div className="mt-6 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep(0)}>
              <ArrowLeft size={15} /> 이전
            </Button>
            <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={picked.length === 0}>
              보고서 만들기 <ArrowRight size={15} />
            </Button>
          </div>
        </SectionCard>
      )}

      {step === 2 && (
        <>
          <ReportPreview data={data} />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> 이전
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** 보고서 미리보기 — PDF와 같은 순서(요약 → 월별 → 기업별 → 월별 표 → 산정 기준) */
function ReportPreview({ data }: { data: GhgDocData }) {
  const s = data.sum;
  type Co = NonNullable<GhgDocData['byCompany']>[number];
  type Mo = GhgDocData['byMonth'][number];
  const coCols: Column<Co>[] = [
    { key: 'company', header: '기업명', render: (c) => cell(c.company, 'font-medium text-white') },
    { key: 'kw', header: '설비 용량 (kW)', align: 'right', render: (c) => num(fmt(c.kw, 2)) },
    { key: 'kwh', header: '발전량 (kWh)', align: 'right', render: (c) => num(fmt(c.kwh)) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', align: 'right', render: (c) => strong(fmt(c.tco2, 3)) },
    { key: 'toe', header: '화석에너지 대체 (TOE)', align: 'right', render: (c) => num(fmt(c.toe, 3)) },
    { key: 'pine', header: '소나무 식재 (그루)', align: 'right', render: (c) => num(fmt(c.pine)) },
    {
      key: 'share',
      header: '비중',
      align: 'right',
      render: (c) => num(`${fmt(s.tco2 ? (c.tco2 / s.tco2) * 100 : 0, 1)}%`),
    },
  ];
  const moCols: Column<Mo>[] = [
    { key: 'month', header: '월', render: (m) => num(m.month) },
    { key: 'kwh', header: '발전량 (kWh)', align: 'right', render: (m) => num(fmt(m.kwh)) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', align: 'right', render: (m) => strong(fmt(m.tco2, 3)) },
    { key: 'toe', header: '화석에너지 대체 (TOE)', align: 'right', render: (m) => num(fmt(m.toe, 3)) },
    { key: 'pine', header: '소나무 식재 (그루)', align: 'right', render: (m) => num(fmt(m.pine)) },
  ];
  return (
    <div className="space-y-6">
      <SectionCard title="온실가스 감축 실적 보고서">
        <div className="grid gap-5 sm:grid-cols-3">
          <Info label="대상" value={data.target} />
          <Info label="기간" value={`${data.from} ~ ${data.to}`} />
          <Info label="배출계수" value={`${data.factors.co2} tCO₂eq/MWh (${data.factors.year}년 기준)`} />
        </div>
      </SectionCard>
      <StatsGrid columns={4}>
        <StatCard label="감축량" value={`${fmtT(s.tco2)} tCO₂eq`} />
        <StatCard label="자가소비 발전량" value={`${fmt(s.kwh / 1000, 1)} MWh`} />
        <StatCard label="화석에너지 대체" value={`${fmtT(s.toe)} TOE`} />
        <StatCard label="소나무 식재" value={`${fmt(s.pine)} 그루`} />
      </StatsGrid>
      <SectionCard title="월별 감축량">
        <RmsBarChart
          data={data.byMonth.map((m) => ({ month: m.month.slice(2), tco2: Math.round(m.tco2 * 100) / 100 }))}
          xKey="month"
          bars={[{ key: 'tco2', name: '감축량 (tCO₂eq)', color: '#F59E0B' }]}
          height={260}
        />
      </SectionCard>
      {data.byCompany && (
        <SectionCard title={`기업별 감축 실적 (${data.byCompany.length})`}>
          <DataTable data={data.byCompany} columns={coCols} rowKey={(c) => c.company} />
        </SectionCard>
      )}
      <SectionCard title={`월별 감축 실적 (${data.byMonth.length})`}>
        <DataTable data={data.byMonth} columns={moCols} rowKey={(m) => m.month} />
      </SectionCard>
      <SectionCard title="산정 기준">
        <ul className="space-y-1.5 text-sm text-slate-300">
          <li>감축량 (tCO₂eq) = 태양광 자가소비 발전량 (MWh) × 전력 배출계수 {data.factors.co2}</li>
          <li>화석에너지 대체 (TOE) = 발전량 (MWh) × {data.factors.toe}</li>
          <li>소나무 식재 (그루) = 감축량 (tCO₂eq) × {data.factors.pine} (20년생)</li>
          <li>
            전력 배출계수 {data.factors.year}년 기준 · {data.factors.published} 공표
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
