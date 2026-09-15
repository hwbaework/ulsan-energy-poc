'use client';

import { useMemo } from 'react';
import { TrendingDown, Leaf, Zap, Wallet, ChevronRight, FileCheck2, Handshake, Activity, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RmsBarChart, RmsAreaChart } from '@/components/ui/Chart';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsumerBilling, useConsumerSites, useSiteUsage, useConsumerContracts } from '@/hooks/consumer/useConsumer';
import { useRoadmap } from '@/hooks/trading/useRe100';
import { useConsumerSupplyDemand } from '@/hooks/monitoring/useMonitoring';
import { useUnreadCount } from '@/hooks/platform/useNotifications';
import { useAllMonthlyRecords, useAllLeaseInvoices } from '@/hooks/lease/useLease';

export default function ConsumerDashboardPage() {
  const router = useRouter();
  const companyId = useAuthStore((s) => s.user?.companyId ?? 0);
  const companyName = useAuthStore((s) => s.user?.companyName ?? '');

  // ── 청구/절감 데이터 ──
  const billingQuery = useConsumerBilling(companyId);
  const billingList = useMemo(() => {
    const raw = billingQuery.data as any;
    return Array.isArray(raw) ? raw : (raw?.content ?? []);
  }, [billingQuery.data]);
  const bill = billingList[0] as any | undefined;

  // ── RE100 ──
  const roadmapQuery = useRoadmap(companyId);
  const roadmap = (roadmapQuery.data as any)?.[0];

  // ── 실시간 공급 (모니터링) ──
  const supplyQuery = useConsumerSupplyDemand(companyId);
  const supply = supplyQuery.data;

  // ── 사이트 + 사용량 ──
  const sitesQuery = useConsumerSites({ companyId });
  const firstSiteId = (sitesQuery.data as any)?.content?.[0]?.id ?? 0;
  const usageQuery = useSiteUsage(firstSiteId);
  const usageList = useMemo(() => {
    const raw = usageQuery.data;
    return Array.isArray(raw) ? raw : [];
  }, [usageQuery.data]);

  // ── 계약 ──
  const contractsQuery = useConsumerContracts(companyId);
  const contracts = useMemo(() => {
    const raw = contractsQuery.data;
    return Array.isArray(raw) ? raw : ((raw as any)?.content ?? []);
  }, [contractsQuery.data]);
  const activeContracts = contracts.filter((c: any) => c.status === 'ACTIVE');

  // ── 알림 ──
  const { data: unreadCount } = useUnreadCount();

  // ── Lease 데이터 (billing API가 빈 경우 fallback) ──
  const { data: leaseRecords } = useAllMonthlyRecords();
  const { data: leaseInvoices } = useAllLeaseInvoices({});
  const kepcoAvg = 120;

  const leaseMonthly = useMemo(() => {
    const recs = Array.isArray(leaseRecords) ? leaseRecords : [];
    const invs = Array.isArray(leaseInvoices) ? leaseInvoices : [];
    const byPeriod = new Map<string, { lease: number; kepco: number; saved: number }>();
    for (const r of recs) {
      const p = r.period ?? '';
      const genKwh = r.generatedKwh ?? 0;
      const lease = r.rent ?? 0;
      const kepcoEquiv = Math.round(genKwh * kepcoAvg);
      byPeriod.set(p, { lease, kepco: kepcoEquiv, saved: kepcoEquiv - lease });
    }
    for (const inv of invs) {
      const p = inv.period ?? '';
      if (!byPeriod.has(p) && inv.total) {
        const lease = inv.total ?? 0;
        byPeriod.set(p, { lease, kepco: lease, saved: 0 });
      }
    }
    return byPeriod;
  }, [leaseRecords, leaseInvoices, kepcoAvg]);

  const hasBilling = billingList.length > 0;

  // ── KPI 계산 (billing 우선, 없으면 lease fallback) ──
  const kpi = useMemo(() => {
    if (hasBilling) {
      const saved = bill?.savedAmount ?? 0;
      const accrued = billingList.reduce((sum: number, b: any) => sum + (b?.savedAmount ?? 0), 0);
      const total = bill ? (bill.ppaAmount ?? 0) + (bill.kepcoAmount ?? 0) + (bill.leaseAmount ?? 0) : 0;
      const equiv = total + saved;
      return {
        savedAmount: saved,
        savedAccrued: accrued,
        totalBill: total,
        kepcoEquiv: equiv,
        dueDate: bill?.dueDate ?? '—',
      };
    }
    const entries = Array.from(leaseMonthly.values());
    const sorted = Array.from(leaseMonthly.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const latest = sorted[0]?.[1];
    const saved = latest?.saved ?? 0;
    const accrued = entries.reduce((s, e) => s + e.saved, 0);
    const total = latest?.lease ?? 0;
    const equiv = latest?.kepco ?? 0;
    return { savedAmount: saved, savedAccrued: accrued, totalBill: total, kepcoEquiv: equiv, dueDate: '—' };
  }, [hasBilling, bill, billingList, leaseMonthly]);

  const savedRatePct = kpi.kepcoEquiv > 0 ? Math.round((kpi.savedAmount / kpi.kepcoEquiv) * 100) : 0;

  const re100Pct = roadmap?.actualPct ?? supply?.reCurrentPct ?? 0;
  const re100Target = roadmap?.targetPct ?? supply?.reTargetPct ?? 20;
  const re100Gap = +(re100Pct - re100Target).toFixed(1);

  const liveSupplyKw = Math.round((supply?.todaySupplyKwh ?? 0) / 24);
  const todaySupplyKwh = supply?.todaySupplyKwh ?? 0;

  // ── 한전 vs PPA 차트 (계약 시작월~12월, 현재 월까지 막대) ──
  const ppaVsKepco = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    if (hasBilling) {
      const byPeriod = new Map<string, any>();
      for (const b of billingList) {
        if (typeof b.period === 'string') byPeriod.set(b.period, b);
      }
      return Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const period = `${year}-${String(m).padStart(2, '0')}`;
        const b = m <= curMonth ? byPeriod.get(period) : null;
        return {
          month: `${m}월`,
          ppa: b ? Math.round(((b.ppaAmount ?? 0) + (b.leaseAmount ?? 0)) / 10000) : 0,
          kepco: b ? Math.round(((b.ppaAmount ?? 0) + (b.leaseAmount ?? 0) + (b.savedAmount ?? 0)) / 10000) : 0,
        };
      });
    }

    return Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const period = `${year}-${String(m).padStart(2, '0')}`;
      const entry = m <= curMonth ? leaseMonthly.get(period) : null;
      return {
        month: `${m}월`,
        ppa: entry ? Math.round(entry.lease / 10000) : 0,
        kepco: entry ? Math.round(entry.kepco / 10000) : 0,
      };
    });
  }, [hasBilling, billingList, leaseMonthly]);

  // ── 사용량 요약 (최근 7일) ──
  const usageDaily = useMemo(() => {
    return usageList.slice(-7).map((u: any) => ({
      date: u.period?.slice(5).replace('-', '/') ?? '',
      usage: u.totalUsageKwh ?? 0,
    }));
  }, [usageList]);
  const totalUsageKwh = usageList.reduce((s: number, u: any) => s + (u.totalUsageKwh ?? 0), 0);
  const peakKw = usageList.reduce((max: number, u: any) => Math.max(max, u.peakDemandKw ?? 0), 0);

  // ── CO₂ 추정 (kWh × 0.4168 tCO₂/MWh) ──
  const monthlySupplyKwh = supply?.monthlySupplyKwh ?? 0;
  const co2ReducedT = +(monthlySupplyKwh * 0.0004168).toFixed(1);

  const isLoading = billingQuery.isLoading || roadmapQuery.isLoading || supplyQuery.isLoading;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '대시보드' }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="mt-1 text-sm text-slate-400">
          {companyName || '수용가'} · {activeContracts.length}개 PPA · 절감·RE100·전력 한눈에
        </p>
      </div>

      {/* 상단 KPI 4종 */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<TrendingDown size={18} className="text-emerald-400" />}
          label="이번 달 절감액"
          loading={isLoading}
          value={`₩ ${kpi.savedAmount.toLocaleString()}`}
          sub={`누적 ₩ ${kpi.savedAccrued.toLocaleString()} · 절감률 ${savedRatePct}%`}
        />
        <StatCard
          icon={<Leaf size={18} className="text-emerald-400" />}
          label="RE100 달성률"
          loading={isLoading}
          value={`${re100Pct}%`}
          sub={`목표 ${re100Target}% · ${re100Gap >= 0 ? '+' : ''}${re100Gap}%p`}
        />
        <StatCard
          icon={<Zap size={18} className="text-amber-400" />}
          label="실시간 공급량"
          loading={isLoading}
          value={`${liveSupplyKw} kW`}
          sub={`오늘 누적 ${todaySupplyKwh.toLocaleString()} kWh`}
        />
        <StatCard
          icon={<Wallet size={18} className="text-emerald-400" />}
          label="이번 달 예상 요금"
          loading={isLoading}
          value={`₩ ${kpi.totalBill.toLocaleString()}`}
          sub={`다음 결제일 ${kpi.dueDate}`}
        />
      </StatsGrid>

      {/* 한전 vs 실제 PPA (좌 2/3) + RE100 달성 (우 1/3) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SectionCard
          className="xl:col-span-2"
          title="한전 vs 실제 PPA"
          description="단위: 만원 · 재생에너지 공급분을 한전 단가로 환산한 값과 실제 지불액 비교"
          actions={
            <Button size="sm" variant="ghost" onClick={() => router.push('/consumer/billing')}>
              정산 내역 <ChevronRight size={14} />
            </Button>
          }
        >
          {ppaVsKepco.length === 0 && !billingQuery.isLoading ? (
            <p className="py-12 text-center text-slate-500">청구 데이터가 없습니다</p>
          ) : (
            <div>
              <RmsBarChart
                data={
                  ppaVsKepco.length > 0
                    ? ppaVsKepco
                    : [
                        { month: '4월', ppa: 492, kepco: 638 },
                        { month: '5월', ppa: 449, kepco: 582 },
                        { month: '6월', ppa: 0, kepco: 0 },
                      ]
                }
                xKey="month"
                bars={[
                  { key: 'ppa', name: '실제 PPA', color: '#10B981' },
                  { key: 'kepco', name: '한전이었으면', color: '#94A3B8' },
                ]}
                height={300}
              />
              {kpi.savedAmount > 0 && (
                <p className="mt-2 text-sm text-slate-400">
                  이번 달 한전이었으면{' '}
                  <span className="font-semibold text-emerald-400">+₩ {kpi.savedAmount.toLocaleString()}</span> 더 냈을
                  거예요
                </p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="RE100 달성"
          actions={
            <Button size="sm" variant="ghost" onClick={() => router.push('/consumer/re100')}>
              상세 <ChevronRight size={14} />
            </Button>
          }
        >
          <div className="space-y-5">
            <div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-emerald-400">{re100Pct}%</span>
                <span className="text-xs text-slate-400">목표 {re100Target}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-sky-400"
                  style={{ width: `${Math.min((re100Pct / re100Target) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/[0.04] p-3">
                <span className="block text-xs text-slate-400">RE 비율</span>
                <span className="mt-1 block text-lg font-semibold text-white">{re100Pct}%</span>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <span className="block text-xs text-slate-400">CO₂ 저감</span>
                <span className="mt-1 block text-lg font-semibold text-white">{co2ReducedT} t</span>
              </div>
            </div>

            <Button variant="primary" className="w-full" onClick={() => router.push('/consumer/re100')}>
              <FileCheck2 size={16} /> 증빙 발급
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* 하단 3분할: 돈 관리 / 사용량 요약 / 내 계약·알림 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard
          title="이번 달 돈 관리"
          actions={
            <Button size="sm" variant="ghost" onClick={() => router.push('/consumer/billing')}>
              정산·요금 <ChevronRight size={14} />
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">예상 요금</span>
              <span className="text-sm font-semibold text-white tabular-nums">₩ {kpi.totalBill.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">다음 결제일</span>
              <span className="text-sm font-semibold text-white tabular-nums">{kpi.dueDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">미정산</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {billingList.filter((b: any) => b.status === 'PENDING' || b.status === 'UNPAID').length}건
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="사용량 요약"
          actions={
            <Button size="sm" variant="ghost" onClick={() => router.push('/consumer/usage')}>
              사용량 분석 <ChevronRight size={14} />
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs text-slate-400">총 사용량</span>
                <span className="mt-1 block text-lg font-semibold text-white tabular-nums">
                  {totalUsageKwh.toLocaleString()} kWh
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">수요 피크</span>
                <span className="mt-1 block text-lg font-semibold text-white tabular-nums">{peakKw} kW</span>
              </div>
            </div>
            {usageDaily.length > 0 ? (
              <RmsAreaChart
                data={usageDaily}
                xKey="date"
                areas={[{ key: 'usage', name: '일별 사용량 (kWh)', color: '#38BDF8' }]}
                height={160}
              />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">사용량 데이터가 없습니다</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="내 계약 · 알림">
          <div className="space-y-2">
            <button
              onClick={() => router.push('/consumer/contracts')}
              className="flex w-full items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/[0.10]">
                <Handshake size={18} className="text-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">활성 계약 {activeContracts.length}건</p>
                <p className="truncate text-xs text-slate-400">
                  {activeContracts.length > 0 ? `${activeContracts[0].powerStationName} 외` : '계약 없음'}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-500" />
            </button>

            <button
              onClick={() => router.push('/consumer/supply-demand')}
              className="flex w-full items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/[0.10]">
                <Activity size={18} className="text-sky-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">수용가 모니터링</p>
                <p className="truncate text-xs text-slate-400">실시간 PPA 공급 · 발전 추이</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-500" />
            </button>

            <button
              onClick={() => router.push('/consulting/proposals')}
              className="flex w-full items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/[0.10]">
                <Inbox size={18} className="text-violet-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  받은 제안
                  {(unreadCount as number) > 0 && (
                    <Badge variant="info" className="shrink-0">
                      {unreadCount as number}
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">검토 대기 중</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-500" />
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
