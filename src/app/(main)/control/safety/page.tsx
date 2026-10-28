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
import { useDxLatestAll, useDxSafetyAll } from '@/hooks/control/useDx';
import { DX_LEVEL, dxSensorsOf, isSafetyLate, isStale, topRisk, worstSafety, type DxLatest, type DxSafety } from '@/lib/dx';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import type { MonitoringPlant } from '@/types/monitoring';

// 안전 — 회사(발전소)마다 한 줄, 줄을 누르면 그 회사 한 곳의 안전 상세로(예지보전과 같은 방식).
// 기업 스코프: 각 기업은 자기 발전소만(바로 상세로), 관리자는 전체.
const fx = (v: number | null | undefined) => (v == null ? null : v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

interface Row {
  plant: MonitoringPlant;
  sensors: number;
  receiving: number;
  worst?: DxSafety;
  /** 센서 결과가 모두 15분 넘게 멈춤 — '갱신 지연'(연계 문서 6.2) */
  late: boolean;
}

export default function SafetyPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const { data: allPlants = [] } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  // 기업 = 태양광 발전소(연료전지 · ORC 는 DX 대상이 아님)
  const plants = filterPlantsByOwnership(allPlants, myPlantMatcher).filter((p) => p.type === 'SOLAR');
  const latestQ = useDxLatestAll();
  const safetyQ = useDxSafetyAll();

  // 발전사업자는 본인 발전소만 보므로 목록을 건너뛰고 상세로 바로 진입한다
  const directPlantId = persona === 'generator' && plants.length > 0 ? plants[0]!.plantId : null;
  useEffect(() => {
    if (directPlantId != null) router.replace(`/control/safety/${directPlantId}`);
  }, [directPlantId, router]);
  if (directPlantId != null) return null;

  const rows: Row[] = plants.map((p) => {
    const macs = dxSensorsOf(p.plantId).map((s) => s.mac);
    const lt = (latestQ.data ?? []).filter((x: DxLatest) => macs.includes(x.macAddress));
    const sf = (safetyQ.data ?? []).filter((x: DxSafety) => macs.includes(x.macAddress));
    const worst = worstSafety(sf);
    return { plant: p, sensors: macs.length, receiving: lt.filter((x) => !isStale(x)).length, worst, late: !worst && sf.length > 0 && sf.every((x) => isSafetyLate(x)) };
  });
  const order = (r: Row) => (r.worst ? DX_LEVEL[r.worst.riskLevel].order : 9);
  rows.sort((a, b) => order(a) - order(b) || (a.worst?.safetyIndex ?? 101) - (b.worst?.safetyIndex ?? 101));

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
      key: 'si',
      header: '전기안전지수',
      width: '130px',
      render: (r) => <span className={`tabular-nums ${r.worst ? 'font-semibold text-white' : 'text-slate-500'}`}>{fx(r.worst?.safetyIndex) ?? (r.late ? '-' : '미산출')}</span>,
    },
    {
      key: 'lv',
      header: '등급',
      width: '110px',
      render: (r) =>
        r.worst ? (
          <StatusPill tone={DX_LEVEL[r.worst.riskLevel].tone} label={DX_LEVEL[r.worst.riskLevel].label} />
        ) : r.late ? (
          <StatusPill tone="muted" label="갱신 지연" />
        ) : (
          <span className="text-slate-500">-</span>
        ),
    },
    { key: 'top', header: '가장 높은 위험 항목', width: '170px', render: (r) => <span className="text-slate-300">{topRisk(r.worst)?.label ?? '-'}</span> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '안전' }]} />
      <h1 className="text-xl font-bold text-white">안전</h1>
      <SectionCard title={`발전소별 안전 현황 (${rows.length})`}>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.plant.plantId}
          onRowClick={(r) => router.push(`/control/safety/${r.plant.plantId}`)}
          emptyMessage="표시할 발전소가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
