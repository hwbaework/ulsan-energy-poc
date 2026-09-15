// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Building2,
  ArrowLeftRight,
  _Activity,
  _History,
  Coins,
  Sun,
  Wind,
  Battery,
  Zap,
  _Leaf,
  TrendingUp,
  _TrendingDown,
  AlertTriangle,
  AlertCircle,
  _CheckCircle2,
  _Bell,
  Search,
  Calendar,
  ChevronRight,
  ChevronDown,
  MapPin,
  CreditCard,
  _Receipt,
  _Target,
  Download,
  FileText,
  FileSpreadsheet,
  Filter,
  X,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsLineChart, RmsBarChart } from '@/components/ui/Chart';
import { cn, exportCsv, exportExcel, exportPdf } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

/* ─────────────────────────────────────────────
   Types & meta
   ───────────────────────────────────────────── */
export type Tab = 'generators' | 'consumers' | 'matching' | 'margin';
type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type SettlementStatus = 'tentative' | 'confirmed' | 'disputed' | 'recalculated';
type ContractType = 'fixed' | 'variable' | 'mixed';
type EnergySource = 'solar' | 'wind' | 'ess' | 'bio';

const PERIOD_LABEL: Record<Period, string> = {
  today: '일',
  week: '주',
  month: '월',
  quarter: '분기',
  year: '연',
  custom: '사용자정의',
};

const SOURCE_META_MAP: Record<string, { label: string; icon: any; color: string; bg: string; ring: string }> = {
  solar: { label: '태양광', icon: Sun, color: 'text-amber-400', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  wind: { label: '풍력', icon: Wind, color: 'text-sky-400', bg: 'bg-sky-500/[0.10]', ring: 'ring-sky-500/30' },
  ess: { label: 'ESS', icon: Battery, color: 'text-rose-400', bg: 'bg-rose-500/[0.10]', ring: 'ring-rose-500/30' },
  bio: { label: '바이오', icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/[0.10]', ring: 'ring-violet-500/30' },
};
const SOURCE_META_DEFAULT = {
  label: '기타',
  icon: Zap,
  color: 'text-slate-400',
  bg: 'bg-slate-500/[0.10]',
  ring: 'ring-slate-500/30',
};
const SOURCE_META = new Proxy(SOURCE_META_MAP, { get: (t, k) => t[k as string] ?? SOURCE_META_DEFAULT }) as Record<
  EnergySource,
  typeof SOURCE_META_DEFAULT
>;

const SETTLEMENT_META_MAP: Record<string, { label: string; ring: string; bg: string; tone: string }> = {
  tentative: { label: '잠정', ring: 'ring-amber-500/30', bg: 'bg-amber-500/[0.10]', tone: 'text-amber-300' },
  confirmed: { label: '확정', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/[0.10]', tone: 'text-emerald-300' },
  disputed: { label: '분쟁중', ring: 'ring-rose-500/30', bg: 'bg-rose-500/[0.10]', tone: 'text-rose-300' },
  recalculated: { label: '재정산', ring: 'ring-violet-500/30', bg: 'bg-violet-500/[0.10]', tone: 'text-violet-300' },
};
const SETTLEMENT_META_DEFAULT = {
  label: '-',
  ring: 'ring-slate-500/30',
  bg: 'bg-slate-500/[0.10]',
  tone: 'text-slate-300',
};
const SETTLEMENT_META = new Proxy(SETTLEMENT_META_MAP, {
  get: (t, k) => t[k as string] ?? SETTLEMENT_META_DEFAULT,
}) as Record<SettlementStatus, typeof SETTLEMENT_META_DEFAULT>;

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  fixed: '고정 PPA',
  variable: '변동 PPA',
  mixed: '혼합',
};

/* ─────────────────────────────────────────────
   단위 자동 스케일링
   ───────────────────────────────────────────── */
function fmtEnergy(kwh: number, forceUnit?: 'kWh' | 'MWh' | 'GWh') {
  if (forceUnit === 'GWh' || (!forceUnit && kwh >= 1_000_000)) return `${(kwh / 1_000_000).toFixed(2)} GWh`;
  if (forceUnit === 'MWh' || (!forceUnit && kwh >= 1_000)) return `${(kwh / 1_000).toFixed(1)} MWh`;
  return `${kwh.toLocaleString()} kWh`;
}

function fmtKrw(n: number) {
  if (Math.abs(n) >= 100_000_000) return `₩ ${(n / 100_000_000).toFixed(2)}억`;
  if (Math.abs(n) >= 10_000) return `₩ ${(n / 10_000).toFixed(0)}만`;
  return `₩ ${n.toLocaleString()}`;
}

/* ─────────────────────────────────────────────
   알림 위젯 데이터
   ───────────────────────────────────────────── */
const FLOW_ALERTS = {
  toConfirmed: { count: 0, diffPct: 0 },
  newDisputes: 0,
  recalcPending: 0,
};

/* ─────────────────────────────────────────────
   발전사 거래 데이터
   ───────────────────────────────────────────── */
type GenRow = {
  id: string;
  plant: string;
  owner: string;
  source: EnergySource;
  capacity: number; // MW
  contractType: ContractType;
  opDays: number;
  totalGen: number; // kWh
  ppaSupply: number; // kWh
  ppaUnitPrice: number; // 원/kWh
  smpSupply: number; // kWh
  smpUnitPrice: number;
  totalRevenue: number; // 원
  settlementDue: number; // 원
  recAvailable: number; // 발급 가능
  settlementStatus: SettlementStatus;
};

// 직접 PPA 계약 0건 — 거래 데이터 없음 (Lease는 /platform/lease 에서 관리)
const GEN_ROWS: GenRow[] = [];

/* ─────────────────────────────────────────────
   수용가 거래 데이터
   ───────────────────────────────────────────── */
type ConRow = {
  id: string;
  name: string;
  contractType: ContractType;
  supplied: number; // kWh, 총 공급받은 양
  contracted: number; // kWh, 약정량
  fulfillment: number; // %
  unitPrice: number; // 평균 단가
  billDue: number; // 청구 예정액
  re100Rate: number; // %
  cfeRate: number; // %
  cfeTarget: number;
  re100: boolean;
  ppaCount: number;
  settlementStatus: SettlementStatus;
};

// 직접 PPA 계약 0건 — 수용가 거래 데이터 없음
const CON_ROWS: ConRow[] = [];

/* ─────────────────────────────────────────────
   매칭 이력 (감사 로그)
   ───────────────────────────────────────────── */
type MatchType = 'normal' | 'shortage' | 'excess';
type MatchLog = {
  id: string;
  datetime: string; // 'YYYY-MM-DD HH:mm'
  generator: string;
  plant: string;
  consumer: string;
  contractNo: string;
  kwh: number;
  priority: { rank: number; reason: string };
  algoVersion: string;
  matchType: MatchType;
  disputed: boolean;
};

// 직접 PPA 계약 0건 — 매칭 이력 없음
const MATCH_LOGS: MatchLog[] = [];

/* ─────────────────────────────────────────────
   SPC 마진
   ───────────────────────────────────────────── */
type MarginRow = {
  id: string;
  txNo: string;
  datetime: string;
  generator: string;
  consumer: string;
  contractType: ContractType;
  billed: number; // 수용가 청구액
  paid: number; // 발전사 지급액
  margin: number; // billed - paid (= SPC 마진)
  marginRate: number; // %
  recBonus: number;
  penaltyShare: number;
};

// 직접 PPA 계약 0건 — 마진 데이터 없음
const MARGIN_ROWS: MarginRow[] = [];
const MARGIN_BY_GEN: { name: string; 마진율: number }[] = [];
const MARGIN_BY_CON: { name: string; 마진율: number }[] = [];
const MARGIN_BY_TYPE: { name: string; 마진율: number }[] = [];

/* ─────────────────────────────────────────────
   24h 차트 (master-detail용)
   ───────────────────────────────────────────── */
function buildHourlyGen(_plantId: string) {
  return [] as { time: string; 발전량: number; 약정: number }[];
}

function buildHourlyCfe(_consumerId: string) {
  return [] as { time: string; 매칭률: number; 목표: number }[];
}

const CFE_TREND_MONTHLY: { month: string; 매칭률: number }[] = [];

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export function PlatformPpaStatusContent({ defaultTab = 'generators' }: { defaultTab?: Tab }) {
  const router = useRouter();
  const [tab, _setTab] = useState<Tab>(defaultTab);
  const [period, setPeriod] = useState<Period>('month');
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<EnergySource | 'all'>('all');
  const [filterContract, setFilterContract] = useState<ContractType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SettlementStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGenId, setSelectedGenId] = useState<string | null>('g1');
  const [selectedConId, setSelectedConId] = useState<string | null>('c1');
  const [chartRange, setChartRange] = useState<'1d' | '7d' | '30d'>('1d');
  const [matchDetail, setMatchDetail] = useState<MatchLog | null>(null);

  /* Filtered data */
  const visibleGens = useMemo(() => {
    return GEN_ROWS.filter((g) => {
      if (filterSource !== 'all' && g.source !== filterSource) return false;
      if (filterContract !== 'all' && g.contractType !== filterContract) return false;
      if (filterStatus !== 'all' && g.settlementStatus !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!g.plant.toLowerCase().includes(q) && !g.owner.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filterSource, filterContract, filterStatus, search]);

  const visibleCons = useMemo(() => {
    return CON_ROWS.filter((c) => {
      if (filterContract !== 'all' && c.contractType !== filterContract) return false;
      if (filterStatus !== 'all' && c.settlementStatus !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filterContract, filterStatus, search]);

  const visibleLogs = useMemo(() => {
    if (!search) return MATCH_LOGS;
    const q = search.toLowerCase();
    return MATCH_LOGS.filter(
      (m) =>
        m.generator.toLowerCase().includes(q) ||
        m.plant.toLowerCase().includes(q) ||
        m.consumer.toLowerCase().includes(q) ||
        m.contractNo.toLowerCase().includes(q),
    );
  }, [search]);

  const visibleMargins = useMemo(() => {
    return MARGIN_ROWS.filter((m) => {
      if (filterContract !== 'all' && m.contractType !== filterContract) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.txNo.toLowerCase().includes(q) &&
          !m.generator.toLowerCase().includes(q) &&
          !m.consumer.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [filterContract, search]);

  const selectedGen = visibleGens.find((g) => g.id === selectedGenId) ?? visibleGens[0] ?? null;
  const selectedCon = visibleCons.find((c) => c.id === selectedConId) ?? visibleCons[0] ?? null;

  const activeFilterCount =
    (filterSource !== 'all' ? 1 : 0) + (filterContract !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setFilterSource('all');
    setFilterContract('all');
    setFilterStatus('all');
  };

  const totalMargin = MARGIN_ROWS.reduce((s, m) => s + m.margin, 0);
  const avgMarginRate =
    MARGIN_ROWS.length > 0 ? MARGIN_ROWS.reduce((s, m) => s + m.marginRate, 0) / MARGIN_ROWS.length : 0;

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '거래 현황' }]}
      />

      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">거래 현황</h1>
          <p className="mt-1 text-sm text-slate-400">발전사·수용가 거래 이력 · 매칭 감사 · SPC 마진 추적</p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
          <Calendar size={12} />
          <span>2026-05-05 (월)</span>
        </div>
      </div>

      {/* ── 알림 위젯 (데이터 있을 때만) ── */}
      {(FLOW_ALERTS.toConfirmed.count > 0 || FLOW_ALERTS.newDisputes > 0 || FLOW_ALERTS.recalcPending > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <AlertCard
            icon={RefreshCcw}
            tone="amber"
            title={`${FLOW_ALERTS.toConfirmed.count}건 잠정 → 확정 전환`}
            desc={`평균 차이 ±${FLOW_ALERTS.toConfirmed.diffPct}% · 검토 필요`}
          />
          <AlertCard
            icon={AlertTriangle}
            tone="rose"
            title={`신규 분쟁 ${FLOW_ALERTS.newDisputes}건`}
            desc="이의신청 발생 — 결제관리에서 처리"
            onClick={() => router.push('/platform/ppa/billing/usage-deviation')}
          />
          <AlertCard
            icon={FileText}
            tone="violet"
            title={`재정산 대기 ${FLOW_ALERTS.recalcPending}건`}
            desc="수정세금계산서 발행 대기"
            onClick={() => router.push('/platform/ppa/billing/tax-invoice')}
          />
        </div>
      )}

      {/* ── 상단 컨트롤 ── */}
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* 기간 */}
          <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06] text-xs">
            {(['today', 'week', 'month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded px-3.5 transition-colors',
                  period === p ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>

          {/* 사용자 정의 입력 */}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Input type="date" className="!w-40" />
              <span className="text-xs text-slate-500">~</span>
              <Input type="date" className="!w-40" />
            </div>
          )}

          {/* 검색 */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="발전소·수용가·계약번호"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 필터 */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
              showFilters || activeFilterCount > 0
                ? 'border-primary/40 bg-primary/[0.08] text-primary'
                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white',
            )}
          >
            <Filter size={12} />
            필터
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary text-[10px] text-white px-1.5 tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 추출 */}
          <Dropdown
            align="right"
            trigger={
              <button className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/[0.12]">
                <Download size={12} />
                추출
                <ChevronDown size={12} className="opacity-60" />
              </button>
            }
          >
            <DropdownItem
              onClick={() =>
                exportCsv(
                  `PPA현황-${new Date().toISOString().slice(0, 10)}`,
                  [
                    '발전소',
                    '소유사',
                    '에너지원',
                    '용량(MW)',
                    '총발전(kWh)',
                    'PPA공급(kWh)',
                    'PPA단가',
                    '총수익',
                    '정산',
                  ],
                  visibleGens.map((g) => [
                    g.plant,
                    g.owner,
                    g.source,
                    g.capacity,
                    g.totalGen,
                    g.ppaSupply,
                    g.ppaUnitPrice,
                    g.totalRevenue,
                    g.settlementStatus,
                  ]),
                )
              }
            >
              <FileText size={12} className="mr-2 inline" />
              CSV (필터 적용)
            </DropdownItem>
            <DropdownItem
              onClick={() =>
                exportExcel(
                  `PPA현황-${new Date().toISOString().slice(0, 10)}`,
                  'PPA현황',
                  [
                    '발전소',
                    '소유사',
                    '에너지원',
                    '용량(MW)',
                    '총발전(kWh)',
                    'PPA공급(kWh)',
                    'PPA단가',
                    '총수익',
                    '정산',
                  ],
                  visibleGens.map((g) => [
                    g.plant,
                    g.owner,
                    g.source,
                    g.capacity,
                    g.totalGen,
                    g.ppaSupply,
                    g.ppaUnitPrice,
                    g.totalRevenue,
                    g.settlementStatus,
                  ]),
                )
              }
            >
              <FileSpreadsheet size={12} className="mr-2 inline" />
              Excel (필터 적용)
            </DropdownItem>
            <DropdownItem
              onClick={() =>
                exportPdf(
                  `PPA현황-${new Date().toISOString().slice(0, 10)}`,
                  'PPA 현황 보고서',
                  ['발전소', '소유사', '용량(MW)', '총발전(kWh)', 'PPA공급(kWh)', '단가', '총수익'],
                  visibleGens.map((g) => [
                    g.plant,
                    g.owner,
                    g.capacity,
                    g.totalGen,
                    g.ppaSupply,
                    g.ppaUnitPrice,
                    g.totalRevenue,
                  ]),
                )
              }
            >
              <FileText size={12} className="mr-2 inline" />
              PDF (회계·세무·감사)
            </DropdownItem>
          </Dropdown>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/[0.06]">
            <FilterGroup
              label="에너지원"
              value={filterSource}
              onChange={(v) => setFilterSource(v as any)}
              options={[
                { v: 'all', l: '전체' },
                { v: 'solar', l: '태양광' },
                { v: 'wind', l: '풍력' },
                { v: 'ess', l: 'ESS' },
                { v: 'bio', l: '바이오' },
              ]}
            />
            <FilterGroup
              label="계약 유형"
              value={filterContract}
              onChange={(v) => setFilterContract(v as any)}
              options={[
                { v: 'all', l: '전체' },
                { v: 'fixed', l: '고정 PPA' },
                { v: 'variable', l: '변동 PPA' },
                { v: 'mixed', l: '혼합' },
              ]}
            />
            <FilterGroup
              label="정산 상태"
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as any)}
              options={[
                { v: 'all', l: '전체' },
                { v: 'tentative', l: '잠정' },
                { v: 'confirmed', l: '확정' },
                { v: 'disputed', l: '분쟁중' },
                { v: 'recalculated', l: '재정산' },
              ]}
            />
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="col-span-full justify-self-start text-xs text-slate-500 hover:text-white inline-flex items-center gap-1"
              >
                <X size={11} /> 필터 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─────────────── 발전사 거래 ─────────────── */}
      {tab === 'generators' && (
        <div className="space-y-6">
          {GEN_ROWS.length === 0 ? (
            <EmptyState
              icon={Factory}
              title="등록된 발전사 거래가 없습니다"
              desc="직접 PPA 계약이 체결되면 발전사별 거래 현황이 표시됩니다."
            />
          ) : (
            <>
              {/* 테이블 */}
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="text-left font-medium px-4 py-3">발전소</th>
                        <th className="font-medium px-3 py-3">가동일</th>
                        <th className="font-medium px-3 py-3">총 발전량</th>
                        <th className="font-medium px-3 py-3">PPA 공급</th>
                        <th className="font-medium px-3 py-3">SMP 판매</th>
                        <th className="font-medium px-3 py-3">총 매출</th>
                        <th className="font-medium px-3 py-3">정산 예정</th>
                        <th className="font-medium px-3 py-3">REC 발급</th>
                        <th className="font-medium px-3 py-3">정산</th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {visibleGens.map((g) => {
                        const meta = SOURCE_META[g.source];
                        const settle = SETTLEMENT_META[g.settlementStatus];
                        const isSelected = selectedGenId === g.id;
                        return (
                          <tr
                            key={g.id}
                            onClick={() => setSelectedGenId(g.id)}
                            className={cn(
                              'cursor-pointer transition-colors',
                              isSelected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded ring-1',
                                    meta.bg,
                                    meta.ring,
                                  )}
                                >
                                  <meta.icon size={13} className={meta.color} />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-white truncate">{g.plant}</p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {g.owner} · {CONTRACT_TYPE_LABEL[g.contractType]} · {g.capacity} MW
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-400">D+{g.opDays}</td>
                            <td className="px-3 py-3 tabular-nums text-white">{fmtEnergy(g.totalGen)}</td>
                            <td className="px-3 py-3 tabular-nums">
                              <div className="text-emerald-300">{fmtEnergy(g.ppaSupply)}</div>
                              <div className="text-[10px] text-slate-600 tabular-nums">@ ₩{g.ppaUnitPrice}</div>
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {g.smpSupply > 0 ? (
                                <>
                                  <div className="text-amber-300">{fmtEnergy(g.smpSupply)}</div>
                                  <div className="text-[10px] text-slate-600 tabular-nums">@ ₩{g.smpUnitPrice}</div>
                                </>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-white font-semibold">
                              {fmtKrw(g.totalRevenue)}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-300">{fmtKrw(g.settlementDue)}</td>
                            <td className="px-3 py-3 tabular-nums text-emerald-300">
                              {g.recAvailable.toLocaleString()}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                  settle.bg,
                                  settle.tone,
                                  settle.ring,
                                )}
                              >
                                {settle.label}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <RowActions
                                onMap={() => router.push('/monitoring')}
                                onBilling={() => router.push('/platform/ppa/billing/settlement')}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {visibleGens.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                            조건에 맞는 거래가 없습니다
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Master-Detail: 시간대별 차트 */}
              {selectedGen && (
                <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-md font-semibold text-white">
                        {selectedGen.plant}{' '}
                        <span className="text-slate-500 font-normal">· 시간대별 발전량 / PPA 약정</span>
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        빨간 음영 = PPA 약정 미달 시간대 (클릭 시 매칭·배분 페이지로 점프)
                      </p>
                    </div>
                    <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06] text-xs">
                      {(['1d', '7d', '30d'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setChartRange(r)}
                          className={cn(
                            'rounded px-3',
                            chartRange === r ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                          )}
                        >
                          {r === '1d' ? '1일' : r === '7d' ? '7일' : '30일'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <RmsLineChart
                    data={buildHourlyGen(selectedGen.id)}
                    xKey="time"
                    lines={[
                      {
                        key: '발전량',
                        name: `발전량 (${selectedGen.capacity >= 1 ? 'kWh' : 'kWh'})`,
                        color: '#10B981',
                      },
                      { key: '약정', name: 'PPA 약정', color: '#F59E0B' },
                    ]}
                    height={240}
                    className="!p-0 !ring-0 !bg-transparent"
                  />
                  <button
                    onClick={() => router.push('/platform/ppa/status')}
                    className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1"
                  >
                    약정 미달 시간대 분석 → 매칭·배분
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────── 수용가 거래 ─────────────── */}
      {tab === 'consumers' && (
        <div className="space-y-6">
          {CON_ROWS.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="등록된 수용가 거래가 없습니다"
              desc="직접 PPA 계약이 체결되면 수용가별 공급·정산 현황이 표시됩니다."
            />
          ) : (
            <>
              {/* 테이블 */}
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="text-left font-medium px-4 py-3">수용가</th>
                        <th className="font-medium px-3 py-3">총 공급량</th>
                        <th className="font-medium px-3 py-3">실공급률</th>
                        <th className="font-medium px-3 py-3">평균 단가</th>
                        <th className="font-medium px-3 py-3">청구 예정액</th>
                        <th className="font-medium px-3 py-3">RE100</th>
                        <th className="font-medium px-3 py-3">정산</th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {visibleCons.map((c) => {
                        const settle = SETTLEMENT_META[c.settlementStatus];
                        const isSelected = selectedConId === c.id;
                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedConId(c.id)}
                            className={cn(
                              'cursor-pointer transition-colors',
                              isSelected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/[0.10] ring-1 ring-blue-500/30">
                                  <Building2 size={13} className="text-blue-300" />
                                </span>
                                <div>
                                  <p className="font-medium text-white">{c.name}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {CONTRACT_TYPE_LABEL[c.contractType]} · PPA {c.ppaCount}건
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              <div className="text-white">{fmtEnergy(c.supplied)}</div>
                              <div className="text-[10px] text-slate-600">/ {fmtEnergy(c.contracted)}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-14 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full',
                                      c.fulfillment >= 95
                                        ? 'bg-emerald-400'
                                        : c.fulfillment >= 85
                                          ? 'bg-amber-400'
                                          : 'bg-rose-400',
                                    )}
                                    style={{ width: `${Math.min(c.fulfillment, 100)}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    'text-sm font-medium tabular-nums',
                                    c.fulfillment >= 95
                                      ? 'text-emerald-300'
                                      : c.fulfillment >= 85
                                        ? 'text-amber-300'
                                        : 'text-rose-300',
                                  )}
                                >
                                  {c.fulfillment.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-300">₩{c.unitPrice}/kWh</td>
                            <td className="px-3 py-3 tabular-nums text-white font-semibold">{fmtKrw(c.billDue)}</td>
                            <td className="px-3 py-3 tabular-nums">
                              {c.re100 ? (
                                <span className={c.re100Rate >= 90 ? 'text-emerald-300' : 'text-amber-300'}>
                                  {c.re100Rate.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                  settle.bg,
                                  settle.tone,
                                  settle.ring,
                                )}
                              >
                                {settle.label}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <RowActions
                                onMap={() => router.push('/monitoring')}
                                onBilling={() => router.push('/platform/ppa/billing/settlement')}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {visibleCons.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-42 text-sm text-slate-500">
                            조건에 맞는 거래가 없습니다
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Master-Detail: 24/7 CFE */}
              {selectedCon && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 space-y-3">
                    <div>
                      <h3 className="text-md font-semibold text-white">
                        {selectedCon.name}{' '}
                        <span className="text-slate-500 font-normal">· 시간대별 매칭률 (24/7 CFE)</span>
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        시간 단위 RE 100% 비율 · 목표 {selectedCon.cfeTarget}%
                      </p>
                    </div>
                    <RmsLineChart
                      data={buildHourlyCfe(selectedCon.id)}
                      xKey="time"
                      lines={[
                        { key: '매칭률', name: '매칭률 (%)', color: '#10B981' },
                        { key: '목표', name: '목표', color: '#64748b' },
                      ]}
                      height={240}
                      className="!p-0 !ring-0 !bg-transparent"
                    />
                  </div>
                  <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 space-y-3">
                    <div>
                      <h3 className="text-md font-semibold text-white">월별 24/7 CFE 매칭률 추이</h3>
                      <p className="mt-0.5 text-xs text-slate-400">최근 5개월</p>
                    </div>
                    <RmsLineChart
                      data={CFE_TREND_MONTHLY}
                      xKey="month"
                      lines={[{ key: '매칭률', name: '매칭률 (%)', color: '#10B981' }]}
                      height={240}
                      className="!p-0 !ring-0 !bg-transparent"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────── 매칭 이력 ─────────────── */}
      {tab === 'matching' && (
        <div className="space-y-4">
          {MATCH_LOGS.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="매칭 이력이 없습니다"
              desc="직접 PPA 계약 체결 후 전력 매칭이 진행되면 감사 로그가 기록됩니다."
            />
          ) : (
            <>
              <div className="rounded-xl border border-violet-500/[0.20] bg-violet-500/[0.04] p-3">
                <div className="flex items-start gap-2.5 text-xs">
                  <Hash size={13} className="text-violet-300 mt-0.5" />
                  <div>
                    <p className="text-violet-200 font-medium">감사·검색용 매칭 로그</p>
                    <p className="text-violet-300/70 mt-0.5">
                      매칭 우선순위 적용 결과 및 알고리즘 버전을 함께 기록합니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="text-left font-medium px-4 py-3">일시 (시간 단위)</th>
                        <th className="text-left font-medium px-3 py-3">발전소</th>
                        <th className="font-medium px-2 py-3" />
                        <th className="text-left font-medium px-3 py-3">수용가</th>
                        <th className="text-left font-medium px-3 py-3">계약번호</th>
                        <th className="font-medium px-3 py-3">매칭량</th>
                        <th className="text-left font-medium px-3 py-3">우선순위</th>
                        <th className="font-medium px-3 py-3">알고리즘</th>
                        <th className="font-medium px-3 py-3">상태</th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {visibleLogs.map((m) => (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 tabular-nums text-slate-300">{m.datetime}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <Factory size={11} className="text-amber-400 shrink-0" />
                              <div>
                                <p className="text-white text-xs">{m.plant}</p>
                                <p className="text-[10px] text-slate-500">{m.generator}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-slate-600">
                            <ChevronRight size={12} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <Building2 size={11} className="text-blue-400 shrink-0" />
                              <span className="text-white text-xs">{m.consumer}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[11px] tabular-nums text-slate-400">{m.contractNo}</td>
                          <td className="px-3 py-3 tabular-nums">
                            <span
                              className={cn(
                                'font-medium',
                                m.matchType === 'normal'
                                  ? 'text-white'
                                  : m.matchType === 'shortage'
                                    ? 'text-rose-300'
                                    : 'text-amber-300',
                              )}
                            >
                              {fmtEnergy(m.kwh)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-white/[0.04] ring-1 ring-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-slate-300">
                                #{m.priority.rank}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate">{m.priority.reason}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center rounded bg-violet-500/[0.10] ring-1 ring-violet-500/30 px-1.5 py-0.5 text-[10px] tabular-nums text-violet-300 font-mono">
                              {m.algoVersion}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {m.matchType === 'shortage' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300">
                                  <ArrowDownRight size={10} />
                                  부족
                                </span>
                              )}
                              {m.matchType === 'excess' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.10] ring-1 ring-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300">
                                  <ArrowUpRight size={10} />
                                  초과
                                </span>
                              )}
                              {m.matchType === 'normal' && <span className="text-[10px] text-emerald-300">정상</span>}
                              {m.disputed && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300">
                                  <AlertTriangle size={10} />
                                  분쟁
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setMatchDetail(m)}
                                className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                                title="감사 정보"
                              >
                                <FileText size={13} />
                              </button>
                              {m.matchType !== 'normal' && (
                                <button
                                  onClick={() => router.push('/platform/ppa/status')}
                                  className="rounded p-1.5 text-amber-400 hover:bg-white/[0.06]"
                                  title="매칭·배분 점프"
                                >
                                  <ArrowLeftRight size={13} />
                                </button>
                              )}
                              {m.disputed && (
                                <button
                                  onClick={() => router.push('/platform/ppa/billing/usage-deviation')}
                                  className="rounded p-1.5 text-rose-400 hover:bg-white/[0.06]"
                                  title="분쟁 케이스"
                                >
                                  <AlertTriangle size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────── SPC 마진 ─────────────── */}
      {tab === 'margin' && (
        <div className="space-y-6">
          {MARGIN_ROWS.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="SPC 마진 데이터가 없습니다"
              desc="직접 PPA 거래가 발생하면 SPC 마진 분석이 표시됩니다."
            />
          ) : (
            <>
              {/* 권한 안내 */}
              <div className="rounded-lg border border-amber-500/[0.20] bg-amber-500/[0.04] px-4 py-2.5 flex items-start gap-2 text-xs">
                <AlertCircle size={13} className="text-amber-300 mt-0.5" />
                <span className="text-amber-200">
                  <span className="font-semibold">관리자 전용 정보</span> · 발전사·수용가 페르소나에는 노출되지 않습니다
                  (협상 정보 보호).
                </span>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <KpiCard label="누적 SPC 마진" value={fmtKrw(totalMargin)} icon={Coins} tone="emerald" />
                <KpiCard label="평균 마진율" value={`${avgMarginRate.toFixed(1)}%`} icon={TrendingUp} tone="blue" />
                <KpiCard label="거래 건수" value={`${MARGIN_ROWS.length}건`} icon={Hash} tone="violet" />
              </div>

              {/* 거래 단위 마진 */}
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="border-b border-white/[0.06] px-5 py-3">
                  <h3 className="text-md font-semibold text-white">거래 단위 마진</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    청구액 - 지급액 = SPC 마진 (REC 가산금·페널티 분담 분해)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="text-left font-medium px-4 py-3">거래번호</th>
                        <th className="text-left font-medium px-3 py-3">발전사</th>
                        <th className="text-left font-medium px-3 py-3">수용가</th>
                        <th className="text-left font-medium px-3 py-3">계약유형</th>
                        <th className="font-medium px-3 py-3">청구액</th>
                        <th className="font-medium px-3 py-3">지급액</th>
                        <th className="font-medium px-3 py-3">단가차</th>
                        <th className="font-medium px-3 py-3">REC</th>
                        <th className="font-medium px-3 py-3">페널티</th>
                        <th className="font-medium px-3 py-3">SPC 마진</th>
                        <th className="font-medium px-3 py-3">마진율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {visibleMargins.map((m) => {
                        const priceDiff = m.margin - m.recBonus + m.penaltyShare;
                        return (
                          <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-mono text-[11px] tabular-nums text-white">{m.txNo}</p>
                              <p className="text-[10px] text-slate-500 tabular-nums">{m.datetime}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-300">{m.generator}</td>
                            <td className="px-3 py-3 text-slate-300">{m.consumer}</td>
                            <td className="px-3 py-3 text-[11px] text-slate-400">
                              {CONTRACT_TYPE_LABEL[m.contractType]}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-blue-300">{fmtKrw(m.billed)}</td>
                            <td className="px-3 py-3 tabular-nums text-amber-300">{fmtKrw(m.paid)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-300">{fmtKrw(priceDiff)}</td>
                            <td className="px-3 py-3 tabular-nums text-emerald-300">
                              {m.recBonus > 0 ? `+${fmtKrw(m.recBonus)}` : '—'}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {m.penaltyShare > 0 ? (
                                <span className="text-rose-300">−{fmtKrw(m.penaltyShare)}</span>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-white font-bold">{fmtKrw(m.margin)}</td>
                            <td className="px-3 py-3 tabular-nums">
                              <span
                                className={cn(
                                  'font-medium',
                                  m.marginRate >= 30
                                    ? 'text-emerald-300'
                                    : m.marginRate >= 20
                                      ? 'text-amber-300'
                                      : 'text-rose-300',
                                )}
                              >
                                {m.marginRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 마진 분석 차트 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                  <h3 className="text-md font-semibold text-white mb-1">발전사업자별 평균 마진율</h3>
                  <p className="text-[11px] text-slate-500 mb-3">단위: %</p>
                  <RmsBarChart
                    data={MARGIN_BY_GEN}
                    xKey="name"
                    bars={[{ key: '마진율', name: '마진율 (%)', color: '#F59E0B' }]}
                    height={220}
                    className="!p-0 !ring-0 !bg-transparent"
                  />
                </div>
                <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                  <h3 className="text-md font-semibold text-white mb-1">수용가별 평균 마진율</h3>
                  <p className="text-[11px] text-slate-500 mb-3">단위: %</p>
                  <RmsBarChart
                    data={MARGIN_BY_CON}
                    xKey="name"
                    bars={[{ key: '마진율', name: '마진율 (%)', color: '#3B82F6' }]}
                    height={220}
                    className="!p-0 !ring-0 !bg-transparent"
                  />
                </div>
                <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                  <h3 className="text-md font-semibold text-white mb-1">계약 유형별 마진 비교</h3>
                  <p className="text-[11px] text-slate-500 mb-3">단위: %</p>
                  <RmsBarChart
                    data={MARGIN_BY_TYPE}
                    xKey="name"
                    bars={[{ key: '마진율', name: '마진율 (%)', color: '#8B5CF6' }]}
                    height={220}
                    className="!p-0 !ring-0 !bg-transparent"
                  />
                </div>
              </div>

              {/* 메인 대시보드 연동 안내 */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-slate-400">
                ※ 메인 대시보드 [거래 실적] 카드의 "매출"은 SPC 마진 합계 기준으로 산출됩니다.
                <button
                  onClick={() => router.push('/platform/ppa/dashboard')}
                  className="ml-2 text-primary hover:text-primary/80 inline-flex items-center gap-1"
                >
                  메인 대시보드 확인
                  <ChevronRight size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 매칭 로그 감사 모달 */}
      {matchDetail && (
        <Modal
          open={!!matchDetail}
          onClose={() => setMatchDetail(null)}
          size="md"
          title={`매칭 감사 정보 · ${matchDetail.id}`}
          footer={
            <Button variant="ghost" onClick={() => setMatchDetail(null)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <DetailRow label="일시" value={matchDetail.datetime} mono />
              <DetailRow label="발전소" value={`${matchDetail.plant} (${matchDetail.generator})`} />
              <DetailRow label="수용가" value={matchDetail.consumer} />
              <DetailRow label="계약번호" value={matchDetail.contractNo} mono />
              <DetailRow label="매칭량" value={fmtEnergy(matchDetail.kwh)} mono />
              <DetailRow
                label="매칭 우선순위"
                value={`#${matchDetail.priority.rank} · ${matchDetail.priority.reason}`}
              />
              <DetailRow label="알고리즘 버전" value={<span className="font-mono">{matchDetail.algoVersion}</span>} />
              <DetailRow
                label="매칭 결과"
                value={
                  matchDetail.matchType === 'normal' ? '정상' : matchDetail.matchType === 'shortage' ? '부족' : '초과'
                }
              />
              <DetailRow label="분쟁 여부" value={matchDetail.disputed ? '분쟁 발생' : '정상'} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Reusable bits
   ───────────────────────────────────────────── */

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
        <Icon size={22} className="text-slate-500" />
      </span>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1.5 text-xs text-slate-500 max-w-sm">{desc}</p>
    </div>
  );
}

function AlertCard({
  icon: Icon,
  tone,
  title,
  desc,
  onClick,
}: {
  icon: any;
  tone: 'amber' | 'rose' | 'violet';
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  const map = {
    amber: 'border-amber-500/[0.20] bg-amber-500/[0.04] hover:bg-amber-500/[0.06] text-amber-300',
    rose: 'border-rose-500/[0.20] bg-rose-500/[0.04] hover:bg-rose-500/[0.06] text-rose-300',
    violet: 'border-violet-500/[0.20] bg-violet-500/[0.04] hover:bg-violet-500/[0.06] text-violet-300',
  };
  return (
    <button
      onClick={onClick}
      className={cn('rounded-xl border p-3 flex items-center gap-3 text-left transition-colors', map[tone])}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400 truncate">{desc}</p>
      </div>
      {onClick && <ChevronRight size={14} className="text-slate-600" />}
    </button>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.v}
            onClick={() => onChange(opt.v)}
            className={cn(
              'rounded-md px-2.5 text-[11px] transition-colors ring-1',
              value === opt.v
                ? 'bg-primary/[0.12] text-primary ring-primary/30'
                : 'bg-white/[0.02] text-slate-400 ring-white/[0.06] hover:text-white',
            )}
          >
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function RowActions({ onMap, onBilling }: { onMap: () => void; onBilling: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onMap}
        className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-emerald-300"
        title="맵에서 보기"
      >
        <MapPin size={13} />
      </button>
      <button
        onClick={onBilling}
        className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-blue-300"
        title="결제관리 점프"
      >
        <CreditCard size={13} />
      </button>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: any;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
}) {
  const map = {
    emerald: 'text-emerald-300 bg-emerald-500/[0.10]',
    amber: 'text-amber-300 bg-amber-500/[0.10]',
    rose: 'text-rose-300 bg-rose-500/[0.10]',
    blue: 'text-blue-300 bg-blue-500/[0.10]',
    violet: 'text-violet-300 bg-violet-500/[0.10]',
  };
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', map[tone])}>
        <Icon size={16} />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={cn('text-sm text-white text-right truncate', mono && 'tabular-nums')}>{value}</span>
    </div>
  );
}
