'use client';

import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusBadge } from '@/components/ui/Design';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import type { MonitoringPlant } from '@/types/monitoring';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';



export default function MonitoringPlantListPage() {
  const router = useRouter();
  const { data: allPlants = [] } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const plants = filterPlantsByOwnership(allPlants, myPlantMatcher);

  const operating = plants.filter((p) => p.status !== 'ANOMALY').length;
  const totalCapacity = plants.reduce((s, p) => s + p.capacity, 0);
  const totalOutput = plants.reduce((s, p) => s + p.currentOutput, 0);

  const columns: Column<MonitoringPlant>[] = [
    {
      key: 'name',
      header: '발전소명',
      width: '220px',
      render: (row) => <PlantNameCell type={row.type} name={row.name} />,
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
      width: '120px',
      render: (row) => {
        return <StatusBadge status={row.status} />;
      },
    },
  ];

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '발전소 상세' }]} />
      <h1 className="text-xl font-bold text-white">발전소 상세</h1>

      <StatsGrid columns={3}>
        <StatCard
          label="운영중"
          value={`${operating} / ${plants.length}`}
        />
        <StatCard
          label="총 설비용량"
          value={`${totalCapacity.toLocaleString()} kW`}
        />
        <StatCard
          label="현재 총 출력"
          value={`${totalOutput.toLocaleString()} kW`}
        />
      </StatsGrid>

      <SectionCard title="발전소 목록">
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
