// @ts-nocheck
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  Wind,
  Battery,
  TrendingUp,
  Award,
  Activity,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  Search,
  FileX,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn, exportPdf } from '@/lib/utils';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';
import type { PpaSettlement } from '@/types/ppa';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';

/* ───────────────────────── Types ───────────────────────── */

const KIND_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  offsite: { icon: Wind, color: 'text-sky-400' },
  onsite: { icon: Sun, color: 'text-amber-400' },
  lease: { icon: Battery, color: 'text-violet-400' },
};

/* ───────────────────────── Page ───────────────────────── */

export default function GeneratorPpaRevenueDeviationPage() {
  const { data: apiSettlements, isLoading } = usePpaSettlements();
  const user = useAuthStore((s) => s.user);
  const isGeneratorView = getPersona(user) === 'generator';

  const settlements = useMemo<PpaSettlement[]>(() => {
    const list = Array.isArray(apiSettlements) ? apiSettlements : ((apiSettlements as any)?.content ?? []);
    let result = list as PpaSettlement[];
    if (isGeneratorView) {
      result = result.map((s) => ({
        ...s,
        plantName:
          s.ppaKind === 'offsite' ? 'Offsite PPA 계약' : s.ppaKind === 'onsite' ? 'Onsite PPA 계약' : s.plantName,
      }));
    }
    return result;
  }, [apiSettlements, isGeneratorView]);

  const plantNames = useMemo(() => Array.from(new Set(settlements.map((s) => s.plantName))), [settlements]);

  const periods = useMemo(() => {
    const set = new Set(settlements.map((s) => s.period));
    return Array.from(set).sort();
  }, [settlements]);

  const years = useMemo(() => Array.from(new Set(periods.map((p) => Number(p.split('-')[0])))).sort(), [periods]);

  const [scopeId, setScopeId] = useState<'all' | string>('all');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [logQuery, setLogQuery] = useState('');

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

  const shiftYear = (delta: number) => {
    const next = Math.max(yearMin, Math.min(yearMax, selectedYear + delta));
    if (next === selectedYear) return;
    setSelectedYear(next);
    const months = periods.filter((p) => p.startsWith(`${next}-`)).map((p) => Number(p.split('-')[1]));
    if (months.length > 0 && !months.includes(selectedMonth)) setSelectedMonth(months[months.length - 1]);
  };

  const selectedPlantLabel = scopeId === 'all' ? `전체 합산 (${plantNames.length})` : scopeId;

  const scopedSettlements = useMemo(() => {
    let list = settlements.filter((s) => s.period === selectedPeriod);
    if (scopeId !== 'all') list = list.filter((s) => s.plantName === scopeId);
    return list;
  }, [settlements, selectedPeriod, scopeId]);

  const sums = useMemo(() => {
    const totalGen = scopedSettlements.reduce((s, r) => s + r.generationKwh, 0);
    const totalSupply = scopedSettlements.reduce((s, r) => s + r.supplyAmount, 0);
    const avgSmp =
      scopedSettlements.length > 0
        ? Math.round(scopedSettlements.reduce((s, r) => s + r.smpUnitPrice, 0) / scopedSettlements.length)
        : 0;
    return { totalGen, totalSupply, avgSmp, count: scopedSettlements.length };
  }, [scopedSettlements]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/generator/trading' }, { label: '직접 PPA' }, { label: '발전량 편차' }]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">발전량 편차</h1>
          <p className="mt-1 text-sm text-slate-400">예상 대비 실 발전량 비교 · 편차 분석</p>
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
                <p className="text-sm">{name}</p>
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
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{selectedPeriod}</span>
      </div>

      {/* KPI 3 */}
      <StatsGrid columns={3}>
        <StatCard
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          label="정산 건수"
          value={`${sums.count}건`}
          sub={`발전량 ${Math.round(sums.totalGen).toLocaleString()} kWh`}
        />
        <StatCard
          icon={<Activity size={18} className="text-blue-400" />}
          label="평균 SMP 단가"
          value={`₩${sums.avgSmp}/kWh`}
          sub="정산 단가"
        />
        <StatCard
          icon={<Award size={18} className="text-violet-400" />}
          label="총 공급가액"
          value={`₩${sums.totalSupply.toLocaleString()}`}
          sub="VAT 제외"
        />
      </StatsGrid>

      {/* 정산 내역 테이블 */}
      <SectionCard
        title="발전량 편차 내역"
        description="정산 기간별 실 발전량 기반 편차 분석"
        actions={
          <div className="relative w-44">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="발전소·기간"
              value={logQuery}
              onChange={(e) => setLogQuery(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        }
      >
        {scopedSettlements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <FileX size={40} className="mb-3 text-slate-600" />
            <p className="text-sm font-medium">해당 기간의 편차 데이터가 없습니다</p>
            <p className="text-xs mt-1 text-slate-600">다른 기간을 선택하거나 발전소를 변경해보세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-medium">기간</th>
                  <th className="px-4 py-2.5 text-left font-medium">발전소</th>
                  <th className="px-4 py-2.5 text-left font-medium">유형</th>
                  <th className="px-4 py-2.5 font-medium">발전량 (kWh)</th>
                  <th className="px-4 py-2.5 font-medium">SMP 단가</th>
                  <th className="px-4 py-2.5 font-medium">공급가액</th>
                  <th className="px-4 py-2.5 font-medium">부가세</th>
                  <th className="px-4 py-2.5 font-medium">합계</th>
                  <th className="px-4 py-2.5 text-left font-medium">상태</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {scopedSettlements
                  .filter((r) => {
                    if (!logQuery) return true;
                    const q = logQuery.toLowerCase();
                    return r.plantName.toLowerCase().includes(q) || r.period.includes(q);
                  })
                  .map((r) => {
                    const kindMeta = KIND_ICON[r.ppaKind] ?? KIND_ICON.offsite;
                    const kindLabel =
                      r.ppaKind === 'offsite' ? 'Offsite' : r.ppaKind === 'onsite' ? 'Onsite' : '온사이트';
                    return (
                      <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-slate-300 tabular-nums whitespace-nowrap">
                          {r.period.replace('-', '.')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <kindMeta.icon size={12} className={kindMeta.color} />
                            <span className="text-xs text-slate-200">{r.plantName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-blue-500/[0.10] text-blue-300 ring-blue-500/30">
                            {kindLabel} PPA
                          </span>
                        </td>
                        <td className="px-4 py-3 text-emerald-300 font-semibold tabular-nums">
                          {Math.round(r.generationKwh).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-300 tabular-nums">₩{r.smpUnitPrice}</td>
                        <td className="px-4 py-3 text-slate-300 tabular-nums">₩{r.supplyAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-300 tabular-nums">₩{r.vat.toLocaleString()}</td>
                        <td className="px-4 py-3 text-emerald-400 tabular-nums font-medium">
                          ₩{r.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                              r.status === 'CONFIRMED'
                                ? 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30'
                                : 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
                            )}
                          >
                            {r.status === 'CONFIRMED' ? '확정' : '대기'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              exportPdf(
                                `정산내역_${r.period}_${r.plantName}`,
                                `${r.period} ${r.plantName} 정산 내역`,
                                ['기간', '발전소', '발전량(kWh)', 'SMP(₩/kWh)', '합계(₩)'],
                                [
                                  [
                                    r.period,
                                    r.plantName,
                                    String(Math.round(r.generationKwh)),
                                    String(r.smpUnitPrice),
                                    `₩${r.total.toLocaleString()}`,
                                  ],
                                ],
                              )
                            }
                            className="text-slate-500 hover:text-white"
                            title="내역 PDF"
                          >
                            <Download size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
