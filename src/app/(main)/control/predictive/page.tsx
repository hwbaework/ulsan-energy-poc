'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout';
import { StatusPill } from '@/components/ui/Design';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { useDxLatestAll } from '@/hooks/control/useDx';
import { dxSensorsOf, isDxTarget, isStale, type DxLatest } from '@/lib/dx';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import type { MonitoringPlant } from '@/types/monitoring';

// 예지보전 — 발전소(회사)마다 DX 스마트센서 상태(아이티공간 UMEI 연계 v1.1).
// 센서가 잰 값(API-003)만 — 전기안전지수 · 등급 · 위험 항목은 안전 목록에 있다(2026-10-29 사용자 확정).
// 줄을 누르면 그 발전소 상세(설비 상태 · 설비별 측정값 · 발전량 추이 · 센서 추이)로 들어간다.
// 회사마다 센서가 있는 것이 전제 — 값이 없으면 '센서 없음'이 아니라 미수신 · 수집 중단 · 갱신 지연.
const fx = (v: number | null | undefined) => (v == null ? null : v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

interface Row {
  plant: MonitoringPlant;
  sensors: number;
  receiving: number;
  health: number | null;
}

export default function PredictivePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const { data: allPlants = [] } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  // 회사 = 태양광 발전소(연료전지 · ORC 는 DX 대상이 아님)
  const plants = filterPlantsByOwnership(allPlants, myPlantMatcher).filter((p) => p.type === 'SOLAR');
  const latestQ = useDxLatestAll();

  // 발전사업자는 본인 발전소만 보므로 목록을 건너뛰고 대시보드로 바로 진입한다
  const directPlantId = persona === 'generator' && plants.length > 0 ? plants[0]!.plantId : null;
  useEffect(() => {
    if (directPlantId != null) router.replace(`/control/predictive/${directPlantId}`);
  }, [directPlantId, router]);
  if (directPlantId != null) return null;

  const rows: Row[] = plants.map((p) => {
    // 연계 대상 센서만(아직 목록에 없는 장비는 미수신) — 응답에 없는 대상 센서는 수신 수에서 빠져 수집 중단으로 보인다
    const macs = dxSensorsOf(p.plantId).filter((s) => isDxTarget(s.mac)).map((s) => s.mac);
    const lt = (latestQ.data ?? []).filter((x: DxLatest) => macs.includes(x.macAddress));
    const live = lt.filter((x) => !isStale(x));
    const hs = live.map((x) => x.health?.healthIndex).filter((v): v is number => v != null);
    return { plant: p, sensors: macs.length, receiving: live.length, health: hs.length ? Math.min(...hs) : null };
  });


  const columns: Column<Row>[] = [
    { key: 'name', header: '발전소', render: (r) => <PlantNameCell type={r.plant.type} name={r.plant.name} /> },
    {
      key: 'recv',
      header: '센서 수신',
      width: '130px',
      render: (r) =>
        r.sensors === 0 ? (
          <StatusPill tone="muted" label="미수신" />
        ) : (
          <StatusPill tone={r.receiving === r.sensors ? 'normal' : r.receiving > 0 ? 'warning' : 'danger'} label={`${r.receiving}/${r.sensors}`} />
        ),
    },
    {
      key: 'hi',
      header: 'Health',
      width: '100px',
      render: (r) => <span className={`tabular-nums ${r.health != null ? 'text-slate-200' : 'text-slate-500'}`}>{fx(r.health) ?? '미산출'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '예지보전' }]} />
      <h1 className="text-xl font-bold text-white">예지보전</h1>


      <SectionCard title={`발전소별 예지보전 현황 (${rows.length})`}>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.plant.plantId}
          onRowClick={(r) => router.push(`/control/predictive/${r.plant.plantId}`)}
          emptyMessage="표시할 발전소가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
