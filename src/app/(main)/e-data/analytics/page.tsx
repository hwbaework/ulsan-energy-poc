'use client';

import { Card, CardHeader } from '@/components/edm/ui/Card';
import { StatCard, StatsGrid } from '@/components/edm/features/StatCard';
import { Badge } from '@/components/edm/ui/Badge';
import { Eye, Zap, TrendingUp, DollarSign } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAnalyticsOverview, useAnalyticsUsage, useAnalyticsApiUsage } from '@/hooks/edm/useAnalytics';

// 데이터 분석 — 실 집계(dm_order·dm_dataset·dm_api_key). 기획 14 §6.
// 하드코딩(DAILY_USAGE/TOP_DATASETS/HEATMAP_DATA) 제거 → 훅 실데이터. 일별 시계열·히트맵은 원천 로그 부재로 "수집 예정".

export default function AnalyticsPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const overview = useAnalyticsOverview(companyId);
  const usage = useAnalyticsUsage(companyId);
  const apiUsage = useAnalyticsApiUsage(companyId);

  const isLive = overview.isLive || usage.isLive || apiUsage.isLive;
  const isError = overview.isError || usage.isError || apiUsage.isError;
  const topDatasets = usage.data;
  const maxOrders = Math.max(1, ...topDatasets.map((d) => d.orders));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">데이터 분석</h1>
        <Badge variant={isLive ? 'success' : isError ? 'warning' : 'default'}>
          {isLive ? '실시간' : isError ? '불러오기 실패' : '—'}
        </Badge>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<DollarSign size={20} />}
          label="누적 수익 (결제완료)"
          value={`₩${overview.data.revenueTotal.toLocaleString()}`}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="결제완료 주문"
          value={overview.data.ordersTotal.toLocaleString()}
          sub="건"
        />
        <StatCard
          icon={<Eye size={20} />}
          label="게시 데이터셋"
          value={overview.data.datasetsPublished.toLocaleString()}
          sub="건"
        />
        <StatCard
          icon={<Zap size={20} />}
          label="활성 API 키"
          value={overview.data.apiKeysActive.toLocaleString()}
          sub="개"
        />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Datasets — 실 판매순 */}
        <Card className="p-5">
          <CardHeader title="인기 데이터셋 Top 5" description="결제완료 판매건수 기준" />
          <div className="space-y-3">
            {topDatasets.length === 0 ? (
              <p className="py-6 text-center text-xs text-accent">판매 데이터가 없습니다.</p>
            ) : (
              topDatasets.map((ds) => (
                <div key={ds.datasetId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white truncate max-w-[70%]">
                      {ds.title || `데이터셋 #${ds.datasetId}`}
                    </span>
                    <span className="text-xs text-accent">{ds.orders.toLocaleString()}건</span>
                  </div>
                  <div className="h-2 bg-accent/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(ds.orders / maxOrders) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 일별 추이·히트맵 — 원천 로그 부재로 수집 예정 (기획 14 §6.3 경계) */}
        <Card className="p-5">
          <CardHeader title="데이터 활용 추이 · API 히트맵" description="요일 × 시간대" />
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
            <Badge variant="info">데이터 수집 예정</Badge>
            <p className="text-xs text-accent">
              일별 시계열·히트맵은 호출로그 수집 인프라 구축 후 제공됩니다.
              <br />
              현재는 누적 지표(수익·주문·API 사용량)만 실집계합니다.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
