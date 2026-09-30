'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusBadge } from '@/components/ui/Design';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import type { EnergySource, MonitoringPlant, PlantContractKind } from '@/types/monitoring';
import { CONTRACT_KIND, SOURCE, SOURCE_ORDER, contractSplitOf, sourceOf } from '@/lib/design';

/** 목록 한 행 = 발전소 × 계약. 혼합 계약(한일튜브)은 자가소비·onsite 두 행으로, 값은 계약 용량 몫 */
interface PlantRow extends MonitoringPlant {
  rowKey: string;
  contractKind?: PlantContractKind;
}
function toRows(plants: MonitoringPlant[]): PlantRow[] {
  return plants.flatMap((p) => {
    const split = contractSplitOf(p);
    if (split.length === 0) return [{ ...p, rowKey: String(p.plantId) }];
    const total = split.reduce((s, c) => s + c.capacityKw, 0) || 1;
    return split.map((c) => {
      const share = c.capacityKw / total;
      return {
        ...p,
        rowKey: `${p.plantId}-${c.kind}`,
        contractKind: c.kind,
        capacity: c.capacityKw,
        currentOutput: Math.round(p.currentOutput * share),
        dailyEnergy: Math.round((p.dailyEnergy ?? 0) * share),
      };
    });
  });
}
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';



export default function MonitoringPlantListPage() {
  const router = useRouter();
  const { data: allPlants = [], isLoading } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const plants = useMemo(() => filterPlantsByOwnership(allPlants, myPlantMatcher), [allPlants, myPlantMatcher]);

  // 발전소가 1개면 고를 게 없으니 목록 없이 바로 그 발전소 상세로 (보고서와 같은 규칙)
  useEffect(() => {
    if (!isLoading && plants.length === 1) router.replace(`/monitoring/plant/${plants[0]!.plantId}`);
  }, [isLoading, plants, router]);

  // 목록 검색·발전원 필터 — KPI(운영중·용량·출력)는 이와 무관하게 전체 기준
  const [query, setQuery] = useState('');
  const [sourceType, setSourceType] = useState<'ALL' | EnergySource>('ALL');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return toRows(plants).filter(
      (p) =>
        (sourceType === 'ALL' || p.type === sourceType) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          sourceOf(p.type).label.toLowerCase().includes(q)),
    );
  }, [plants, query, sourceType]);

  const operating = plants.filter((p) => p.status !== 'ANOMALY').length;
  const totalCapacity = plants.reduce((s, p) => s + p.capacity, 0);
  const totalOutput = plants.reduce((s, p) => s + p.currentOutput, 0);

  const columns: Column<PlantRow>[] = [
    {
      key: 'name',
      header: '발전소명',
      width: '220px',
      render: (row) => <PlantNameCell type={row.type} name={row.name} />,
    },
    {
      // 계약 유형 — 행 하나가 계약 하나. 혼합 계약 발전소는 자가소비·onsite 행이 따로 있다
      key: 'contractKind',
      header: '계약 유형',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-300">{row.contractKind ? CONTRACT_KIND[row.contractKind].label : '-'}</span>,
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

      <SectionCard
        title="발전소 목록"
        actions={
          /* /guide 표기 규칙: 헤더 actions 순서는 필터 → 검색 → 등록 */
          <div className="flex items-center gap-3">
            {/* 발전원 필터 — 전체 / 태양광 / ORC / 연료전지 */}
            <div className="w-32">
              <Select
                options={[{ value: 'ALL', label: '전체' }, ...SOURCE_ORDER.map((t) => ({ value: t, label: SOURCE[t].label }))]}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as 'ALL' | EnergySource)}
              />
            </div>
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="발전소명 · 위치 검색"
                className="pl-8"
              />
            </div>
          </div>
        }
      >
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.rowKey}
          onRowClick={(row) => router.push(row.contractKind ? `/monitoring/plant/${row.plantId}?contract=${row.contractKind}` : `/monitoring/plant/${row.plantId}`)}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 발전소가 없습니다'}
        />
      </SectionCard>
    </div>
  );
}
