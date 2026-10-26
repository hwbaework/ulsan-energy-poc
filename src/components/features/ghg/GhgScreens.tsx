'use client';

// E-데이터마켓 › 온실가스 인벤토리 — 태양광으로 줄인 탄소(감축량)만.
// 입력 없음: 발전 데이터를 가져와 보여 주고 내려받기만. 관리자는 전체 기업(기업별로 나눠), 기업 계정은 자기 회사만.
// 메뉴 이름은 그대로(배출시설 정보 · 배출원 등록 · 배출계수 관리 · 배출량 산정 · 명세서 · 보고서), 내용만 감축량 기준.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { exportPdf, generateReportHtml, type ReportPreviewDoc } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  Settings,
} from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { Badge } from '@/components/ui/Badge/Badge';
import { tco2PerUnit, type GhgFactor } from '@/lib/ghg-factors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { RmsLineChart } from '@/components/ui/Chart';
import { getPersona } from '@/lib/persona';
import { sourceOf } from '@/lib/design';
import { useAuthStore } from '@/stores/useAuthStore';
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
  useGhgFactorList,
  useGhgFactorValues,
  yearRange,
  type Facility,
  type ReductionDay,
  type ReductionRow,
} from '@/lib/ghg-reduction';

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
export function GhgHeader({ title, actions }: { title: string; actions?: ReactNode }) {
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

/** 월별 합계 */
function byMonth(rows: ReductionRow[], months: string[]) {
  return months.map((m) => ({ month: m, ...totalsOf(rows.filter((r) => r.month === m)) }));
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
const kwSum = (fs: Facility[]) =>
  Math.round(fs.filter((f) => f.status === 'ACTIVE').reduce((a, f) => a + f.kw, 0) * 100) / 100;

/** 감축량 기간 — 일(한 달의 날마다) / 월(한 해의 달마다). 그래프와 아래 표가 같이 쓴다 */
function useReductionPeriod(fs: Facility[]) {
  const year = GHG_TODAY.slice(0, 4);
  const firstMonth = fs.map((f) => (f.startMonth > FIRST_MONTH ? f.startMonth : FIRST_MONTH)).sort()[0] ?? TODAY_MONTH;
  const [unit, setUnit] = useState<GhgUnit>('day');
  const [month, setMonth] = useState(TODAY_MONTH);
  const [yr, setYr] = useState(year);
  return {
    unit,
    setUnit,
    month,
    yr,
    atStart: unit === 'day' ? month <= firstMonth : yr <= firstMonth.slice(0, 4),
    atEnd: unit === 'day' ? month >= TODAY_MONTH : yr >= year,
    shift: (by: number) =>
      unit === 'day' ? setMonth((m) => shiftMonth(m, by)) : setYr((y) => String(Number(y) + by)),
    /** 칸 하나 — 일이면 그 달의 날짜(YYYY-MM-DD), 월이면 그 해의 달(YYYY-MM). 금일 · 금월 뒤는 future */
    slots: (unit === 'day'
      ? Array.from(
          { length: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate() },
          (_, i) => ({ key: `${month}-${String(i + 1).padStart(2, '0')}`, x: `${i + 1}일` }),
        )
      : Array.from({ length: 12 }, (_, i) => ({ key: `${yr}-${String(i + 1).padStart(2, '0')}`, x: `${i + 1}월` }))
    ).map((s) => ({ ...s, future: s.key > (unit === 'day' ? GHG_TODAY : TODAY_MONTH) })),
  };
}
type ReductionPeriod = ReturnType<typeof useReductionPeriod>;

/** 칸 하나의 발전량 · 감축량 — 일은 날 값, 월은 달 값 */
function slotTotals(p: ReductionPeriod, key: string, ids: Set<number>, days: ReductionDay[], rows: ReductionRow[]) {
  const xs = p.unit === 'day' ? days.filter((d) => d.date === key) : rows.filter((r) => r.month === key);
  const hit = xs.filter((x) => ids.has(x.facility.id));
  return { kwh: hit.reduce((a, x) => a + x.kwh, 0), tco2: r3(hit.reduce((a, x) => a + x.tco2, 0)) };
}

/** 감축량 그래프 카드 — 배출시설 정보 · 배출원 상세가 같이 쓴다. 일 / 월 · 설비 용량 · 기간 감축량 · 이전/다음 */
function ReductionChartCard({
  period: p,
  fs,
  days,
  rows,
  picker,
  cards = true,
}: {
  period: ReductionPeriod;
  fs: Facility[];
  days: ReductionDay[];
  rows: ReductionRow[];
  picker?: ReactNode;
  /** 안쪽 카드(설비 용량 · 기간 감축량) — 배출원 상세는 위 설비 정보 · 감축량 카드와 겹쳐 뺀다 */
  cards?: boolean;
}) {
  // 설비가 둘이면(자가소비 · PPA) 선 두 개
  const groups = fs.map((f) => ({ key: `f${f.id}`, name: f.kind, id: f.id }));
  // 금일 · 금월 뒤는 값 없음(선이 끊긴다)
  const chart = p.slots.map((s) =>
    s.future
      ? { x: s.x }
      : {
          x: s.x,
          ...Object.fromEntries(groups.map((g) => [g.key, slotTotals(p, s.key, new Set([g.id]), days, rows).tco2])),
        },
  );
  const ids = new Set(fs.map((f) => f.id));
  const rangeT = r3(p.slots.reduce((a, s) => a + slotTotals(p, s.key, ids, days, rows).tco2, 0));
  const arrowBtn =
    'flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white disabled:opacity-30';

  return (
    <div className="overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3">
        <h3 className="text-md font-semibold text-white">감축량</h3>
        <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
          {GHG_UNITS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => p.setUnit(o.value)}
              className={`h-7 rounded px-2.5 text-xs transition-colors ${
                p.unit === o.value ? 'bg-primary font-medium text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 py-4">
        {cards && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
              <p className="text-sm text-slate-300">설비 용량</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {fs.length ? `${fmt(kwSum(fs), 2)} kW` : '-'}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-500/30">
              <p className="text-sm text-emerald-300/90">{`${p.unit === 'day' ? '금월' : '금년'} 감축량`}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-300">
                {fs.length ? `${fmtT(rangeT)} tCO₂eq` : '-'}
              </p>
            </div>
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="w-56">{picker}</div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="이전" disabled={p.atStart} onClick={() => p.shift(-1)} className={arrowBtn}>
              <ChevronLeft size={13} />
            </button>
            <span className="min-w-[100px] px-2 text-center text-sm font-semibold tabular-nums text-white">
              {p.unit === 'day' ? p.month : p.yr}
            </span>
            <button type="button" aria-label="다음" disabled={p.atEnd} onClick={() => p.shift(1)} className={arrowBtn}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
        <RmsLineChart data={chart} xKey="x" lines={groups.map((g) => ({ key: g.key, name: g.name }))} height={300} />
      </div>
    </div>
  );
}

export function GhgOverviewScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const days = useMemo(() => reductionDays(fx, role.facilities), [fx, role.facilities]);
  const mine = (r: { facility: Facility }) => role.companies.some((c) => c.id === r.facility.companyId);
  const kwOf = kwSum;
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
  const graphOptions = [
    ...role.companies.map((c) => ({ value: `c:${c.id}`, label: c.name })),
    ...(['FUEL_CELL', 'ORC'] as const).map((src) => ({ value: `s:${src}`, label: sourceOf(src).label })),
  ];
  const period = useReductionPeriod(fs);

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
      <GhgHeader title="배출시설 정보" />
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

      <ReductionChartCard
        period={period}
        fs={fs}
        days={days}
        rows={rows}
        picker={
          role.isAdmin && (
            <Select
              options={graphOptions}
              value={pickKey}
              onChange={(e) => setPicked(e.target.value)}
              className="h-8 text-sm"
            />
          )
        }
      />

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
      <GhgHeader title="배출원 등록" />
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
  const mine = rows.filter((r) => r.facility.id === id);
  const yearT = totalsOf(mine.filter((r) => r.month.startsWith(thisYear))).tco2;
  const monthT = totalsOf(mine.filter((r) => r.month === TODAY_MONTH)).tco2;
  const dayT = r3(days.filter((d) => d.date === GHG_TODAY).reduce((a, d) => a + d.tco2, 0));

  // 그래프 · 아래 산정 표가 같은 기간(일 / 월)
  const fs = f ? [f] : [];
  const period = useReductionPeriod(fs);
  const ids = new Set(fs.map((x) => x.id));
  // 값 없는 날 · 달(설비 가동 전 · 금일 뒤)은 빈 줄
  const calc = period.slots.map((s) => {
    const t = s.future ? null : slotTotals(period, s.key, ids, days, mine);
    return { key: s.key, t: t && t.kwh > 0 ? t : null };
  });
  const rangeSum = r3(calc.reduce((a, c) => a + (c.t?.tco2 ?? 0), 0));
  type Calc = (typeof calc)[number];
  const cols: Column<Calc>[] = [
    { key: 'key', header: period.unit === 'day' ? '일자' : '월', render: (c) => num(c.key) },
    { key: 'kwh', header: '발전량 (kWh)', render: (c) => num(c.t ? fmt(c.t.kwh) : '') },
    { key: 'f', header: '배출계수 (tCO₂eq/MWh)', render: (c) => num(c.t ? fx.co2 : '') },
    {
      key: 'expr',
      header: '계산식',
      render: (c) => num(c.t ? `${fmt(c.t.kwh / 1000, 3)} MWh × ${fx.co2}` : ''),
    },
    {
      key: 'tco2',
      header: '감축량 (tCO₂eq)',
      render: (c) => strong(c.t ? (period.unit === 'day' ? fmt(c.t.tco2, 3) : fmtT(c.t.tco2)) : ''),
    },
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
          <ReductionChartCard period={period} fs={fs} days={days} rows={mine} cards={false} />
          <SectionCard
            title={`${period.unit === 'day' ? '일별' : '월별'} 산정 (${calc.filter((c) => c.t).length})`}
            actions={
              <span className="text-sm text-slate-300">
                감축량 = 발전량 (MWh) × 배출계수 · 합계 {fmt(rangeSum, 3)} tCO₂eq
              </span>
            }
            noPadding
          >
            <div className="overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <DataTable data={calc} columns={cols} rowKey={(c) => c.key} />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

/* ══ 3.1.3 배출계수 관리 — 감축량 계산에 쓰는 계수 3개(발전 감축 · 화석에너지 대체 · 소나무 식재)와
 *    계산식에 들어가는 금년 발전량. 값은 관리 › 에너지 설정 한 곳에서 고친다(관리자), 바꾸면 전 기간에 바로 반영 ══ */
export function GhgFactorsScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const year = GHG_TODAY.slice(0, 4);
  const t = totalsOf(
    rows.filter((r) => r.month.startsWith(year) && role.companies.some((c) => c.id === r.facility.companyId)),
  );
  const list = [
    {
      key: 'co2',
      name: '발전 감축',
      value: `${fx.co2} tCO₂eq/MWh`,
      use: '감축량 = 발전량 (MWh) × 계수',
      calc: `${fmt(t.mwh, 3)} MWh × ${fx.co2} = ${fmtT(t.tco2)} tCO₂eq`,
    },
    {
      key: 'pine',
      name: '소나무 식재',
      value: `${fx.pine} 그루/tCO₂`,
      use: '소나무 식재 = 감축량 (tCO₂eq) × 계수',
      calc: `${fmtT(t.tco2)} tCO₂eq × ${fx.pine} = ${fmt(t.pine)} 그루`,
    },
    {
      key: 'toe',
      name: '화석에너지 대체',
      value: `${fx.toe} TOE/MWh`,
      use: '화석에너지 대체 = 발전량 (MWh) × 계수',
      calc: `${fmt(t.mwh, 3)} MWh × ${fx.toe} = ${fmtT(t.toe)} TOE`,
    },
  ];
  type S = (typeof list)[number];
  const cols: Column<S>[] = [
    { key: 'name', header: '계수', render: (f) => cell(f.name, 'font-medium text-white') },
    { key: 'value', header: '값', render: (f) => strong(f.value) },
    { key: 'use', header: '산식', render: (f) => cell(f.use) },
    { key: 'calc', header: '금년 계산', render: (f) => num(f.calc) },
  ];
  // 배출원 계수(Scope 1 · 2, 연료별) — 관리 › 에너지 설정에서 고치고 여기서는 보기만
  const factors = useGhgFactorList();
  const isElec = (f: GhgFactor) => f.category === '외부 전기';
  const factorCols: Column<GhgFactor>[] = [
    { key: 'scope', header: 'Scope', render: (f) => cell(`Scope ${f.scope}`, 'font-medium text-white') },
    { key: 'cat', header: '배출활동', render: (f) => cell(f.category) },
    { key: 'fuel', header: '연료 · 에너지', render: (f) => cell(f.fuel, 'text-white') },
    { key: 'unit', header: '단위', render: (f) => cell(f.unit) },
    { key: 'ncv', header: '순발열량', render: (f) => num(f.category === '외부 열(스팀)' ? '' : `${f.ncv} MJ/${f.unit}`) },
    { key: 'co2', header: 'CO₂', render: (f) => num(isElec(f) ? `${f.co2} t/MWh` : `${fmt(f.co2, 1)} kg/TJ`) },
    { key: 'ch4', header: 'CH₄', render: (f) => num(`${f.ch4} ${isElec(f) ? 'kg/MWh' : 'kg/TJ'}`) },
    { key: 'n2o', header: 'N₂O', render: (f) => num(`${f.n2o} ${isElec(f) ? 'kg/MWh' : 'kg/TJ'}`) },
    { key: 'unitT', header: '1단위당 (tCO₂eq)', render: (f) => strong(`${tco2PerUnit(f, fx.co2).toFixed(6)} /${f.unit}`) },
  ];
  return (
    <div className="space-y-6">
      <GhgHeader
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
        <StatCard label="금년 발전량" value={`${fmt(t.mwh, 1)} MWh`} />
        <StatCard label="발전 감축" value={`${fx.co2} tCO₂eq/MWh`} />
        <StatCard label="소나무 식재" value={`${fx.pine} 그루/tCO₂`} />
        <StatCard label="화석에너지 대체" value={`${fx.toe} TOE/MWh`} />
      </StatsGrid>
      <SectionCard title={`계수 (${list.length})`} noPadding>
        <div className="overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
          <DataTable data={list} columns={cols} rowKey={(f) => f.key} />
        </div>
      </SectionCard>
      <SectionCard title={`배출원 계수 (${factors.length})`} noPadding>
        <div className="overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
          <DataTable data={factors} columns={factorCols} rowKey={(f) => f.id} />
        </div>
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
  // 그래프 — 1월 ~ 12월, 산정 범위 밖 달은 값 없음(선이 끊긴다)
  const chart = yearMonths.map((m, i) => {
    const mo = monthly.find((x) => x.month === m);
    const row: Record<string, string | number> = { x: `${i + 1}월` };
    if (mo) row['감축량'] = r3(mo.tco2);
    return row;
  });

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
    { key: 'tco2', header: '탄소 감축량 (tCO₂eq)', render: (m) => strong(fmtT(m.tco2)) },
    { key: 'pine', header: '소나무 식재 (그루)', render: (m) => num(fmt(m.pine)) },
    { key: 'toe', header: '화석에너지 대체 (TOE)', render: (m) => num(fmtT(m.toe)) },
  ];

  return (
    <div className="space-y-6">
      <GhgHeader
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
        <StatCard label="자가소비 발전량" value={`${fmt(t.mwh, 1)} MWh`} />
        <StatCard label="탄소 감축량" value={`${fmtT(t.tco2)} tCO₂eq`} />
        <StatCard label="소나무 식재" value={`${fmt(t.pine)} 그루`} />
        <StatCard label="화석에너지 대체" value={`${fmtT(t.toe)} TOE`} />
      </StatsGrid>
      <SectionCard title="월별 탄소 감축량">
        <RmsLineChart data={chart} xKey="x" lines={[{ key: '감축량', name: '탄소 감축량 (tCO₂eq)' }]} height={260} />
      </SectionCard>
      <SectionCard title={`배출원별 월 탄소 감축량 (${matrix.length})`} noPadding>
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

/* ══ 3.1.6 보고서 — 통합관제 › 보고서와 같은 양식(화면 · 문서 모두).
   연도 · 월 · 기업 + 보고서 목록 + 미리보기(문서) · PDF. 감축 실적(매월 1건, 월 마감 후 생성)만 — 연간 보고서는 고도화 ══ */
type GhgReportKind = 'month' | 'year';
const GHG_KIND_LABEL: Record<GhgReportKind, string> = { month: '감축 실적', year: '연간 감축 실적' };
const REPORT_MONTH_OPTIONS = [
  { value: 'all', label: '전체' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(12 - i).padStart(2, '0'), label: `${12 - i}월` })),
];
const THIS_YEAR = Number(TODAY_MONTH.slice(0, 4));
const FIRST_YEAR = Number(FIRST_MONTH.slice(0, 4));

interface GhgReportDoc {
  id: string;
  kind: GhgReportKind;
  /** YYYY-MM (감축 실적) · YYYY (연간) */
  period: string;
  title: string;
  label: string;
  createdAt: string;
}

/** 그 해의 문서 — 감축 실적 월별(1월 ~ 금년이면 금월, 최신순). 연간 보고서는 고도화 */
function ghgDocsOfYear(year: number): GhgReportDoc[] {
  const docs: GhgReportDoc[] = [];
  const last = year === THIS_YEAR ? Number(TODAY_MONTH.slice(5, 7)) : 12;
  for (let m = last; m >= 1; m--) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    if (month < FIRST_MONTH) break;
    const end = new Date(year, m, 0).getDate();
    const next = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
    docs.push({
      id: `month-${month}`,
      kind: 'month',
      period: month,
      title: `${year}년 ${m}월 ${GHG_KIND_LABEL.month} 보고서`,
      label: `${year}년 ${m}월 (1일 ~ ${end}일)`,
      createdAt: month === TODAY_MONTH ? '작성 중' : next,
    });
  }
  return docs;
}

/** 발전소 이름 — 통합관제처럼 한 기업에 계약이 둘이면 "한일튜브(PPA)" */
function plantName(f: Facility, all: Facility[]) {
  return all.filter((x) => x.companyId === f.companyId).length > 1 ? `${f.company}(${f.kind})` : f.company;
}

export function GhgReportScreen() {
  const sp = useSearchParams();
  const id = sp.get('id');
  const plant = sp.get('plant');
  return (
    <GhgReportDocs facilityId={id ? Number(id) : undefined} plantId={plant ? Number(plant) : undefined} />
  );
}

/** 연료전지 · ORC 발전소 — 통합관제처럼 목록에는 보이고, 감축 보고서 항목은 아직 없어 값을 비워 둔다 */
function useOtherPlants() {
  const { data } = useMonitoringPlants();
  const matcher = useMyPlantMatcher();
  return useMemo(() => filterPlantsByOwnership(data ?? [], matcher).filter((p) => p.type !== 'SOLAR'), [data, matcher]);
}

/** ② 발전소(계약) 하나의 보고서 — 통합관제 보고서 2단계와 같은 화면 · 문서 양식 */
function GhgReportDocs({ facilityId, plantId }: { facilityId?: number; plantId?: number }) {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const [year, setYear] = useState(THIS_YEAR);
  const [monthFilter, setMonthFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = role.facilities.filter((f) => f.status === 'ACTIVE');
  const others = useOtherPlants();
  // 기업(발전소) — 전체면 모든 발전소 보고서를 한 목록에. ?id= · ?plant= 로 들어오면 그 발전소
  const [pickKey, setPickKey] = useState(
    facilityId != null ? `f-${facilityId}` : plantId != null ? `p-${plantId}` : 'all',
  );
  const pickOptions = [
    { value: 'all', label: '전체' },
    ...active.map((x) => ({ value: `f-${x.id}`, label: plantName(x, active) })),
    ...others.map((p) => ({ value: `p-${p.plantId}`, label: p.name })),
  ];
  const inScope = active.filter((x) => pickKey === 'all' || pickKey === `f-${x.id}`);

  const docs = useMemo(
    () =>
      inScope.flatMap((x) =>
        ghgDocsOfYear(year)
          .filter((d) => monthFilter === 'all' || d.period.endsWith(`-${monthFilter}`))
          .map((d) => ({ ...d, id: `${x.id}-${d.id}`, f: x, name: plantName(x, active) }))
          .filter((d) => !q.trim() || d.name.includes(q.trim())),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickKey, active.length, year, monthFilter, q],
  );
  // 처음부터 맨 위 문서가 열려 있고, 다른 행을 누르면 오른쪽이 그 문서로 바뀐다
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;
  const f = selected?.f;
  const name = selected?.name ?? '';
  const days = useMemo(() => (f ? reductionDays(fx, [f]) : []), [fx, f]);
  type ReportDoc = (typeof docs)[number];

  /** 선택 문서의 합계 + 일별(감축 실적) / 월별(연간) 줄 */
  const build = (doc: ReportDoc) => {
    const inDoc = (m: string) => (doc.kind === 'year' ? m.startsWith(doc.period) : m === doc.period);
    const mine = rows.filter((r) => r.facility.id === doc.f.id && inDoc(r.month));
    const sum = totalsOf(mine);
    let acc = 0;
    const lines =
      doc.kind === 'month'
        ? days
            .filter((d) => d.date.startsWith(doc.period) && d.kwh > 0)
            .map((d) => {
              acc += d.tco2;
              return { at: d.date, kwh: d.kwh, tco2: d.tco2, acc: r3(acc) };
            })
        : Array.from({ length: 12 }, (_, i) => `${doc.period}-${String(i + 1).padStart(2, '0')}`)
            .map((m) => ({ m, t: totalsOf(mine.filter((r) => r.month === m)) }))
            .filter((x) => x.t.kwh > 0)
            .map((x) => {
              acc += x.t.tco2;
              return { at: x.m, kwh: x.t.kwh, tco2: x.t.tco2, acc: r3(acc) };
            });
    return { sum, lines };
  };

  /* 내보내기 — 통합관제처럼 발전소 실적 한 줄 */
  const exportData = (doc: ReportDoc) => {
    const { sum } = build(doc);
    return {
      file: `${doc.title} · ${doc.name}`,
      headers: ['발전소', '발전원', '계약 유형', '설비 용량 kW', '발전량 kWh', '감축량 tCO2eq'],
      rows: [[doc.name, sourceOf(doc.f.source).label, doc.f.kind, doc.f.kw, sum.kwh, sum.tco2]],
    };
  };
  const onPdf = (doc: ReportDoc) => {
    const d = exportData(doc);
    void exportPdf(d.file, d.file, d.headers, d.rows);
  };

  /* 미리보기에 그릴 문서 — 통합관제 월간 보고서와 같은 구성(기간 · 대상 · 계약 유형 · 생성일 → 요약 → 실적 → 일별) */
  const previewDoc = useMemo<ReportPreviewDoc | null>(() => {
    if (!selected || !f) return null;
    const { sum, lines } = build(selected);
    const isYear = selected.kind === 'year';
    return {
      title: `${selected.title} · ${name}`,
      kindLabel: `온실가스 인벤토리 · ${isYear ? '연간' : '월간'} 보고서`,
      meta: [
        ['기간', selected.label],
        ['대상', `${name} · 설비 ${fmt(f.kw, 2)} kW`],
        ['계약 유형', f.kind],
        ['생성일', selected.createdAt],
      ],
      sections: [
        {
          heading: '요약',
          rows: [
            ['총 감축량', `${fmtT(sum.tco2)} tCO₂eq`],
            ['총 발전량', `${fmt(sum.kwh)} kWh`],
            ['전력 배출계수', `${fx.co2} tCO₂eq/MWh`],
          ],
        },
        {
          heading: '실적',
          rows: [
            ['발전소', `${name} (${sourceOf(f.source).label})`],
            ['설비 용량', `${fmt(f.kw, 2)} kW`],
            ['발전량', `${fmt(sum.kwh)} kWh`],
            ['감축량', `${fmtT(sum.tco2)} tCO₂eq`],
          ],
        },
        {
          heading: isYear ? '월별 감축량' : '일별 감축량',
          headers: [isYear ? '월' : '일자', '발전량', '감축량', '누적 감축량'],
          rows: lines.map((l) => [l.at, `${fmt(l.kwh)} kWh`, `${fmt(l.tco2, 3)} tCO₂eq`, `${fmt(l.acc, 3)} tCO₂eq`]),
        },
      ],
      note: `통합관제에서 수집한 발전 이력에 전력 배출계수를 곱해 ${isYear ? '연' : '월'} 단위로 집계한 보고서입니다. ${isYear ? '연' : '월'} 마감 후 자동 생성됩니다.`,
    };
  }, [selected, f, rows, days, fx, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const th = 'px-4 py-2.5 text-left text-xs font-medium text-slate-400';
  const td = 'px-4 py-3 text-sm';

  return (
    <div className="space-y-6">
      <GhgHeader title="보고서" />

      {/* 연도 · 월 · 종류 · 기업 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-5 py-3 ring-1 ring-white/[0.06]">
        <span className="text-sm text-slate-400">연도</span>
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= FIRST_YEAR}
          className="rounded-md p-1.5 text-slate-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="이전 연도"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-bold tabular-nums text-white">{year}년</span>
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
          <Select options={REPORT_MONTH_OPTIONS} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        </div>
        {pickOptions.length > 2 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-400">기업</span>
            <div className="w-52">
              <Select
                options={pickOptions}
                value={pickKey}
                onChange={(e) => {
                  setPickKey(e.target.value);
                  setSelectedId(null);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 목록 왼쪽 · 미리보기 문서 오른쪽 */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:grid-cols-[minmax(0,1fr)_480px]">
        <SectionCard
          title={`보고서 목록 (${docs.length})`}
          actions={
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
            </div>
          }
          noPadding
          className="!h-auto min-w-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <th className={th}>기간</th>
                  <th className={th}>문서</th>
                  <th className={th}>기업</th>
                  <th className={th}>생성일</th>
                  <th className={th}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`cursor-pointer border-b border-white/5 transition-colors ${selected?.id === d.id ? 'bg-primary/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <td className={`${td} whitespace-nowrap font-medium tabular-nums text-white`}>{d.period}</td>
                    <td className={`${td} whitespace-nowrap text-slate-200`}>{GHG_KIND_LABEL[d.kind]} 보고서</td>
                    <td className={`${td} whitespace-nowrap text-slate-200`}>{d.name}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-slate-400`}>{d.createdAt}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(d.id);
                          onPdf(d);
                        }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                        title="PDF"
                      >
                        <FileText size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      {pickKey.startsWith('p-') ? '보고서 항목이 아직 정해지지 않았습니다' : '보고서가 없습니다'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* 문서 미리보기 — 실제 문서(종이) 모습 그대로. 행을 누르면 이 자리가 그 문서로 바뀐다 */}
        {selected && previewDoc && (
          <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">미리보기</p>
                <p className="truncate text-sm font-semibold text-white">
                  {selected.title} · {name}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => onPdf(selected)}>
                  <FileText size={14} className="mr-1" /> PDF
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
