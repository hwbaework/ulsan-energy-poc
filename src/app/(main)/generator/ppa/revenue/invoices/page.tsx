// @ts-nocheck
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sun,
  Wind,
  Battery,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  Search,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn, exportSettlementNoticePdf, generateSettlementNoticeHtml } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';
import { useAllLeaseInvoices } from '@/hooks/lease/useLease';
import type { PpaSettlement } from '@/types/ppa';
import type { LeaseInvoice as LeaseInvoiceType } from '@/types/lease';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';

/* ───────────────────────── Types ───────────────────────── */

interface SettlementRecord {
  id: string;
  plantName: string;
  ppaKind: string;
  period: string;
  year: number;
  month: number;
  generation: number;
  unitPrice: number;
  ppaRevenue: number;
  tradeFee: number;
  supplyFee: number;
  manageFee: number;
  vat: number;
  netRevenue: number;
  adjust: number;
  network: number;
  fund: number;
  status: SettlementStatus;
  total: number;
}

type SettlementStatus = 'paid' | 'issued' | 'pending';
const STATUS_META: Record<
  SettlementStatus,
  { label: string; tone: string; bg: string; ring: string; icon: LucideIcon }
> = {
  paid: {
    label: '입금 완료',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.08]',
    ring: 'ring-emerald-500/30',
    icon: CheckCircle2,
  },
  issued: {
    label: '발행·미입금',
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.08]',
    ring: 'ring-amber-500/30',
    icon: Clock,
  },
  pending: {
    label: '확정 대기',
    tone: 'text-slate-400',
    bg: 'bg-white/[0.04]',
    ring: 'ring-white/[0.08]',
    icon: AlertTriangle,
  },
};

const KIND_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  offsite: { icon: Wind, color: 'text-sky-400' },
  onsite: { icon: Sun, color: 'text-amber-400' },
  lease: { icon: Battery, color: 'text-violet-400' },
};

function ppaStatusToSettlement(apiStatus: string): SettlementStatus {
  switch (apiStatus) {
    case 'CONFIRMED':
      return 'paid';
    case 'PENDING':
      return 'pending';
    default:
      return 'issued';
  }
}

function ppaSettlementToRecord(s: PpaSettlement): SettlementRecord {
  const [y, m] = s.period.split('-').map(Number);
  const netRevenue = s.supplyAmount - s.tradeFee - s.supplyFee - s.manageFee + s.vat;
  return {
    id: `ppa-${s.id}`,
    plantName: s.plantName,
    ppaKind: s.ppaKind ?? 'offsite',
    period: s.period,
    year: y,
    month: m,
    generation: s.generationKwh,
    unitPrice: s.smpUnitPrice,
    ppaRevenue: s.supplyAmount,
    tradeFee: s.tradeFee,
    supplyFee: s.supplyFee,
    manageFee: s.manageFee,
    vat: s.vat,
    netRevenue,
    adjust: s.adjustAmount ?? 0,
    network: s.networkFee ?? 0,
    fund: s.fundAmount ?? 0,
    status: ppaStatusToSettlement(s.status),
    total: s.total,
  };
}

function leaseToRecord(li: LeaseInvoiceType): SettlementRecord {
  const [y, m] = li.period.split('-').map(Number);
  const statusMap: Record<string, SettlementStatus> = { PAID: 'paid', ISSUED: 'issued', UNISSUED: 'pending' };
  const netRevenue = li.supplyAmount + li.vat;
  return {
    id: `lease-${li.id}`,
    plantName: li.siteName ?? li.equipmentName ?? '',
    ppaKind: 'lease',
    period: li.period,
    year: y,
    month: m,
    generation: li.supplyAmount / 92.6,
    unitPrice: 92.6,
    ppaRevenue: li.supplyAmount,
    tradeFee: 0,
    supplyFee: 0,
    manageFee: li.maintenanceFee ?? 0,
    vat: li.vat,
    netRevenue,
    adjust: 0,
    network: 0,
    fund: 0,
    status: statusMap[li.invoiceStatus] ?? 'pending',
    total: li.total,
  };
}

function MetaRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn('text-white tabular-nums text-right', valueClass)}>{value}</span>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function GeneratorPpaRevenueInvoicesPage() {
  const pathname = usePathname();
  const isDirect = pathname.includes('/direct/');

  const { data: apiSettlements } = usePpaSettlements();
  const { data: apiLeaseInvoices } = useAllLeaseInvoices();
  const user = useAuthStore((s) => s.user);
  const isGeneratorView = getPersona(user) === 'generator';

  const allRecords = useMemo<SettlementRecord[]>(() => {
    const ppaList = (
      Array.isArray(apiSettlements) ? apiSettlements : ((apiSettlements as any)?.content ?? [])
    ) as PpaSettlement[];
    const leaseList = (apiLeaseInvoices ?? []) as LeaseInvoiceType[];
    let fromPpa = ppaList.map(ppaSettlementToRecord);
    if (isGeneratorView) {
      fromPpa = fromPpa.map((r) => ({
        ...r,
        plantName:
          r.ppaKind === 'offsite' ? 'Offsite PPA 계약' : r.ppaKind === 'onsite' ? 'Onsite PPA 계약' : r.plantName,
      }));
    }
    const fromLease = leaseList.map(leaseToRecord);
    let merged = [...fromPpa, ...fromLease].sort((a, b) => b.period.localeCompare(a.period));
    if (isDirect) {
      merged = merged.filter((r) => r.ppaKind !== 'lease');
    } else {
      merged = merged.filter((r) => r.ppaKind === 'lease');
    }
    return merged;
  }, [apiSettlements, apiLeaseInvoices, isGeneratorView, isDirect]);

  const plantNames = useMemo(() => {
    const names = new Set(allRecords.map((r) => r.plantName));
    return Array.from(names);
  }, [allRecords]);

  const periods = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.period));
    return Array.from(set).sort();
  }, [allRecords]);

  const years = useMemo(() => Array.from(new Set(periods.map((p) => Number(p.split('-')[0])))).sort(), [periods]);

  const [scopeId, setScopeId] = useState<'all' | string>('all');
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    return now.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1;
  });
  const [historyQuery, setHistoryQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [noticePreview, setNoticePreview] = useState<{ recordId: string; type: 'taxable' | 'non-taxable' } | null>(
    null,
  );

  const initialSet = useRef(false);
  useEffect(() => {
    if (!initialSet.current && periods.length > 0) {
      const latest = periods[periods.length - 1];
      const [y, m] = latest.split('-').map(Number);
      setSelectedYear(y);
      setSelectedMonth(m);
      initialSet.current = true;
    }
  }, [periods]);

  const yearMin = years.length > 0 ? years[0] : selectedYear;
  const yearMax = years.length > 0 ? years[years.length - 1] : selectedYear;
  const monthsInYear = useMemo(
    () =>
      periods
        .filter((p) => p.startsWith(`${selectedYear}-`))
        .map((p) => Number(p.split('-')[1]))
        .sort((a, b) => a - b),
    [selectedYear, periods],
  );

  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isPast = allRecords.some((r) => r.period === selectedPeriod && r.status === 'paid');

  const shiftYear = (delta: number) => {
    const next = Math.max(yearMin, Math.min(yearMax, selectedYear + delta));
    if (next === selectedYear) return;
    setSelectedYear(next);
    const months = periods.filter((p) => p.startsWith(`${next}-`)).map((p) => Number(p.split('-')[1]));
    if (months.length > 0 && !months.includes(selectedMonth)) setSelectedMonth(months[months.length - 1]);
  };

  const scopedRecords = useMemo(
    () => (scopeId === 'all' ? allRecords : allRecords.filter((r) => r.plantName === scopeId)),
    [scopeId, allRecords],
  );
  const selectedPlantLabel = scopeId === 'all' ? `전체 합산 (${plantNames.length})` : scopeId;

  const periodRecords = useMemo(
    () => scopedRecords.filter((r) => r.period === selectedPeriod),
    [scopedRecords, selectedPeriod],
  );

  const sums = useMemo(() => {
    const ppa = periodRecords.reduce((s, r) => s + r.ppaRevenue, 0);
    const cost = periodRecords.reduce((s, r) => s + r.tradeFee + r.supplyFee + r.manageFee, 0);
    const vatSum = periodRecords.reduce((s, r) => s + r.vat, 0);
    const net = ppa - cost + vatSum;
    const outstanding = periodRecords.filter((r) => r.status === 'issued').reduce((s, r) => s + r.netRevenue, 0);
    return { ppa, cost, net, outstanding };
  }, [periodRecords]);

  const historyRecords = useMemo(() => {
    const out = scopedRecords;
    if (!historyQuery) return out;
    const q = historyQuery.toLowerCase();
    return out.filter((r) => r.period.includes(q) || r.plantName.toLowerCase().includes(q));
  }, [scopedRecords, historyQuery]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '전력거래', path: '/generator/trading' },
          { label: isDirect ? '직접 PPA' : '온사이트 PPA' },
          { label: '청구서' },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">정산</h1>
          <p className="mt-1 text-sm text-slate-400">월별 정산 분해 · 매출/매입 세금계산서 자동 검증</p>
        </div>
        <Dropdown
          align="right"
          trigger={
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[200px] cursor-pointer text-white hover:bg-white/[0.08]">
              <span className="text-xs text-slate-500 shrink-0">발전소</span>
              <span className="font-medium truncate flex-1">{selectedPlantLabel}</span>
              <ChevronDown size={14} className="text-slate-500 shrink-0" />
            </div>
          }
        >
          <DropdownItem onClick={() => setScopeId('all' as any)}>
            <div className="flex items-center gap-2">
              <Building2 size={14} />
              <div>
                <p className="text-sm">전체 합산</p>
                <p className="text-xs text-slate-500">{plantNames.length}개 발전소</p>
              </div>
            </div>
          </DropdownItem>
          <div className="my-1 border-t border-white/[0.06]" />
          {plantNames.map((name) => (
            <DropdownItem key={name} onClick={() => setScopeId(name)}>
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                <div>
                  <p className="text-sm">{name}</p>
                </div>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>
      </div>

      {/* Period picker */}
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-surface-card px-4 py-3 flex-wrap">
        <span className="text-xs text-slate-500 shrink-0">연도</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftYear(-1)}
            disabled={selectedYear <= yearMin}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-base font-semibold text-white tabular-nums min-w-[72px] text-center">
            {selectedYear}년
          </span>
          <button
            type="button"
            onClick={() => shiftYear(1)}
            disabled={selectedYear >= yearMax}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="text-xs text-slate-500 shrink-0 ml-2">월</span>
        <Dropdown
          align="left"
          trigger={
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer min-w-[100px]">
              <span className="font-semibold tabular-nums">{String(selectedMonth).padStart(2, '0')}월</span>
              <ChevronDown size={12} className="ml-auto text-slate-500" />
            </div>
          }
        >
          <div className="max-h-72 overflow-y-auto min-w-[140px]">
            {(monthsInYear.length > 0 ? monthsInYear : [selectedMonth]).map((m) => (
              <DropdownItem key={m} onClick={() => setSelectedMonth(m)}>
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    m === selectedMonth ? 'text-primary font-semibold' : 'text-slate-200',
                  )}
                >
                  {String(m).padStart(2, '0')}월
                </span>
              </DropdownItem>
            ))}
          </div>
        </Dropdown>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
            isPast
              ? 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30'
              : 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
          )}
        >
          {isPast ? '확정' : '집계 중'}
        </span>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{selectedPeriod}</span>
      </div>

      {/* KPI 4 */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          label={`${selectedPeriod} 매출 (전력량대금)`}
          value={`₩${sums.ppa.toLocaleString()}`}
          sub="발전사 수입"
        />
        <StatCard
          icon={<TrendingDown size={18} className="text-amber-400" />}
          label={`${selectedPeriod} 비용 (수수료 합계)`}
          value={`₩${sums.cost.toLocaleString()}`}
          sub="거래소·공급거래·관리"
        />
        <StatCard
          icon={<CreditCard size={18} className="text-blue-400" />}
          label={`${selectedPeriod} 순수익 (실 수령액)`}
          value={`₩${sums.net.toLocaleString()}`}
          sub="매출 − 비용 + 부가세"
        />
        <StatCard
          icon={<Clock size={18} className="text-rose-400" />}
          label="미수금 (발행·미입금)"
          value={`₩${sums.outstanding.toLocaleString()}`}
          sub="입금 대기"
        />
      </StatsGrid>

      {/* 정산 이력 + 상세 패널 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8">
          <SectionCard
            title={`전체 ${historyRecords.length}건`}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-40">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="발전소·기간"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1550px]">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.04] text-[10px] text-slate-400 bg-white/[0.04]">
                    <th
                      colSpan={4}
                      className="px-3.5 text-left font-medium whitespace-nowrap border-r border-white/[0.04]"
                    >
                      기본
                    </th>
                    <th colSpan={6} className="px-3.5 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      과세
                    </th>
                    <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      부가세
                    </th>
                    <th
                      colSpan={1}
                      className="px-3.5 font-medium whitespace-nowrap text-slate-500 border-r border-white/[0.04]"
                    >
                      비과세
                    </th>
                    <th
                      colSpan={1}
                      className="px-3.5 font-medium whitespace-nowrap text-emerald-300 border-r border-white/[0.04]"
                    >
                      월 합계
                    </th>
                    <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap"></th>
                  </tr>
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">기간</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">발전소</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">공급량</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      단가
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">₩/kWh</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-emerald-400">전력량 대금</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">부가정산금</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">망이용요금</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-amber-400">
                      거래수수료
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">전력거래소</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-amber-400">
                      거래수수료
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">전력공급거래</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-amber-400">
                      관리 수수료
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04]">부가세</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-slate-500">
                      전력산업
                      <br />
                      기반기금
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-emerald-300">
                      실 수령액
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">SPC 입금</span>
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.map((r) => {
                    const sm = STATUS_META[r.status];
                    const isSelected = r.id === (selectedRecordId ?? historyRecords[0]?.id);
                    const kindIcon = KIND_ICON[r.ppaKind] ?? KIND_ICON.offsite;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRecordId(r.id)}
                        className={cn(
                          'border-b border-white/[0.04] cursor-pointer transition-colors',
                          isSelected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                        )}
                      >
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">
                          {(() => {
                            const lastDay = new Date(r.year, r.month, 0).getDate();
                            const mm = String(r.month).padStart(2, '0');
                            return `${r.year}.${mm}.01 ~ ${r.year}.${mm}.${String(lastDay).padStart(2, '0')}`;
                          })()}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <kindIcon.icon size={11} className={kindIcon.color} />
                            <span className="text-xs text-slate-200">{r.plantName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          <span className="text-slate-400">{Math.round(r.generation).toLocaleString()} kWh</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums text-xs border-r border-white/[0.04]">
                          ₩{r.unitPrice}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs font-semibold">
                          <span className="text-emerald-300">₩{r.ppaRevenue.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          <span className="text-slate-300">₩{r.adjust.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          <span className="text-slate-300">₩{r.network.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          <span className="text-amber-300">−₩{r.tradeFee.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          <span className="text-amber-300">−₩{r.supplyFee.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs border-r border-white/[0.04]">
                          <span className="text-amber-300">−₩{r.manageFee.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs border-r border-white/[0.04]">
                          <span className="text-slate-300">₩{r.vat.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs border-r border-white/[0.04]">
                          <span className="text-slate-500">₩{r.fund.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-white/[0.04]">
                          <span className="text-emerald-300 font-bold tabular-nums text-xs">
                            ₩{r.total.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                              sm.bg,
                              sm.tone,
                              sm.ring,
                            )}
                          >
                            <sm.icon size={9} />
                            {sm.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {historyRecords.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center text-sm text-slate-500">
                        정산 데이터가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Right: 선택 record 상세 패널 */}
        <div className="xl:col-span-4">
          {(() => {
            const r = historyRecords.find((x) => x.id === selectedRecordId) ?? historyRecords[0];
            if (!r) {
              return (
                <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  좌측 표에서 행을 선택하세요
                </div>
              );
            }
            const sm = STATUS_META[r.status];
            return (
              <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden sticky top-6">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  {(() => {
                    const lastDay = new Date(r.year, r.month, 0).getDate();
                    const mm = String(r.month).padStart(2, '0');
                    return (
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-base font-bold text-white tabular-nums whitespace-nowrap">
                            {r.year}.{mm}.01 ~ {r.year}.{mm}.{String(lastDay).padStart(2, '0')}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            정산 기간 · {Math.round(r.generation).toLocaleString()} kWh 발전
                          </p>
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 shrink-0',
                            sm.bg,
                            sm.tone,
                            sm.ring,
                          )}
                        >
                          <sm.icon size={9} />
                          {sm.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="px-5 py-3 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-slate-300 mb-2">정산 분해 (발전사)</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1 mb-1">과세</p>
                  <MetaRow
                    label="전력량 대금 (매출)"
                    value={`₩${r.ppaRevenue.toLocaleString()}`}
                    valueClass="text-emerald-300 font-semibold"
                  />
                  <MetaRow label="부가정산금" value={`₩${r.adjust.toLocaleString()}`} valueClass="text-slate-300" />
                  <MetaRow label="망이용요금" value={`₩${r.network.toLocaleString()}`} valueClass="text-slate-300" />
                  <MetaRow
                    label="거래수수료 (전력거래소, 차감)"
                    value={`−₩${r.tradeFee.toLocaleString()}`}
                    valueClass="text-amber-300"
                  />
                  <MetaRow
                    label="거래수수료 (전력공급거래, 차감)"
                    value={`−₩${r.supplyFee.toLocaleString()}`}
                    valueClass="text-amber-300"
                  />
                  <MetaRow
                    label="관리 수수료 (차감)"
                    value={`−₩${r.manageFee.toLocaleString()}`}
                    valueClass="text-amber-300"
                  />
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">부가세</p>
                  <MetaRow label="부가세 (+10%)" value={`+₩${r.vat.toLocaleString()}`} valueClass="text-slate-300" />
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">비과세</p>
                  <MetaRow label="전력산업기반기금" value={`₩${r.fund.toLocaleString()}`} valueClass="text-slate-500" />
                  <div className="my-2 rounded-md bg-emerald-500/[0.10] ring-1 ring-emerald-500/30 px-3 py-2 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-emerald-200">실 수령액 (SPC 입금)</span>
                    <span className="text-base font-bold text-emerald-300 tabular-nums">
                      ₩{r.total.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">※ 매출 − 거래수수료 + 부가세 = 실제 입금되는 금액</p>
                </div>

                <div className="px-5 py-3 bg-white/[0.02]">
                  <p className="text-xs font-semibold text-slate-300 mb-2">일정</p>
                  {(() => {
                    const periodLastDay = new Date(r.year, r.month, 0).getDate();
                    const settlementDate = `${r.year}.${String(r.month).padStart(2, '0')}.${String(periodLastDay).padStart(2, '0')}`;
                    const nextMonth = r.month === 12 ? 1 : r.month + 1;
                    const nextYear = r.month === 12 ? r.year + 1 : r.year;
                    const nm = String(nextMonth).padStart(2, '0');
                    const issueDate = `${nextYear}.${nm}.10`;
                    const dueDate = `${nextYear}.${nm}.25`;
                    return (
                      <>
                        <MetaRow label="정산일" value={settlementDate} valueClass="text-slate-300 text-xs" />
                        <MetaRow
                          label="정산서 발행"
                          value={r.status !== 'pending' ? issueDate : <span className="text-slate-500">대기</span>}
                        />
                        <MetaRow label="지급기한" value={dueDate} valueClass="text-amber-200 text-xs font-semibold" />
                        <MetaRow
                          label="SPC 입금"
                          value={
                            r.status === 'paid' ? (
                              <span className="text-emerald-300">{dueDate}</span>
                            ) : (
                              <span className="text-amber-300">{dueDate} 예정</span>
                            )
                          }
                        />
                      </>
                    );
                  })()}
                </div>
                <div className="px-5 py-3 border-t border-white/[0.06]">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="justify-center"
                      onClick={() => setNoticePreview({ recordId: r.id, type: 'taxable' })}
                    >
                      <FileText size={11} className="mr-1.5" />
                      통지서 미리보기
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="justify-center"
                      onClick={() => {
                        exportSettlementNoticePdf(`정산서_${r.period}_${r.plantName}`, {
                          period: r.period,
                          plantName: r.plantName,
                          generation: r.generation,
                          unitPrice: r.unitPrice,
                          ppaRevenue: r.ppaRevenue,
                          adjust: r.adjust,
                          network: r.network,
                          tradeFee: r.tradeFee,
                          supplyFee: r.supplyFee,
                          manageFee: r.manageFee,
                          vat: r.vat,
                          total: r.total,
                        });
                      }}
                    >
                      <Download size={11} className="mr-1.5" />
                      정산서 다운로드
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 정산금 통지서 미리보기 모달 */}
      {noticePreview &&
        (() => {
          const r = historyRecords.find((x) => x.id === noticePreview.recordId);
          if (!r) return null;
          const noticeData = {
            period: r.period,
            plantName: r.plantName,
            generation: r.generation,
            unitPrice: r.unitPrice,
            ppaRevenue: r.ppaRevenue,
            adjust: r.adjust,
            network: r.network,
            tradeFee: r.tradeFee,
            supplyFee: r.supplyFee,
            manageFee: r.manageFee,
            vat: r.vat,
            total: r.total,
          };
          return (
            <Modal
              open={!!noticePreview}
              onClose={() => setNoticePreview(null)}
              title="정산금 통지서 미리보기 (별지 제39호)"
              size="xl"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setNoticePreview(null)}>
                    닫기
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => exportSettlementNoticePdf(`정산통지서_${r.period}_${r.plantName}`, noticeData)}
                  >
                    <Download size={12} className="mr-1.5" />
                    PDF 다운로드
                  </Button>
                </>
              }
            >
              <iframe
                srcDoc={generateSettlementNoticeHtml(noticeData)}
                title="정산금 통지서 미리보기"
                className="w-full rounded"
                style={{ height: '70vh', border: 'none', background: '#fff' }}
              />
            </Modal>
          );
        })()}
    </div>
  );
}
