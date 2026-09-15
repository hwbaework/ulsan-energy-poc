// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, Sun } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { SettlementStatusPill, BillingKpiCard, ScopeTrigger, MetaRow } from '@/components/features/billing';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { useAllMonthlyRecords, useVolumeContracts } from '@/hooks/lease/useLease';
import { useKepcoAvgPrice } from '@/hooks/platform/useBillingRates';

type SettlementStatus = 'pending' | 'completed';

function formatPeriod(period: string): string {
  if (period === '전체') return '전체';
  const [py, pm] = period.split('-').map(Number);
  if (!py || !pm) return period;
  return `${py}년 ${pm}월`;
}

type Scope = { kind: 'all' } | { kind: 'lease'; contractId: string };

export default function LeaseSettlementPage() {
  const KEPCO_AVG_PRICE = useKepcoAvgPrice();
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);

  const { data: volumeData } = useVolumeContracts();
  const { data: apiRecords } = useAllMonthlyRecords({ year: yearFilter });

  const contracts = useMemo(() => {
    const list = volumeData?.content;
    if (!list || list.length === 0) return [];
    return list.map((c: any) => ({
      id: String(c.id),
      label: c.siteName ?? '—',
      lessor: c.generatorCompanyName ?? '—',
      consumer: c.consumerCompanyName ?? '—',
      capacityKw: Number(c.capacityKw) || 0,
      contractYears: c.contractYears ?? 0,
      startDate: c.startDate ?? '',
      monthlyRent: c.monthlyRent ?? 0,
      warrantyHours: c.warrantyHours ?? 1300,
    }));
  }, [volumeData]);

  const records = useMemo(() => {
    if (!apiRecords || !Array.isArray(apiRecords)) return [];
    const thisMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return apiRecords.map((r: any) => {
      const gen = Number(r.generatedKwh) || 0;
      const unit = Number(r.unitPriceKrw) || 0;
      const rent = r.rent ?? Math.round(gen * unit);
      const vat = Math.round(rent * 0.1);
      const total = rent + vat;
      const gridSaving = Math.round(gen * KEPCO_AVG_PRICE);
      const saved = r.savedAmount ?? Math.round(gen * (KEPCO_AVG_PRICE - unit));
      const net = r.netSavings ?? saved - rent;
      const period = r.period ?? '';
      const isPending = period >= thisMonth;
      const [py, pm] = period.split('-').map(Number);
      const billMonth = pm === 12 ? 1 : pm + 1;
      const billYear = pm === 12 ? py + 1 : py;
      return {
        id: String(r.id),
        contractId: String(r.leaseContractId),
        period,
        generation: gen,
        unitPrice: unit,
        leaseFee: rent,
        maintenanceFee: r.maintenanceFee ?? 0,
        vat,
        total,
        gridSaving,
        netSaving: gridSaving - total,
        status: (isPending ? 'pending' : 'completed') as SettlementStatus,
        billDate: `${billYear}-${String(billMonth).padStart(2, '0')}-15`,
        baselineBill: r.baselineBill ?? 0,
        reducedBill: r.reducedBill ?? 0,
        savedAmount: saved,
      };
    });
  }, [apiRecords, KEPCO_AVG_PRICE, currentYear]);

  const [scope, setScope] = useState<Scope>({ kind: 'all' });
  const [periodFilter, setPeriodFilter] = useState<string>('전체');
  const [query, setQuery] = useState('');
  const [paymentCardsOpen, setPaymentCardsOpen] = useState(true);
  const [tableLeaseFilter, setTableLeaseFilter] = useState<'all' | string>('all');

  const selectedContract = scope.kind === 'lease' ? (contracts.find((c) => c.id === scope.contractId) ?? null) : null;

  const scopedRecords = useMemo(() => {
    if (scope.kind === 'all') return records;
    return records.filter((r) => r.contractId === scope.contractId);
  }, [scope, records]);

  const sortedRecords = useMemo(
    () => [...scopedRecords].sort((a, b) => b.period.localeCompare(a.period)),
    [scopedRecords],
  );

  const periodOptions = useMemo(() => {
    const periods = Array.from(new Set(sortedRecords.map((r) => r.period))).sort((a, b) => b.localeCompare(a));
    return ['전체', ...periods];
  }, [sortedRecords]);

  const filtered = useMemo(() => {
    return sortedRecords.filter((r) => {
      if (scope.kind === 'all' && tableLeaseFilter !== 'all' && r.contractId !== tableLeaseFilter) return false;
      if (periodFilter !== '전체' && r.period !== periodFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const c = contracts.find((x) => x.id === r.contractId);
        return (
          r.period.includes(q) ||
          r.billDate.includes(q) ||
          (c?.label.toLowerCase().includes(q) ?? false) ||
          (c?.lessor.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [sortedRecords, periodFilter, query, scope, tableLeaseFilter, contracts]);

  const thisMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const thisMonthRecords = records.filter((r) => r.period === thisMonth);
  const hasThisMonth = thisMonthRecords.length > 0;
  const latestMonth =
    records.length > 0 ? [...records].sort((a, b) => b.period.localeCompare(a.period))[0].period : null;
  const estimateRecords = hasThisMonth
    ? thisMonthRecords
    : latestMonth
      ? records.filter((r) => r.period === latestMonth)
      : [];
  const totalThisMonth = estimateRecords.reduce((s, r) => s + r.total, 0);
  const totalSavingThisMonth = estimateRecords.reduce((s, r) => s + r.netSaving, 0);
  const estimateLabel = hasThisMonth ? null : latestMonth;
  const ytdTotal = records.filter((r) => r.status === 'completed').reduce((s, r) => s + r.total, 0);
  const pendingCount = records.filter((r) => r.status === 'pending').length;

  const leasePaymentsThisMonth = useMemo(() => {
    const targetMonth = hasThisMonth ? thisMonth : latestMonth;
    if (!targetMonth) return [];
    return contracts
      .map((c) => {
        const recs = records.filter((r) => r.contractId === c.id && r.period === targetMonth);
        const total = recs.reduce((s, r) => s + r.total, 0);
        const generation = recs.reduce((s, r) => s + r.generation, 0);
        const netSaving = recs.reduce((s, r) => s + r.netSaving, 0);
        const status: SettlementStatus = recs.some((r) => r.status === 'pending') ? 'pending' : 'completed';
        const billDate = recs[0]?.billDate ?? '';
        return { contract: c, total, generation, netSaving, status, billDate };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [contracts, records, thisMonth, hasThisMonth, latestMonth]);

  const drillStats = useMemo(() => {
    if (scope.kind === 'all') return null;
    const completed = sortedRecords.filter((r) => r.status === 'completed');
    if (completed.length === 0) return null;
    const totalGen = completed.reduce((s, r) => s + r.generation, 0);
    const totalFee = completed.reduce((s, r) => s + r.total, 0);
    const totalSaving = completed.reduce((s, r) => s + r.gridSaving, 0);
    const totalNet = completed.reduce((s, r) => s + r.netSaving, 0);

    const monthAgg = new Map<string, { gen: number; fee: number; saving: number; net: number }>();
    for (const r of completed) {
      const existing = monthAgg.get(r.period) ?? { gen: 0, fee: 0, saving: 0, net: 0 };
      existing.gen += r.generation;
      existing.fee += r.total;
      existing.saving += r.gridSaving;
      existing.net += r.netSaving;
      monthAgg.set(r.period, existing);
    }

    const chartData = Array.from(monthAgg.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({
        month: `${parseInt(period.split('-')[1], 10)}월`,
        leaseFee: Math.round(v.fee / 1000),
        gridSaving: Math.round(v.saving / 1000),
        netSaving: Math.round(v.net / 1000),
      }));

    return { totalGen, totalFee, totalSaving, totalNet, chartData, count: completed.length };
  }, [scope, sortedRecords]);

  if (contracts.length === 0 && records.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '정산' }]} />
        <h1 className="text-2xl font-bold text-white">정산</h1>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-slate-400">등록된 Lease 계약이 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">PPA 계약이 체결되면 정산 내역이 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '정산' }]} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">정산</h1>
          <p className="mt-1 text-sm text-slate-400">
            {scope.kind === 'all'
              ? `전체 합산 · ${contracts.length}개 리스 · ${records.length}건 정산`
              : `${selectedContract?.label} · ${scopedRecords.length}건`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <Dropdown
            align="right"
            trigger={
              <button className="flex items-center gap-1.5 h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white hover:bg-white/[0.08] tabular-nums">
                <span>{yearFilter}년</span>
                <ChevronDown size={11} className="text-slate-500" />
              </button>
            }
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <DropdownItem key={y} onClick={() => setYearFilter(y)}>
                {y}년
              </DropdownItem>
            ))}
          </Dropdown>

          <Dropdown
            align="left"
            trigger={
              <ScopeTrigger
                label="리스"
                value={scope.kind === 'all' ? '전체 합산' : (selectedContract?.label ?? '—')}
              />
            }
          >
            <DropdownItem onClick={() => setScope({ kind: 'all' })}>
              <div>
                <p className="text-sm">전체 합산</p>
                <p className="text-xs text-slate-500">{contracts.length}개 리스</p>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {contracts.map((c) => (
              <DropdownItem key={c.id} onClick={() => setScope({ kind: 'lease', contractId: c.id })}>
                <div>
                  <p className="text-sm">{c.label}</p>
                  <p className="text-xs text-slate-500">
                    {c.lessor} · {c.capacityKw} kW
                  </p>
                </div>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* KPI 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BillingKpiCard
          label="이번달 PPA 요금 (예상)"
          value={`₩ ${totalThisMonth.toLocaleString()}`}
          sub={estimateLabel ? `${formatPeriod(estimateLabel)} 기준 추정 · VAT 포함` : '익월 15일 확정 · VAT 포함'}
        />
        <BillingKpiCard
          label="이번달 순절감 (예상)"
          value={`₩ ${totalSavingThisMonth.toLocaleString()}`}
          valueColor={totalSavingThisMonth >= 0 ? 'text-emerald-400' : 'text-amber-400'}
          sub={
            estimateLabel ? `${formatPeriod(estimateLabel)} 기준 추정` : `한전 ₩${KEPCO_AVG_PRICE}/kWh 기준 · 리스 차감`
          }
        />
        <BillingKpiCard label="누적 PPA 요금 (YTD)" value={`₩ ${ytdTotal.toLocaleString()}`} sub="확정분만 합산" />
        <BillingKpiCard
          label="예상 정산 (미확정)"
          value={`${pendingCount} 건`}
          valueColor={pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
          sub={pendingCount > 0 ? '익월 15일 확정' : undefined}
          badge={pendingCount === 0 ? { text: '정상', tone: 'emerald' } : undefined}
        />
      </div>

      {/* === MODE A: 전체 종합 === */}
      {scope.kind === 'all' && (
        <>
          {leasePaymentsThisMonth.length > 0 && (
            <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
              <button
                type="button"
                onClick={() => setPaymentCardsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <p className="text-base font-semibold text-white">이번달 결제 예정</p>
                  {leasePaymentsThisMonth.length > 1 && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {leasePaymentsThisMonth.length}개 리스 ·{' '}
                      <span className="text-white tabular-nums">
                        합계 ₩{leasePaymentsThisMonth.reduce((s, x) => s + x.total, 0).toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
                <ChevronUp
                  size={18}
                  className={cn('text-slate-500 transition-transform duration-200', !paymentCardsOpen && 'rotate-180')}
                />
              </button>

              {paymentCardsOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-6 pb-4">
                  {leasePaymentsThisMonth.map(({ contract, total, generation, netSaving, status, billDate }) => (
                    <button
                      key={contract.id}
                      onClick={() => setScope({ kind: 'lease', contractId: contract.id })}
                      className="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                          <Sun size={16} className="text-amber-400" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{contract.label}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {contract.lessor} · {contract.capacityKw} kW
                          </p>
                        </div>
                        <SettlementStatusPill labels={{ pending: '예상', completed: '확정' }} status={status} />
                      </div>
                      <div className="border-t border-white/[0.06] pt-3">
                        <p className="text-2xl font-bold text-white tabular-nums">₩{total.toLocaleString()}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {generation.toLocaleString()} kWh · 결제일 {billDate}
                          </p>
                          <span
                            className={cn(
                              'text-[11px] font-medium tabular-nums',
                              netSaving >= 0 ? 'text-emerald-400' : 'text-amber-400',
                            )}
                          >
                            순절감 {netSaving >= 0 ? '+' : ''}₩{netSaving.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
                      <span>{formatPeriod(periodFilter)}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                  }
                >
                  {periodOptions.map((p) => (
                    <DropdownItem key={p} onClick={() => setPeriodFilter(p)}>
                      {formatPeriod(p)}
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>
            }
          >
            {contracts.length > 1 && (
              <div className="px-6 py-3 border-b border-white/[0.06] flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">리스:</span>
                <button
                  onClick={() => setTableLeaseFilter('all')}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] transition-colors ring-1',
                    tableLeaseFilter === 'all'
                      ? 'bg-primary text-white ring-primary'
                      : 'bg-white/[0.04] text-slate-400 ring-white/[0.06] hover:text-white',
                  )}
                >
                  전체
                </button>
                {contracts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTableLeaseFilter(c.id)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] transition-colors ring-1',
                      tableLeaseFilter === c.id
                        ? 'bg-primary text-white ring-primary'
                        : 'bg-white/[0.04] text-slate-400 ring-white/[0.06] hover:text-white',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">기간</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">리스</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">발전량</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-rose-300">PPA 요금 (VAT포함)</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-emerald-400">한전 절감</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">순절감</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">결제일</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">상태</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">세금계산서</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const c = contracts.find((x) => x.id === r.contractId);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setScope({ kind: 'lease', contractId: r.contractId })}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                      >
                        <td className="px-3 py-3 text-slate-300 tabular-nums whitespace-nowrap text-xs">
                          {formatPeriod(r.period)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="text-white text-sm">{c?.label ?? '—'}</p>
                          <p className="text-[11px] text-slate-500">{c?.lessor ?? '—'}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">
                          {r.generation.toLocaleString()} kWh
                        </td>
                        <td className="px-3 py-3 text-rose-300 font-bold tabular-nums text-xs">
                          ₩{r.total.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-emerald-400 tabular-nums text-xs">
                          ₩{r.gridSaving.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-xs font-semibold">
                          <span className={cn(r.netSaving >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                            {r.netSaving >= 0 ? '+' : ''}₩{r.netSaving.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-400 tabular-nums text-xs whitespace-nowrap">
                          {r.billDate}
                          {r.status === 'pending' && <span className="ml-1 text-amber-400/70">(예상)</span>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <SettlementStatusPill labels={{ pending: '예상', completed: '확정' }} status={r.status} />
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <a
                            href={`/lease/billing/tax-invoice?period=${r.period}`}
                            className="text-primary hover:text-primary/80 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            세금계산서
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
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

      {/* === MODE B: Lease selected === */}
      {scope.kind === 'lease' && selectedContract && (
        <>
          <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
            <div className="px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.10] ring-1 ring-amber-500/30">
                  <Sun size={18} className="text-amber-400" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white">{selectedContract.label}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedContract.lessor} · {selectedContract.capacityKw} kW · 계약 {selectedContract.contractYears}
                    년
                  </p>
                </div>
                <button
                  onClick={() => setScope({ kind: 'all' })}
                  className="shrink-0 rounded-md bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white transition-colors ring-1 ring-white/[0.06]"
                >
                  전체로 돌아가기
                </button>
              </div>
            </div>
          </div>

          {drillStats && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5 space-y-3">
                  <p className="text-xs text-slate-500">계약 정보</p>
                  <div className="space-y-1">
                    <MetaRow label="발전사업자" value={selectedContract.lessor} />
                    <MetaRow label="설비 용량" value={`${selectedContract.capacityKw} kW`} />
                    <MetaRow label="계약 기간" value={`${selectedContract.contractYears}년`} />
                    <MetaRow label="시작일" value={selectedContract.startDate} />
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5 space-y-2">
                  <p className="text-xs text-slate-500">정산 요약 ({drillStats.count}개월)</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400">총 발전량</span>
                      <span className="text-sm tabular-nums text-white">
                        {drillStats.totalGen.toLocaleString()} kWh
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400">누적 PPA 요금</span>
                      <span className="text-sm tabular-nums text-rose-300">
                        ₩{drillStats.totalFee.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400">누적 한전 절감</span>
                      <span className="text-sm tabular-nums text-emerald-400">
                        ₩{drillStats.totalSaving.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-2">
                      <span className="text-xs text-slate-400 font-semibold">누적 순절감</span>
                      <span
                        className={cn(
                          'text-sm tabular-nums font-bold',
                          drillStats.totalNet >= 0 ? 'text-emerald-400' : 'text-amber-400',
                        )}
                      >
                        {drillStats.totalNet >= 0 ? '+' : ''}₩{drillStats.totalNet.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5">
                  <p className="text-xs text-slate-500 mb-3">월별 PPA 요금 vs 절감</p>
                  <RmsBarLineChart
                    data={drillStats.chartData}
                    xKey="month"
                    bars={[
                      { key: 'leaseFee', name: 'PPA 요금 (천원)', color: '#F59E0B' },
                      { key: 'gridSaving', name: '한전 절감 (천원)', color: '#10B981' },
                    ]}
                    lines={[{ key: 'netSaving', name: '순절감 (천원)', color: '#6366F1' }]}
                    yUnit="천원"
                    height={180}
                  />
                </div>
              </div>

              <SectionCard
                title={`정산 내역 (${filtered.length}건)`}
                actions={
                  <Dropdown
                    align="right"
                    trigger={
                      <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08]">
                        <span className="text-xs text-slate-500">기간</span>
                        <span>{formatPeriod(periodFilter)}</span>
                        <ChevronDown size={14} className="text-slate-500" />
                      </button>
                    }
                  >
                    {periodOptions.map((p) => (
                      <DropdownItem key={p} onClick={() => setPeriodFilter(p)}>
                        {formatPeriod(p)}
                      </DropdownItem>
                    ))}
                  </Dropdown>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="text-left">
                      <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                        <th className="px-3 py-2.5 text-left font-medium">기간</th>
                        <th className="px-3 py-2.5 font-medium">발전량</th>
                        <th className="px-3 py-2.5 font-medium text-rose-300">PPA 요금 (VAT포함)</th>
                        <th className="px-3 py-2.5 font-medium text-emerald-400">한전 절감</th>
                        <th className="px-3 py-2.5 font-medium">순절감</th>
                        <th className="px-3 py-2.5 text-left font-medium">결제일</th>
                        <th className="px-3 py-2.5 font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">{formatPeriod(r.period)}</td>
                          <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">
                            {r.generation.toLocaleString()} kWh
                          </td>
                          <td className="px-3 py-3 text-rose-300 font-bold tabular-nums text-xs">
                            ₩{r.total.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-emerald-400 tabular-nums text-xs">
                            ₩{r.gridSaving.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-xs font-semibold">
                            <span className={cn(r.netSaving >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                              {r.netSaving >= 0 ? '+' : ''}₩{r.netSaving.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-400 tabular-nums text-xs whitespace-nowrap">
                            {r.billDate}
                            {r.status === 'pending' && <span className="ml-1 text-amber-400/70">(예상)</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <SettlementStatusPill labels={{ pending: '예상', completed: '확정' }} status={r.status} />
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
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
        </>
      )}
    </div>
  );
}
