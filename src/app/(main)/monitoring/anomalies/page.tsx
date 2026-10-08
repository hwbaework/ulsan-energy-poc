'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';

import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { CONTRACT_KIND, commStatusOf, contractKindsOf, gradeOf, isAnomaly } from '@/lib/design';
import { contractDisplayName } from '@/lib/contract-plants';
import type { AnomalyEvent, PlantContractKind } from '@/types/monitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { PlantCommStatusTable, type CommOutage } from '@/components/features/monitoring/PlantCommStatusTable';

interface AnomalyRow extends AnomalyEvent {
  plantType?: string;
  /** 이상이 속한 계약 — 이상 하나는 계약 하나. 응답에 없으면 발전소의 계약이 하나일 때만 채움 */
  contractKind?: PlantContractKind;
  /** 계약 단위 이름 — 한일튜브(onsite) */
  displayName: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 등급·상태 표기와 이상 포함 조건은 src/lib/design.ts (ANOMALY_GRADE · COMM_STATUS · isAnomaly) 한 곳에서 정의한다.
// 처리 워크플로(감지→확인→조치중→완료)는 스펙에 없다. 필터 항목은 데이터에 실제 있는 값만 보여준다.

const TYPE_LABELS: Record<string, string> = {
  SOLAR: '태양광',
  ORC: 'ORC',
  FUEL_CELL: '연료전지',
};

function getDeviceLabel(r: AnomalyRow): string {
  const text = `${r.title ?? ''} ${r.description ?? ''}`;
  if (text.includes('인버터')) return '인버터';
  if (text.includes('RTU')) return 'RTU';
  return '-';
}

export default function AnomaliesPage() {
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const myPlantMatcher = useMyPlantMatcher();
  const { data: plantList } = useMonitoringPlants();
  const plantOf = (plantId: number) => (plantList ?? []).find((x) => x.plantId === plantId);
  const { data: apiData, isError } = useAnomalies({ size: 100 });
  const rawListAll: any[] =
    !isError && apiData ? (Array.isArray(apiData) ? apiData : ((apiData as any)?.content ?? [])) : [];
  const rawList = filterPlantsByOwnership(
    rawListAll.map((a: any) => ({
      ...a,
      plantId: a.plantId ?? a.powerStationId,
      name: a.plantName ?? a.powerStationName,
    })),
    myPlantMatcher,
  );

  const anomalies: AnomalyRow[] = rawList
    .filter((a: any) => isAnomaly(a.severity ?? 'normal', a.status ?? 'NORMAL'))
    .map((a: any) => {
      const plantId = a.plantId ?? a.powerStationId ?? 0;
      const p = plantOf(plantId);
      const kinds = p ? contractKindsOf(p) : [];
      const contractKind = (a.contractKind as PlantContractKind | undefined) ?? (kinds.length === 1 ? kinds[0] : undefined);
      const plantName = a.plantName ?? a.powerStationName ?? '';
      return {
    id: a.id,
    plantId,
    plantName,
    displayName: contractDisplayName(plantName, contractKind, kinds.length > 1),
    plantType: a.detectionType ?? 'SOLAR',
    contractKind,
    severity: a.severity ?? 'caution',
    status: a.status ?? 'NORMAL',
    title: a.title ?? '',
    description: a.description ?? '',
    detectedAt: a.detectedAt ?? a.createdAt ?? '',
    resolvedAt: a.resolvedAt,
    createdAt: a.createdAt ?? '',
    updatedAt: a.updatedAt ?? '',
      };
    });

  // 전체 상태 — 내 발전소 전부(정상 포함) + 통신오류 건
  const myPlants = filterPlantsByOwnership(plantList ?? [], myPlantMatcher);
  const commOutages: CommOutage[] = rawList
    .filter((a: any) => a.status === 'COMM_ERROR')
    .map((a: any) => ({
      plantId: a.plantId,
      contractKind: a.contractKind,
      title: a.title ?? '',
      detectedAt: a.detectedAt ?? a.createdAt ?? '',
      resolvedAt: a.resolvedAt,
    }));

  const q = query.trim().toLowerCase();
  const filtered = anomalies.filter((a) => {
    if (severity !== 'all' && a.severity !== severity) return false;
    if (status !== 'all' && a.status !== status) return false;
    if (q && !a.displayName.toLowerCase().includes(q) && !a.title.toLowerCase().includes(q)) return false;
    return true;
  });

  // 필터 항목 = 데이터에 실제 있는 값만 (하드코딩 금지)
  const severityOptions = useMemo(() => {
    const codes = [...new Set(anomalies.map((a) => a.severity))].sort((x, y) => gradeOf(x).order - gradeOf(y).order);
    return [{ value: 'all', label: '전체 등급' }, ...codes.map((c) => ({ value: c, label: gradeOf(c).label }))];
  }, [anomalies]);
  const statusOptions = useMemo(() => {
    const codes = [...new Set(anomalies.map((a) => a.status))].sort((x, y) => commStatusOf(x).order - commStatusOf(y).order);
    return [{ value: 'all', label: '전체 상태' }, ...codes.map((c) => ({ value: c, label: commStatusOf(c).label }))];
  }, [anomalies]);

  // 활성 이상 = 목록 전체(등급 주의·경고 또는 통신오류) · 경고 = 등급 경고 건
  const activeCount = anomalies.length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;

  const columns: Column<AnomalyRow>[] = [
    {
      key: 'detectedAt',
      header: '시간',
      width: '180px',
      render: (r) => (
        <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">
          {new Date(r.detectedAt).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </span>
      ),
    },
    {
      key: 'plantName',
      header: '발전소',
      width: '130px',
      render: (r) => <span className="text-sm font-medium text-white truncate block">{r.displayName}</span>,
    },
    {
      key: 'plantType',
      header: '설비',
      width: '90px',
      render: (r) => <span className="text-sm text-slate-300">{TYPE_LABELS[r.plantType ?? ''] ?? r.plantType}</span>,
    },
    {
      // 계약 유형 — 자가소비 / onsite. 발전소 단위 이상(RTU 등)은 계약 전부
      key: 'contractKind',
      header: '계약 유형',
      width: '110px',
      render: (r) => <span className="text-sm text-slate-300">{r.contractKind ? CONTRACT_KIND[r.contractKind].label : '-'}</span>,
    },
    {
      key: 'device' as any,
      header: '장비',
      width: '70px',
      render: (r) => <span className="text-sm text-slate-300">{getDeviceLabel(r)}</span>,
    },
    {
      key: 'title',
      header: '이상유형',
      width: '200px',
      render: (r) => <span className="text-sm text-white truncate block max-w-[200px]">{r.title}</span>,
    },
    {
      key: 'severity',
      header: '등급',
      width: '80px',
      render: (r) => {
        const s = gradeOf(r.severity);
        return <StatusPill tone={s.tone} label={s.label} />;
      },
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (r) => {
        const s = commStatusOf(r.status);
        return <StatusPill tone={s.tone} label={s.label} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '이상감지 관리' }]} />
      <div>
        <h1 className="text-xl font-bold text-white">이상감지 관리</h1>
      </div>

      <StatsGrid columns={2}>
        <StatCard label="활성 이상" value={activeCount} />
        <StatCard label="경고" value={warningCount} />
      </StatsGrid>

      <SectionCard
        title="이상 감지 목록"
        actions={
          /* /guide 표기 규칙: 필터 → 검색 */
          <div className="flex items-center gap-3">
            <div className="w-32">
              <Select options={severityOptions} value={severity} onChange={(e) => setSeverity(e.target.value)} />
            </div>
            <div className="w-32">
              <Select options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="발전소 · 이상유형 검색"
                className="pl-8"
              />
            </div>
          </div>
        }
      >
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          emptyMessage={q || severity !== 'all' || status !== 'all' ? '검색 결과가 없습니다' : '이상 감지 내역이 없습니다'}
        />
      </SectionCard>

      <PlantCommStatusTable plants={myPlants} outages={commOutages} />
    </div>
  );
}
