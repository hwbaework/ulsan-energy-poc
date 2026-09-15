// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Sun,
  Wind,
  _Battery,
  _Zap,
  _Leaf,
  _CreditCard,
  Activity,
  Building2,
  FileSignature,
  Download,
  Mail,
  Save,
  Lightbulb,
  FileText,
} from 'lucide-react';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { RmsLineChart, RmsAreaChart, RmsBarChart, RmsBarLineChart } from '@/components/ui/Chart';
import { cn, exportExcel, exportPdf } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';

/* ───────────────────────── Types & Mock data ───────────────────────── */
// NOTE: SITES / PpaContract 모델은 거래현황과 동일 구조 — 추후 공유 store/lib로 추출 예정

interface PpaContract {
  id: string;
  label: string;
  supplier: string;
  capacity: string;
}

interface Site {
  id: string;
  label: string;
  location: string;
  ppas: PpaContract[];
}

import { usePpaContracts } from '@/hooks/ppa/usePpa';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';
import { useAuthStore } from '@/stores/useAuthStore';

type TimeUnit = 'hour' | 'day' | 'month' | 'quarter' | 'year';
type CompareMode = 'target' | 'mom' | 'yoy';
type Resource = 'all' | 'pv' | 'wind' | 'ess' | 'fuelCell';

const TIME_UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'hour', label: '시간' },
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
  { value: 'quarter', label: '분기' },
  { value: 'year', label: '연' },
];
const COMPARE_OPTIONS: { value: CompareMode; label: string }[] = [
  { value: 'target', label: '목표대비' },
  { value: 'mom', label: '전월대비' },
  { value: 'yoy', label: '전년대비' },
];
const RESOURCE_OPTIONS: { value: Resource; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pv', label: 'PV' },
  { value: 'wind', label: '풍력' },
  { value: 'ess', label: 'ESS' },
  { value: 'fuelCell', label: '연료전지' },
];

/* ── Demand & supply flow data (empty — no PPA contracts) ─── */
function generateFlowData(_unit: TimeUnit): {
  time: string;
  pv: number;
  wind: number;
  fuelCell: number;
  ess: number;
  supply: number;
  supplyMom: number;
  demand: number;
  demandMom: number;
  demandYoy: number;
  errorPct: number;
  errorMom: number;
  errorYoy: number;
  target: number;
}[] {
  return [];
}

const UNIT_LABEL: Record<TimeUnit, string> = {
  hour: '시간대별',
  day: '일별',
  month: '월별',
  quarter: '분기별',
  year: '연도별',
};

/* ── 24/7 CFE Heatmap data (empty — no PPA contracts) ─────────────────────────────── */
const HEATMAP: { day: number; hour: number; rate: number }[][] = [];

/* ── RE100 이행률 (연도별 × 월별, %) ────────────────────────────────
 * - 목표선은 종점 목표값(2030: 60%, 2050: 100%)을 상수 처리 → 수평 참조선.
 * - 과거 연도는 PPA 점진 확장에 따라 baseline이 상승.
 */
const RE100_YEARS = [2026] as const;
type Re100Year = (typeof RE100_YEARS)[number];

const RE100_BY_YEAR: Record<Re100Year, { month: string; actual: number; target2030: number; target2050: number }[]> = {
  2026: [],
};

const RE100_ANNUAL_AVG: Record<Re100Year, number> = {
  2026: 0,
};

/* ── 24/7 CFE 시간대별 평균 (empty — no PPA contracts) ───────────── */
const CFE_HOURLY_AVG: number[] = Array.from({ length: 24 }, () => 0);

/* ── 자동 헷지 로그 (부족만) ─────────────────────────────── */
type HedgeResolution = 'internal' | 'kepco';

interface HedgeEvent {
  id: number;
  date: string;
  startHour: number;
  endHour: number;
  kwh: number;
  resolution: HedgeResolution;
  settlementImpact: number; // ₩, 음수=손실, 0=내부보완
  re100: string; // '−0.8%p' 등
  covered: string;
}

const HEDGE_LOG: HedgeEvent[] = [];

const formatHour = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const _formatTimeRange = (start: number, end: number) => `${formatHour(start)} ~ ${formatHour(end)}`;

const _HEDGE_RES_META: Record<HedgeResolution, { label: string; tone: string; bg: string; ring: string }> = {
  internal: { label: '내부 보완', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', ring: 'ring-emerald-500/30' },
  kepco: { label: '한전 청구', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
};

/* ───────────────────────── Sub-components ───────────────────────── */

function SegmentedToggle<V extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded transition-colors',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            opt.value === value ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ScopeTrigger({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[160px]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-white hover:bg-white/[0.08]',
      )}
    >
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="font-medium truncate flex-1">{value}</span>
      <ChevronDown size={14} className="text-slate-500 shrink-0" />
    </div>
  );
}

/**
 * 24/7 CFE 매칭률을 시간대별로 픽셀 블록 형태로 시각화.
 * 각 컬럼 = 한 시간, 컬럼당 ROWS개 셀. 매칭률에 비례해 하단부터 채워짐.
 * 상단에 시간대별 우세 자원 아이콘(풍력/태양광) 표시.
 */
function Cfe247Strip({ hourly }: { hourly: number[] }) {
  const ROWS = 8;
  const TIME_LABELS: { hour: number; label: string }[] = [
    { hour: 0, label: 'MIDNIGHT' },
    { hour: 6, label: 'MORNING' },
    { hour: 12, label: 'NOON' },
    { hour: 18, label: 'AFTERNOON' },
    { hour: 22, label: 'EVENING' },
  ];
  const WEATHER: { hour: number; icon: typeof Wind | typeof Sun; color: string }[] = [
    { hour: 4, icon: Wind, color: 'text-sky-400' },
    { hour: 12, icon: Sun, color: 'text-amber-400' },
    { hour: 19, icon: Wind, color: 'text-sky-400' },
  ];

  const gridStyle = { gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' };

  return (
    <div className="px-6 py-4">
      {/* Weather row */}
      <div className="grid gap-px mb-3 h-6" style={gridStyle}>
        {Array.from({ length: 24 }, (_, h) => {
          const w = WEATHER.find((x) => x.hour === h);
          return (
            <div key={h} className="flex items-center justify-center">
              {w && <w.icon size={16} className={w.color} />}
            </div>
          );
        })}
      </div>

      {/* Cell grid (8 rows × 24 cols) */}
      <div className="space-y-1">
        {Array.from({ length: ROWS }, (_, rowIdxFromTop) => (
          <div key={rowIdxFromTop} className="grid gap-px" style={gridStyle}>
            {Array.from({ length: 24 }, (_, h) => {
              const rate = hourly[h];
              const filled = Math.round((rate / 100) * ROWS);
              const isFilled = ROWS - rowIdxFromTop <= filled;
              return (
                <div
                  key={h}
                  title={`${h}시 — 매칭률 ${rate}%`}
                  className={cn('h-3 rounded-[2px] transition-colors', isFilled ? 'bg-emerald-400' : 'bg-white/[0.05]')}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Time labels */}
      <div className="grid mt-3 text-[10px] tracking-wider text-slate-500" style={gridStyle}>
        {Array.from({ length: 24 }, (_, h) => {
          const tl = TIME_LABELS.find((x) => x.hour === h);
          return (
            <div key={h} className="text-center whitespace-nowrap">
              {tl?.label}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          탄소 무배출 시간 (CFE 매칭)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.05] ring-1 ring-white/10" />
          미매칭 (한전 / 부족)
        </span>
        <span className="ml-auto text-slate-600">최근 30일 시간대별 평균</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function PpaPowerPage() {
  const _router = useRouter();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;

  const { data: contractsData } = usePpaContracts();
  const { data: sitesData } = useConsumerSites({ companyId });

  const SITES: Site[] = useMemo(() => {
    const apiSites = (sitesData?.content ?? []).filter((s: any) => !s.deletedAt) as any[];
    const apiContracts = (contractsData?.content ?? []) as any[];
    if (apiSites.length === 0 && apiContracts.length === 0) return [];
    if (apiSites.length === 0) {
      return [
        {
          id: 'default',
          label: '전사',
          location: '',
          ppas: apiContracts.map((c: any) => ({
            id: String(c.id),
            label: c.contractNumber ?? `PPA-${c.id}`,
            supplier: c.generatorCompanyName ?? '발전사',
            capacity: `${c.totalCapacityKw ?? 0} kW`,
          })),
        },
      ];
    }
    return apiSites.map((s: any) => ({
      id: String(s.id),
      label: s.name,
      location: s.address ?? '',
      ppas: apiContracts
        .filter((c: any) => c.consumerSiteName === s.name || !c.consumerSiteName)
        .map((c: any) => ({
          id: String(c.id),
          label: c.contractNumber ?? `PPA-${c.id}`,
          supplier: c.generatorCompanyName ?? '발전사',
          capacity: `${c.totalCapacityKw ?? 0} kW`,
        })),
    }));
  }, [sitesData, contractsData]);

  const TOTAL_PPA_COUNT = SITES.reduce((s, x) => s + x.ppas.length, 0);

  // Scope state
  const [siteId, setSiteId] = useState<'all' | string>('all');
  const [ppaId, setPpaId] = useState<'all' | string>('all');
  const selectedSite = useMemo(
    () => (siteId === 'all' ? null : (SITES.find((s) => s.id === siteId) ?? null)),
    [siteId, SITES],
  );
  const availablePpas = selectedSite?.ppas ?? [];
  const selectedPpa = useMemo(
    () => (ppaId === 'all' ? null : (availablePpas.find((p) => p.id === ppaId) ?? null)),
    [ppaId, availablePpas],
  );

  // Control state
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('hour');
  const [compareMode, setCompareMode] = useState<CompareMode>('target');
  const [resource, setResource] = useState<Resource>('all');
  const [re100BySite, setRe100BySite] = useState(false);
  const [re100Year, setRe100Year] = useState<Re100Year>(2026);

  const re100Data = RE100_BY_YEAR[re100Year];
  const re100YearAvg = RE100_ANNUAL_AVG[re100Year];
  const re100PrevAvg = re100Year > RE100_YEARS[0] ? RE100_ANNUAL_AVG[(re100Year - 1) as Re100Year] : null;
  const re100Yoy = re100PrevAvg !== null ? Math.round((re100YearAvg - re100PrevAvg) * 10) / 10 : null;

  // Threshold state
  const [thresholds, setThresholds] = useState({ matchingMin: 80, errorMax: 10, shortageHours: 24 });

  const handleSiteChange = (id: 'all' | string) => {
    setSiteId(id);
    setPpaId('all');
  };

  // Resource filter for supply chart
  const supplyAreas = useMemo(() => {
    const all = [
      { key: 'pv', name: '태양광', color: '#F59E0B' },
      { key: 'wind', name: '풍력', color: '#06B6D4' },
      { key: 'fuelCell', name: '연료전지', color: '#A78BFA' },
      { key: 'ess', name: 'ESS', color: '#F43F5E' },
    ];
    if (resource === 'all') return all;
    const map: Record<Exclude<Resource, 'all'>, string> = {
      pv: 'pv',
      wind: 'wind',
      ess: 'ess',
      fuelCell: 'fuelCell',
    };
    return all.filter((a) => a.key === map[resource]);
  }, [resource]);

  // Time unit → re-generate data; compare mode → add comparison line
  const flowData = useMemo(() => generateFlowData(timeUnit), [timeUnit]);

  const demandLines = useMemo(() => {
    const base: { key: string; name: string; color: string }[] = [
      { key: 'demand', name: '사용자 사용량', color: '#F59E0B' },
    ];
    if (compareMode === 'mom') base.push({ key: 'demandMom', name: '전월 동기', color: '#94A3B8' });
    else if (compareMode === 'yoy') base.push({ key: 'demandYoy', name: '전년 동기', color: '#64748B' });
    return base;
  }, [compareMode]);

  const errorLines = useMemo(() => {
    const base: { key: string; name: string; color: string }[] = [
      { key: 'errorPct', name: '오차율 (%)', color: '#F43F5E' },
      { key: 'target', name: '목표 0%', color: '#10B981' },
    ];
    if (compareMode === 'mom') base.push({ key: 'errorMom', name: '전월 오차율', color: '#94A3B8' });
    else if (compareMode === 'yoy') base.push({ key: 'errorYoy', name: '전년 오차율', color: '#64748B' });
    return base;
  }, [compareMode]);

  const compareLabel = compareMode === 'target' ? '목표대비' : compareMode === 'mom' ? '전월대비' : '전년대비';

  const _scopeDescription = selectedPpa
    ? `${selectedSite!.label} > ${selectedPpa.label}`
    : selectedSite
      ? `${selectedSite.label} (${selectedSite.location})`
      : `전사 합산 · ${TOTAL_PPA_COUNT}개 PPA`;

  if (SITES.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">전력관리</h1>
          <p className="mt-1 text-sm text-slate-400">PPA 전력 수급 현황</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity size={40} className="text-slate-600 mb-4" />
          <p className="text-sm text-slate-400 mb-2">전력관리 데이터가 아직 없습니다</p>
          <p className="text-xs text-slate-600">PPA 계약이 체결되면 여기에 전력 수급 현황이 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">전력 현황</h1>
          <p className="mt-1 text-sm text-slate-400">전체 계약 통합 · CFE 매칭 · RE100 · 전력 수급</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const headers = ['시간', 'PV(kWh)', '풍력(kWh)', '연료전지(kWh)', 'ESS(kWh)', '수요(kWh)', 'CFE(%)'];
              const rows = flowData.map((d: any) => [d.label, d.pv, d.wind, d.fuelCell, d.ess, d.demand, d.cfeScore]);
              exportExcel(`전력현황-${new Date().toISOString().slice(0, 10)}`, '전력현황', headers, rows);
            }}
          >
            <Download size={14} className="mr-1" />
            엑셀
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const headers = ['시간', 'PV(kWh)', '풍력(kWh)', '연료전지(kWh)', 'ESS(kWh)', '수요(kWh)', 'CFE(%)'];
              const rows = flowData.map((d: any) => [d.label, d.pv, d.wind, d.fuelCell, d.ess, d.demand, d.cfeScore]);
              exportPdf(`전력현황-${new Date().toISOString().slice(0, 10)}`, '전력 현황 보고서', headers, rows);
            }}
          >
            <FileText size={14} className="mr-1" />
            PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!window.confirm('전력 현황 보고서를 이메일로 발송하시겠습니까?')) return;
              useToastStore.getState().add('success', '이메일 발송 요청 완료');
            }}
          >
            <Mail size={14} className="mr-1" />
            이메일
          </Button>
        </div>
      </div>

      {/* ───────── KPI 요약 ───────── */}
      <StatsGrid columns={4}>
        <StatCard label="24/7 CFE 매칭률" value="—" sub="직접 PPA 계약 없음" />
        <StatCard label="RE100 이행률" value="—" sub="직접 PPA 계약 없음" />
        <StatCard label="예상 정산금" value="₩0" />
        <StatCard label="CO₂ 절감" value="—" />
      </StatsGrid>

      {/* Scope controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div />
        <div className="flex flex-wrap gap-2">
          <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSite?.label ?? '전사 합산'} />}>
            <DropdownItem onClick={() => handleSiteChange('all')}>
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                <div>
                  <p className="text-sm">전사 합산</p>
                  <p className="text-xs text-slate-500">
                    {SITES.length}개 사업장 · {TOTAL_PPA_COUNT}개 PPA
                  </p>
                </div>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => (
              <DropdownItem key={s.id} onClick={() => handleSiteChange(s.id)}>
                <div className="flex items-center gap-2">
                  <Building2 size={14} />
                  <div>
                    <p className="text-sm">{s.label}</p>
                    <p className="text-xs text-slate-500">
                      {s.location} · {s.ppas.length}개 PPA
                    </p>
                  </div>
                </div>
              </DropdownItem>
            ))}
          </Dropdown>

          {selectedSite ? (
            <Dropdown
              align="left"
              trigger={<ScopeTrigger label="PPA" value={selectedPpa?.label ?? '사업장 내 전체'} />}
            >
              <DropdownItem onClick={() => setPpaId('all')}>
                <div className="flex items-center gap-2">
                  <FileSignature size={14} />
                  <div>
                    <p className="text-sm">사업장 내 전체</p>
                    <p className="text-xs text-slate-500">{availablePpas.length}개 PPA 합산</p>
                  </div>
                </div>
              </DropdownItem>
              <div className="my-1 border-t border-white/[0.06]" />
              {availablePpas.map((p) => (
                <DropdownItem key={p.id} onClick={() => setPpaId(p.id)}>
                  <div className="flex items-center gap-2">
                    <FileSignature size={14} />
                    <div>
                      <p className="text-sm">{p.label}</p>
                      <p className="text-xs text-slate-500">
                        {p.supplier} · {p.capacity}
                      </p>
                    </div>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
          ) : (
            <ScopeTrigger label="PPA" value="—" disabled />
          )}
        </div>
      </div>

      {/* RE100 이행률 (최상단) */}
      <SectionCard
        title={`RE100 이행률 — ${re100Year}년`}
        description={`연 평균 ${re100YearAvg}%${re100Yoy !== null ? ` (전년 대비 ${re100Yoy >= 0 ? '+' : ''}${re100Yoy}%p)` : ''} · 목표선 2030 60% / 2050 100%`}
        actions={
          <div className="flex items-center gap-2">
            <Dropdown
              align="right"
              trigger={
                <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08] cursor-pointer">
                  <span className="text-slate-500">연도</span>
                  <span className="font-medium tabular-nums">{re100Year}년</span>
                  <ChevronDown size={12} className="text-slate-500" />
                </div>
              }
            >
              {[...RE100_YEARS].reverse().map((y) => (
                <DropdownItem key={y} onClick={() => setRe100Year(y)}>
                  <div className="flex items-center justify-between gap-4 min-w-[120px]">
                    <span
                      className={cn(
                        'text-sm tabular-nums',
                        y === re100Year ? 'text-primary font-semibold' : 'text-slate-200',
                      )}
                    >
                      {y}년
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">{RE100_ANNUAL_AVG[y]}%</span>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
            <button
              onClick={() => setRe100BySite((v) => !v)}
              className={cn(
                'rounded px-2 py-1 text-xs transition-colors',
                re100BySite ? 'bg-primary text-white' : 'bg-white/[0.04] text-slate-400 hover:text-white',
              )}
            >
              사업장 분해 {re100BySite ? 'ON' : 'OFF'}
            </button>
          </div>
        }
      >
        <div className="px-2">
          <RmsBarLineChart
            data={re100Data}
            xKey="month"
            bars={[{ key: 'actual', name: `${re100Year}년 월별 실적`, color: '#10B981' }]}
            lines={[
              { key: 'target2030', name: '2030 목표 (60%)', color: '#F59E0B', dashed: true },
              { key: 'target2050', name: '2050 목표 (100%)', color: '#6366F1', dashed: true },
            ]}
            yUnit="%"
            yDomain={[0, 100]}
            height={260}
          />
          {re100BySite && <p className="px-4 pb-2 text-xs text-slate-500">사업장 분해: 데이터 없음</p>}
        </div>

        {/* 연도별 평균 이행률 스트립 — 선택 연도 기준 최근 5개년 */}
        {(() => {
          const selectedIdx = RE100_YEARS.indexOf(re100Year);
          const start = Math.max(0, Math.min(selectedIdx - 4, RE100_YEARS.length - 5));
          const visibleYears = RE100_YEARS.slice(start, start + 5);
          return (
            <div className="border-t border-white/[0.06] px-4 py-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">연도별 평균 이행률 (YoY)</p>
              <div className="grid grid-cols-5 gap-2">
                {visibleYears.map((y) => {
                  const avg = RE100_ANNUAL_AVG[y];
                  const yIdx = RE100_YEARS.indexOf(y);
                  const prev = yIdx > 0 ? RE100_ANNUAL_AVG[RE100_YEARS[yIdx - 1]] : null;
                  const diff = prev !== null ? Math.round((avg - prev) * 10) / 10 : null;
                  const isCurrent = y === re100Year;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setRe100Year(y)}
                      className={cn(
                        'rounded-lg px-3 py-2 text-left transition-colors',
                        isCurrent
                          ? 'bg-primary/[0.10] ring-1 ring-primary/40'
                          : 'bg-white/[0.03] ring-1 ring-white/[0.04] hover:bg-white/[0.06]',
                      )}
                    >
                      <p className="text-[10px] text-slate-500 tabular-nums">{y}</p>
                      <p
                        className={cn(
                          'text-base font-semibold tabular-nums',
                          isCurrent ? 'text-white' : 'text-slate-200',
                        )}
                      >
                        {avg}
                        <span className="text-[10px] text-slate-500 ml-0.5">%</span>
                      </p>
                      {diff !== null && (
                        <p
                          className={cn(
                            'text-[10px] tabular-nums mt-0.5',
                            diff >= 0 ? 'text-emerald-400' : 'text-amber-400',
                          )}
                        >
                          {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}%p
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </SectionCard>

      {/* Control Bar (시간 기반 차트들 직전에 위치) */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">시간 단위</span>
            <SegmentedToggle options={TIME_UNIT_OPTIONS} value={timeUnit} onChange={setTimeUnit} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">비교</span>
            <SegmentedToggle options={COMPARE_OPTIONS} value={compareMode} onChange={setCompareMode} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">자원</span>
            <SegmentedToggle options={RESOURCE_OPTIONS} value={resource} onChange={setResource} size="sm" />
          </div>
        </div>
      </SectionCard>

      {/* 기본 운영 그래프 - 1: 수급량 + 공급량 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RmsLineChart
          data={flowData}
          xKey="time"
          lines={demandLines}
          title="전력수급량"
          description={`${UNIT_LABEL[timeUnit]} 사용자 수요${compareMode !== 'target' ? ` · ${compareLabel}` : ''}`}
          height={260}
        />
        <RmsAreaChart
          data={flowData}
          xKey="time"
          areas={supplyAreas}
          stacked
          title="전력공급량"
          description={`${UNIT_LABEL[timeUnit]} 자원별 공급 누적 (PV/풍력/연료전지/ESS)`}
          height={260}
        />
      </div>

      {/* 기본 운영 그래프 - 2: 매칭오차율 */}
      <RmsLineChart
        data={flowData}
        xKey="time"
        lines={errorLines}
        title="매칭오차율"
        description={`(수요 − 공급) / 수요 × 100, 목표선 0%${compareMode !== 'target' ? ` · ${compareLabel}` : ''}`}
        height={220}
      />

      {/* 24/7 CFE 매칭률 — 시간대별 픽셀 스트립 */}
      <SectionCard
        title="★ 24/7 CFE 매칭률"
        description="시간대별 탄소 무배출 에너지 매칭 패턴 — 풍력·태양광 가용 시간에 부하를 정렬"
        actions={
          <Badge variant="info" className="text-[10px]">
            시그니처
          </Badge>
        }
      >
        <Cfe247Strip hourly={CFE_HOURLY_AVG} />
      </SectionCard>

      {/* 자동 헷지 로그 (부족 처리 이력) */}
      <div id="hedge-log" className="scroll-mt-20">
        <HedgeLogSection timeUnit={timeUnit} compareMode={compareMode} resource={resource} />
      </div>

      {/* 알림 임계값 + 출력 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard title="알림 임계값" description="값 미만/초과 시 알림 발송 (사용자 설정)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">매칭률 미만 (%)</label>
              <Input
                type="number"
                value={thresholds.matchingMin}
                onChange={(e) => setThresholds((t) => ({ ...t, matchingMin: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">오차율 초과 (%)</label>
              <Input
                type="number"
                value={thresholds.errorMax}
                onChange={(e) => setThresholds((t) => ({ ...t, errorMax: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">부족시간 초과 (시간)</label>
              <Input
                type="number"
                value={thresholds.shortageHours}
                onChange={(e) => setThresholds((t) => ({ ...t, shortageHours: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="px-6 pb-4">
            <Button
              size="sm"
              variant="primary"
              onClick={() => useToastStore.getState().add('success', '알림 설정이 저장되었습니다')}
            >
              저장
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="출력 / 자동 발송" description="기간별 자동 생성, 24/7 리포트는 문서 보관함 자동 저장">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const headers = ['시간', 'PV(kWh)', '풍력(kWh)', '연료전지(kWh)', 'ESS(kWh)', '수요(kWh)', 'CFE(%)'];
                const rows = flowData.map((d: any) => [d.label, d.pv, d.wind, d.fuelCell, d.ess, d.demand, d.cfeScore]);
                exportExcel(`발전현황-${new Date().toISOString().slice(0, 10)}`, '발전현황', headers, rows);
              }}
            >
              <Download size={14} className="mr-1.5" />
              엑셀 다운로드
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const headers = ['시간', 'PV(kWh)', '풍력(kWh)', '연료전지(kWh)', 'ESS(kWh)', '수요(kWh)', 'CFE(%)'];
                const rows = flowData.map((d: any) => [d.label, d.pv, d.wind, d.fuelCell, d.ess, d.demand, d.cfeScore]);
                exportPdf(`발전현황-${new Date().toISOString().slice(0, 10)}`, '발전 현황 보고서', headers, rows);
              }}
            >
              <FileText size={14} className="mr-1.5" />
              PDF 다운로드
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!window.confirm('발전 현황 보고서를 관련 담당자에게 이메일 발송하시겠습니까?')) return;
                useToastStore.getState().add('success', '정기 이메일 발송 요청 완료');
              }}
            >
              <Mail size={14} className="mr-1.5" />
              정기 이메일 발송
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                useToastStore.getState().add('success', '24/7 CFE 리포트 자동 저장이 활성화되었습니다');
              }}
            >
              <Save size={14} className="mr-1.5" />
              24/7 리포트 자동 저장
            </Button>
          </div>
          <p className="px-6 pb-4 text-xs text-slate-500">
            ※ 24/7 CFE 시간대별 이행 리포트는 생성 후 <span className="text-slate-300">문서 → 문서 보관함</span>에 자동
            저장됩니다.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

/* ───────────────────────── Hedge Log Section ───────────────────────── */

const RESOURCE_KEYWORD: Record<Exclude<Resource, 'all'>, string> = {
  pv: 'PV',
  wind: '풍력',
  ess: 'ESS',
  fuelCell: '연료전지',
};

function matchesResource(event: HedgeEvent, resource: Resource): boolean {
  if (resource === 'all') return true;
  const keyword = RESOURCE_KEYWORD[resource];
  return event.covered.includes(keyword);
}

function HedgeLogSection({
  timeUnit,
  compareMode,
  resource,
}: {
  timeUnit: TimeUnit;
  compareMode: CompareMode;
  resource: Resource;
}) {
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const availableMonths = useMemo(
    () => Array.from(new Set(HEDGE_LOG.map((e) => `${parseInt(e.date.split('/')[0])}월`))).sort(),
    [],
  );

  const filtered = HEDGE_LOG.filter((e) => {
    if (!matchesResource(e, resource)) return false;
    const m = `${parseInt(e.date.split('/')[0])}월`;
    if (monthFilter !== 'all' && m !== monthFilter) return false;
    return true;
  });

  const shortageCount = HEDGE_LOG.filter((e) => matchesResource(e, resource)).length;
  const netImpact = filtered.reduce((s, e) => s + e.settlementImpact, 0);

  const compareLabel = compareMode === 'target' ? null : compareMode === 'mom' ? '전월대비' : '전년대비';
  const resourceLabel = resource === 'all' ? null : RESOURCE_KEYWORD[resource];

  return (
    <SectionCard
      title="자동 헷지 로그"
      description={
        '부족 자동 처리 이력 — ' +
        UNIT_LABEL[timeUnit] +
        ' 집계' +
        (resourceLabel ? ` · ${resourceLabel} 자원만` : '') +
        (compareLabel ? ` · ${compareLabel}` : '')
      }
      actions={
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-slate-500">
            부족 발생 <span className="font-semibold text-amber-300 tabular-nums">{shortageCount}회</span>
          </span>
          <span className="text-[11px] text-slate-500">
            정산 순영향{' '}
            <span className={cn('font-semibold tabular-nums', netImpact >= 0 ? 'text-emerald-300' : 'text-amber-300')}>
              {netImpact >= 0 ? '+' : '−'}₩{Math.abs(netImpact).toLocaleString()}
            </span>
          </span>

          {/* 월 셀렉트 */}
          <Dropdown
            align="right"
            trigger={
              <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08] cursor-pointer">
                <span className="text-slate-500">기간</span>
                <span className="font-medium">{monthFilter === 'all' ? '전체' : monthFilter}</span>
                <ChevronDown size={12} className="text-slate-500" />
              </div>
            }
          >
            <DropdownItem onClick={() => setMonthFilter('all')}>
              <span className={cn('text-sm', monthFilter === 'all' ? 'text-primary font-semibold' : 'text-slate-200')}>
                전체 기간
              </span>
            </DropdownItem>
            {availableMonths.map((m) => (
              <DropdownItem key={m} onClick={() => setMonthFilter(m)}>
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    monthFilter === m ? 'text-primary font-semibold' : 'text-slate-200',
                  )}
                >
                  {m}
                </span>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      }
    >
      {/* 부족 막대 차트 (날짜별 합계) */}
      <div className="px-2 pt-2">
        {(() => {
          // 같은 날 이벤트 합산 (부족만)
          const dateMap = new Map<string, number>();
          for (const e of filtered) {
            dateMap.set(e.date, (dateMap.get(e.date) ?? 0) + e.kwh);
          }

          const chartRows: { label: string; shortage: number }[] = (() => {
            if (monthFilter !== 'all') {
              const m = parseInt(monthFilter);
              const daysInMonth = new Date(2026, m, 0).getDate();
              return Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const date = `${m}/${d}`;
                return { label: date, shortage: dateMap.get(date) ?? 0 };
              });
            }
            return Array.from(dateMap.entries())
              .sort(([a], [b]) => {
                const [am, ad] = a.split('/').map(Number);
                const [bm, bd] = b.split('/').map(Number);
                return am !== bm ? am - bm : ad - bd;
              })
              .map(([date, kwh]) => ({ label: date, shortage: kwh }));
          })();

          if (chartRows.length === 0) {
            return <div className="px-6 py-12 text-center text-sm text-slate-500">조건에 맞는 이벤트가 없습니다</div>;
          }

          return (
            <RmsBarChart
              data={chartRows}
              xKey="label"
              bars={[{ key: 'shortage', name: '부족 (kWh)', color: '#F59E0B' }]}
              height={280}
            />
          );
        })()}
      </div>

      {/* AI Insight */}
      <div className="mx-6 mb-4 mt-2 rounded-lg bg-violet-500/[0.08] ring-1 ring-violet-500/20 p-4">
        <div className="flex items-start gap-2">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-violet-400" />
          <div className="text-sm">
            <p className="font-medium text-violet-300">AI 인사이트 — 다음 갱신 시 추천</p>
            <p className="mt-1 text-slate-400">
              <span className="text-white">저녁 부족</span>은 18~21시에 집중 발생.
              <span className="text-white"> ESS 200 kW 추가 계약</span>으로 한낮 잉여 발전을 저녁대로 이전하면 헷지 비용
              ~₩160K/월 절감 + 매칭률 91% 가능.
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
