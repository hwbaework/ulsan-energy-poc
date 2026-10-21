'use client';

// E-데이터마켓 › 온실가스 인벤토리 — 태양광으로 줄인 탄소(감축량)만.
// 입력 없음: 발전 데이터를 가져와 보여 주고 내려받기만. 관리자는 전체 기업(기업별로 나눠), 기업 계정은 자기 회사만.
// 메뉴 이름은 그대로(배출시설 정보 · 배출원 등록 · 배출계수 관리 · 배출량 산정 · 명세서 · 보고서), 내용만 감축량 기준.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Settings,
} from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { CATEGORY_SCOPE, GHG_FACTORS, GWP, combined, tco2PerUnit, type GhgFactor } from '@/lib/ghg-factors';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { RmsBarChart, RmsLineChart } from '@/components/ui/Chart';
import { getPersona } from '@/lib/persona';
import { sourceOf } from '@/lib/design';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  FIRST_MONTH,
  LAST_MONTH,
  YEARS,
  fmt,
  fmtT,
  GHG_TODAY,
  TODAY_MONTH,
  monthsBetween,
  reductionDays,
  companiesOf,
  pick,
  reductionRows,
  totalsOf,
  useFacilities,
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
const kindBadge = (f: Facility) => <Badge variant={f.kind === 'PPA' ? 'info' : 'default'}>{f.kind}</Badge>;

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
  /** 배출원 = 전력거래 체결 계약의 설비 */
  const all = useFacilities();
  const facilities = isAdmin ? all : all.filter((f) => f.companyId === myId);
  /** 이 계정이 볼 수 있는 기업 */
  const companies = companiesOf(facilities);
  return { isAdmin, persona, myId, companies, facilities, myName: user?.companyName ?? '' };
}
export type Role = ReturnType<typeof useGhgRole>;

/** 산정 줄 전체 — 계수가 바뀌면(에너지 설정) 다시 계산 */
export function useRows() {
  const fx = useGhgFactorValues();
  const facilities = useFacilities();
  const rows = useMemo(() => reductionRows(fx, facilities), [fx.co2, fx.toe, fx.pine, facilities]); // eslint-disable-line react-hooks/exhaustive-deps
  return { fx, rows };
}

/** 기업 셀렉트 — 관리자만(전체 + 기업마다). 기업 계정은 자기 회사로 고정 */
function CompanySelect({
  role,
  value,
  onChange,
}: {
  role: Role;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  if (!role.isAdmin) return null;
  return (
    <div className="w-48">
      <Select
        options={[
          { value: '', label: '전체 기업' },
          ...role.companies.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
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
        <Select
          options={MONTH_OPTIONS.filter((o) => o.value <= to)}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <span className="text-slate-500">~</span>
      <div className="w-32">
        <Select
          options={MONTH_OPTIONS.filter((o) => o.value >= from)}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
    </div>
  );
}

/** 처음 기간 — 금년 첫 달 ~ 마지막 달 */
export function useMonthRange() {
  const [y0, y1] = yearRange(LAST_MONTH.slice(0, 4));
  const [from, setFrom] = useState(y0);
  const [to, setTo] = useState(y1);
  return { from, to, setFrom, setTo };
}

/** 기업 하나의 범위 — 관리자가 고른 기업 / 기업 계정은 자기 회사 */
const scopeOf = (role: Role, chosen: number | null) => (role.isAdmin ? chosen : role.myId);

/** 기업별 합계 */
function byCompany(rows: ReductionRow[], companies: { id: number; name: string }[], facilities: Facility[]) {
  return companies.map((c) => {
    const rs = rows.filter((r) => r.facility.companyId === c.id);
    const kw = facilities.filter((f) => f.companyId === c.id).reduce((a, f) => a + f.kw, 0);
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
  facilities: Facility[],
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
    byCompany: target ? undefined : byCompany(rows, companies, facilities),
    byMonth: byMonth(rows, monthsBetween(from, to)),
  };
}

/* ══ 3.1.1 배출시설 정보 — 통합관제처럼 현황. 위 카드 4개는 고정(설비 용량 · 금년 · 금월 · 금일 감축량),
 *    아래 그래프는 회사 하나(관리자는 회사 셀렉트, 기업은 자기 회사) · 일 / 월, 안쪽 카드 3개는 그래프 기간을 따라 ══ */
type GhgUnit = 'day' | 'month';
const GHG_UNITS: { value: GhgUnit; label: string }[] = [
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];
const shiftMonth = (m: string, by: number) => {
  const [y = 2026, mm = 1] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mm - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function GhgOverviewScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const days = useMemo(() => reductionDays(fx, role.facilities), [fx, role.facilities]);
  const mine = (r: { facility: Facility }) => role.companies.some((c) => c.id === r.facility.companyId);
  const kwOf = (fs: Facility[]) =>
    Math.round(fs.filter((f) => f.status === 'ACTIVE').reduce((a, f) => a + f.kw, 0) * 100) / 100;
  const year = GHG_TODAY.slice(0, 4);

  // 위 카드 — 고정
  const yearT = totalsOf(rows.filter((r) => mine(r) && r.month.startsWith(year))).tco2;
  const monthT = totalsOf(rows.filter((r) => mine(r) && r.month === TODAY_MONTH)).tco2;
  const dayT = r3(days.filter((d) => d.date === GHG_TODAY).reduce((a, d) => a + d.tco2, 0));

  // 그래프 — 회사 하나, 또는 연료전지 · ORC(성과지표 8-①③ — 설비가 들어오면 값이 생긴다)
  const [picked, setPicked] = useState<string | null>(null);
  const pickKey = role.isAdmin ? (picked ?? `c:${role.companies[0]?.id ?? 0}`) : `c:${role.myId}`;
  const pickedSource = pickKey.startsWith('s:') ? (pickKey.slice(2) as Facility['source']) : null;
  const companyId = pickedSource ? null : Number(pickKey.slice(2));
  // 체결된 설비만(해지된 옛 계약은 선을 그리지 않는다)
  const fs = role.facilities.filter(
    (f) => f.status === 'ACTIVE' && (pickedSource ? f.source === pickedSource : f.companyId === companyId),
  );
  const fsIds = new Set(fs.map((f) => f.id));
  const graphOptions = [
    ...role.companies.map((c) => ({ value: `c:${c.id}`, label: c.name })),
    ...(['FUEL_CELL', 'ORC'] as const).map((src) => ({ value: `s:${src}`, label: sourceOf(src).label })),
  ];
  const firstMonth = fs.map((f) => (f.startMonth > FIRST_MONTH ? f.startMonth : FIRST_MONTH)).sort()[0] ?? TODAY_MONTH;
  const [unit, setUnit] = useState<GhgUnit>('day');
  const [month, setMonth] = useState(TODAY_MONTH);
  const [yr, setYr] = useState(year);
  const atStart = unit === 'day' ? month <= firstMonth : yr <= firstMonth.slice(0, 4);
  const atEnd = unit === 'day' ? month >= TODAY_MONTH : yr >= year;
  const shift = (by: number) =>
    unit === 'day' ? setMonth((m) => shiftMonth(m, by)) : setYr((y) => String(Number(y) + by));

  // 설비가 둘이면(자가소비 · PPA) 선 두 개
  const groups = fs.map((f) => ({ key: `f${f.id}`, name: f.kind, id: f.id }));
  const chart =
    unit === 'day'
      ? Array.from(
          { length: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate() },
          (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`;
            // 금일 뒤는 값 없음(선이 끊긴다)
            if (date > GHG_TODAY) return { x: `${i + 1}일` };
            return {
              x: `${i + 1}일`,
              ...Object.fromEntries(
                groups.map((g) => [
                  g.key,
                  r3(days.filter((d) => d.date === date && d.facility.id === g.id).reduce((a, d) => a + d.tco2, 0)),
                ]),
              ),
            };
          },
        )
      : Array.from({ length: 12 }, (_, i) => {
          const m = `${yr}-${String(i + 1).padStart(2, '0')}`;
          if (m > TODAY_MONTH) return { x: `${i + 1}월` };
          return {
            x: `${i + 1}월`,
            ...Object.fromEntries(
              groups.map((g) => [
                g.key,
                r3(totalsOf(rows.filter((r) => r.month === m && r.facility.id === g.id)).tco2),
              ]),
            ),
          };
        });
  const inRange =
    unit === 'day'
      ? days.filter((d) => fsIds.has(d.facility.id) && d.date.startsWith(month))
      : rows.filter((r) => fsIds.has(r.facility.id) && r.month.startsWith(yr));
  const rangeT = r3(inRange.reduce((a, r) => a + r.tco2, 0));
  const arrowBtn =
    'flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white disabled:opacity-30';

  // 감축 실적 — 위 카드(금년 · 금월 · 금일)를 나눈 것. 관리자는 기업마다(검색, 줄을 누르면 위 그래프가 그 회사로), 기업은 설비마다
  const [q, setQ] = useState('');
  type Perf = { id: number; name: string; kw: number; y: number; m: number; d: number };
  const perfOf = (id: number, name: string, fsOf: Facility[], match: (r: { facility: Facility }) => boolean): Perf => ({
    id,
    name,
    kw: kwOf(fsOf),
    y: totalsOf(rows.filter((r) => match(r) && r.month.startsWith(year))).tco2,
    m: totalsOf(rows.filter((r) => match(r) && r.month === TODAY_MONTH)).tco2,
    d: r3(days.filter((x) => match(x) && x.date === GHG_TODAY).reduce((a, x) => a + x.tco2, 0)),
  });
  const perf: Perf[] = role.isAdmin
    ? role.companies
        .filter((c) => !q.trim() || c.name.includes(q.trim()))
        .map((c) =>
          perfOf(
            c.id,
            c.name,
            role.facilities.filter((f) => f.companyId === c.id),
            (r) => r.facility.companyId === c.id,
          ),
        )
    : role.facilities.map((f) => perfOf(f.id, f.kind, [f], (r) => r.facility.id === f.id));
  const tCol = (key: 'y' | 'm' | 'd', header: string, digits: number): Column<Perf> => ({
    key,
    header,
    align: 'right',
    sortable: true,
    sortValue: (c) => c[key],
    render: (c) => (key === 'y' ? strong(fmt(c[key], digits)) : num(fmt(c[key], digits))),
  });
  const perfCols: Column<Perf>[] = [
    { key: 'name', header: role.isAdmin ? '기업' : '설비', render: (c) => cell(c.name, 'font-medium text-white') },
    { key: 'kw', header: '설비 용량 (kW)', align: 'right', render: (c) => num(fmt(c.kw, 2)) },
    tCol('y', '금년 감축량 (tCO₂eq)', 2),
    tCol('m', '금월 감축량 (tCO₂eq)', 2),
    tCol('d', '금일 감축량 (tCO₂eq)', 3),
  ];

  return (
    <div className="space-y-6">
      <Header title="배출시설 정보" />
      <StatsGrid columns={4}>
        {[
          <StatCard
            key="kw"
            label={role.isAdmin ? '보유 설비 용량' : '설비 용량'}
            value={`${fmt(kwOf(role.facilities), 2)} kW`}
          />,
          <StatCard key="y" label="금년 감축량" value={`${fmtT(yearT)} tCO₂eq`} />,
          <StatCard key="m" label="금월 감축량" value={`${fmtT(monthT)} tCO₂eq`} />,
          <StatCard key="d" label="금일 감축량" value={`${fmt(dayT, 3)} tCO₂eq`} />,
        ]}
      </StatsGrid>

      <div className="overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-md font-semibold text-white">감축량</h3>
          <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
            {GHG_UNITS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setUnit(o.value)}
                className={`h-7 rounded px-2.5 text-xs transition-colors ${
                  unit === o.value ? 'bg-primary font-medium text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
              <p className="text-sm text-slate-300">설비 용량</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {fs.length ? `${fmt(kwOf(fs), 2)} kW` : '-'}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-500/30">
              <p className="text-sm text-emerald-300/90">{`${unit === 'day' ? '금월' : '금년'} 감축량`}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-300">
                {fs.length ? `${fmtT(rangeT)} tCO₂eq` : '-'}
              </p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="w-56">
              {role.isAdmin && (
                <Select
                  options={graphOptions}
                  value={pickKey}
                  onChange={(e) => setPicked(e.target.value)}
                  className="h-8 text-sm"
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="이전" disabled={atStart} onClick={() => shift(-1)} className={arrowBtn}>
                <ChevronLeft size={13} />
              </button>
              <span className="min-w-[100px] px-2 text-center text-sm font-semibold tabular-nums text-white">
                {unit === 'day' ? month : `${yr}`}
              </span>
              <button type="button" aria-label="다음" disabled={atEnd} onClick={() => shift(1)} className={arrowBtn}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          <RmsLineChart data={chart} xKey="x" lines={groups.map((g) => ({ key: g.key, name: g.name }))} height={300} />
        </div>
      </div>

      <SectionCard
        title={`감축 실적 (${perf.length})`}
        actions={
          role.isAdmin ? (
            <div className="w-56">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" />
            </div>
          ) : undefined
        }
        noPadding
      >
        <DataTable
          data={perf}
          columns={perfCols}
          rowKey={(c) => c.id}
          defaultSort={{ key: 'y', direction: 'desc' }}
          emptyMessage="감축 실적 없음"
          onRowClick={
            role.isAdmin
              ? (c) => {
                  setPicked(`c:${c.id}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              : undefined
          }
        />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.2 배출원 등록 — 감축 설비(태양광). 설비는 계약에서 자동으로 들어온다. 줄을 누르면 배출원 상세 ══ */
const SOURCES = '/e-data/inventory/sources';
/** 명세서 양식(배출량 보고 및 인증 지침 별지 제11호) — 태양광 */
const GHG_CODES = {
  facilityCode: '0120',
  facility: '재생에너지 전기 사용 시설',
  activity: '외부 전력 대체(태양광 자가소비)',
  activityData: '0272 재생에너지(태양광) 전력',
  measure: '7114 태양전지를 이용한 전력생산',
  scope: 'Scope 2 감축',
};

/** 배출원 한 줄 — 전력거래 계약에서 자동으로 생긴 설비. 어느 기업이 어떤 계약으로 몇 kW 를 설치했는지(2026-10-21 사용자) */
interface SrcRow {
  key: string;
  company: string;
  source: string;
  kind: string;
  kw: number;
  scope: string;
  solar: Facility;
}
function solarRow(f: Facility): SrcRow {
  return {
    key: `s${f.id}`,
    company: f.company,
    source: sourceOf(f.source).label,
    kind: f.kind,
    kw: f.kw,
    scope: GHG_CODES.scope,
    solar: f,
  };
}
/** 배출원 칸 — 등록 목록과 산정 표가 같은 칸을 쓴다 */
function sourceHeadCols<T>(get: (x: T) => SrcRow): Column<T>[] {
  return [
    { key: 'company', header: '기업', render: (x) => cell(get(x).company, 'font-medium text-white') },
    { key: 'source', header: '발전원', render: (x) => cell(get(x).source) },
    { key: 'kind', header: '계약 유형', render: (x) => cell(get(x).kind) },
    { key: 'kw', header: '설비 용량 (kW)', render: (x) => num(fmt(get(x).kw, 2)) },
    { key: 'scope', header: '배출구분', render: (x) => cell(get(x).scope) },
  ];
}
export function GhgSourcesScreen() {
  const role = useGhgRole();
  const router = useRouter();
  const { rows: red } = useRows();
  const [q, setQ] = useState('');
  const word = q.trim();
  const year = GHG_TODAY.slice(0, 4);
  // 체결된 설비만 — 해지된 계약은 안 보인다(해지 전 기간 감축량은 합계 · 명세서에 남음)
  const rows: SrcRow[] = role.facilities
    .filter((f) => f.status === 'ACTIVE')
    .map((f) => solarRow(f))
    .filter((r) => !word || r.company.includes(word));
  const yearT = (f: Facility) => totalsOf(red.filter((r) => r.facility.id === f.id && r.month.startsWith(year)));
  const active = role.facilities.filter((f) => f.status === 'ACTIVE');
  const kw = active.reduce((a, f) => a + f.kw, 0);
  const self = (r: SrcRow) => r;
  const cols: Column<SrcRow>[] = [
    ...sourceHeadCols(self),
    { key: 'mwh', header: '금년 발전량 (MWh)', render: (r) => num(fmt(yearT(r.solar).mwh, 1)) },
    { key: 'tco2', header: '금년 감축량 (tCO₂eq)', render: (r) => strong(fmtT(yearT(r.solar).tco2)) },
    { key: 'go', header: '', render: () => <ChevronRight size={15} className="text-slate-600" /> },
  ];

  return (
    <div className="space-y-6">
      <Header title="배출원 등록" />
      <StatsGrid columns={3}>
        <StatCard label="배출원" value={`${active.length}개`} />
        <StatCard label="시설용량" value={`${fmt(kw, 2)} kW`} />
        <StatCard label="기업" value={`${new Set(active.map((f) => f.companyId)).size}곳`} />
      </StatsGrid>
      <SectionCard
        title={`배출원 목록 (${rows.length})`}
        actions={
          <div className="w-56">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" />
          </div>
        }
        noPadding
      >
        <div className="overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
          <DataTable
            data={rows}
            columns={cols}
            rowKey={(r) => r.key}
            emptyMessage="체결된 전력거래 계약이 없습니다"
            onRowClick={(r) => router.push(`${SOURCES}/view?id=${r.solar.id}`)}
          />
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.2 배출원 상세 — 설비 하나의 정보 + 감축량(금년 · 금월 · 금일) + 월별 감축량 그래프 · 표 ══ */
export function GhgSourceDetailScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const f = role.facilities.find((x) => x.id === id);
  const days = useMemo(() => (f ? reductionDays(fx, [f]) : []), [fx, f]);
  const thisYear = GHG_TODAY.slice(0, 4);
  const [year, setYear] = useState(thisYear);
  const mine = rows.filter((r) => r.facility.id === id);
  const yearT = totalsOf(mine.filter((r) => r.month.startsWith(thisYear))).tco2;
  const monthT = totalsOf(mine.filter((r) => r.month === TODAY_MONTH)).tco2;
  const dayT = r3(days.filter((d) => d.date === GHG_TODAY).reduce((a, d) => a + d.tco2, 0));
  const years = [...new Set(mine.map((r) => r.month.slice(0, 4)))].sort().reverse();

  // 월별 — 1월 ~ 12월, 값 없는 달은 빈 값
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    const r = mine.find((x) => x.month === m);
    return { month: m, x: `${i + 1}월`, r };
  });
  // 값 없는 달은 감축량 키를 두지 않는다(선이 끊긴다)
  const chart = monthly.map((m) => {
    const row: Record<string, string | number> = { x: m.x };
    if (m.r) row['감축량'] = Math.round(m.r.tco2 * 100) / 100;
    return row;
  });
  const yearSum = totalsOf(mine.filter((r) => r.month.startsWith(year)));
  type Mo = (typeof monthly)[number];
  const cols: Column<Mo>[] = [
    { key: 'month', header: '월', render: (m) => num(m.month) },
    { key: 'kwh', header: '발전량 (kWh)', render: (m) => num(m.r ? fmt(m.r.kwh) : '') },
    { key: 'f', header: '배출계수 (tCO₂eq/MWh)', render: (m) => num(m.r ? fx.co2 : '') },
    { key: 'tco2', header: '감축량 (tCO₂eq)', render: (m) => strong(m.r ? fmtT(m.r.tco2) : '') },
  ];

  const info = (items: [string, ReactNode][]) => (
    <SectionCard title="설비 정보">
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value]) => (
          <Info key={label} label={label} value={value} />
        ))}
      </div>
    </SectionCard>
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'E-데이터마켓', path: '/e-data/inventory' },
          { label: '온실가스 인벤토리' },
          { label: '배출원 등록', path: SOURCES },
          { label: '배출원 상세' },
        ]}
      />
      <div className="flex items-center gap-3">
        <BackButton href={SOURCES} label="배출원 등록으로" />
        <h1 className="text-2xl font-bold text-white">
          {f ? `${f.company} ${sourceOf(f.source).label} 발전설비` : '배출원 상세'}
        </h1>
        {f && kindBadge(f)}
      </div>
      {!f ? (
        id != null && <p className="text-sm text-slate-400">배출원이 없습니다</p>
      ) : (
        <>
          {info([
            ['기업', f.company],
            ['소재지', f.address],
            ['발전원', sourceOf(f.source).label],
            ['계약 유형', f.kind],
            ['설비 용량', `${fmt(f.kw, 2)} kW`],
            ['배출구분', GHG_CODES.scope],
            ['전력거래 계약번호', f.contractNo],
          ])}
          <StatsGrid columns={3}>
            <StatCard label="금년 감축량" value={`${fmtT(yearT)} tCO₂eq`} />
            <StatCard label="금월 감축량" value={`${fmtT(monthT)} tCO₂eq`} />
            <StatCard label="금일 감축량" value={`${fmt(dayT, 3)} tCO₂eq`} />
          </StatsGrid>
          <SectionCard
            title="월별 감축량"
            actions={
              years.length > 1 ? (
                <div className="w-32">
                  <Select
                    options={years.map((y) => ({ value: y, label: `${y}년` }))}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              ) : undefined
            }
          >
            <RmsLineChart data={chart} xKey="x" lines={[{ key: '감축량', name: '감축량 (tCO₂eq)' }]} height={260} />
          </SectionCard>
          <SectionCard
            title={`월별 산정 (${monthly.filter((m) => m.r).length})`}
            actions={<span className="text-sm text-slate-300">합계 {fmtT(yearSum.tco2)} tCO₂eq</span>}
            noPadding
          >
            <DataTable data={monthly} columns={cols} rowKey={(m) => m.month} />
          </SectionCard>
        </>
      )}
    </div>
  );
}

/* ══ 3.1.3 배출계수 관리 — 배출원(Scope 1 · 2)에 쓰는 계수 + 태양광 감축 환산 계수.
 *    값이 어떻게 이뤄졌는지(순발열량 · 가스별 계수 · GWP)까지 보여 준다. 전력 배출계수는 관리 › 에너지 설정 값 ══ */
export function GhgFactorsScreen() {
  const role = useGhgRole();
  const fx = useGhgFactorValues();
  type F = GhgFactor;
  const elecSum = (f: F) => (f.category === '외부 전기' ? fx.co2 : combined(f));
  const cols: Column<F>[] = [
    {
      key: 'scope',
      header: 'Scope',
      render: (f) => cell(`Scope ${CATEGORY_SCOPE[f.category]}`, 'font-medium text-white'),
    },
    { key: 'cat', header: '배출활동', render: (f) => cell(f.category) },
    { key: 'fuel', header: '연료 · 에너지', render: (f) => cell(f.fuel, 'text-white') },
    { key: 'unit', header: '단위', render: (f) => cell(f.unit) },
    {
      key: 'ncv',
      header: '순발열량',
      render: (f) => num(f.category === '외부 열(스팀)' ? '-' : `${f.ncv} MJ/${f.unit}`),
    },
    {
      key: 'co2',
      header: 'CO₂',
      render: (f) => num(f.category === '외부 전기' ? `${f.co2} t/MWh` : `${fmt(f.co2, 1)} kg/TJ`),
    },
    {
      key: 'ch4',
      header: 'CH₄',
      render: (f) => num(f.category === '외부 전기' ? `${f.ch4} kg/MWh` : `${f.ch4} kg/TJ`),
    },
    {
      key: 'n2o',
      header: 'N₂O',
      render: (f) => num(f.category === '외부 전기' ? `${f.n2o} kg/MWh` : `${f.n2o} kg/TJ`),
    },
    {
      key: 'sum',
      header: 'GWP 합산',
      render: (f) => strong(f.category === '외부 전기' ? `${fx.co2} tCO₂eq/MWh` : `${fmt(elecSum(f), 1)} kgCO₂eq/TJ`),
    },
    { key: 'unitT', header: '1단위당', render: (f) => num(`${tco2PerUnit(f, fx.co2).toFixed(6)} tCO₂eq/${f.unit}`) },
  ];
  const solarList = [
    {
      key: 'co2',
      name: '발전 감축 (전력 배출계수 — 태양광 · 연료전지 · ORC)',
      value: `${fx.co2} tCO₂eq/MWh`,
      use: '감축량 = 발전량(MWh) × 계수',
      basis: `${fx.year}년 소비단 · ${fx.published} 공표 · 가스별 CO₂ 0.4149 · CH₄ 0.0075 · N₂O 0.0081`,
    },
    {
      key: 'toe',
      name: '화석에너지 대체',
      value: `${fx.toe} TOE/MWh`,
      use: '화석에너지 대체 = 발전량(MWh) × 계수',
      basis: '에너지법 시행규칙 에너지열량 환산기준 — 전기 소비기준 9.6 MJ/kWh',
    },
    {
      key: 'pine',
      name: '소나무 식재',
      value: `${fx.pine} 그루/tCO₂`,
      use: '소나무 식재 = 감축량(tCO₂eq) × 계수',
      basis: '30년생 소나무 1그루 연 6.6 kg CO₂ 흡수(국립산림과학원) 기준',
    },
  ];
  type S = (typeof solarList)[number];
  const solarCols: Column<S>[] = [
    { key: 'name', header: '계수', render: (f) => cell(f.name, 'font-medium text-white') },
    { key: 'value', header: '값', render: (f) => strong(f.value) },
    { key: 'use', header: '산식', render: (f) => cell(f.use) },
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
      <StatsGrid columns={4}>
        <StatCard
          label="Scope 1 계수"
          value={`${GHG_FACTORS.filter((f) => CATEGORY_SCOPE[f.category] === 1).length}종`}
        />
        <StatCard
          label="Scope 2 계수"
          value={`${GHG_FACTORS.filter((f) => CATEGORY_SCOPE[f.category] === 2).length}종`}
        />
        <StatCard label="전력 배출계수" value={`${fx.co2} tCO₂eq/MWh`} sub={`${fx.year}년 기준`} />
        <StatCard label="GWP" value={`CH₄ ${GWP.ch4} · N₂O ${GWP.n2o}`} sub="AR5" />
      </StatsGrid>
      <SectionCard title={`배출원 계수 (${GHG_FACTORS.length})`} noPadding>
        <div className="overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
          <DataTable data={GHG_FACTORS} columns={cols} rowKey={(f) => f.id} />
        </div>
      </SectionCard>
      <SectionCard title={`감축 환산 (${solarList.length})`} noPadding>
        <DataTable data={solarList} columns={solarCols} rowKey={(f) => f.key} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.1.4 배출량 산정 — 연도 · 기업을 고르면 월마다 발전량 × 전력 배출계수 = 감축량(태양광, 실제로 가져오는 값만) ══ */
export function GhgCalculationScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const [year, setYear] = useState(LAST_MONTH.slice(0, 4));
  const [company, setCompany] = useState<number | null>(null);
  const me = scopeOf(role, company);
  const [from, to] = yearRange(year);
  const months = monthsBetween(from, to);
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const picked = pick(rows, from, to, me).filter((r) => role.companies.some((c) => c.id === r.facility.companyId));
  const t = totalsOf(picked);
  const monthly = byMonth(picked, months);
  const shown = me == null ? role.companies : role.companies.filter((c) => c.id === me);

  const facilities = role.facilities.filter((f) => f.status === 'ACTIVE' && shown.some((c) => c.id === f.companyId));
  const matrix = facilities.map((f) => {
    const rs = picked.filter((r) => r.facility.id === f.id);
    return {
      f,
      row: solarRow(f),
      byM: Object.fromEntries(rs.map((r) => [r.month, r.tco2])),
      sum: totalsOf(rs),
    };
  });
  type M = (typeof matrix)[number];
  const fOf = (x: M) => x.row;
  const matrixCols: Column<M>[] = [
    ...sourceHeadCols(fOf),
    { key: 'sum', header: '합계 (tCO₂eq)', render: (x) => strong(fmtT(x.sum.tco2)) },
    ...yearMonths.map((m, i) => ({
      key: m,
      header: `${i + 1}월`,
      render: (x: M) => num(x.byM[m] == null ? '' : fmtT(x.byM[m])),
    })),
  ];

  type Mo = (typeof monthly)[number];
  const monthCols: Column<Mo>[] = [
    { key: 'month', header: '월', render: (m) => num(m.month) },
    { key: 'kwh', header: '발전량 (kWh)', render: (m) => num(fmt(m.kwh)) },
    { key: 'mwh', header: '발전량 (MWh)', render: (m) => num(fmt(m.mwh, 3)) },
    { key: 'f', header: '배출계수 (tCO₂eq/MWh)', render: () => num(fx.co2) },
    { key: 'tco2', header: '감축량 (tCO₂eq)', render: (m) => strong(fmtT(m.tco2)) },
    { key: 'toe', header: '화석에너지 대체 (TOE)', render: (m) => num(fmtT(m.toe)) },
    { key: 'pine', header: '소나무 식재 (그루)', render: (m) => num(fmt(m.pine)) },
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
      <SectionCard title={`배출원별 월 감축량 (${matrix.length})`} noPadding>
        <div className="overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap" data-table>
          <DataTable data={matrix} columns={matrixCols} rowKey={(x) => x.f.id} />
        </div>
      </SectionCard>
      <SectionCard title={`월별 산정 (${monthly.length})`} noPadding>
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
  const target = me == null ? null : (role.companies.find((c) => c.id === me) ?? null);
  const data = docData(picked, fx, from, to, target, role.companies, role.facilities);
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
  const picked = pick(rows, range.from, range.to, me).filter((r) =>
    role.companies.some((c) => c.id === r.facility.companyId),
  );
  const target = me == null ? null : (role.companies.find((c) => c.id === me) ?? null);
  const data = docData(picked, fx, range.from, range.to, target, role.companies, role.facilities);
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
