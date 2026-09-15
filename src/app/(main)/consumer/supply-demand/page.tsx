'use client';

import { useState } from 'react';
import { Zap, TrendingDown, TrendingUp, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { RmsAreaChart, RmsBarChart } from '@/components/ui/Chart';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsumerSites, useSiteUsage } from '@/hooks/consumer/useConsumer';

function buildMonthlyChart(usageList: any[]) {
  return usageList
    .slice(0, 12)
    .reverse()
    .map((u: any) => ({
      month: u.period?.substring(5) + '월',
      수요: Math.round(u.totalUsageKwh ?? 0),
      PPA공급: Math.round(u.ppaSupplyKwh ?? 0),
      자가발전: Math.round(u.selfGenKwh ?? 0),
      한전: Math.round(u.kepcoUsageKwh ?? 0),
    }));
}

function buildBalanceChart(usageList: any[]) {
  return usageList
    .slice(0, 12)
    .reverse()
    .map((u: any) => {
      const demand = u.totalUsageKwh ?? 0;
      const supply = (u.ppaSupplyKwh ?? 0) + (u.selfGenKwh ?? 0);
      return {
        date: u.period ?? '',
        수요: Math.round(demand),
        공급: Math.round(supply),
      };
    });
}

export default function SupplyDemandPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? 0);
  const sitesQuery = useConsumerSites({ companyId });
  const sites = sitesQuery.data?.content ?? [];
  const [selectedSiteId, setSelectedSiteId] = useState<number>(0);
  const siteId = selectedSiteId || sites[0]?.id || 0;
  const usageQuery = useSiteUsage(siteId);
  const usageList = usageQuery.data ?? [];
  const latest = usageList[0];

  const totalDemand = latest?.totalUsageKwh ?? 0;
  const ppaSupply = latest?.ppaSupplyKwh ?? 0;
  const selfGen = latest?.selfGenKwh ?? 0;
  const kepco = latest?.kepcoUsageKwh ?? 0;
  const rePercent = latest?.rePercent ?? 0;
  const balance = ppaSupply + selfGen - totalDemand;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '수용가', path: '/consumer' }, { label: '수요-공급 통합 뷰' }]} />
      <div>
        <h1 className="text-xl font-bold text-white">수요-공급 통합 뷰</h1>
        <p className="mt-1 text-sm text-slate-400">전력 소비와 재생에너지 공급의 균형 현황</p>
      </div>

      {sites.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {sites.map((site: any) => (
            <button
              key={site.id}
              onClick={() => setSelectedSiteId(site.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                siteId === site.id
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              {site.name}
            </button>
          ))}
        </div>
      )}

      <StatsGrid columns={4}>
        <StatCard
          icon={<TrendingDown size={18} className="text-red-400" />}
          label="총 수요"
          value={`${totalDemand.toLocaleString()} kWh`}
          sub={latest?.period ?? '-'}
        />
        <StatCard
          icon={<Zap size={18} className="text-emerald-400" />}
          label="PPA 공급"
          value={`${ppaSupply.toLocaleString()} kWh`}
        />
        <StatCard
          icon={<ArrowRightLeft size={18} className="text-amber-400" />}
          label="한전 사용"
          value={`${kepco.toLocaleString()} kWh`}
        />
        <StatCard
          icon={
            balance >= 0 ? (
              <TrendingUp size={18} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="text-red-400" />
            )
          }
          label="잉여/부족"
          value={`${balance >= 0 ? '+' : ''}${balance.toLocaleString()} kWh`}
          sub={balance >= 0 ? '잉여' : '부족'}
        />
      </StatsGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard title="월별 수요-공급 추이">
          <div>
            <RmsBarChart
              data={buildMonthlyChart(usageList)}
              xKey="month"
              bars={[
                { key: '수요', name: '총 수요(kWh)', color: '#EF4444' },
                { key: 'PPA공급', name: 'PPA 공급', color: '#3B82F6' },
                { key: '자가발전', name: '자가발전', color: '#F59E0B' },
                { key: '한전', name: '한전 사용', color: '#64748B' },
              ]}
              height={280}
            />
          </div>
        </SectionCard>

        <SectionCard title="월별 수급 균형">
          <div>
            <RmsAreaChart
              data={buildBalanceChart(usageList)}
              xKey="date"
              areas={[
                { key: '수요', name: '수요(kWh)', color: '#EF4444' },
                { key: '공급', name: '공급(kWh)', color: '#10B981' },
              ]}
              height={280}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="RE100 달성 현황">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400">{rePercent}%</div>
            <div className="text-xs text-slate-400 mt-1">현재 재생에너지 비율</div>
          </div>
          <div className="flex-1">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                style={{ width: `${Math.min(rePercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>0%</span>
              <span>RE100 목표</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
