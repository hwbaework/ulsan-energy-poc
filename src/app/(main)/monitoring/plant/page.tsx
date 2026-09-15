'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Sun, Wind, Droplets, Zap, Activity } from 'lucide-react';
import type { MonitoringPlant, PlantStatus } from '@/types/monitoring';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

const TYPE_ICONS: Record<string, { icon: typeof Sun; label: string }> = {
  SOLAR: { icon: Sun, label: '태양광' },
  ORC: { icon: Activity, label: 'ORC' },
  FUEL_CELL: { icon: Zap, label: '연료전지' },
  WIND: { icon: Wind, label: '풍력' },
  HYDRO: { icon: Droplets, label: '수력' },
};

const STATUS_BADGE: Record<
  PlantStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' | 'info' }
> = {
  NORMAL: { label: '정상', variant: 'success' },
  WARNING: { label: '주의', variant: 'warning' },
  ANOMALY: { label: '이상', variant: 'danger' },
  MAINTENANCE: { label: '정비', variant: 'info' },
  OFFLINE: { label: '정지', variant: 'default' },
};

export default function MonitoringPlantListPage() {
  const router = useRouter();
  const { data: allPlants = [] } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const plants = filterPlantsByOwnership(allPlants, myPlantMatcher);

  const operating = plants.filter((p) => p.status === 'NORMAL' || p.status === 'WARNING').length;
  const totalCapacity = plants.reduce((s, p) => s + p.capacity, 0);
  const totalOutput = plants.reduce((s, p) => s + p.currentOutput, 0);

  const columns: Column<MonitoringPlant>[] = [
    {
      key: 'name',
      header: '발전소명',
      width: '200px',
      render: (row) => {
        const t = TYPE_ICONS[row.type] ?? { icon: Zap, label: row.type };
        const Icon = t.icon;
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
              <Icon size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{row.name}</p>
              <p className="text-xs text-slate-500">{t.label}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'address', header: '위치', render: (row) => <span className="text-sm text-slate-400">{row.address}</span> },
    {
      key: 'capacity',
      header: '설비용량',
      width: '120px',
      align: 'right',
      render: (row) => <span className="text-sm text-slate-300 tabular-nums">{row.capacity.toLocaleString()} kW</span>,
    },
    {
      key: 'currentOutput',
      header: '현재출력',
      width: '120px',
      align: 'right',
      render: (row) => <span className="text-sm text-white tabular-nums">{row.currentOutput.toLocaleString()} kW</span>,
    },
    {
      key: 'dailyEnergy',
      header: '금일발전',
      width: '120px',
      align: 'right',
      render: (row) => (
        <span className="text-sm text-slate-300 tabular-nums">{(row.dailyEnergy ?? 0).toLocaleString()} kWh</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (row) => {
        const s = STATUS_BADGE[row.status] ?? { label: row.status, variant: 'default' as const };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <Breadcrumb items={[{ label: '모니터링' }, { label: '발전소 상세' }]} />

      <StatsGrid columns={3}>
        <StatCard
          icon={<Zap size={18} className="text-amber-400" />}
          label="운영중"
          value={`${operating} / ${plants.length}`}
        />
        <StatCard
          icon={<Activity size={18} className="text-blue-400" />}
          label="총 설비용량"
          value={`${totalCapacity.toLocaleString()} kW`}
        />
        <StatCard
          icon={<Sun size={18} className="text-emerald-400" />}
          label="현재 총 출력"
          value={`${totalOutput.toLocaleString()} kW`}
        />
      </StatsGrid>

      <SectionCard title="">
        <DataTable
          columns={columns}
          data={plants}
          rowKey={(row) => row.plantId}
          onRowClick={(row) => router.push(`/monitoring/plant/${row.plantId}`)}
          emptyMessage="등록된 발전소가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
