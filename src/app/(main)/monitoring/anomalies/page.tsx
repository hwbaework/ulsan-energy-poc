'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';

import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { CONTRACT_KIND, CONTRACT_KIND_LABEL, CONTRACT_KIND_ORDER, SENSOR_STOP, anomalyStateOf, contractKindsOf, isAnomaly } from '@/lib/design';
import { useDxLatestAll } from '@/hooks/control/useDx';
import { dxSensorLabel, dxSensorsOf, isDxTarget, isStale, type DxLatest } from '@/lib/dx';
import { getPersona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { contractDisplayName } from '@/lib/contract-plants';
import type { AnomalyEvent, PlantContractKind } from '@/types/monitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { PlantCommStatusTable, type SiteIssue } from '@/components/features/monitoring/PlantCommStatusTable';

interface AnomalyRow extends AnomalyEvent {
  plantType?: string;
  /** 이상이 속한 계약 — 이상 하나는 계약 하나. 응답에 없으면 발전소의 계약이 하나일 때만 채움 */
  contractKind?: PlantContractKind;
  /** 계약 단위 이름 — 한일튜브(PPA) */
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
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  // 관리자는 전체를 한 번에, 발전사업자 · 전기사용자는 계약 유형(자가소비 / PPA)을 골라서 본다 — 계약마다 주체가 다르다
  const isAdmin = getPersona(useAuthStore((st) => st.user)) === 'admin';
  const [kindTab, setKindTab] = useState<PlantContractKind>('SELF_CONSUMPTION');

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

  const apiAnomalies: AnomalyRow[] = rawList
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
    severity: a.severity ?? 'normal', // 등급이 비어 오면 지어내지 않고 정상(목록 포함 판정과 같은 기준)
    status: a.status ?? 'NORMAL',
    title: a.title ?? '',
    description: a.description ?? '',
    detectedAt: a.detectedAt ?? a.createdAt ?? '',
    resolvedAt: a.resolvedAt,
    createdAt: a.createdAt ?? '',
    updatedAt: a.updatedAt ?? '',
      };
    });

  // 전체 상태 — 내 발전소 전부(정상 포함)
  const myPlants = filterPlantsByOwnership(plantList ?? [], myPlantMatcher);

  // 예지보전 센서 수신 끊김 — 연계 대상 DX 센서의 receivedAt 이 5분 넘게 멈췄거나 응답에 없음(연계 문서 8-4, 알림 '센서 수신 끊김'과 같은 기준).
  // 센서 목록에 없는 사업장(한길 · 건호이엔씨)은 대상이 아니라 넣지 않는다. 조회가 실패하면 판단할 수 없어 넣지 않는다
  const dxQ = useDxLatestAll();
  const sensorStops: AnomalyRow[] = !dxQ.isSuccess
    ? []
    : myPlants.flatMap((pl) =>
        dxSensorsOf(pl.plantId)
          .filter((sn) => isDxTarget(sn.mac))
          .flatMap((sn) => {
            const lt = (dxQ.data ?? []).find((x: DxLatest) => x.macAddress === sn.mac);
            if (!isStale(lt)) return [];
            const kinds = contractKindsOf(pl);
            const row: AnomalyRow = {
              id: -Math.abs([...sn.mac].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)), // API 이상 id 와 겹치지 않게 음수
              plantId: pl.plantId,
              plantName: pl.name,
              displayName: pl.name,
              plantType: pl.type,
              contractKind: kinds.length === 1 ? kinds[0] : undefined,
              severity: 'normal',
              status: SENSOR_STOP,
              title: `${dxSensorLabel(sn.mac)} 센서 수신 끊김`,
              // 마지막으로 받은 시각(KST), 응답에 아예 없으면 모름
              detectedAt: lt?.receivedAt ? lt.receivedAt.replace(' ', 'T') + '+09:00' : '',
            };
            return [row];
          }),
      );
  const anomalies: AnomalyRow[] = [...apiAnomalies, ...sensorStops];
  // 내 계약 유형 — 둘(자가소비 · PPA)일 때만 골라서 본다
  const myKinds = CONTRACT_KIND_ORDER.filter((k) => myPlants.some((pl) => contractKindsOf(pl).includes(k)));
  const pickKind = !isAdmin && myKinds.length > 1;
  // 사업장 상태에 들어가는 이상 — 이상 감지 목록 전체(통신 · 전원, 전기안전지수 위험 · 경고, 센서 수신 끊김)
  const siteIssues: SiteIssue[] = anomalies.map((a) => ({
    plantId: a.plantId,
    contractKind: a.contractKind,
    title: a.title,
    detectedAt: a.detectedAt,
    resolvedAt: a.resolvedAt,
    comm: a.status === 'COMM_ERROR' || a.status === 'POWER_OFF', // 전원이 꺼져도 값이 끊긴다 — 최근 수신 칸은 끊긴 시각
  }));

  const q = query.trim().toLowerCase();
  const filtered = anomalies.filter((a) => {
    // 계약을 모르는 이상(발전소 단위 RTU 등)은 두 유형 모두에 보인다
    if (pickKind && a.contractKind && a.contractKind !== kindTab) return false;
    if (status !== 'all' && anomalyStateOf(a.severity, a.status).code !== status) return false;
    if (q && !a.displayName.toLowerCase().includes(q) && !a.title.toLowerCase().includes(q)) return false;
    return true;
  });

  // 필터 항목 = 데이터에 실제 있는 값만 (하드코딩 금지)
  const statusOptions = useMemo(() => {
    const specs = new Map(anomalies.map((a) => {
      const s = anomalyStateOf(a.severity, a.status);
      return [s.code, s] as const;
    }));
    const codes = [...specs.values()].sort((x, y) => x.order - y.order);
    return [{ value: 'all', label: '전체 상태' }, ...codes.map((c) => ({ value: c.code, label: c.label }))];
  }, [anomalies]);

  // 활성 이상 = 목록 전체(등급 위험·경고, 통신오류, 센서 수신 끊김) · 경고 = 등급 경고 건
  const inKind = anomalies.filter((a) => !pickKind || !a.contractKind || a.contractKind === kindTab);
  const activeCount = inKind.length;
  const warningCount = inKind.filter((a) => a.severity === 'warning').length;

  const columns: Column<AnomalyRow>[] = [
    {
      key: 'detectedAt',
      header: '시간',
      width: '180px',
      render: (r) => (
        <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">
          {!r.detectedAt ? '-' : new Date(r.detectedAt).toLocaleString('ko-KR', {
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
      // 이름은 괄호 없이 — 계약 유형은 옆 칸
      render: (r) => <span className="text-sm font-medium text-white truncate block">{r.plantName}</span>,
    },
    {
      key: 'plantType',
      header: '설비',
      width: '90px',
      render: (r) => <span className="text-sm text-slate-300">{TYPE_LABELS[r.plantType ?? ''] ?? r.plantType}</span>,
    },
    {
      // 계약 유형 — 자가소비 / PPA. 발전소 단위 이상(RTU 등)은 계약 전부
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
      key: 'status',
      header: '상태',
      width: '80px',
      render: (r) => {
        const s = anomalyStateOf(r.severity, r.status);
        return <StatusPill tone={s.tone} label={s.label} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '이상감지 관리' }]} />
      {/* 제목 줄 오른쪽 끝 — 계약 유형이 둘인 발전사업자 · 전기사용자는 자가소비 / PPA 를 골라서 본다 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-white">이상감지 관리</h1>
          {/* 지금 보는 계약 유형 — 색이 아니라 글자로(design.ts 규칙) */}
          {!isAdmin && myKinds.length > 0 && (
            <span className="rounded-md bg-white/[0.08] px-2.5 py-1 text-sm font-semibold text-white ring-1 ring-white/[0.16]">
              {CONTRACT_KIND_LABEL[pickKind ? kindTab : myKinds[0]!]}
            </span>
          )}
        </div>
        {pickKind && (
          <div className="w-40">
            <Select
              options={myKinds.map((k) => ({ value: k, label: CONTRACT_KIND_LABEL[k] }))}
              value={kindTab}
              onChange={(e) => setKindTab(e.target.value as PlantContractKind)}
            />
          </div>
        )}
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
          // 줄을 누르면 그 이상을 자세히 보는 화면으로 — 통신 · 전원은 발전소 상세, 센서 수신 끊김은 예지보전, 전기안전지수 위험 · 경고는 안전의 그 기업 상세.
          // 알림은 모두 이 화면으로 오고, 여기서 눌러 들어간다(2026-11-23 사용자)
          onRowClick={(r) =>
            router.push(
              r.status === 'POWER_OFF' || r.status === 'COMM_ERROR'
                ? `/monitoring/plant/${r.plantId}`
                : r.status === SENSOR_STOP
                  ? `/control/predictive/${r.plantId}`
                  : `/control/safety/${r.plantId}`,
            )
          }
          emptyMessage={q || status !== 'all' ? '검색 결과가 없습니다' : '이상 감지 내역이 없습니다'}
        />
      </SectionCard>

      <PlantCommStatusTable plants={myPlants} issues={siteIssues} kind={pickKind ? kindTab : undefined} />
    </div>
  );
}
