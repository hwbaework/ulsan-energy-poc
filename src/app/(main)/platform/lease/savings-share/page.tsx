// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Sun,
  Percent,
  Wallet,
  TrendingUp,
  _TrendingDown,
  _Download,
  _ArrowRight,
  _ArrowDown,
  _Calendar,
  Wrench,
  _Search,
  _ChevronDown,
  _ChevronUp,
  _ChevronRight,
} from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { useSavingsContracts } from '@/hooks/lease/useLease';

/* ───────────────────────── Fallback ───────────────────────── */

interface PlatformContract {
  id: string;
  contractNo: string;
  installer: string; // 시공사 (= SPC 또는 SPC 파트너)
  customer: string; // 수용가 (= 건물주)
  siteName: string;
  capacityKw: number;
  contractYears: number;
  sharePct: number;
  status: 'active' | 'pending' | 'closed';
  thisMonthSaved: number;
  thisMonthShare: number;
  startDate: string;
}

const CONTRACTS: PlatformContract[] = [];

interface MonthlyTotal {
  period: string;
  totalSaved: number;
  totalShare: number;
}

const MONTHLY: MonthlyTotal[] = [];

const STATUS_META = {
  active: { label: '활성', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', ring: 'ring-emerald-500/30' },
  pending: { label: '진행중', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
  closed: { label: '종료', tone: 'text-slate-400', bg: 'bg-white/[0.04]', ring: 'ring-white/[0.08]' },
};

const fmtKrw = (n: number) =>
  n >= 100_000_000
    ? `₩${(n / 100_000_000).toFixed(2)}억`
    : n >= 10_000
      ? `₩${(n / 10_000).toFixed(0)}만`
      : `₩${n.toLocaleString()}`;

/* ───────────────────────── Page ───────────────────────── */

type SortKey = 'saved' | 'share' | 'capacity' | 'sharePct';

export default function PlatformLeaseSavingsSharePage() {
  const { data: _apiSavings } = useSavingsContracts();
  const [_period, _setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // 수용가별 정산 — 검색·정렬·페이징
  const [breakdownSearch, _setBreakdownSearch] = useState('');
  const [breakdownSort, _setBreakdownSort] = useState<SortKey>('saved');
  const [breakdownExpanded, _setBreakdownExpanded] = useState(false);
  const PAGE_SIZE = 10;

  const totals = useMemo(() => {
    const active = CONTRACTS.filter((c) => c.status === 'active');
    const totalCapacity = CONTRACTS.reduce((s, c) => s + c.capacityKw, 0);
    const monthlyShare = active.reduce((s, c) => s + c.thisMonthShare, 0);
    const monthlySaved = active.reduce((s, c) => s + c.thisMonthSaved, 0);
    const installers = new Set(CONTRACTS.map((c) => c.installer));
    const customers = new Set(CONTRACTS.map((c) => c.customer));
    const avgShare = active.length > 0 ? active.reduce((s, c) => s + c.sharePct, 0) / active.length : 0;
    return {
      totalCapacity,
      monthlyShare,
      monthlySaved,
      installers: installers.size,
      customers: customers.size,
      activeCount: active.length,
      avgShare,
    };
  }, []);

  // 수용가별 합산 — "어디가 얼마 절감하고 얼마 셰어 받는지"
  const customerBreakdownAll = useMemo(() => {
    const map = new Map<
      string,
      {
        customer: string;
        capacity: number;
        saved: number;
        share: number;
        netCustomer: number;
        contracts: number;
        sharePct: number;
      }
    >();
    for (const c of CONTRACTS.filter((x) => x.status === 'active')) {
      const prev = map.get(c.customer) ?? {
        customer: c.customer,
        capacity: 0,
        saved: 0,
        share: 0,
        netCustomer: 0,
        contracts: 0,
        sharePct: 0,
      };
      prev.capacity += c.capacityKw;
      prev.saved += c.thisMonthSaved;
      prev.share += c.thisMonthShare;
      prev.netCustomer += c.thisMonthSaved - c.thisMonthShare;
      prev.contracts += 1;
      map.set(c.customer, prev);
    }
    // 평균 셰어율 계산
    return [...map.values()].map((c) => ({ ...c, sharePct: c.saved > 0 ? (c.share / c.saved) * 100 : 0 }));
  }, []);

  const customerBreakdownFiltered = useMemo(() => {
    const q = breakdownSearch.trim().toLowerCase();
    let list = customerBreakdownAll.filter((c) => !q || c.customer.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (breakdownSort === 'saved') return b.saved - a.saved;
      if (breakdownSort === 'share') return b.share - a.share;
      if (breakdownSort === 'capacity') return b.capacity - a.capacity;
      if (breakdownSort === 'sharePct') return b.sharePct - a.sharePct;
      return 0;
    });
    return list;
  }, [customerBreakdownAll, breakdownSearch, breakdownSort]);

  const _customerBreakdownVisible =
    breakdownExpanded || breakdownSearch ? customerBreakdownFiltered : customerBreakdownFiltered.slice(0, PAGE_SIZE);

  const _maxSaved = Math.max(...customerBreakdownAll.map((c) => c.saved), 1);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '절감 셰어' }]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">절감 셰어 운영 대시보드</h1>
        <p className="mt-1 text-sm text-slate-400">수용가(건물주) ↔ SPC(시공) 절감 셰어 계약의 자금 흐름·정산 현황</p>
      </div>

      {/* KPI cards */}
      <StatsGrid columns={5}>
        <StatCard
          icon={<Building2 size={18} className="text-blue-400" />}
          label="활성 계약"
          value={`${totals.activeCount}건`}
          sub={`전체 ${CONTRACTS.length}건`}
        />
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="설치 용량"
          value={`${(totals.totalCapacity / 1000).toFixed(2)} MW`}
          sub={`${totals.installers}개 시공 파트너`}
        />
        <StatCard
          icon={<Wallet size={18} className="text-violet-400" />}
          label="이번달 수용가 절감"
          value={fmtKrw(totals.monthlySaved)}
          sub="건물주 절약 합계"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          label="이번달 SPC 셰어 수익"
          value={fmtKrw(totals.monthlyShare)}
          sub={`평균 셰어율 ${totals.avgShare.toFixed(1)}%`}
        />
        <StatCard
          icon={<Percent size={18} className="text-rose-400" />}
          label="수용가 순이익"
          value={fmtKrw(totals.monthlySaved - totals.monthlyShare)}
          sub={
            totals.monthlySaved > 0
              ? `절감의 ${(((totals.monthlySaved - totals.monthlyShare) / totals.monthlySaved) * 100).toFixed(1)}%`
              : '절감의 —'
          }
        />
      </StatsGrid>

      {/* 월별 추이 */}
      <SectionCard title="월별 절감·셰어 정산 추이" description={`최근 ${MONTHLY.length}개월 · 플랫폼 전체`}>
        <div>
          <RmsBarLineChart
            data={MONTHLY}
            xKey="period"
            bars={[{ key: 'totalShare', name: 'SPC 셰어 수익', color: '#10B981' }]}
            lines={[{ key: 'totalSaved', name: '수용가 절감액', color: '#A78BFA' }]}
            height={260}
          />
        </div>
      </SectionCard>

      {/* 계약 목록 */}
      <SectionCard
        title="계약 목록"
        description={`${CONTRACTS.length}건 · 활성 ${totals.activeCount}건 · 진행중 ${CONTRACTS.length - totals.activeCount}건`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                <th className="px-4 py-2 text-left font-medium">계약번호</th>
                <th className="px-4 py-2 text-left font-medium">수용가 (건물주)</th>
                <th className="px-4 py-2 text-left font-medium">시공 파트너</th>
                <th className="px-4 py-2 font-medium">용량</th>
                <th className="px-4 py-2 font-medium">계약</th>
                <th className="px-4 py-2 font-medium">셰어율</th>
                <th className="px-4 py-2 text-left font-medium">상태</th>
                <th className="px-4 py-2 font-medium">절감액</th>
                <th className="px-4 py-2 font-medium">SPC 셰어</th>
                <th className="px-4 py-2 font-medium">수용가 순이익</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((c) => {
                const sm = STATUS_META[c.status];
                const net = c.thisMonthSaved - c.thisMonthShare;
                return (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300 text-xs tabular-nums">{c.contractNo}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-xs">{c.customer}</p>
                      <p className="text-[11px] text-slate-500">{c.siteName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Wrench size={10} className="text-violet-300" />
                        {c.installer}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{c.capacityKw} kW</td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums">{c.contractYears}년</td>
                    <td className="px-4 py-3 text-rose-300 font-semibold tabular-nums">{c.sharePct}%</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                          sm.bg,
                          sm.tone,
                          sm.ring,
                        )}
                      >
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-violet-300 tabular-nums">
                      {c.thisMonthSaved > 0 ? fmtKrw(c.thisMonthSaved) : '—'}
                    </td>
                    <td className="px-4 py-3 text-rose-300 font-semibold tabular-nums">
                      {c.thisMonthShare > 0 ? fmtKrw(c.thisMonthShare) : '—'}
                    </td>
                    <td className="px-4 py-3 text-emerald-300 font-bold tabular-nums">{net > 0 ? fmtKrw(net) : '—'}</td>
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
