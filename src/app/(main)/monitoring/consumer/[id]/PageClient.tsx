'use client';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { ArrowLeft, Building2, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConsumerSite } from '@/hooks/consumer/useConsumer';

interface MockConsumerDetail {
  id: number;
  name: string;
  address: string;
  reTargetPct: number;
  reCurrentPct: number;
  monthlyDemandKwh: number;
  monthlySupplyKwh: number;
  contracts: {
    id: number;
    plantId: number;
    plantName: string;
    contractType: string;
    capacity: number;
    pricePerKwh: number;
    startDate: string;
    endDate: string;
    status: string;
  }[];
  supplyBreakdown: { source: string; amount: number; color: string }[];
}

export default function ConsumerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const numId = Number(id);
  const { data: apiConsumer, isError } = useConsumerSite(numId);

  const consumer: MockConsumerDetail =
    !isError && apiConsumer
      ? {
          id: (apiConsumer as any).id ?? numId,
          name: (apiConsumer as any).name ?? '',
          address: (apiConsumer as any).address ?? '',
          reTargetPct: (apiConsumer as any).reTargetPct ?? 0,
          reCurrentPct: (apiConsumer as any).reCurrentPct ?? 0,
          monthlyDemandKwh: (apiConsumer as any).monthlyDemandKwh ?? 0,
          monthlySupplyKwh: (apiConsumer as any).monthlySupplyKwh ?? 0,
          contracts: (apiConsumer as any).contracts ?? [],
          supplyBreakdown: (apiConsumer as any).supplyBreakdown ?? [],
        }
      : (undefined as any);
  if (!consumer) return null;

  const supplyPercent =
    consumer.monthlyDemandKwh > 0 ? ((consumer.monthlySupplyKwh / consumer.monthlyDemandKwh) * 100).toFixed(1) : '0';
  const totalBreakdown = consumer.supplyBreakdown.reduce((s, b) => s + b.amount, 0);

  const contractCols: Column<(typeof consumer.contracts)[0]>[] = [
    {
      key: 'plantName',
      header: '발전소',
      render: (r) => (
        <button
          onClick={() => router.push(`/monitoring/plant/${r.plantId}`)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {r.plantName}
        </button>
      ),
    },
    { key: 'contractType', header: '계약 유형', render: (r) => <Badge variant="primary">{r.contractType}</Badge> },
    {
      key: 'capacity',
      header: '계약 용량',
      render: (r) => <span className="text-sm text-white tabular-nums">{r.capacity} kW</span>,
    },
    {
      key: 'pricePerKwh',
      header: '단가',
      render: (r) => <span className="text-sm text-white tabular-nums">{r.pricePerKwh} 원/kWh</span>,
    },
    {
      key: 'period',
      header: '계약 기간',
      render: (r) => (
        <span className="text-xs text-slate-400">
          {r.startDate} ~ {r.endDate}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (r) => <Badge variant={r.status === '이행중' ? 'success' : 'warning'}>{r.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '모니터링', path: '/monitoring' }, { label: '사업장 모니터링' }]} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => router.push('/monitoring')}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">{consumer.name}</h1>
          <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-1">
            <Building2 size={12} /> {consumer.address}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-accent/20 bg-surface-card p-6 flex flex-col items-center justify-center">
          <p className="text-xs text-accent mb-1 flex items-center gap-1">
            <Target size={12} /> RE100 달성률
          </p>
          <p className="text-5xl font-bold text-white tabular-nums">
            {consumer.reCurrentPct}
            <span className="text-xl text-slate-400">%</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">목표: {consumer.reTargetPct}%</p>
          <div className="w-full mt-4">
            <ProgressBar
              value={consumer.reCurrentPct}
              max={consumer.reTargetPct}
              variant={
                consumer.reCurrentPct >= consumer.reTargetPct * 0.8
                  ? 'success'
                  : consumer.reCurrentPct >= consumer.reTargetPct * 0.5
                    ? 'warning'
                    : 'danger'
              }
              showValue
              label="목표 대비 달성률"
            />
          </div>
        </div>
        <div className="lg:col-span-2">
          <StatsGrid columns={2}>
            <StatCard
              icon={<Zap size={18} className="text-amber-400" />}
              label="월간 전력 수요"
              value={`${(consumer.monthlyDemandKwh / 1000).toLocaleString()} MWh`}
            />
            <StatCard
              icon={<Zap size={18} className="text-emerald-400" />}
              label="월간 재생에너지 공급"
              value={`${(consumer.monthlySupplyKwh / 1000).toLocaleString()} MWh`}
              change={{ value: Number(supplyPercent) - 50, label: '전월 대비' }}
            />
          </StatsGrid>
          <div className="mt-4 rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-3">공급원별 비중</p>
            <div className="flex h-4 w-full rounded-full overflow-hidden gap-0.5">
              {consumer.supplyBreakdown.map((b) => (
                <div
                  key={b.source}
                  className={cn('h-full rounded-sm transition-all', b.color)}
                  style={{ width: `${(b.amount / totalBreakdown) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              {consumer.supplyBreakdown.map((b) => (
                <div key={b.source} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('inline-block w-2.5 h-2.5 rounded-sm', b.color)} />
                  <span className="text-slate-400">{b.source}</span>
                  <span className="text-white tabular-nums">{(b.amount / 1000).toLocaleString()} MWh</span>
                  <span className="text-slate-500">({((b.amount / totalBreakdown) * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionCard title="계약 현황" description={`${consumer.contracts.length}건`}>
        <DataTable columns={contractCols} data={consumer.contracts} rowKey={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
