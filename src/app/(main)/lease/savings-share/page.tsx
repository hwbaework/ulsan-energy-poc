// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  Sun,
  TrendingDown,
  Percent,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  _Download,
  _Info,
  _Plus,
  _CheckCircle2,
} from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { useSavingsContracts } from '@/hooks/lease/useLease';

/* ───────────────────────── Fallback ───────────────────────── */

interface LeaseContract {
  id: string;
  siteName: string; // 사업장 (한일튜브 본사 옥상 등)
  generatorName: string; // 발전사
  capacityKw: number;
  contractYears: number;
  sharePct: number; // 절감액 셰어 % (계약별 다를 수 있음)
  installedAt: string;
}

const CONTRACTS: LeaseContract[] = [];

interface MonthlyRow {
  contractId: string;
  period: string;
  baselineBill: number;
  reducedBill: number;
  generatedKwh: number; // 월 발전량 (kWh)
  unitPriceKrw: number; // 적용 단가 (₩/kWh) — KEPCO 회피비용
  savedAmount: number;
  shareToGen: number;
  netSavings: number;
}

// 계약별 월별 정산 (mock)
const MONTHLY: MonthlyRow[] = (() => {
  const periods = ['2025.11', '2025.12', '2026.01', '2026.02', '2026.03', '2026.04'];
  // 계약별 baseline (월 평균 한전 요금) + 평균 절감률 약 22~25%
  const baseByContract: Record<string, number[]> = {
    'c-1': [11_500_000, 12_200_000, 13_100_000, 12_700_000, 12_400_000, 12_800_000],
    'c-2': [7_300_000, 7_900_000, 8_400_000, 8_100_000, 7_800_000, 8_200_000],
    'c-3': [6_800_000, 7_200_000, 7_700_000, 7_400_000, 7_100_000, 7_500_000],
  };
  const savedRateByMonth = [0.19, 0.15, 0.12, 0.15, 0.21, 0.235]; // 월별 절감 비율 (계절성)
  const unitPriceByMonth = [142, 138, 135, 138, 145, 152]; // 월별 적용 단가 (계절·계시별 평균)
  const out: MonthlyRow[] = [];
  for (const c of CONTRACTS) {
    const bases = baseByContract[c.id];
    periods.forEach((p, i) => {
      const baseline = bases[i];
      const saved = Math.round(baseline * savedRateByMonth[i]);
      const reduced = baseline - saved;
      const unitPrice = unitPriceByMonth[i];
      const generatedKwh = Math.round(saved / unitPrice);
      const share = Math.round((saved * c.sharePct) / 100);
      const net = saved - share;
      out.push({
        contractId: c.id,
        period: p,
        baselineBill: baseline,
        reducedBill: reduced,
        generatedKwh,
        unitPriceKrw: unitPrice,
        savedAmount: saved,
        shareToGen: share,
        netSavings: net,
      });
    });
  }
  return out;
})();

const PERIODS = Array.from(new Set(MONTHLY.map((m) => m.period))).sort();

/* ───────────────────────── Page ───────────────────────── */

export default function ConsumerLeaseSavingsSharePage() {
  // API 호출
  const { data: savingsApiData } = useSavingsContracts();
  const _apiSavingsContracts = savingsApiData?.content ?? [];

  // 스코프 (전체 합산 또는 단일 계약)
  const [contractId, setContractId] = useState<'all' | string>('all');
  // 선택 월 (PERIODS 인덱스)
  const [periodIdx, setPeriodIdx] = useState(PERIODS.length - 1);

  const selectedContract = useMemo(
    () => (contractId === 'all' ? null : (CONTRACTS.find((c) => c.id === contractId) ?? null)),
    [contractId],
  );
  const selectedPeriod = PERIODS[periodIdx];
  const isAll = contractId === 'all';

  // 선택 월의 합산값 (전체 합산 모드) 또는 단일 계약 값
  const current = useMemo(() => {
    const rows = MONTHLY.filter((m) => m.period === selectedPeriod && (isAll ? true : m.contractId === contractId));
    const generatedKwh = rows.reduce((s, r) => s + r.generatedKwh, 0);
    const savedAmount = rows.reduce((s, r) => s + r.savedAmount, 0);
    return {
      baselineBill: rows.reduce((s, r) => s + r.baselineBill, 0),
      reducedBill: rows.reduce((s, r) => s + r.reducedBill, 0),
      generatedKwh,
      avgUnitPrice: generatedKwh > 0 ? Math.round(savedAmount / generatedKwh) : 0,
      savedAmount,
      shareToGen: rows.reduce((s, r) => s + r.shareToGen, 0),
      netSavings: rows.reduce((s, r) => s + r.netSavings, 0),
    };
  }, [selectedPeriod, contractId, isAll]);

  // 차트 데이터 — 6개월 추이
  const chartData = useMemo(() => {
    return PERIODS.map((p) => {
      const rows = MONTHLY.filter((m) => m.period === p && (isAll ? true : m.contractId === contractId));
      return {
        period: p,
        saved: rows.reduce((s, r) => s + r.savedAmount, 0),
        share: rows.reduce((s, r) => s + r.shareToGen, 0),
        net: rows.reduce((s, r) => s + r.netSavings, 0),
      };
    });
  }, [contractId, isAll]);

  // 화면용 라벨/메타
  const scopeLabel = isAll
    ? `전체 합산 (${CONTRACTS.length}개 계약)`
    : `${selectedContract!.siteName} · ${selectedContract!.generatorName}`;
  const totalCapacity = isAll ? CONTRACTS.reduce((s, c) => s + c.capacityKw, 0) : selectedContract!.capacityKw;
  const headerSharePct = isAll
    ? `평균 ${Math.round(CONTRACTS.reduce((s, c) => s + c.sharePct, 0) / CONTRACTS.length)}%`
    : `${selectedContract!.sharePct}%`;

  // 모든 계약 + 선택 월 행 (계약별 표용)
  const perContractCurrent = useMemo(() => {
    return CONTRACTS.map((c) => {
      const r = MONTHLY.find((m) => m.contractId === c.id && m.period === selectedPeriod);
      return { contract: c, row: r };
    });
  }, [selectedPeriod]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '절감 공유' }]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">절감 셰어</h1>
        <p className="mt-1 text-sm text-slate-400">절감액 일부 지급</p>
      </div>

      {/* 계약 셀렉터 + 월 셀렉터 (한 줄) */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-lg border border-white/[0.06] bg-surface-card px-4 py-2.5">
        {/* 계약 dropdown */}
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
                {CONTRACTS.length}개 계약 · 총 {CONTRACTS.reduce((s, c) => s + c.capacityKw, 0).toLocaleString()} kW
              </p>
            </div>
          </DropdownItem>
          <div className="my-1 border-t border-white/[0.06]" />
          {CONTRACTS.map((c) => (
            <DropdownItem key={c.id} onClick={() => setContractId(c.id)}>
              <div>
                <p className="text-sm">{c.siteName}</p>
                <p className="text-xs text-slate-500">
                  {c.generatorName} · {c.capacityKw} kW · 셰어 {c.sharePct}% · 계약 {c.contractYears}년
                </p>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>

        {/* 월 셀렉터 — 예상 표시는 월 텍스트와 결합해서 폭 흔들림 방지 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0">조회 월</span>
          <button
            type="button"
            onClick={() => setPeriodIdx((i) => Math.max(0, i - 1))}
            disabled={periodIdx === 0}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="flex flex-col items-center min-w-[80px]">
            <span className="text-sm font-semibold text-white tabular-nums leading-tight">{selectedPeriod}</span>
            <span
              className={cn(
                'text-[10px] leading-tight',
                periodIdx === PERIODS.length - 1 ? 'text-amber-300' : 'text-slate-600',
              )}
            >
              {periodIdx === PERIODS.length - 1 ? '예상 (집계 중)' : '확정'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setPeriodIdx((i) => Math.min(PERIODS.length - 1, i + 1))}
            disabled={periodIdx === PERIODS.length - 1}
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
        />
        <StatCard
          icon={<TrendingDown size={18} className="text-emerald-400" />}
          label="예상 절감액"
          value={`₩${current.savedAmount.toLocaleString()}`}
        />
        <StatCard
          icon={<Percent size={18} className="text-rose-400" />}
          label="예상 발전사 지급"
          value={`−₩${current.shareToGen.toLocaleString()}`}
        />
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="예상 순이익"
          value={`+₩${current.netSavings.toLocaleString()}`}
        />
      </StatsGrid>

      {/* 발전량·단가·셰어율 보조 정보 */}
      <div className="rounded-lg border border-white/[0.06] bg-surface-card px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[11px] text-slate-500">월 발전량</p>
          <p className="text-lg font-bold text-emerald-300 tabular-nums mt-0.5">
            {current.generatedKwh.toLocaleString()} kWh
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">적용 단가</p>
          <p className="text-lg font-bold text-white tabular-nums mt-0.5">₩{current.avgUnitPrice}/kWh</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">셰어율</p>
          <p className="text-lg font-bold text-violet-300 tabular-nums mt-0.5">{headerSharePct}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">설비 용량</p>
          <p className="text-lg font-bold text-white tabular-nums mt-0.5">{totalCapacity.toLocaleString()} kW</p>
        </div>
      </div>

      {/* 차트 */}
      <SectionCard title="월별 절감·지급 추이" description={`최근 ${PERIODS.length}개월 · ${scopeLabel}`}>
        <div>
          <RmsBarLineChart
            data={chartData}
            xKey="period"
            bars={[
              { key: 'share', name: '발전사 지급', color: '#F43F5E', stackId: 'a' },
              { key: 'net', name: '순이익', color: '#10B981', stackId: 'a' },
            ]}
            lines={[{ key: 'saved', name: '총 절감액', color: '#A78BFA' }]}
            height={260}
          />
        </div>
      </SectionCard>

      {/* 계약별 비교 표 */}
      <SectionCard title={`${selectedPeriod} 계약별 정산`} description={`${CONTRACTS.length}개 계약`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                <th className="px-4 py-2 text-left font-medium">사업장</th>
                <th className="px-4 py-2 text-left font-medium">발전사</th>
                <th className="px-4 py-2 font-medium">용량</th>
                <th className="px-4 py-2 font-medium">발전량</th>
                <th className="px-4 py-2 font-medium">단가</th>
                <th className="px-4 py-2 font-medium">셰어율</th>
                <th className="px-4 py-2 font-medium">예상 절감</th>
                <th className="px-4 py-2 font-medium">발전사 지급</th>
                <th className="px-4 py-2 font-medium">순이익</th>
              </tr>
            </thead>
            <tbody>
              {perContractCurrent.map(({ contract: c, row }) => {
                const isHighlight = !isAll && c.id === contractId;
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
                    <td className="px-4 py-3 text-emerald-300 tabular-nums">
                      {(row?.generatedKwh ?? 0).toLocaleString()} kWh
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">₩{row?.unitPriceKrw ?? 0}/kWh</td>
                    <td className="px-4 py-3 text-violet-300 font-semibold tabular-nums">{c.sharePct}%</td>
                    <td className="px-4 py-3 text-violet-200 tabular-nums">
                      ₩{(row?.savedAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-rose-300 tabular-nums">
                      −₩{(row?.shareToGen ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-emerald-300 font-bold tabular-nums">
                      +₩{(row?.netSavings ?? 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 월별 정산 표 — 선택 계약 (또는 전체 합산) 의 6개월 이력 */}
      <SectionCard title={`월별 정산 내역 — ${scopeLabel}`} description={`${PERIODS.length}개월`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                <th className="px-4 py-2 text-left font-medium">월</th>
                <th className="px-4 py-2 font-medium">예상 전기요금</th>
                <th className="px-4 py-2 font-medium">절감액</th>
                <th className="px-4 py-2 font-medium">발전사 지급</th>
                <th className="px-4 py-2 font-medium">순이익</th>
              </tr>
            </thead>
            <tbody>
              {[...chartData].reverse().map((row, _i) => {
                const periodRows = MONTHLY.filter(
                  (m) => m.period === row.period && (isAll ? true : m.contractId === contractId),
                );
                const reduced = periodRows.reduce((s, r) => s + r.reducedBill, 0);
                const baseline = periodRows.reduce((s, r) => s + r.baselineBill, 0);
                return (
                  <tr key={row.period} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{row.period}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">
                      ₩{reduced.toLocaleString()}
                      <span className="text-[10px] text-slate-500 ml-1">/ ₩{baseline.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-violet-300 font-semibold tabular-nums">
                      ₩{row.saved.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-rose-300 tabular-nums">−₩{row.share.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-300 font-semibold tabular-nums">
                      +₩{row.net.toLocaleString()}
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
