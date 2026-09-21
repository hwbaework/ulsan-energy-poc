'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout';
import { StatusPill } from '@/components/ui/Design';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { isLaseePlant } from '@/constants/plant-mapping';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import type { MonitoringPlant } from '@/types/monitoring';

// 예지보전 — 설계 v2/docs/12 §3 + 백엔드 배선(17). 발전소 목록에서 RTU·인버터 통신 상태를 훑어보고,
// 행을 클릭하면 그 발전소의 인버터별 상세·점검 제안(/control/predictive/[id])으로 들어간다.
// 발전소 상세(/monitoring/plant/[id])는 발전소 1곳의 원시 계측(3상 전류·전압, 이력 차트)을 보여주는 화면이고,
// 예지보전은 그 계측을 근거로 점검이 필요한지 판단·제안하는 화면으로 역할을 나눈다.
function normalInverterCount(plant: MonitoringPlant): number {
  return (plant.inverters ?? []).filter((inv) => inv.connectionState === 'NORMAL' && inv.statusMessages.length === 0)
    .length;
}

function isPlantHealthy(plant: MonitoringPlant): boolean {
  const c = plant.connectionStatus;
  const total = plant.inverters?.length ?? 0;
  return c?.rtuPower === 'ON' && c?.rtuConnection === 'NORMAL' && normalInverterCount(plant) === total;
}

export default function PredictivePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const { data: allPlants = [] } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const ownedPlants = filterPlantsByOwnership(allPlants, myPlantMatcher);
  const plants = ownedPlants.filter((p) => isLaseePlant(p.plantId) && p.inverters?.length);

  // 발전사업자는 본인 발전소만 보므로 목록을 건너뛰고 첫 발전소 상세로 바로 진입한다.
  // 관리자·전기사용자는 목록에서 발전소를 고른다.
  const directPlantId = persona === 'generator' && plants.length > 0 ? plants[0]!.plantId : null;
  useEffect(() => {
    if (directPlantId != null) router.replace(`/control/predictive/${directPlantId}`);
  }, [directPlantId, router]);
  if (directPlantId != null) return null;

  const totalInverters = plants.reduce((s, p) => s + (p.inverters?.length ?? 0), 0);
  const normalInverters = plants.reduce((s, p) => s + normalInverterCount(p), 0);
  const healthyPlants = plants.filter(isPlantHealthy).length;
  const needsInspection = plants.length - healthyPlants;

  const columns: Column<MonitoringPlant>[] = [
    {
      key: 'no',
      header: 'No.',
      width: '56px',
      align: 'right',
      render: (_p, index) => <span className="text-sm text-slate-500 tabular-nums">{index + 1}</span>,
    },
    {
      key: 'name',
      header: '발전소',
      render: (p) => <PlantNameCell type={p.type} name={p.name} />,
    },
    {
      key: 'capacity',
      header: '설비용량',
      width: '120px',
      align: 'right',
      render: (p) => <span className="text-sm text-slate-300 tabular-nums">{p.capacity.toLocaleString()} kW</span>,
    },
    {
      key: 'rtuPower',
      header: 'RTU 전원',
      width: '110px',
      render: (p) => (
        <StatusPill
          tone={p.connectionStatus?.rtuPower === 'ON' ? 'normal' : 'danger'}
          label={p.connectionStatus?.rtuPower === 'ON' ? '켜짐' : '꺼짐'}
        />
      ),
    },
    {
      key: 'rtuConnection',
      header: 'RTU 통신',
      width: '110px',
      render: (p) => (
        <StatusPill
          tone={p.connectionStatus?.rtuConnection === 'NORMAL' ? 'normal' : 'danger'}
          label={p.connectionStatus?.rtuConnection === 'NORMAL' ? '정상' : '오류'}
        />
      ),
    },
    {
      key: 'inverterComm',
      header: '인버터 통신',
      width: '130px',
      sortable: true,
      sortValue: (p) => normalInverterCount(p) - (p.inverters?.length ?? 0),
      render: (p) => {
        const total = p.inverters?.length ?? 0;
        const normal = normalInverterCount(p);
        return <StatusPill tone={normal === total ? 'normal' : 'warning'} label={`${normal}/${total} 정상`} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '예지보전' }]} />
      <h1 className="text-xl font-bold text-white">예지보전</h1>

      <StatsGrid columns={3}>
        <StatCard label="정상 가동" value={`${healthyPlants} / ${plants.length}`} />
        <StatCard label="인버터 통신 정상" value={`${normalInverters} / ${totalInverters}`} />
        <StatCard label="점검 필요" value={`${needsInspection}개소`} />
      </StatsGrid>

      <SectionCard title="발전소별 예지보전 현황" description={`총 ${plants.length}개소`}>
        <DataTable
          columns={columns}
          data={plants}
          rowKey={(p) => p.plantId}
          onRowClick={(p) => router.push(`/control/predictive/${p.plantId}`)}
          emptyMessage="표시할 발전소가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
