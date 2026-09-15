// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sun,
  CreditCard,
  TrendingUp,
  Receipt,
  Calendar as CalendarIcon,
  Download,
  Mail,
  FileText,
  ExternalLink,
  Save,
  ChevronRight,
  ChevronLeft,
  Eye,
} from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { RmsPieChart } from '@/components/ui/Chart';
import { cn, exportExcel, exportMonthlyGenerationReport, generateMonthlyReportHtml } from '@/lib/utils';
import { usePpaSettlements, usePpaContracts } from '@/hooks/ppa/usePpa';
import { useVolumeContracts, useAllMonthlyRecords } from '@/hooks/lease/useLease';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';

type PpaType = 'lease' | 'onsite' | 'offsite';

const PPA_TYPE_META: Record<PpaType, { label: string; color: string; chartColor: string }> = {
  lease: { label: '직접 PPA', color: 'text-blue-300', chartColor: '#3B82F6' },
  onsite: { label: 'Onsite PPA', color: 'text-emerald-300', chartColor: '#10B981' },
  offsite: { label: 'Offsite PPA', color: 'text-violet-300', chartColor: '#A78BFA' },
};

const KPX_CALENDARS = [
  {
    label: '발전사업자 정산달력',
    url: 'https://www.kpx.or.kr/board.es?mid=a10502000000&bid=0045',
    description: 'KPX 종합자료실 — 발전사업자용 연간 정산일정',
  },
];

export default function GeneratorPpaRevenueAnalyticsPage() {
  const pathname = usePathname();
  const isDirect = pathname.includes('/direct/');
  const user = useAuthStore((s) => s.user);

  const reportFileName = useMemo(() => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const name = user?.name ?? '사용자';
    return `월간발전보고서_제작_${yy}${mm}${dd}(${name})_v1.0`;
  }, [user?.name]);

  // 직접 PPA: volume_lease_contracts + lease_monthly_records
  const { data: volumeContracts } = useVolumeContracts();
  const { data: allMonthlyRecords } = useAllMonthlyRecords({ year: 2026 });

  // Direct PPA: ppa_contracts + ppa_settlements
  const { data: ppaContracts } = usePpaContracts();
  const { data: ppaSettlements } = usePpaSettlements();

  // --- 직접 PPA 데이터 가공 ---
  const leaseContracts = useMemo(() => {
    const items = volumeContracts?.content ?? volumeContracts ?? [];
    return Array.isArray(items) ? items : [];
  }, [volumeContracts]);

  const leaseRecords = useMemo(() => {
    const items = allMonthlyRecords ?? [];
    return Array.isArray(items) ? items : [];
  }, [allMonthlyRecords]);

  // --- Direct PPA 데이터 가공 ---
  const directContracts = useMemo(() => {
    const items = ppaContracts?.content ?? ppaContracts ?? [];
    return Array.isArray(items) ? items : [];
  }, [ppaContracts]);

  const directSettlements = useMemo(() => {
    const items = ppaSettlements?.content ?? ppaSettlements ?? [];
    return Array.isArray(items) ? items : [];
  }, [ppaSettlements]);

  // --- 기간 선택 ---
  const availablePeriods = useMemo(() => {
    const records = isDirect ? directSettlements : leaseRecords;
    const periods = new Set<string>();
    for (const r of records) {
      const p = r.period; // "2026-05" format
      if (p) periods.add(p);
    }
    return Array.from(periods).sort();
  }, [isDirect, leaseRecords, directSettlements]);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const displayPeriod = `${selectedYear}.${String(selectedMonth).padStart(2, '0')}`;

  // 데이터가 로드되면 가장 최근 데이터가 있는 기간으로 자동 이동
  useEffect(() => {
    if (availablePeriods.length > 0) {
      const latest = availablePeriods[availablePeriods.length - 1];
      const y = Number(latest.slice(0, 4));
      const m = Number(latest.slice(5, 7));
      setSelectedYear(y);
      setSelectedMonth(m);
    }
  }, [availablePeriods.length]);

  const availableYears = useMemo(() => {
    const years = new Set(availablePeriods.map((p) => Number(p.slice(0, 4))));
    years.add(now.getFullYear());
    return Array.from(years).sort();
  }, [availablePeriods]);

  const monthsInYear = useMemo(() => {
    const months = availablePeriods.filter((p) => p.startsWith(String(selectedYear))).map((p) => Number(p.slice(5, 7)));
    if (selectedYear === now.getFullYear() && !months.includes(now.getMonth() + 1)) {
      months.push(now.getMonth() + 1);
    }
    return months.sort((a, b) => a - b);
  }, [availablePeriods, selectedYear]);

  const isPastPeriod = selectedPeriod < currentPeriod;
  const isCurrentPeriod = selectedPeriod === currentPeriod;
  const statusLabel = isPastPeriod ? '실적' : isCurrentPeriod ? '예상' : '예측';
  const periodTone = isPastPeriod
    ? { bg: 'bg-emerald-500/[0.10]', tone: 'text-emerald-300', ring: 'ring-emerald-500/30' }
    : isCurrentPeriod
      ? { bg: 'bg-amber-500/[0.10]', tone: 'text-amber-300', ring: 'ring-amber-500/30' }
      : { bg: 'bg-blue-500/[0.10]', tone: 'text-blue-300', ring: 'ring-blue-500/30' };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const months = availablePeriods.filter((p) => p.startsWith(String(year))).map((p) => Number(p.slice(5, 7)));
    if (months.length > 0 && !months.includes(selectedMonth)) {
      setSelectedMonth(months[months.length - 1]);
    }
  };

  // --- 직접 PPA 선택 기간 수익 ---
  const leaseMonthData = useMemo(() => {
    const records = leaseRecords.filter((r) => r.period === selectedPeriod);
    const totalRent = records.reduce((sum, r) => sum + (r.rent ?? 0), 0);
    const totalKwh = records.reduce((sum, r) => sum + (r.generatedKwh ?? 0), 0);
    return { records, totalRent, totalKwh };
  }, [leaseRecords, selectedPeriod]);

  // --- Direct PPA 선택 기간 수익 ---
  const directMonthData = useMemo(() => {
    const settlements = directSettlements.filter((s) => s.period === selectedPeriod);
    const onsiteTotal = settlements.filter((s) => s.ppaKind === 'onsite').reduce((sum, s) => sum + (s.total ?? 0), 0);
    const offsiteTotal = settlements.filter((s) => s.ppaKind === 'offsite').reduce((sum, s) => sum + (s.total ?? 0), 0);
    const otherTotal = settlements
      .filter((s) => s.ppaKind !== 'onsite' && s.ppaKind !== 'offsite')
      .reduce((sum, s) => sum + (s.total ?? 0), 0);
    return { settlements, onsiteTotal, offsiteTotal, otherTotal, total: onsiteTotal + offsiteTotal + otherTotal };
  }, [directSettlements, selectedPeriod]);

  // --- 통합 수치 ---
  const contracts = isDirect ? directContracts : leaseContracts;
  const totalCapacity = isDirect
    ? directContracts.reduce((sum, c) => sum + (c.totalCapacityKw ?? 0), 0)
    : leaseContracts.reduce((sum, c) => sum + (c.capacityKw ?? 0), 0);
  const totalRevenue = isDirect ? directMonthData.total : leaseMonthData.totalRent;

  // 보고서 행
  const reportRows = useMemo(() => {
    if (isDirect) {
      return directMonthData.settlements.map((s) => ({
        name: s.plantName ?? `발전소 #${s.plantId}`,
        ppaType: PPA_TYPE_META[s.ppaKind as PpaType]?.label ?? s.ppaKind ?? 'PPA',
        revenue: s.total ?? 0,
        fee: Math.round((s.tradeFee ?? 0) + (s.supplyFee ?? 0) + (s.manageFee ?? 0)),
        net: (s.total ?? 0) - Math.round((s.tradeFee ?? 0) + (s.supplyFee ?? 0) + (s.manageFee ?? 0)),
      }));
    }
    return leaseMonthData.records.map((r) => {
      const contract = leaseContracts.find((c) => c.id === r.leaseContractId);
      return {
        name: contract?.siteName ?? `계약 #${r.leaseContractId}`,
        ppaType: '직접 PPA',
        revenue: r.rent ?? 0,
        fee: 0,
        net: r.rent ?? 0,
      };
    });
  }, [isDirect, directMonthData, leaseMonthData, leaseContracts]);

  const totalFee = reportRows.reduce((sum, r) => sum + r.fee, 0);
  const totalNet = reportRows.reduce((sum, r) => sum + r.net, 0);

  // 월간 발전 보고서 PDF 데이터 (참조 양식 기준)
  const reportData = useMemo(() => {
    const plantName =
      reportRows.length === 0
        ? '전체 발전소'
        : reportRows.length === 1
          ? reportRows[0].name
          : `${reportRows[0].name} 외 ${reportRows.length - 1}개소`;

    // 누적(선택 기간까지) 발전량/수익
    const cumulativeKwh = isDirect
      ? undefined
      : leaseRecords
          .filter((r) => r.period && r.period <= selectedPeriod)
          .reduce((s, r) => s + (r.generatedKwh ?? 0), 0);
    const cumulativeRevenue = isDirect
      ? directSettlements
          .filter((s) => s.period && s.period <= selectedPeriod)
          .reduce((sum, s) => sum + (s.total ?? 0), 0)
      : leaseRecords.filter((r) => r.period && r.period <= selectedPeriod).reduce((sum, r) => sum + (r.rent ?? 0), 0);

    const monthTotalKwh = isDirect ? undefined : leaseMonthData.totalKwh || undefined;

    return {
      plantName,
      capacityKw: totalCapacity || undefined,
      period: displayPeriod,
      monthTotalKwh,
      cumulativeKwh: cumulativeKwh || undefined,
      revenue: {
        totalKwh: monthTotalKwh,
        monthRevenue: totalRevenue || undefined,
        cumulativeRevenue: cumulativeRevenue || undefined,
      },
    };
  }, [
    reportRows,
    isDirect,
    leaseRecords,
    directSettlements,
    selectedPeriod,
    leaseMonthData.totalKwh,
    totalCapacity,
    displayPeriod,
    totalRevenue,
  ]);

  // 발송 설정 모달
  const [exportSettingsOpen, setExportSettingsOpen] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState('finance@company.co.kr');
  const [deliveryDay, setDeliveryDay] = useState('5');
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '전력거래', path: '/generator/trading' },
          { label: isDirect ? '직접 PPA' : '온사이트 PPA' },
          { label: '수익 분석' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">수익 분석</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isDirect
              ? `${directContracts.length}개 계약 — Onsite·Offsite PPA 수익 분석`
              : `${leaseContracts.length}개 계약 — 직접 PPA 수익 분석`}
          </p>
        </div>
      </div>

      {/* Period picker */}
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-surface-card px-4 py-3 flex-wrap">
        <span className="text-xs text-slate-500 shrink-0">연도</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleYearChange(selectedYear - 1)}
            disabled={selectedYear <= availableYears[0]}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-base font-semibold text-white tabular-nums min-w-[72px] text-center">
            {selectedYear}년
          </span>
          <button
            type="button"
            onClick={() => handleYearChange(selectedYear + 1)}
            disabled={selectedYear >= availableYears[availableYears.length - 1]}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
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
          <div className="max-h-72 overflow-y-auto min-w-[160px]">
            {(monthsInYear.length > 0 ? monthsInYear : Array.from({ length: 12 }, (_, i) => i + 1)).map((m) => {
              const p = `${selectedYear}-${String(m).padStart(2, '0')}`;
              const hasData = availablePeriods.includes(p);
              return (
                <DropdownItem key={m} onClick={() => setSelectedMonth(m)}>
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span
                      className={cn(
                        'text-sm tabular-nums',
                        m === selectedMonth ? 'text-primary font-semibold' : 'text-slate-200',
                      )}
                    >
                      {String(m).padStart(2, '0')}월
                    </span>
                    {hasData && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full ring-1 bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30">
                        실적
                      </span>
                    )}
                  </div>
                </DropdownItem>
              );
            })}
          </div>
        </Dropdown>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
            periodTone.bg,
            periodTone.tone,
            periodTone.ring,
          )}
        >
          {statusLabel}
        </span>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{displayPeriod}</span>
      </div>

      {/* KPI */}
      <StatsGrid columns={isDirect ? 4 : 3}>
        {isDirect && (
          <StatCard
            icon={<TrendingUp size={18} className="text-emerald-400" />}
            label={`${displayPeriod} Onsite PPA`}
            value={`₩${directMonthData.onsiteTotal.toLocaleString()}`}
          />
        )}
        {isDirect && (
          <StatCard
            icon={<Receipt size={18} className="text-violet-400" />}
            label={`${displayPeriod} Offsite PPA`}
            value={`₩${directMonthData.offsiteTotal.toLocaleString()}`}
          />
        )}
        {!isDirect && (
          <StatCard
            icon={<CreditCard size={18} className="text-blue-400" />}
            label={`${displayPeriod} 온사이트 PPA 요금`}
            value={`₩${leaseMonthData.totalRent.toLocaleString()}`}
          />
        )}
        <StatCard
          icon={<Receipt size={18} className="text-amber-400" />}
          label={`${displayPeriod} ${statusLabel} 총 수익`}
          value={`₩${totalRevenue.toLocaleString()}`}
        />
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="총 설비용량"
          value={`${totalCapacity.toLocaleString()} kW`}
          sub={`${contracts.length}개 계약`}
        />
      </StatsGrid>

      {/* 수익 구성 */}
      <SectionCard
        title={`${displayPeriod} 수익 구성`}
        description={`${isDirect ? 'Onsite · Offsite PPA' : '온사이트 PPA'} 분해`}
        actions={
          <Badge variant="info" className="text-[10px]">
            {displayPeriod}
          </Badge>
        }
        noPadding
      >
        {totalRevenue === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-5">
            <Receipt size={32} className="text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">{isDirect ? '직접 PPA' : '온사이트 PPA'} 수익 데이터가 없습니다</p>
            <p className="text-xs text-slate-500 mt-1">계약 등록 후 수익이 발생하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 py-4 items-center">
            <RmsPieChart
              donut
              height={240}
              data={
                isDirect
                  ? [
                      {
                        name: 'Onsite PPA',
                        value: directMonthData.onsiteTotal,
                        color: PPA_TYPE_META.onsite.chartColor,
                      },
                      {
                        name: 'Offsite PPA',
                        value: directMonthData.offsiteTotal,
                        color: PPA_TYPE_META.offsite.chartColor,
                      },
                    ]
                  : [{ name: '직접 PPA', value: leaseMonthData.totalRent, color: PPA_TYPE_META.lease.chartColor }]
              }
            />

            <div className="space-y-2">
              {isDirect ? (
                <>
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <p className="text-sm font-semibold text-emerald-300">Onsite PPA</p>
                      <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
                        {directMonthData.total
                          ? ((directMonthData.onsiteTotal / directMonthData.total) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] text-slate-500">수요지 내 직접 공급</p>
                      <p className="text-base font-bold text-white tabular-nums">
                        ₩{directMonthData.onsiteTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-400" />
                      <p className="text-sm font-semibold text-violet-300">Offsite PPA</p>
                      <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
                        {directMonthData.total
                          ? ((directMonthData.offsiteTotal / directMonthData.total) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] text-slate-500">원격지 계약 공급</p>
                      <p className="text-base font-bold text-white tabular-nums">
                        ₩{directMonthData.offsiteTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    <p className="text-sm font-semibold text-blue-300">직접 PPA</p>
                    <span className="ml-auto text-[11px] text-slate-500 tabular-nums">100.0%</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10px] text-slate-500">발전량 × 단가 PPA 요금</p>
                    <p className="text-base font-bold text-white tabular-nums">
                      ₩{leaseMonthData.totalRent.toLocaleString()}
                    </p>
                  </div>
                  {leaseMonthData.totalKwh > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
                      발전량 {leaseMonthData.totalKwh.toLocaleString()} kWh × ₩92.6/kWh
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 수익 분해 테이블 */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">
            {isDirect ? '발전소별' : '계약별'} {displayPeriod} {statusLabel} 수익 분해
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-white/[0.06] text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">{isDirect ? '발전소' : '사업장'}</th>
                  <th className="px-4 py-2 font-medium">유형</th>
                  <th className="px-4 py-2 font-medium">매출</th>
                  {isDirect && <th className="px-4 py-2 font-medium text-amber-300">수수료</th>}
                  <th className="px-4 py-2 font-medium text-emerald-300">{isDirect ? '순수취액' : 'PPA 요금'}</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={isDirect ? 5 : 4} className="px-4 py-8 text-center text-sm text-slate-500">
                      {displayPeriod} 기간의 {isDirect ? '직접 PPA' : '온사이트 PPA'} 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  reportRows.map((r, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Sun size={13} className="text-amber-400" />
                          <span className="text-white">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-blue-300">{r.ppaType}</span>
                      </td>
                      <td className="px-4 py-2.5 text-white font-semibold tabular-nums">
                        ₩{r.revenue.toLocaleString()}
                      </td>
                      {isDirect && (
                        <td className="px-4 py-2.5 text-amber-300 tabular-nums">−₩{r.fee.toLocaleString()}</td>
                      )}
                      <td className="px-4 py-2.5 text-emerald-300 font-semibold tabular-nums">
                        ₩{r.net.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {reportRows.length > 0 && (
                <tfoot>
                  <tr className="bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-sm text-slate-400">합계</td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-white font-bold tabular-nums">₩{totalRevenue.toLocaleString()}</td>
                    {isDirect && (
                      <td className="px-4 py-2.5 text-amber-300 tabular-nums">−₩{totalFee.toLocaleString()}</td>
                    )}
                    <td className="px-4 py-2.5 text-emerald-300 font-bold tabular-nums">
                      ₩{totalNet.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </SectionCard>

      {/* 정산 일정 + Export */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 정산 일정 (2/3) */}
        <div className="xl:col-span-2">
          <SectionCard
            title="정산 일정"
            description={isDirect ? '직접 PPA — KPX 정산달력 기반' : '직접 PPA — 월별 PPA 요금 정산'}
            actions={
              <Dropdown
                align="right"
                trigger={
                  <Button size="sm" variant="ghost">
                    <ExternalLink size={12} className="mr-1" />
                    KPX 정산달력
                    <ChevronDown size={12} className="ml-1" />
                  </Button>
                }
              >
                {KPX_CALENDARS.map((cal) => (
                  <DropdownItem key={cal.label} onClick={() => window.open(cal.url, '_blank', 'noopener')}>
                    <div>
                      <p className="text-sm flex items-center gap-1.5">
                        <CalendarIcon size={12} />
                        {cal.label}
                      </p>
                      <p className="text-xs text-slate-500">{cal.description}</p>
                    </div>
                  </DropdownItem>
                ))}
              </Dropdown>
            }
            noPadding
          >
            <div className="px-5 py-4 space-y-2">
              {/* 실적이 있는 월별 데이터로 정산 일정 자동 생성 */}
              {(isDirect ? directSettlements : leaseRecords)
                .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
                .slice(0, 5)
                .map((record, idx) => {
                  const period = record.period ?? '';
                  const [y, m] = period.split('-');
                  const amount = isDirect ? (record.total ?? 0) : (record.rent ?? 0);
                  const contractName = isDirect
                    ? (record.plantName ?? '발전소')
                    : (leaseContracts.find((c) => c.id === record.leaseContractId)?.siteName ?? 'PPA 계약');
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg p-3 ring-1 bg-white/[0.02] ring-white/[0.04]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 bg-emerald-500/[0.08] ring-emerald-500/30">
                        <Receipt size={14} className="text-emerald-300" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-300">
                          {y}.{m} {isDirect ? 'PPA 정산' : 'PPA 요금 정산'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">{contractName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-white font-semibold tabular-nums">₩{amount.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 tabular-nums">
                          {y}.{m}
                        </p>
                      </div>
                    </div>
                  );
                })}

              {(isDirect ? directSettlements : leaseRecords).length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500">정산 이력이 없습니다</p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Export (1/3) */}
        <SectionCard title="보고서 / 자동 발송" description="월간 보고서 다운로드 + 정기 이메일 발송">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">월간 보고서 다운로드</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    exportExcel(
                      reportFileName,
                      '월간수익',
                      isDirect
                        ? ['발전소', 'PPA유형', '매출(₩)', '수수료(₩)', '순수취(₩)']
                        : ['사업장', '유형', 'PPA 요금(₩)'],
                      reportRows.map((r) =>
                        isDirect
                          ? [r.name, r.ppaType, String(r.revenue), String(r.fee), String(r.net)]
                          : [r.name, r.ppaType, String(r.revenue)],
                      ),
                    )
                  }
                >
                  <Download size={12} className="mr-1" />
                  Excel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportMonthlyGenerationReport(reportFileName, reportData)}
                >
                  <FileText size={12} className="mr-1" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">정기 자동 발송</p>
              <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.04] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">월간 수익 리포트</span>
                  <Badge variant={deliveryEnabled ? 'info' : 'default'} className="text-[10px]">
                    {deliveryEnabled ? `매월 ${deliveryDay}일` : '비활성'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  보내는 곳: <span className="text-slate-400">{deliveryEmail}</span>
                </p>
                <Button size="sm" variant="ghost" className="w-full" onClick={() => setExportSettingsOpen(true)}>
                  <Mail size={12} className="mr-1" />
                  발송 설정 관리
                </Button>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-3 space-y-2">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setPreviewHtml(generateMonthlyReportHtml(reportData));
                  setPreviewOpen(true);
                }}
              >
                <Eye size={12} className="mr-1.5" />
                미리보기
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="w-full"
                onClick={async () => {
                  await exportMonthlyGenerationReport(reportFileName, reportData);
                  useToastStore.getState().add('success', '월간 발전 보고서가 저장되었습니다.');
                }}
              >
                <Save size={12} className="mr-1.5" />
                보고서 저장
              </Button>
              <p className="text-[10px] text-slate-500 text-center">선택 기간 기준으로 PDF 자동 생성</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 발송 설정 모달 */}
      <Modal
        open={exportSettingsOpen}
        onClose={() => setExportSettingsOpen(false)}
        title="정기 발송 설정"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportSettingsOpen(false)}>
              닫기
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setExportSettingsOpen(false);
                useToastStore
                  .getState()
                  .add('success', `발송 설정이 저장되었습니다. 매월 ${deliveryDay}일 ${deliveryEmail}으로 발송됩니다.`);
              }}
            >
              설정 저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-accent mb-1.5">수신 이메일 *</label>
            <Input
              type="email"
              value={deliveryEmail}
              onChange={(e) => setDeliveryEmail(e.target.value)}
              placeholder="finance@company.co.kr"
            />
          </div>
          <div>
            <label className="block text-xs text-accent mb-1.5">발송일 (매월) *</label>
            <Select
              options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `매월 ${i + 1}일` }))}
              value={deliveryDay}
              onChange={(e) => setDeliveryDay(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] px-4 py-3">
            <div>
              <p className="text-sm text-white">자동 발송 활성화</p>
              <p className="text-[11px] text-slate-500">설정된 날짜에 월간 수익 보고서를 자동 발송합니다</p>
            </div>
            <button
              type="button"
              onClick={() => setDeliveryEnabled((v) => !v)}
              className={cn(
                'rounded-full px-3 py-1 text-xs ring-1 transition-colors',
                deliveryEnabled
                  ? 'bg-emerald-500/[0.15] text-emerald-300 ring-emerald-500/40'
                  : 'bg-white/[0.04] text-slate-500 ring-white/[0.06]',
              )}
            >
              {deliveryEnabled ? '활성' : '비활성'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 미리보기 모달 */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${displayPeriod} 월간 발전 보고서 미리보기`}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              닫기
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await exportMonthlyGenerationReport(reportFileName, reportData);
                useToastStore.getState().add('success', '월간 발전 보고서가 저장되었습니다.');
                setPreviewOpen(false);
              }}
            >
              <Download size={12} className="mr-1" />
              PDF 저장
            </Button>
          </>
        }
      >
        <iframe
          srcDoc={previewHtml}
          title="보고서 미리보기"
          className="w-full rounded"
          style={{ height: '70vh', border: 'none', background: '#fff' }}
        />
      </Modal>
    </div>
  );
}
