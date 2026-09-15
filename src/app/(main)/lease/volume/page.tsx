// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { Sun, CreditCard, TrendingDown, Wallet, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { useVolumeContracts, useAllMonthlyRecords } from '@/hooks/lease/useLease';

const KEPCO_AVG = 119.6;

export default function ConsumerLeaseCrossPage() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);

  const { data: volumeApiData } = useVolumeContracts();
  const { data: apiRecords } = useAllMonthlyRecords({ year: yearFilter });

  const contracts = useMemo(() => {
    const list = volumeApiData?.content;
    if (!list || list.length === 0) return [];
    return list.map((c: any) => ({
      id: String(c.id),
      siteName: c.siteName ?? '—',
      generatorName: c.generatorCompanyName ?? '—',
      consumerName: c.consumerCompanyName ?? '—',
      capacityKw: Number(c.capacityKw) || 0,
      contractYears: c.contractYears ?? 0,
      startDate: c.startDate ?? '',
      monthlyRent: c.monthlyRent ?? 0,
      warrantyHours: c.warrantyHours ?? 1300,
    }));
  }, [volumeApiData]);

  const monthlyRows = useMemo(() => {
    if (!apiRecords || !Array.isArray(apiRecords)) return [];
    return apiRecords.map((r: any) => {
      const gen = Number(r.generatedKwh) || 0;
      const unit = Number(r.unitPriceKrw) || 0;
      const rent = r.rent ?? Math.round(gen * unit);
      const baseline = r.baselineBill ?? Math.round(gen * KEPCO_AVG);
      const reduced = r.reducedBill ?? baseline - (r.savedAmount ?? 0);
      const saved = r.savedAmount ?? Math.round(gen * (KEPCO_AVG - unit));
      const net = r.netSavings ?? saved - rent;
      const [, m] = (r.period ?? '').split('-');
      return {
        contractId: String(r.leaseContractId),
        period: m ? `${Number(m)}월` : r.period,
        periodRaw: r.period,
        baselineBill: baseline,
        reducedBill: reduced,
        savedAmount: saved,
        rent,
        netSavings: net,
        generatedKwh: gen,
        unitPrice: unit,
      };
    });
  }, [apiRecords]);

  const PERIODS = useMemo(
    () =>
      [...new Set(monthlyRows.map((m) => m.period))].sort((a, b) => {
        const na = parseInt(a),
          nb = parseInt(b);
        return na - nb;
      }),
    [monthlyRows],
  );

  const [contractId, setContractId] = useState<'all' | string>('all');
  const [periodIdx, setPeriodIdx] = useState(-1);
  const [annexOpen, setAnnexOpen] = useState(false);

  const safePeriodIdx =
    PERIODS.length === 0
      ? 0
      : Math.min(Math.max(0, periodIdx < 0 ? PERIODS.length - 1 : periodIdx), PERIODS.length - 1);
  const selectedPeriod = PERIODS[safePeriodIdx] ?? '';
  const isAll = contractId === 'all';

  const selectedContract = useMemo(
    () => (isAll ? null : (contracts.find((c) => c.id === contractId) ?? null)),
    [contractId, contracts, isAll],
  );

  const current = useMemo(() => {
    const rows = monthlyRows.filter((m) => m.period === selectedPeriod && (isAll || m.contractId === contractId));
    return {
      baselineBill: rows.reduce((s, r) => s + r.baselineBill, 0),
      reducedBill: rows.reduce((s, r) => s + r.reducedBill, 0),
      savedAmount: rows.reduce((s, r) => s + r.savedAmount, 0),
      rent: rows.reduce((s, r) => s + r.rent, 0),
      netSavings: rows.reduce((s, r) => s + r.netSavings, 0),
    };
  }, [selectedPeriod, contractId, isAll, monthlyRows]);

  const chartData = useMemo(() => {
    return PERIODS.map((p) => {
      const rows = monthlyRows.filter((m) => m.period === p && (isAll || m.contractId === contractId));
      return {
        period: p,
        saved: rows.reduce((s, r) => s + r.savedAmount, 0),
        rent: rows.reduce((s, r) => s + r.rent, 0),
        net: rows.reduce((s, r) => s + r.netSavings, 0),
      };
    });
  }, [PERIODS, contractId, isAll, monthlyRows]);

  const scopeLabel = isAll
    ? `전체 합산 (${contracts.length}개 계약)`
    : selectedContract
      ? `${selectedContract.siteName} · ${selectedContract.generatorName}`
      : '—';
  const totalCapacity = isAll ? contracts.reduce((s, c) => s + c.capacityKw, 0) : (selectedContract?.capacityKw ?? 0);

  const avgUnit = useMemo(() => {
    const rows = monthlyRows.filter((m) => isAll || m.contractId === contractId);
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((s, r) => s + r.unitPrice, 0) / rows.length) * 10) / 10;
  }, [monthlyRows, contractId, isAll]);

  const avgMonthlyRent = useMemo(() => {
    const rows = monthlyRows.filter((m) => isAll || m.contractId === contractId);
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((s, r) => s + r.rent, 0) / rows.length);
  }, [monthlyRows, contractId, isAll]);

  const avgMonthlyKwh = useMemo(() => {
    const rows = monthlyRows.filter((m) => isAll || m.contractId === contractId);
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((s, r) => s + r.generatedKwh, 0) / rows.length);
  }, [monthlyRows, contractId, isAll]);

  const perContractCurrent = useMemo(() => {
    return contracts.map((c) => {
      const r = monthlyRows.find((m) => m.contractId === c.id && m.period === selectedPeriod);
      return { contract: c, row: r };
    });
  }, [contracts, monthlyRows, selectedPeriod]);

  if (contracts.length === 0 && monthlyRows.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: 'PPA 요금 현황' }]}
        />
        <h1 className="text-2xl font-bold text-white">PPA 요금 현황</h1>
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20">
          <p className="text-sm text-slate-400">등록된 PPA 계약이 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: 'PPA 요금 현황' }]}
      />

      <div>
        <h1 className="text-2xl font-bold text-white">PPA 요금 현황</h1>
        <p className="mt-1 text-sm text-slate-400">발전사업자가 부지에 설치 · 발전량 비례 청구 (온사이트 PPA)</p>
      </div>

      {/* 계약 셀렉터 + 월 셀렉터 */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-lg border border-white/[0.06] bg-surface-card px-4 py-2.5">
        <Dropdown
          align="left"
          trigger={
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.08] min-w-[280px]">
              <span className="text-xs text-slate-500 shrink-0">계약</span>
              <span className="font-medium text-white truncate flex-1">{scopeLabel}</span>
              <ChevronDown size={14} className="text-slate-500 shrink-0" />
            </div>
          }
        >
          <DropdownItem onClick={() => setContractId('all')}>
            <div>
              <p className="text-sm">전체 합산</p>
              <p className="text-xs text-slate-500">
                {contracts.length}개 계약 · 총 {contracts.reduce((s, c) => s + c.capacityKw, 0).toLocaleString()} kW
              </p>
            </div>
          </DropdownItem>
          <div className="my-1 border-t border-white/[0.06]" />
          {contracts.map((c) => (
            <DropdownItem key={c.id} onClick={() => setContractId(c.id)}>
              <div>
                <p className="text-sm">{c.siteName}</p>
                <p className="text-xs text-slate-500">
                  {c.generatorName} · {c.capacityKw} kW · 계약 {c.contractYears}년
                </p>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>

        <div className="flex items-center gap-2">
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

          <span className="text-xs text-slate-500 shrink-0">조회 월</span>
          <button
            type="button"
            onClick={() => setPeriodIdx(safePeriodIdx - 1)}
            disabled={safePeriodIdx === 0}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="flex flex-col items-center min-w-[80px]">
            <span className="text-sm font-semibold text-white tabular-nums leading-tight">{selectedPeriod || '—'}</span>
            <span
              className={cn(
                'text-[10px] leading-tight',
                safePeriodIdx === PERIODS.length - 1 ? 'text-amber-300' : 'text-slate-600',
              )}
            >
              {safePeriodIdx === PERIODS.length - 1 ? '최신' : '확정'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setPeriodIdx(safePeriodIdx + 1)}
            disabled={safePeriodIdx === PERIODS.length - 1}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* KPI 4 */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<CreditCard size={18} className="text-slate-400" />}
          label="예상 전기요금"
          value={`₩${current.reducedBill.toLocaleString()}`}
          sub={`한전 기준 ₩${current.baselineBill.toLocaleString()}`}
        />
        <StatCard
          icon={<TrendingDown size={18} className="text-emerald-400" />}
          label="예상 절감액"
          value={`₩${current.savedAmount.toLocaleString()}`}
          sub={`한전 ₩${KEPCO_AVG}/kWh 기준`}
        />
        <StatCard
          icon={<Wallet size={18} className="text-rose-400" />}
          label="발전사 지급 PPA 요금"
          value={`−₩${current.rent.toLocaleString()}`}
          sub="발전량 × 단가 (월별 변동)"
        />
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="예상 순이익"
          value={`${current.netSavings >= 0 ? '+' : ''}₩${current.netSavings.toLocaleString()}`}
          sub="절감액 − PPA 요금"
        />
      </StatsGrid>

      {/* 단가 기준 안내 */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5 text-[11px] text-slate-400">
        <span className="text-amber-300 font-medium">※ 단가 기준</span> 절감액·전기요금은{' '}
        <span className="text-white font-semibold">한전 산업용 평균 단가 ₩{KEPCO_AVG}/kWh</span> 기준 산정 · 실제 한전
        단가는 시간대(경부하/중간부하/최대부하)·계절(여름/봄가을/겨울)·계약 종별로 변동
      </div>

      {/* 발전량·단가·PPA 요금·용량 보조 정보 */}
      <div className="rounded-lg border border-white/[0.06] bg-surface-card px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[11px] text-slate-500">평균 월 발전량</p>
          <p className="text-lg font-bold text-emerald-300 tabular-nums mt-0.5">{avgMonthlyKwh.toLocaleString()} kWh</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">PPA 요금 단가</p>
          <p className="text-lg font-bold text-white tabular-nums mt-0.5">₩{avgUnit}/kWh</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">평균 월 PPA 요금</p>
          <p className="text-lg font-bold text-rose-300 tabular-nums mt-0.5">₩{avgMonthlyRent.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">설비 용량</p>
          <p className="text-lg font-bold text-white tabular-nums mt-0.5">{totalCapacity.toLocaleString()} kW</p>
        </div>
      </div>

      {/* 차트 */}
      <SectionCard title="월별 절감·지급 추이" description={`${yearFilter}년 · ${scopeLabel}`}>
        <div>
          <RmsBarLineChart
            data={chartData}
            xKey="period"
            bars={[
              { key: 'rent', name: '발전사 지급 PPA 요금', color: '#F43F5E', stackId: 'a' },
              { key: 'net', name: '순이익', color: '#10B981', stackId: 'a' },
            ]}
            lines={[{ key: 'saved', name: '총 절감액', color: '#A78BFA' }]}
            height={260}
          />
        </div>
      </SectionCard>

      {/* 계약별 비교 표 */}
      {contracts.length > 0 && (
        <SectionCard title={`${selectedPeriod || '—'} 계약별 정산`} description={`${contracts.length}개 계약`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">사업장</th>
                  <th className="px-4 py-2 text-left font-medium">발전사</th>
                  <th className="px-4 py-2 font-medium">용량</th>
                  <th className="px-4 py-2 font-medium">발전량</th>
                  <th className="px-4 py-2 font-medium">예상 절감</th>
                  <th className="px-4 py-2 font-medium">발전사 지급 PPA 요금</th>
                  <th className="px-4 py-2 font-medium">순이익</th>
                </tr>
              </thead>
              <tbody>
                {perContractCurrent.map(({ contract: c, row }) => {
                  const isHighlight = !isAll && c.id === contractId;
                  const net = (row?.savedAmount ?? 0) - (row?.rent ?? 0);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setContractId(c.id)}
                      className={cn(
                        'border-b border-white/[0.04] cursor-pointer transition-colors',
                        isHighlight ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                      )}
                    >
                      <td className="px-4 py-3 text-white font-medium">{c.siteName}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{c.generatorName}</td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">{c.capacityKw} kW</td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">
                        {row ? `${(row.generatedKwh / 1000).toFixed(1)} MWh` : '—'}
                      </td>
                      <td className="px-4 py-3 text-violet-200 tabular-nums">
                        ₩{(row?.savedAmount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-rose-300 font-bold tabular-nums">
                        −₩{(row?.rent ?? 0).toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 font-bold tabular-nums',
                          net >= 0 ? 'text-emerald-300' : 'text-rose-300',
                        )}
                      >
                        {net >= 0 ? '+' : ''}₩{net.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 월별 정산 표 */}
      <SectionCard title={`월별 정산 내역 — ${scopeLabel}`} description={`${PERIODS.length}개월`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                <th className="px-4 py-2 text-left font-medium">월</th>
                <th className="px-4 py-2 font-medium">발전량</th>
                <th className="px-4 py-2 font-medium">예상 전기요금</th>
                <th className="px-4 py-2 font-medium">절감액</th>
                <th className="px-4 py-2 font-medium">발전사 지급 PPA 요금</th>
                <th className="px-4 py-2 font-medium">순이익</th>
              </tr>
            </thead>
            <tbody>
              {[...chartData].reverse().map((row) => {
                const periodRows = monthlyRows.filter(
                  (m) => m.period === row.period && (isAll || m.contractId === contractId),
                );
                const reduced = periodRows.reduce((s, r) => s + r.reducedBill, 0);
                const baseline = periodRows.reduce((s, r) => s + r.baselineBill, 0);
                const genKwh = periodRows.reduce((s, r) => s + r.generatedKwh, 0);
                return (
                  <tr key={row.period} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{row.period}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{(genKwh / 1000).toFixed(1)} MWh</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">
                      ₩{reduced.toLocaleString()}
                      <span className="text-[10px] text-slate-500 ml-1">/ ₩{baseline.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-violet-300 font-semibold tabular-nums">
                      ₩{row.saved.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-rose-300 font-bold tabular-nums">−₩{row.rent.toLocaleString()}</td>
                    <td
                      className={cn(
                        'px-4 py-3 font-semibold tabular-nums',
                        row.net >= 0 ? 'text-emerald-300' : 'text-rose-300',
                      )}
                    >
                      {row.net >= 0 ? '+' : ''}₩{row.net.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
