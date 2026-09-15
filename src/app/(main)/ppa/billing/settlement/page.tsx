// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Sun,
  Wind,
  Battery,
  Zap,
  Layers,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionCard } from '@/components/features';
import {
  SettlementStatusPill,
  BillingKpiCard,
  ScopeTrigger,
  MetaRow,
  MiniStatRow,
} from '@/components/features/billing';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsAreaChart, RmsBarChart } from '@/components/ui/Chart';
import { cn, exportPdf } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { calculateSettlement } from '@/lib/settlement/calculator';
import type { PpaKind } from '@/lib/settlement/calculator';
import { DEFAULT_FEES } from '@/lib/settlement/defaults';

type PendingRequest = Record<string, any>;

/* ───────────────────────── Types ───────────────────────── */

type SettlementStatus = 'pending' | 'completed';

interface Plant {
  id: string;
  name: string;
  capacity: string;
  capacityKw: number;
  resource: string;
  resourceIcon: LucideIcon;
  resourceColor: string;
  address: string;
  facilityCode: string;
}

type ContractKind = 'Offsite PPA' | 'Onsite PPA';
const KIND_META: Record<ContractKind, { tone: string; bg: string; ring: string }> = {
  'Offsite PPA': { tone: 'text-blue-300', bg: 'bg-blue-500/[0.10]', ring: 'ring-blue-500/30' },
  'Onsite PPA': { tone: 'text-violet-300', bg: 'bg-violet-500/[0.10]', ring: 'ring-violet-500/30' },
};

interface Contract {
  id: string;
  number: string;
  label: string;
  counterparty: string;
  site: string;
  unitPrice: number;
  exchangeAgency: string;
  operationStartDate: string;
  contractEnd: string;
  totalCapacityKw: number;
  plants: Plant[];
  kind?: ContractKind;
}

interface Site {
  id: string;
  label: string;
}

import { usePpaContracts, usePpaSettlements } from '@/hooks/ppa/usePpa';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';
import { useAuthStore } from '@/stores/useAuthStore';

const useDemoApprovals = () => ({
  getApproval: (_id: string) => 'reviewed' as string,
  setApproval: (_id: string, _status: string) => {},
});

// SPC가 통보한 요금 조정 — 수용가는 읽기 전용으로만 확인
interface FeeAdjustmentNotice {
  reason: string;
  amount: number;
  vat: number;
  status: 'editing' | 'saved' | 'reviewed'; // 'reviewed'만 수용가에 노출
}

interface MonthlyRecord {
  id: string;
  contractId: string;
  plantId: string;
  period: string;
  billDate: string;
  status: SettlementStatus;
  generation: number;
  smpUnitPrice: number;
  supplyAmount: number;
  vat: number;
  total: number;
  generationDays: number;
  generationHours: number;
  matchingRate: number;
  adjust: number;
  network: number;
  fund: number;
  tradeFee: number;
  supplyFee: number;
  manageFee: number;
  transmissionLoss: number;
  welfareCost: number;
  vatBase: number;
  ppaKind: PpaKind;
  feeAdjustment?: FeeAdjustmentNotice;
}

type Scope = { kind: 'all' } | { kind: 'ppa'; contractId: string };

/* ───────────────────────── Mock — PPA → Plants ───────────────────────── */

const PV = { resource: 'PV', resourceIcon: Sun, resourceColor: 'text-amber-400' };
const WIND = { resource: '풍력', resourceIcon: Wind, resourceColor: 'text-sky-400' };
const ESS = { resource: 'ESS', resourceIcon: Battery, resourceColor: 'text-rose-400' };
const FUEL = { resource: '연료전지', resourceIcon: Zap, resourceColor: 'text-violet-400' };

const STATIC_CONTRACTS: Contract[] = [];

// 자원별 메타 — 세션 candidate.resource → resourceIcon/Color 매핑
const RESOURCE_META_BY_NAME: Record<string, { resource: string; resourceIcon: LucideIcon; resourceColor: string }> = {
  태양광: { ...PV, resource: 'PV' },
  PV: { ...PV, resource: 'PV' },
  풍력: { ...WIND },
  ESS: { ...ESS },
  연료전지: { ...FUEL },
  바이오: { resource: '바이오', resourceIcon: Battery, resourceColor: 'text-emerald-400' },
};

// 세션 PendingRequest(체결된 PPA) → Contract 변환
function _pendingPpaToContract(r: PendingRequest, currentSite: string): Contract | null {
  if (r.dealType !== 'ppa') return null;
  if (r.step < r.totalSteps) return null;
  if (!r.contract) return null;
  if (!r.matchedCandidates || r.matchedCandidates.length === 0) return null;

  const [sy, sm, sd] = r.contract.signedAt.split('-').map(Number);
  const endYear = sy + (r.durationYears || 5);
  const contractEnd = `${endYear}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;

  const totalCapacityKw = r.matchedCandidates.reduce((s, c) => s + (c.capacityKw || 0), 0);
  const primary = r.matchedCandidates[0];

  const plants: Plant[] = r.matchedCandidates.map((cand) => {
    const meta = RESOURCE_META_BY_NAME[cand.resource] ?? PV;
    return {
      id: `ses-${r.id}-${cand.id}`,
      name: cand.plantName,
      capacity: `${cand.capacityKw} kW`,
      capacityKw: cand.capacityKw || 0,
      resource: meta.resource,
      resourceIcon: meta.resourceIcon,
      resourceColor: meta.resourceColor,
      address: cand.region,
      facilityCode: `FC-${cand.id}`,
    };
  });

  return {
    id: `ses-${r.id}`,
    number: r.contract.contractNo,
    label: `${currentSite} Offsite PPA`,
    counterparty: primary.generator,
    site: currentSite,
    unitPrice: primary.proposedPriceKrw ?? r.unitPrice ?? 140,
    exchangeAgency: '한국전력공사 (5001054161)',
    operationStartDate: r.contract.effectiveFrom,
    contractEnd,
    totalCapacityKw,
    plants,
    kind: 'Offsite PPA',
  };
}

// 세션 PendingRequest(체결된 Onsite PPA) → Contract 변환 (Lease는 /lease 에서 관리)
function _pendingOnsiteToContract(r: PendingRequest, currentSite: string): Contract | null {
  if (r.dealType !== 'savings-share') return null;
  if (r.step < r.totalSteps) return null;
  if (!r.contract) return null;

  const kind: ContractKind = 'Onsite PPA';
  const data = r.shareEval;
  if (!data) return null;

  const counterparty = data.assignedGenerator || r.assignedGenerator || '발전사';
  const capacityKw = r.shareEval?.installCapacityKw ?? 0;
  const unitPrice = 0;

  const [sy, sm, sd] = r.contract.signedAt.split('-').map(Number);
  const endYear = sy + (r.durationYears || 15);
  const contractEnd = `${endYear}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;

  const plant: Plant = {
    id: `ses-${r.id}-plant`,
    name: `${currentSite} 옥상 태양광 (${kind})`,
    capacity: `${capacityKw} kW`,
    capacityKw,
    ...PV,
    address: currentSite,
    facilityCode: `FC-LP-${r.id.slice(-4).toUpperCase()}`,
  };

  return {
    id: `ses-${r.id}`,
    number: r.contract.contractNo,
    label: `${currentSite} ${kind}`,
    counterparty,
    site: currentSite,
    unitPrice,
    exchangeAgency: '한국전력공사 (5001054161)',
    operationStartDate: r.contract.effectiveFrom,
    contractEnd,
    totalCapacityKw: capacityKw,
    plants: [plant],
    kind,
  };
}

// Lease 변환 함수 제거됨 — 직접 PPA 정산은 /lease/billing/settlement 에서 관리

/* ── 정산 데이터 ─────────────────────── */

// 6월 이후 추정 — 설비용량 99kW 기준, 계절별 일사량 반영
/* ── Generate records per plant ─────────────────────── */

function generateRecordsFor(contracts: Contract[]): MonthlyRecord[] {
  const out: MonthlyRecord[] = [];
  const today = new Date(2026, 4, 1);

  for (const c of contracts) {
    const kind: PpaKind = c.kind === 'Onsite PPA' ? 'onsite' : 'offsite';

    for (const plant of c.plants) {
      const opStart = new Date(c.operationStartDate);
      const opStartYM = opStart.getFullYear() * 100 + (opStart.getMonth() + 1);

      const periods: string[] = [];
      for (let i = 17; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const dYM = d.getFullYear() * 100 + (d.getMonth() + 1);
        if (dYM < opStartYM) continue;
        periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      for (const period of periods) {
        const [py, pm] = period.split('-').map(Number);
        const lastDay = new Date(py, pm, 0).getDate();
        const billD = new Date(py, pm, 15);
        const billDate = `${billD.getFullYear()}-${String(billD.getMonth() + 1).padStart(2, '0')}-${String(billD.getDate()).padStart(2, '0')}`;
        const isCurrent = period === '2026-05';

        const month0 = pm - 1;
        const isWind = plant.resource === '풍력';
        const seasonal = isWind
          ? 0.7 + 0.5 * Math.cos(((month0 - 0) / 12) * Math.PI * 2)
          : 0.7 + 0.5 * Math.sin(((month0 - 2) / 12) * Math.PI * 2);
        const generation = Math.round(
          plant.capacityKw * 60 * seasonal * (1 + ((((c.id?.charCodeAt?.(0) ?? 0) * 7 + pm * 3) % 100) - 50) * 0.001),
        );
        const smpUnitPrice = c.unitPrice + ((((c.id?.charCodeAt?.(0) ?? 0) * 13 + pm * 7) % 40) - 20) * 0.1;

        const result = calculateSettlement({
          kind,
          generationKwh: generation,
          unitPrice: smpUnitPrice,
          fees: DEFAULT_FEES,
        });

        out.push({
          id: `${plant.id}-${period}`,
          contractId: c.id,
          plantId: plant.id,
          period,
          billDate,
          status: isCurrent ? 'pending' : 'completed',
          generation,
          smpUnitPrice: Math.round(smpUnitPrice * 100) / 100,
          supplyAmount: result.supplyAmount,
          vat: result.vat,
          total: result.consumerPayable,
          generationDays: lastDay - 2,
          generationHours: Math.round((generation / plant.capacityKw / lastDay) * 100) / 100,
          matchingRate: Math.round((85 + (((pm * 3) % 10) - 5)) * 10) / 10,
          adjust: result.surcharge,
          network: result.networkFee,
          fund: result.fund,
          tradeFee: result.tradeFee,
          supplyFee: result.supplyFee,
          manageFee: result.manageFee,
          transmissionLoss: result.transmissionLoss,
          welfareCost: result.welfareCost,
          vatBase: result.vatBase,
          ppaKind: kind,
          feeAdjustment: undefined,
        });
      }
    }
  }
  return out;
}

const _STATIC_RECORDS: MonthlyRecord[] = generateRecordsFor(STATIC_CONTRACTS);

const THIS_MONTH = '2026-05';

/* ───────────────────────── Page ───────────────────────── */

export default function PpaSettlementPage() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;

  const { data: apiContracts } = usePpaContracts();
  const { data: sitesData } = useConsumerSites({ companyId });
  const { getApproval } = useDemoApprovals();

  const [scope, setScope] = useState<Scope>({ kind: 'all' });
  const [subPlantId, setSubPlantId] = useState<'all' | string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('전체');
  const [query, setQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [paymentCardsOpen, setPaymentCardsOpen] = useState(true);
  const [tablePpaFilter, setTablePpaFilter] = useState<'all' | string>('all');
  const [siteId, setSiteId] = useState<'all' | string>('all');

  const SITES: Site[] = useMemo(() => {
    const apiSites = (sitesData?.content ?? []).filter((s: any) => !s.deletedAt) as any[];
    return apiSites.map((s: any) => ({ id: String(s.id), label: s.name }));
  }, [sitesData]);

  const selectedSite = useMemo(
    () => (siteId === 'all' ? null : (SITES.find((s) => s.id === siteId) ?? null)),
    [siteId, SITES],
  );

  const CONTRACTS = useMemo<Contract[]>(() => {
    const raw = (apiContracts?.content ?? []) as any[];
    if (raw.length === 0) return STATIC_CONTRACTS;
    return raw
      .filter((c: any) => c.contractType !== 'LEASE')
      .map((c: any) => ({
        id: String(c.id),
        number: c.contractNumber ?? `PPA-${c.id}`,
        label: c.contractNumber ?? `PPA-${c.id}`,
        counterparty: c.generatorCompanyName ?? '발전사',
        site: c.consumerSiteName ?? '전사',
        unitPrice: c.unitPriceKrw ?? 110,
        exchangeAgency: '한국전력공사',
        operationStartDate: c.startDate ?? '2026-01-01',
        contractEnd: c.endDate ?? '2036-12-31',
        totalCapacityKw: c.totalCapacityKw ?? 0,
        plants: [
          {
            id: `plt-api-${c.id}`,
            name: c.generatorCompanyName ?? '발전소',
            capacity: `${c.totalCapacityKw ?? 0} kW`,
            capacityKw: c.totalCapacityKw ?? 0,
            ...PV,
            address: c.consumerSiteName ?? '',
            facilityCode: `FC-${c.id}`,
          },
        ],
        kind: (c.contractType === 'ONSITE' ? 'Onsite PPA' : 'Offsite PPA') as ContractKind,
      }));
  }, [apiContracts]);

  const ALL_CONTRACTS = CONTRACTS;

  // API 기반 정산 데이터 조회
  const { data: apiSettlements } = usePpaSettlements({ size: 100 });
  const ALL_RECORDS = useMemo<MonthlyRecord[]>(() => {
    const raw = apiSettlements?.content ?? [];
    if (raw.length > 0) {
      return raw.map((s: any) => {
        const [py, pm] = (s.period ?? '').split('-').map(Number);
        const lastDay = new Date(py, pm, 0).getDate();
        const billD = new Date(py, pm, 15);
        const billDate = `${billD.getFullYear()}-${String(billD.getMonth() + 1).padStart(2, '0')}-${String(billD.getDate()).padStart(2, '0')}`;
        const statusMap: Record<string, SettlementStatus> = {
          CONFIRMED: 'completed',
          PENDING: 'pending',
          SPC_REVIEWING: 'pending',
          DISPUTED: 'pending',
          ADJUSTED: 'completed',
        };
        return {
          id: String(s.id),
          contractId: String(s.contractId),
          plantId: `plt-api-${s.contractId}`,
          period: s.period,
          billDate,
          status: statusMap[s.status] ?? 'pending',
          generation: Number(s.generationKwh ?? 0),
          smpUnitPrice: Number(s.smpUnitPrice ?? 0),
          supplyAmount: Number(s.supplyAmount ?? 0),
          vat: Number(s.vat ?? 0),
          total: Number(s.total ?? 0),
          generationDays: lastDay - 2,
          generationHours: 0,
          matchingRate: Number(s.matchingRate ?? 0),
          adjust: Number(s.adjustAmount ?? 0),
          network: Number(s.networkFee ?? 0),
          fund: Number(s.fundAmount ?? 0),
          tradeFee: Number(s.tradeFee ?? 0),
          supplyFee: Number(s.supplyFee ?? 0),
          manageFee: Number(s.manageFee ?? 0),
          transmissionLoss: Number(s.transmissionLoss ?? 0),
          welfareCost: Number(s.welfareCost ?? 0),
          vatBase: Number(s.vatBase ?? 0),
          ppaKind: (s.ppaKind ?? 'offsite') as PpaKind,
          feeAdjustment: undefined,
        };
      });
    }
    return generateRecordsFor(ALL_CONTRACTS);
  }, [apiSettlements, ALL_CONTRACTS]);

  // 선택 사업장 안의 PPA 목록
  const sitePpas = useMemo(
    () => (selectedSite ? ALL_CONTRACTS.filter((c) => c.site === selectedSite.label) : ALL_CONTRACTS),
    [selectedSite],
  );

  const handleSiteChange = (id: 'all' | string) => {
    setSiteId(id);
    setScope({ kind: 'all' });
    setSubPlantId('all');
  };

  // Reset sub-plant when PPA changes
  const handleScopeChange = (s: Scope) => {
    setScope(s);
    setSubPlantId('all');
  };

  // === Resolve scope ===
  const selectedContract = scope.kind === 'ppa' ? ALL_CONTRACTS.find((c) => c.id === scope.contractId)! : null;
  const selectedPlant =
    selectedContract && subPlantId !== 'all'
      ? (selectedContract.plants.find((p) => p.id === subPlantId) ?? null)
      : null;

  // === Records filtered by site + scope + sub-plant ===
  const siteContractIds = useMemo(() => sitePpas.map((c) => c.id), [sitePpas]);

  const scopedRecords = useMemo(() => {
    let recs = ALL_RECORDS;
    // 사업장 필터 (site 선택 시 그 사업장의 contractId 만 통과)
    if (selectedSite) {
      recs = recs.filter((r) => siteContractIds.includes(r.contractId));
    }
    if (scope.kind === 'all') return recs;
    // PPA mode
    if (subPlantId === 'all') return recs.filter((r) => r.contractId === scope.contractId);
    return recs.filter((r) => r.plantId === subPlantId);
  }, [scope, subPlantId, selectedSite, siteContractIds, ALL_RECORDS]);

  // === Sort + apply table filters ===
  const sortedRecords = useMemo(
    () => [...scopedRecords].sort((a, b) => b.period.localeCompare(a.period)),
    [scopedRecords],
  );

  const periodOptions = useMemo(() => {
    const periods = Array.from(new Set(sortedRecords.map((r) => r.period))).sort((a, b) => b.localeCompare(a));
    return ['전체', ...periods];
  }, [sortedRecords]);

  // For aggregate mode, table shows all records (with optional PPA filter)
  // For PPA/plant mode, table is already scoped
  const filtered = useMemo(() => {
    return sortedRecords.filter((r) => {
      if (scope.kind === 'all' && tablePpaFilter !== 'all' && r.contractId !== tablePpaFilter) return false;
      if (periodFilter !== '전체' && r.period !== periodFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const c = ALL_CONTRACTS.find((x) => x.id === r.contractId);
        const p = c?.plants.find((x) => x.id === r.plantId);
        return (
          r.period.includes(q) ||
          r.billDate.includes(q) ||
          (c?.label.toLowerCase().includes(q) ?? false) ||
          (c?.counterparty.toLowerCase().includes(q) ?? false) ||
          (p?.name.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [sortedRecords, periodFilter, query, scope, tablePpaFilter]);

  const selectedRecord = selectedRecordId
    ? (filtered.find((r) => r.id === selectedRecordId) ?? filtered[0])
    : filtered[0];

  // === KPIs — SPC 검토 완료된 record만 합계에 포함, 미검토 record는 카운트만 +
  const totalThisMonth = useMemo(
    () =>
      ALL_RECORDS.filter((r) => r.period === THIS_MONTH && getApproval(r.id) === 'reviewed').reduce(
        (s, r) => s + r.total,
        0,
      ),
    [ALL_RECORDS, getApproval],
  );
  const _totalKwhThisMonth = useMemo(
    () =>
      ALL_RECORDS.filter((r) => r.period === THIS_MONTH && getApproval(r.id) === 'reviewed').reduce(
        (s, r) => s + r.generation,
        0,
      ),
    [ALL_RECORDS, getApproval],
  );
  const ytdTotal = useMemo(
    () =>
      ALL_RECORDS.filter(
        (r) => r.period.startsWith('2026') && r.status === 'completed' && getApproval(r.id) === 'reviewed',
      ).reduce((s, r) => s + r.supplyAmount, 0),
    [ALL_RECORDS, getApproval],
  );
  // 미정산 건 = SPC 검토 대기 + 청구 완료 후 미결제
  const pendingCount = useMemo(
    () => ALL_RECORDS.filter((r) => r.status === 'pending' || getApproval(r.id) === 'pending').length,
    [ALL_RECORDS, getApproval],
  );

  // === PPA-level payment summary for "전체 종합" view ===
  const ppaPaymentsThisMonth = useMemo(() => {
    return ALL_CONTRACTS.map((c) => {
      const recs = ALL_RECORDS.filter((r) => r.contractId === c.id && r.period === THIS_MONTH);
      const total = recs.reduce((s, r) => s + r.total, 0);
      const generation = recs.reduce((s, r) => s + r.generation, 0);
      const status: SettlementStatus = recs.some((r) => r.status === 'pending') ? 'pending' : 'completed';
      const billDate = recs[0]?.billDate ?? '';
      return { contract: c, total, generation, status, billDate, plantCount: c.plants.length };
    })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [ALL_CONTRACTS, ALL_RECORDS]);

  // === Aggregate stats for PPA/plant drill-down ===
  const drillStats = useMemo(() => {
    if (scope.kind === 'all') return null;
    const completed = sortedRecords.filter((r) => r.status === 'completed');
    if (completed.length === 0) return null;
    const totalGen = completed.reduce((s, r) => s + r.generation, 0);
    const totalSupply = completed.reduce((s, r) => s + r.supplyAmount, 0);
    const totalDays = completed.reduce((s, r) => s + r.generationDays, 0);

    // For PPA mode: aggregate plant-level per month (sum across plants)
    let monthAgg: { period: string; gen: number; supply: number; days: number; hours: number }[];
    if (scope.kind === 'ppa') {
      const map = new Map<string, { gen: number; supply: number; days: number; hours: number; count: number }>();
      for (const r of completed) {
        const existing = map.get(r.period) ?? { gen: 0, supply: 0, days: 0, hours: 0, count: 0 };
        existing.gen += r.generation;
        existing.supply += r.supplyAmount;
        existing.days += r.generationDays;
        existing.hours += r.generationHours;
        existing.count++;
        map.set(r.period, existing);
      }
      monthAgg = Array.from(map.entries()).map(([period, v]) => ({
        period,
        gen: v.gen,
        supply: v.supply,
        days: Math.round(v.days / v.count),
        hours: v.hours / v.count,
      }));
    } else {
      monthAgg = completed.map((r) => ({
        period: r.period,
        gen: r.generation,
        supply: r.supplyAmount,
        days: r.generationDays,
        hours: r.generationHours,
      }));
    }

    const avgGen = Math.round(totalGen / monthAgg.length);
    const avgSupply = Math.round(totalSupply / monthAgg.length);
    const avgHours = monthAgg.reduce((s, m) => s + m.hours, 0) / monthAgg.length;
    const periods = monthAgg.map((m) => m.period).sort();
    return {
      avgGen,
      avgSupply,
      totalSupply,
      totalDays,
      avgHours,
      periodFirst: periods[0],
      periodLast: periods[periods.length - 1],
      count: monthAgg.length,
      monthAgg: monthAgg.sort((a, b) => a.period.localeCompare(b.period)),
    };
  }, [scope, sortedRecords]);

  const chartData = useMemo(() => {
    if (!drillStats) return [];
    return drillStats.monthAgg.map((m) => ({
      month: m.period.slice(2).replace('.', '/'),
      gen: Math.round(m.gen / 1000),
      bill: Math.round(m.supply / 1_000_000),
    }));
  }, [drillStats]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/contracts' }, { label: '정산·요금' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">정산·요금</h1>
          <p className="mt-1 text-sm text-slate-400">직접 PPA 정산 내역</p>
        </div>

        {/* Scope dropdowns — 다른 페이지들과 통일 */}
        <div className="flex flex-wrap gap-2 items-start">
          {/* 사업장 */}
          <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSite?.label ?? '전사 합산'} />}>
            <DropdownItem onClick={() => handleSiteChange('all')}>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm">전사 합산</p>
                  <p className="text-xs text-slate-500">
                    {SITES.length}개 사업장 · {ALL_CONTRACTS.length}개 PPA
                  </p>
                </div>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => {
              const count = ALL_CONTRACTS.filter((c) => c.site === s.label).length;
              return (
                <DropdownItem key={s.id} onClick={() => handleSiteChange(s.id)}>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm">{s.label}</p>
                      <p className="text-xs text-slate-500">{count}개 PPA</p>
                    </div>
                  </div>
                </DropdownItem>
              );
            })}
          </Dropdown>

          {/* PPA */}
          {selectedSite ? (
            <Dropdown
              align="left"
              trigger={
                <ScopeTrigger
                  label="PPA"
                  value={
                    scope.kind === 'ppa'
                      ? (ALL_CONTRACTS.find((c) => c.id === scope.contractId)?.label ?? '사업장 내 전체')
                      : '사업장 내 전체'
                  }
                />
              }
            >
              <DropdownItem onClick={() => handleScopeChange({ kind: 'all' })}>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm">사업장 내 전체</p>
                    <p className="text-xs text-slate-500">{sitePpas.length}개 PPA 합산</p>
                  </div>
                </div>
              </DropdownItem>
              <div className="my-1 border-t border-white/[0.06]" />
              {sitePpas.map((c) => (
                <DropdownItem key={c.id} onClick={() => handleScopeChange({ kind: 'ppa', contractId: c.id })}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm">{c.label}</p>
                        {c.kind && (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1',
                              KIND_META[c.kind].bg,
                              KIND_META[c.kind].tone,
                              KIND_META[c.kind].ring,
                            )}
                          >
                            {c.kind}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {c.counterparty} · {c.totalCapacityKw} kW
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

      {/* KPI 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <BillingKpiCard
          label="이달 총 비용"
          value={`₩ ${totalThisMonth.toLocaleString()}`}
          sub={`직접 PPA`}
          valueColor="text-semantic-red"
        />
        <BillingKpiCard label="이달 순절감" value="₩ 820,000" valueColor="text-semantic-green" sub="한전 대비" />
        <BillingKpiCard label="다음 결제일" value="D-12" valueColor="text-blue-400" />
        <BillingKpiCard label="누적 (YTD)" value={`₩ ${(ytdTotal / 100_000_000).toFixed(2)} 억`} />
        <BillingKpiCard
          label="미정산"
          value={`${pendingCount} 건`}
          valueColor={pendingCount > 0 ? 'text-amber-400' : 'text-rose-400'}
          badge={pendingCount === 0 ? { text: '정상', tone: 'emerald' } : undefined}
        />
      </div>

      {/* === MODE A: 전체 종합 === */}
      {scope.kind === 'all' && (
        <>
          {/* PPA별 이번달 결제 예정 — collapsible */}
          <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
            <button
              type="button"
              onClick={() => setPaymentCardsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p className="text-base font-semibold text-white">PPA별 이번달 결제 예정</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  이번달 어느 PPA(발전소)에 얼마씩 결제 예정인지 한눈에 ·{' '}
                  <span className="text-white tabular-nums">
                    합계 ₩{ppaPaymentsThisMonth.reduce((s, x) => s + x.total, 0).toLocaleString()}
                  </span>
                </p>
              </div>
              <ChevronUp
                size={18}
                className={cn('text-slate-500 transition-transform duration-200', !paymentCardsOpen && 'rotate-180')}
              />
            </button>

            {paymentCardsOpen && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-6 pb-4">
                  {ppaPaymentsThisMonth.map(({ contract, total, generation, status, billDate, plantCount }) => (
                    <button
                      key={contract.id}
                      onClick={() => handleScopeChange({ kind: 'ppa', contractId: contract.id })}
                      className="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                          <Layers size={16} className="text-primary" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {contract.label} · {contract.counterparty}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {plantCount}개 발전소 · {contract.totalCapacityKw} kW
                          </p>
                        </div>
                        <SettlementStatusPill status={status} />
                      </div>
                      <div className="border-t border-white/[0.06] pt-3">
                        <p className="text-2xl font-bold text-white tabular-nums">₩{total.toLocaleString()}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {generation.toLocaleString()} kWh · 결제일 {billDate}
                          {status === 'pending' && <span className="ml-1 text-amber-400">(예정)</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mx-6 mb-4 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-400">합계 ({ppaPaymentsThisMonth.length}개 PPA)</span>
                  <span className="text-lg font-bold text-white tabular-nums">
                    ₩{ppaPaymentsThisMonth.reduce((s, x) => s + x.total, 0).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 정산 내역 — with PPA filter at top */}
          <SectionCard
            title={`정산 내역 (${filtered.length}건)`}
            actions={
              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Dropdown
                  align="right"
                  trigger={
                    <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08]">
                      <span className="text-xs text-slate-500">기간</span>
                      <span>{periodFilter}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                  }
                >
                  {periodOptions.map((p) => (
                    <DropdownItem key={p} onClick={() => setPeriodFilter(p)}>
                      {p}
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>
            }
          >
            {/* PPA filter pills above table */}
            <div className="px-6 py-3 border-b border-white/[0.06] flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">PPA:</span>
              <button
                onClick={() => setTablePpaFilter('all')}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] transition-colors ring-1',
                  tablePpaFilter === 'all'
                    ? 'bg-primary text-white ring-primary'
                    : 'bg-white/[0.04] text-slate-400 ring-white/[0.06] hover:text-white',
                )}
              >
                전체
              </button>
              {ALL_CONTRACTS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTablePpaFilter(c.id)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] transition-colors ring-1',
                    tablePpaFilter === c.id
                      ? 'bg-primary text-white ring-primary'
                      : 'bg-white/[0.04] text-slate-400 ring-white/[0.06] hover:text-white',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">기간</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">PPA · 발전소</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">공급량</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      단가
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">₩/kWh</span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">전력량대금</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">부가금·수수료</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">부가세</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-rose-300">청구 총액</th>
                    <th className="px-3 py-2 text-center font-medium whitespace-nowrap">상태</th>
                    <th className="px-3 py-2 text-center font-medium whitespace-nowrap">세금계산서</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const c = ALL_CONTRACTS.find((x) => x.id === r.contractId)!;
                    const p = c.plants.find((x) => x.id === r.plantId)!;
                    const surchargesTotal =
                      r.adjust +
                      r.network +
                      r.transmissionLoss +
                      r.welfareCost +
                      r.fund -
                      r.tradeFee -
                      r.supplyFee -
                      r.manageFee;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => {
                          setScope({ kind: 'ppa', contractId: c.id });
                          setSubPlantId(p.id);
                        }}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer group"
                      >
                        <td className="px-3 py-3 text-slate-300 tabular-nums whitespace-nowrap text-xs">
                          {(() => {
                            const [py, pm] = r.period.split('-').map(Number);
                            const lastDay = new Date(py, pm, 0).getDate();
                            const mm = String(pm).padStart(2, '0');
                            return `${py}.${mm}.01 ~ ${py}.${mm}.${String(lastDay).padStart(2, '0')}`;
                          })()}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white text-sm">{c.label}</p>
                            {c.kind && (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1',
                                  KIND_META[c.kind].bg,
                                  KIND_META[c.kind].tone,
                                  KIND_META[c.kind].ring,
                                )}
                              >
                                {c.kind}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{c.counterparty}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <p.resourceIcon size={10} className={p.resourceColor} />
                            {p.name}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs whitespace-nowrap">
                          {(r.generation / 1000).toFixed(1)} MWh
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs whitespace-nowrap">
                          ₩{r.smpUnitPrice.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs whitespace-nowrap">
                          ₩{r.supplyAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span
                            className="text-slate-400 tabular-nums text-xs"
                            title={`부가정산금 ₩${r.adjust.toLocaleString()} / 망이용 ₩${r.network.toLocaleString()} / 손실 ₩${r.transmissionLoss.toLocaleString()} / 복지 ₩${r.welfareCost.toLocaleString()} / 기반기금 ₩${r.fund.toLocaleString()} / 수수료 −₩${(r.tradeFee + r.supplyFee + r.manageFee).toLocaleString()}`}
                          >
                            ₩{surchargesTotal.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs whitespace-nowrap">
                          ₩{r.vat.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className="text-rose-300 font-bold tabular-nums text-xs">
                            ₩{r.total.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <SettlementStatusPill status={r.status} />
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/ppa/billing/tax-invoice?period=${r.period}`;
                            }}
                            className="text-primary hover:text-primary/80 text-xs"
                          >
                            <FileText size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                        조건에 맞는 정산이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {/* === MODE B: PPA selected (aggregate of multiple plants) === */}
      {scope.kind === 'ppa' && selectedContract && (
        <>
          {/* PPA header card with plant list */}
          <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/[0.10] ring-1 ring-primary/30">
                  <Layers size={18} className="text-primary" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white">
                    {selectedContract.label} · {selectedContract.counterparty}
                  </p>
                  <p className="text-[11px] text-slate-500 tabular-nums">{selectedContract.number}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    총 용량 {selectedContract.totalCapacityKw} kW · {selectedContract.operationStartDate} ~{' '}
                    {selectedContract.contractEnd} · {selectedContract.exchangeAgency}
                  </p>
                </div>
              </div>
            </div>

            {/* Plants under this PPA — selectable */}
            <div className="px-6 py-4 bg-white/[0.02]">
              <p className="text-xs font-semibold text-slate-300 mb-3">
                포함 발전소 ({selectedContract.plants.length}곳) · 클릭해서 상세 전환
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {/* PPA 합산 tile */}
                <button
                  onClick={() => setSubPlantId('all')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                    subPlantId === 'all'
                      ? 'border-primary/60 bg-primary/[0.06] ring-1 ring-primary/30'
                      : 'border-white/[0.06] bg-surface-card hover:border-white/[0.15]',
                  )}
                >
                  <Layers size={14} className={subPlantId === 'all' ? 'text-primary' : 'text-slate-400'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">PPA 합산</p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {selectedContract.plants.length}곳 · {selectedContract.totalCapacityKw} kW
                    </p>
                  </div>
                </button>
                {selectedContract.plants.map((p) => {
                  const isSelected = subPlantId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSubPlantId(p.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                        isSelected
                          ? 'border-primary/60 bg-primary/[0.06] ring-1 ring-primary/30'
                          : 'border-white/[0.06] bg-surface-card hover:border-white/[0.15]',
                      )}
                    >
                      <p.resourceIcon size={14} className={p.resourceColor} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-500 tabular-nums">{p.capacity}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3-card aggregate — first card varies by subPlantId */}
          {drillStats && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: PPA meta OR plant identity */}
              {selectedPlant ? (
                <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                      <selectedPlant.resourceIcon size={18} className={selectedPlant.resourceColor} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white truncate">{selectedPlant.name}</p>
                      <p className="text-xs text-slate-500">
                        {selectedContract.label} · {selectedContract.counterparty}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-white/[0.06]">
                    <MetaRow label="계약" value={`${selectedContract.label} · ${selectedContract.counterparty}`} />
                    <MetaRow
                      label="계약 기간"
                      value={`${selectedContract.operationStartDate} ~ ${selectedContract.contractEnd}`}
                    />
                    <MetaRow label="주소" value={selectedPlant.address} />
                    <MetaRow label="설비코드" value={selectedPlant.facilityCode} />
                    <MetaRow label="설비용량" value={selectedPlant.capacity} />
                    <MetaRow label="거래기관" value={selectedContract.exchangeAgency} />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5 space-y-3">
                  <p className="text-xs text-slate-500">PPA 메타 (합산)</p>
                  <div className="space-y-1">
                    <MetaRow label="계약번호" value={selectedContract.number} />
                    <MetaRow label="총 용량" value={`${selectedContract.totalCapacityKw} kW`} />
                    <MetaRow label="발전소 수" value={`${selectedContract.plants.length}곳`} />
                    <MetaRow label="단가" value={`₩${selectedContract.unitPrice}/kWh`} />
                    <MetaRow label="상업운전시작일" value={selectedContract.operationStartDate} />
                    <MetaRow label="거래기관" value={selectedContract.exchangeAgency} />
                  </div>
                </div>
              )}

              {/* Card 2: Average generation */}
              <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-slate-500">평균 발전량 {selectedPlant ? '' : '(PPA 합산)'}</p>
                  <p className="text-[10px] text-slate-600 tabular-nums">
                    {drillStats.periodFirst} ~ {drillStats.periodLast}
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white tabular-nums">
                    {drillStats.avgGen.toLocaleString()}
                    <span className="ml-1 text-base text-slate-400 font-normal">kWh</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">평균 {drillStats.avgHours.toFixed(2)}시간</p>
                </div>
                <div className="-mx-2 -mb-2">
                  <RmsAreaChart
                    data={chartData}
                    xKey="month"
                    areas={[{ key: 'gen', name: '발전량 (MWh)', color: '#10B981' }]}
                    height={90}
                  />
                </div>
              </div>

              {/* Card 3: Cumulative settlement */}
              <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-slate-500">누적 청구액 (VAT 제외)</p>
                  <p className="text-[10px] text-slate-600">최근 {chartData.length}개월</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white tabular-nums">
                    {drillStats.totalSupply.toLocaleString()}
                    <span className="ml-1 text-base text-slate-400 font-normal">원</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">평균 ₩{drillStats.avgSupply.toLocaleString()}/월</p>
                </div>
                <div className="-mx-2 -mb-2">
                  <RmsBarChart
                    data={chartData}
                    xKey="month"
                    bars={[{ key: 'bill', name: '청구액 (백만원)', color: '#A78BFA' }]}
                    height={90}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Records table + Detail — show plant column only when 합산 mode */}
          <RecordsTableWithDetail
            records={filtered}
            contracts={ALL_CONTRACTS}
            selectedRecordId={selectedRecord?.id ?? null}
            onSelectRecord={setSelectedRecordId}
            selectedRecord={selectedRecord ?? null}
            query={query}
            setQuery={setQuery}
            showPlantColumn={subPlantId === 'all'}
          />
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Records table + detail (shared) ───────────────────────── */

function RecordsTableWithDetail({
  records,
  contracts,
  selectedRecordId,
  onSelectRecord,
  selectedRecord,
  query,
  setQuery,
  showPlantColumn = false,
}: {
  records: MonthlyRecord[];
  contracts: Contract[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  selectedRecord: MonthlyRecord | null;
  query: string;
  setQuery: (q: string) => void;
  showPlantColumn?: boolean;
}) {
  // 정산금 통지서 미리보기 모달
  const [noticePreview, setNoticePreview] = useState<{ recordId: string; type: 'taxable' | 'non-taxable' } | null>(
    null,
  );
  // SPC 검토 상태 — pending이면 모든 값을 가림
  const { getApproval } = useDemoApprovals();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8">
        <SectionCard
          title={`전체 ${records.length}건`}
          actions={
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="text"
                  placeholder="검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1850px]">
              <thead>
                {/* 그룹 헤더 */}
                <tr className="border-b border-white/[0.04] text-[10px] text-slate-400 bg-white/[0.04]">
                  <th
                    colSpan={showPlantColumn ? 6 : 5}
                    className="px-3 py-1.5 text-left font-medium whitespace-nowrap border-r border-white/[0.04]"
                  >
                    기본
                  </th>
                  <th
                    colSpan={6}
                    className="px-3 py-1.5 text-center font-medium whitespace-nowrap border-r border-white/[0.04]"
                  >
                    과세
                  </th>
                  <th
                    colSpan={1}
                    className="px-3 py-1.5 text-center font-medium whitespace-nowrap border-r border-white/[0.04]"
                  >
                    부가세
                  </th>
                  <th
                    colSpan={1}
                    className="px-3 py-1.5 text-center font-medium whitespace-nowrap text-slate-500 border-r border-white/[0.04]"
                  >
                    비과세
                  </th>
                  <th
                    colSpan={1}
                    className="px-3 py-1.5 text-center font-medium whitespace-nowrap text-amber-300 border-r border-white/[0.04]"
                  >
                    요금 조정
                  </th>
                  <th colSpan={1} className="px-3 py-1.5 text-center font-medium whitespace-nowrap text-rose-300">
                    총 청구
                  </th>
                </tr>
                {/* 개별 컬럼 헤더 */}
                <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">기간</th>
                  {showPlantColumn && <th className="px-3 py-2 text-left font-medium whitespace-nowrap">발전소</th>}
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">청구일</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">청구상태</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">발전량</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap border-r border-white/[0.04]">
                    단가
                    <br />
                    <span className="text-[10px] font-normal text-slate-500">₩/kWh</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-rose-300">
                    공급가액
                    <br />
                    <span className="text-[10px] font-normal text-slate-500">지불</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">부가정산금</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">망이용요금</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-amber-400">
                    거래수수료
                    <br />
                    <span className="text-[10px] font-normal text-slate-500">전력거래소</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-amber-400">
                    거래수수료
                    <br />
                    <span className="text-[10px] font-normal text-slate-500">전력공급거래</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap border-r border-white/[0.04] text-amber-400">
                    관리 수수료
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap border-r border-white/[0.04]">
                    부가세
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap border-r border-white/[0.04] text-slate-500">
                    전력산업
                    <br />
                    기반기금
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap border-r border-white/[0.04] text-amber-300">
                    조정 금액
                    <br />
                    <span className="text-[10px] font-normal text-slate-500">SPC 통보</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-rose-300">
                    총 청구
                    <br />
                    <span className="text-[10px] font-normal text-slate-500">결제 금액</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const isSelected = r.id === selectedRecordId;
                  const c = contracts.find((x) => x.id === r.contractId)!;
                  const p = c.plants.find((x) => x.id === r.plantId)!;
                  const adj = r.feeAdjustment;
                  const adjTotal = adj ? adj.amount + adj.vat : 0;
                  // SPC 검토 상태 — pending이면 모든 값을 "—"로 가림
                  const isPending = getApproval(r.id) === 'pending';
                  const dash = <span className="text-slate-600">—</span>;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelectRecord(r.id)}
                      className={cn(
                        'border-b border-white/[0.04] cursor-pointer transition-colors',
                        isSelected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                        isPending && 'bg-amber-500/[0.02]',
                      )}
                    >
                      <td className="px-3 py-3 text-white tabular-nums whitespace-nowrap text-xs">
                        {(() => {
                          const [py, pm] = r.period.split('-').map(Number);
                          const lastDay = new Date(py, pm, 0).getDate();
                          const mm = String(pm).padStart(2, '0');
                          return `${py}.${mm}.01 ~ ${py}.${mm}.${String(lastDay).padStart(2, '0')}`;
                        })()}
                      </td>
                      {showPlantColumn && (
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="text-xs text-slate-300 flex items-center gap-1">
                            <p.resourceIcon size={11} className={p.resourceColor} />
                            {p.name}
                          </p>
                        </td>
                      )}
                      <td className="px-3 py-3 text-slate-400 tabular-nums text-xs whitespace-nowrap">{r.billDate}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.10] text-amber-300 ring-1 ring-amber-500/30 px-2 py-0.5 text-[10px] font-medium">
                            <Clock size={9} />
                            SPC 검토 대기
                          </span>
                        ) : (
                          <SettlementStatusPill status={r.status} />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap">
                        {isPending ? dash : <span className="text-slate-300">{r.generation.toLocaleString()} kWh</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                        ₩{r.smpUnitPrice.toFixed(2)}
                      </td>
                      {/* 과세 */}
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-semibold whitespace-nowrap">
                        {isPending ? dash : <span className="text-rose-300">₩{r.supplyAmount.toLocaleString()}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap">
                        {isPending ? dash : <span className="text-slate-300">₩{r.adjust.toLocaleString()}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap">
                        {isPending ? dash : <span className="text-slate-300">₩{r.network.toLocaleString()}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap">
                        {isPending ? dash : <span className="text-amber-300">−₩{r.tradeFee.toLocaleString()}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap">
                        {isPending ? dash : <span className="text-amber-300">−₩{r.supplyFee.toLocaleString()}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                        {isPending ? dash : <span className="text-amber-300">−₩{r.manageFee.toLocaleString()}</span>}
                      </td>
                      {/* 부가세 */}
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                        {isPending ? dash : <span className="text-slate-300">₩{r.vat.toLocaleString()}</span>}
                      </td>
                      {/* 비과세 */}
                      <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                        {isPending ? dash : <span className="text-slate-500">₩{r.fund.toLocaleString()}</span>}
                      </td>
                      {/* 요금 조정 */}
                      <td className="px-3 py-3 text-right whitespace-nowrap border-r border-white/[0.04]">
                        {isPending ? (
                          dash
                        ) : adj ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span
                              className={cn(
                                'tabular-nums text-xs font-semibold',
                                adjTotal >= 0 ? 'text-amber-300' : 'text-rose-300',
                              )}
                            >
                              {adjTotal >= 0 ? '+' : ''}₩{adjTotal.toLocaleString()}
                            </span>
                            <span
                              title={adj.reason}
                              className="inline-flex items-center rounded-full bg-emerald-500/[0.15] text-emerald-300 ring-1 ring-emerald-500/40 px-1.5 py-0.5 text-[9px] font-medium"
                            >
                              SPC 통보
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      {/* 총 청구 */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {isPending ? (
                          dash
                        ) : (
                          <span className="text-rose-300 font-bold tabular-nums text-xs">
                            ₩{r.total.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={showPlantColumn ? 16 : 15} className="px-4 py-12 text-center text-sm text-slate-500">
                      조건에 맞는 청구가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-4">
        {selectedRecord ? (
          (() => {
            // SPC 검토 완료 여부 — pending이면 모든 값을 가림
            const isPending = getApproval(selectedRecord.id) === 'pending';
            const mask = (val: string) => (isPending ? '—' : val);
            return (
              <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
                  <div>
                    {(() => {
                      const [py, pm] = selectedRecord.period.split('-').map(Number);
                      const lastDay = new Date(py, pm, 0).getDate();
                      const mm = String(pm).padStart(2, '0');
                      return (
                        <>
                          <p className="text-base font-bold text-white tabular-nums">
                            {py}.{mm}.01 ~ {py}.{mm}.{String(lastDay).padStart(2, '0')}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {isPending ? (
                              <span className="text-amber-300">SPC 검토 대기 (값 미공개)</span>
                            ) : (
                              '청구 정산'
                            )}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.10] text-amber-300 ring-1 ring-amber-500/30 px-2 py-0.5 text-[10px] font-medium">
                        <Clock size={9} />
                        SPC 검토 대기
                      </span>
                    ) : (
                      <>
                        <SettlementStatusPill status={selectedRecord.status} />
                        {selectedRecord.feeAdjustment && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/[0.15] text-amber-300 ring-1 ring-amber-500/40 px-2 py-0.5 text-[10px] font-medium">
                            요금 조정 반영
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-slate-300 mb-2">발전현황</p>
                  <MiniStatRow
                    label="발전량 (계량기)"
                    value={mask(`${selectedRecord.generation.toLocaleString()} kWh`)}
                  />
                  <MiniStatRow label="발전량 (RTU)" value="— kWh" valueClass="text-slate-500" />
                  <MiniStatRow label="발전일" value={mask(`${selectedRecord.generationDays} 일`)} />
                  <MiniStatRow label="발전시간" value={mask(`${selectedRecord.generationHours.toFixed(2)} 시간`)} />
                  <MiniStatRow
                    label="24/7 매칭률"
                    value={mask(`${selectedRecord.matchingRate.toFixed(1)}%`)}
                    valueClass={isPending ? 'text-slate-600' : 'text-emerald-300'}
                  />
                </div>

                {(() => {
                  // 계약 + 일정 데이터
                  const _c = contracts.find((x) => x.id === selectedRecord.contractId);
                  const [py, pm] = selectedRecord.period.split('-').map(Number);
                  const nextMonth = pm === 12 ? 1 : pm + 1;
                  const nextYear = pm === 12 ? py + 1 : py;
                  const nm = String(nextMonth).padStart(2, '0');
                  const lastDay = new Date(py, pm, 0).getDate();
                  const settlementDate = `${py}.${String(pm).padStart(2, '0')}.${String(lastDay).padStart(2, '0')}`;
                  const issueDate = `${nextYear}.${nm}.10`;
                  const dueDate = `${nextYear}.${nm}.25`;
                  const adj = selectedRecord.feeAdjustment;
                  const adjTotal = adj ? adj.amount + adj.vat : 0;
                  return (
                    <>
                      {/* 정산 분해 — 그룹 구조 (과세 / 부가세 / 비과세) */}
                      <div className="px-5 py-4 border-b border-white/[0.06]">
                        <p className="text-xs font-semibold text-slate-300 mb-2">정산 분해</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1 mb-1">과세</p>
                        <MiniStatRow
                          label="발전량 × SMP 단가"
                          value={mask(
                            `${selectedRecord.generation.toLocaleString()} kWh × ${selectedRecord.smpUnitPrice.toFixed(2)}원`,
                          )}
                          valueClass="text-slate-400 text-[11px]"
                        />
                        <MiniStatRow
                          label="공급가액 (지불)"
                          value={mask(`₩${selectedRecord.supplyAmount.toLocaleString()}`)}
                          valueClass="text-rose-300 font-semibold"
                        />
                        <MiniStatRow
                          label="부가정산금"
                          value={mask(`₩${selectedRecord.adjust.toLocaleString()}`)}
                          valueClass="text-slate-300"
                        />
                        <MiniStatRow
                          label="망이용요금"
                          value={mask(`₩${selectedRecord.network.toLocaleString()}`)}
                          valueClass="text-slate-300"
                        />
                        <MiniStatRow
                          label="거래수수료 (전력거래소, 차감)"
                          value={mask(`−₩${selectedRecord.tradeFee.toLocaleString()}`)}
                          valueClass="text-amber-300"
                        />
                        <MiniStatRow
                          label="거래수수료 (전력공급거래, 차감)"
                          value={mask(`−₩${selectedRecord.supplyFee.toLocaleString()}`)}
                          valueClass="text-amber-300"
                        />
                        <MiniStatRow
                          label="관리 수수료 (차감)"
                          value={mask(`−₩${selectedRecord.manageFee.toLocaleString()}`)}
                          valueClass="text-amber-300"
                        />
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">부가세</p>
                        <MiniStatRow
                          label="부가세 (+10%)"
                          value={mask(`+₩${selectedRecord.vat.toLocaleString()}`)}
                          valueClass="text-slate-300"
                        />
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">비과세</p>
                        <MiniStatRow
                          label="전력산업기반기금"
                          value={mask(`₩${selectedRecord.fund.toLocaleString()}`)}
                          valueClass="text-slate-500"
                        />
                        {adj && !isPending && (
                          <>
                            <p className="text-[10px] uppercase tracking-wide text-amber-200 mt-2 mb-1">
                              요금 조정 (SPC 통보)
                            </p>
                            <MiniStatRow
                              label="조정 합계 (반영)"
                              value={`${adjTotal >= 0 ? '+' : ''}₩${adjTotal.toLocaleString()}`}
                              valueClass={adjTotal >= 0 ? 'text-amber-300' : 'text-rose-300'}
                            />
                          </>
                        )}
                      </div>

                      {/* 합계금액 — 강조 */}
                      <div className="px-5 py-3 bg-rose-500/[0.06] border-b border-white/[0.06]">
                        <div className="rounded-md bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-3 py-2 flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-rose-200">총 청구 (수용가 지불)</span>
                          <span className="text-base font-bold text-rose-300 tabular-nums">
                            {isPending ? '—' : `₩${selectedRecord.total.toLocaleString()}`}
                          </span>
                        </div>
                        {isPending ? (
                          <p className="text-[10px] text-amber-200/80 mt-1.5">
                            ※ SPC가 검토 완료 후 청구 금액이 통보됩니다
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-1.5">
                            ※ 공급가액 + 부가세 (+ 요금 조정) = 실제 결제 금액
                          </p>
                        )}
                      </div>

                      {/* 요금 조정 통보 (있을 때만) — 읽기 전용 */}
                      {adj && (
                        <div className="px-5 py-3 border-b border-white/[0.06] bg-amber-500/[0.04]">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-amber-200">요금 조정 통보</p>
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-emerald-500/[0.15] text-emerald-300 ring-emerald-500/30">
                              SPC 검토 완료 · 확정
                            </span>
                          </div>
                          <MiniStatRow
                            label="조정 사유"
                            value={adj.reason}
                            valueClass="text-slate-300 text-[11px] leading-relaxed"
                          />
                          <MiniStatRow
                            label="조정 금액"
                            value={`${adj.amount >= 0 ? '+' : ''}₩${adj.amount.toLocaleString()}`}
                            valueClass={adj.amount >= 0 ? 'text-amber-300' : 'text-rose-300'}
                          />
                          <MiniStatRow
                            label="조정 부가세"
                            value={`${adj.vat >= 0 ? '+' : ''}₩${adj.vat.toLocaleString()}`}
                            valueClass="text-slate-300"
                          />
                          <p className="text-[10px] text-amber-200/70 mt-1.5">
                            ※ 본 조정은 SPC가 검토 완료하여 청구 금액에 반영되었습니다 (읽기 전용)
                          </p>
                        </div>
                      )}

                      {/* 일정 */}
                      <div className="px-5 py-3 bg-white/[0.02]">
                        <p className="text-xs font-semibold text-slate-300 mb-2">일정</p>
                        <MiniStatRow label="정산일" value={settlementDate} valueClass="text-slate-300 text-xs" />
                        <MiniStatRow
                          label="청구서 발행"
                          value={
                            selectedRecord.status === 'completed' ? (
                              issueDate
                            ) : (
                              <span className="text-slate-500">대기</span>
                            )
                          }
                        />
                        <MiniStatRow
                          label="지급기한"
                          value={dueDate}
                          valueClass="text-amber-200 text-xs font-semibold"
                        />
                        <MiniStatRow
                          label="결제일"
                          value={
                            selectedRecord.status === 'completed' ? (
                              <span className="text-emerald-300">{dueDate}</span>
                            ) : (
                              <span className="text-amber-300">{dueDate} 예정</span>
                            )
                          }
                        />
                      </div>

                      {/* 통지서 미리보기 + 청구서 다운 */}
                      <div className="px-5 py-3 border-t border-white/[0.06]">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-center"
                            onClick={() => setNoticePreview({ recordId: selectedRecord.id, type: 'taxable' })}
                          >
                            <FileText size={11} className="mr-1.5" />
                            통지서 미리보기
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="justify-center"
                            onClick={() =>
                              exportPdf(
                                `청구서-${selectedRecord.id}`,
                                `PPA 정산 청구서`,
                                ['항목', '값'],
                                [
                                  ['정산ID', selectedRecord.id],
                                  ['기간', selectedRecord.period?.key ?? ''],
                                ],
                              )
                            }
                          >
                            <Download size={12} className="mr-1.5" />
                            청구서 다운로드
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            );
          })()
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
            월을 선택하세요
          </div>
        )}
      </div>

      {/* ─────────── 정산금 통지서 미리보기 모달 ─────────── */}
      {noticePreview &&
        (() => {
          const r = records.find((x) => x.id === noticePreview.recordId);
          if (!r) return null;
          const c = contracts.find((x) => x.id === r.contractId);
          const p = c?.plants.find((x) => x.id === r.plantId);
          if (!c || !p) return null;
          const [py, pm] = r.period.split('-').map(Number);
          const lastDay = new Date(py, pm, 0).getDate();
          const mm = String(pm).padStart(2, '0');
          const periodStart = `${py}.${mm}.01`;
          const periodEnd = `${py}.${mm}.${String(lastDay).padStart(2, '0')}`;
          const nextMonth = pm === 12 ? 1 : pm + 1;
          const nextYear = pm === 12 ? py + 1 : py;
          const issueDate = `${nextYear}.${String(nextMonth).padStart(2, '0')}.10`;
          const dueDate = `${nextYear}.${String(nextMonth).padStart(2, '0')}.25`;
          const adj = r.feeAdjustment;
          const adjTotal = adj ? adj.amount + adj.vat : 0;
          // 과세분 합계 = 공급가액 + 부가정산금 + 망이용 − 거래수수료 − 관리 + 부가세 + 조정
          const total =
            r.supplyAmount + r.adjust + r.network - r.tradeFee - r.supplyFee - r.manageFee + r.vat + adjTotal;
          const toKoreanAmount = (n: number) => {
            const units = ['', '만', '억', '조'];
            const num = Math.abs(n);
            if (num === 0) return '영원';
            let result = '';
            let chunkIdx = 0;
            let rem = num;
            while (rem > 0) {
              const chunk = rem % 10000;
              if (chunk > 0) result = `${chunk.toLocaleString()}${units[chunkIdx]} ${result}`;
              rem = Math.floor(rem / 10000);
              chunkIdx++;
            }
            return `${n < 0 ? '음 ' : ''}${result.trim()}원`;
          };
          return (
            <Modal
              open={!!noticePreview}
              onClose={() => setNoticePreview(null)}
              title="정산금 통지서 미리보기 (별지 제39호)"
              size="lg"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setNoticePreview(null)}>
                    닫기
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      exportPdf(
                        `통지서-${noticePreview?.recordId}`,
                        '정산금 통지서 (별지 제39호)',
                        ['항목', '값'],
                        [
                          ['정산 ID', String(noticePreview?.recordId ?? '')],
                          ['유형', noticePreview?.type ?? ''],
                        ],
                      )
                    }
                  >
                    <Download size={12} className="mr-1.5" />
                    PDF 다운로드
                  </Button>
                </>
              }
            >
              <div
                className="bg-white text-slate-900 rounded-lg p-8 shadow-inner"
                style={{ fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' }}
              >
                {/* 문서 헤더 */}
                <div className="text-right text-[10px] text-slate-500 mb-2">[별지 제39호서식]</div>
                <h1 className="text-center text-2xl font-bold tracking-widest mb-1">정산금 통지서</h1>
                <p className="text-center text-xs text-slate-500 mb-6">Settlement Notice</p>

                {/* 통지서 정보 블록 */}
                <div className="text-xs grid grid-cols-2 gap-x-6 gap-y-1 mb-6 border-y border-slate-300 py-3">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">통지서 번호</span>
                    <span className="font-medium">
                      SN-{r.period}-{p.id.slice(-3).toUpperCase()}-01
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">발행일자</span>
                    <span className="font-medium">{issueDate}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">정산 기간</span>
                    <span className="font-medium">
                      {periodStart} ~ {periodEnd}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">지급기한</span>
                    <span className="font-semibold text-rose-700">{dueDate}</span>
                  </div>
                </div>

                {/* 발신자 / 수신자 */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                  <div className="border border-slate-300 rounded">
                    <div className="bg-slate-100 px-3 py-1.5 font-semibold border-b border-slate-300">
                      발신자 (정산기관)
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">상호</span>
                        <span>(주)울산E-SPC</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">사업자번호</span>
                        <span className="tabular-nums">215-87-44210</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">대표자</span>
                        <span>김에너</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">주소</span>
                        <span>울산광역시 남구 ...</span>
                      </div>
                    </div>
                  </div>
                  <div className="border border-slate-300 rounded">
                    <div className="bg-slate-100 px-3 py-1.5 font-semibold border-b border-slate-300">
                      수신자 (수용가)
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">계약</span>
                        <span>
                          {c.label} · {c.counterparty}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">발전소</span>
                        <span>{p.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">설비용량</span>
                        <span className="tabular-nums">{p.capacity}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">계약 기간</span>
                        <span className="tabular-nums text-[11px]">
                          {c.operationStartDate} ~ {c.contractEnd}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 정산 내역 */}
                <p className="text-sm font-semibold mb-2">■ 정산 내역</p>
                <table className="w-full text-xs border border-slate-300 mb-2">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="px-3 py-2 text-left">항목</th>
                      <th className="px-3 py-2 text-right">금액 (원)</th>
                      <th className="px-3 py-2 text-left">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">공급가액 (지불)</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        {r.supplyAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        발전량 {r.generation.toLocaleString()} kWh × ₩{r.smpUnitPrice.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">부가정산금</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.adjust.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-slate-500">KPX 정산정정분</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">망이용요금</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.network.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-slate-500">한전 단가표</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">거래수수료 (전력거래소)</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-rose-700">
                        −{r.tradeFee.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">차감</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">거래수수료 (전력공급거래)</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-rose-700">
                        −{r.supplyFee.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">차감</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">관리 수수료</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-rose-700">
                        −{r.manageFee.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">차감</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-1.5">부가세 (10%)</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.vat.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-slate-500">+ 10%</td>
                    </tr>
                    {adj && (
                      <tr className="border-b border-slate-200 bg-amber-50">
                        <td className="px-3 py-1.5">요금 조정 (SPC 통보)</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {adjTotal >= 0 ? '+' : ''}
                          {adjTotal.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{adj.reason || '—'}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <td className="px-3 py-2">합계 (지불 금액)</td>
                      <td className="px-3 py-2 text-right tabular-nums text-base text-rose-700">
                        ₩ {total.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-600">{toKoreanAmount(total)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 지급 정보 */}
                <div className="border border-slate-300 rounded p-3 text-xs mb-6">
                  <p className="font-semibold mb-1">■ 결제 정보</p>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">결제 방식</span>
                    <span>계좌이체</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">수금 계좌</span>
                    <span className="tabular-nums">기업 481-021726-97144 ((주)울산E-SPC)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">결제 기한</span>
                    <span className="font-semibold text-rose-700">{dueDate}</span>
                  </div>
                </div>

                {/* 안내문 */}
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  본 통지서는 「전기사업법」 제16조 및 「전력거래 정산 운영규정」에 의거하여 위 정산 기간에 대한
                  정산금을 통지하는 문서입니다. 이의가 있으시면 발행일로부터 7일 이내 서면으로 신청해 주시기 바랍니다.
                </p>

                {/* 발신자 서명 */}
                <div className="text-center text-sm font-semibold mt-8">
                  <p className="mb-1">{issueDate}</p>
                  <p className="text-base mt-3">
                    (주)울산E-SPC 대표 김에너{' '}
                    <span className="inline-block ml-2 px-3 py-2 ring-1 ring-rose-300 rounded-full text-rose-600 text-[10px]">
                      (인)
                    </span>
                  </p>
                </div>
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}
