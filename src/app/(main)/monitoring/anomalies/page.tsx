'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';

import { Breadcrumb } from '@/components/layout/Breadcrumb';
import type { AnomalyEvent } from '@/types/monitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { usePromoteAnomaly } from '@/hooks/control/useControl';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

interface AnomalyRow extends AnomalyEvent {
  plantType?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
};

const STATUS_LABELS: Record<string, string> = {
  DETECTED: '감지됨',
  ACKNOWLEDGED: '확인됨',
  IN_PROGRESS: '조치중',
  RESOLVED: '완료',
  FALSE_ALARM: '오탐',
};

const STATUS_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
  DETECTED: 'danger',
  ACKNOWLEDGED: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  FALSE_ALARM: 'default',
};

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
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('all');
  const [plant, setPlant] = useState('all');

  const myPlantMatcher = useMyPlantMatcher();
  const promote = usePromoteAnomaly();
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

  const anomalies: AnomalyRow[] = rawList.map((a: any) => ({
    id: a.id,
    plantId: a.plantId ?? a.powerStationId ?? 0,
    plantName: a.plantName ?? a.powerStationName ?? '',
    plantType: a.detectionType ?? 'SOLAR',
    severity: a.severity ?? 'LOW',
    status: a.status ?? 'DETECTED',
    title: a.title ?? '',
    description: a.description ?? '',
    detectedAt: a.detectedAt ?? a.createdAt ?? '',
    resolvedAt: a.resolvedAt,
    createdAt: a.createdAt ?? '',
    updatedAt: a.updatedAt ?? '',
  }));

  const filtered = anomalies.filter((a) => {
    if (severity !== 'all' && a.severity !== severity) return false;
    if (status !== 'all' && a.status !== status) return false;
    if (plant !== 'all' && a.plantName !== plant) return false;
    return true;
  });

  const activeCount = anomalies.filter((a) => a.status !== 'RESOLVED' && a.status !== 'FALSE_ALARM').length;
  const criticalCount = anomalies.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;

  const columns: Column<AnomalyRow>[] = [
    {
      key: 'detectedAt',
      header: '시간',
      width: '180px',
      render: (r) => (
        <span className="text-xs text-slate-200 tabular-nums whitespace-nowrap">
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
      render: (r) => <span className="text-sm font-medium text-white truncate block">{r.plantName}</span>,
    },
    {
      key: 'plantType',
      header: '설비',
      width: '90px',
      render: (r) => <span className="text-xs text-slate-200">{TYPE_LABELS[r.plantType ?? ''] ?? r.plantType}</span>,
    },
    {
      key: 'device' as any,
      header: '장비',
      width: '70px',
      render: (r) => <span className="text-xs text-slate-200">{getDeviceLabel(r)}</span>,
    },
    {
      key: 'title',
      header: '이상유형',
      width: '200px',
      render: (r) => <span className="text-sm text-white truncate block max-w-[200px]">{r.title}</span>,
    },
    {
      key: 'severity',
      header: '심각도',
      width: '80px',
      render: (r) => <Badge variant={SEVERITY_VARIANT[r.severity]}>{r.severity}</Badge>,
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge>,
    },
    {
      key: 'detail' as any,
      header: '',
      width: '120px',
      render: (r) => {
        // 관제 루프 승격 게이트 (기획 12 §4): HIGH/CRITICAL & 미종결만 DiSOP 승격 가능
        const promotable = ['HIGH', 'CRITICAL'].includes(r.severity) && ['DETECTED', 'ACKNOWLEDGED'].includes(r.status);
        return promotable ? (
          <Button
            size="sm"
            variant="primary"
            disabled={promote.isPending}
            onClick={(e) => {
              e.stopPropagation();
              promote.mutate(r.id, { onSuccess: () => router.push('/control/disop') });
            }}
          >
            DiSOP 승격
          </Button>
        ) : null;
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
        <StatCard label="긴급(CRITICAL)" value={criticalCount} />
      </StatsGrid>

      <SectionCard
        title="이상 감지 목록"
        description={`총 ${filtered.length}건`}
        actions={
          <>
            <div className="w-32">
              <Select
                options={[
                  { value: 'all', label: '전체 심각도' },
                  { value: 'CRITICAL', label: 'CRITICAL' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'LOW', label: 'LOW' },
                ]}
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              />
            </div>
            <div className="w-32">
              <Select
                options={[
                  { value: 'all', label: '전체 상태' },
                  { value: 'DETECTED', label: '감지됨' },
                  { value: 'ACKNOWLEDGED', label: '확인됨' },
                  { value: 'IN_PROGRESS', label: '조치중' },
                  { value: 'RESOLVED', label: '완료' },
                  { value: 'FALSE_ALARM', label: '오탐' },
                ]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                options={[
                  { value: 'all', label: '전체 발전소' },
                  { value: '그린솔라 1호', label: '그린솔라 1호' },
                  { value: '그린솔라 2호', label: '그린솔라 2호' },
                  { value: '울산 ORC 발전소', label: '울산 ORC 발전소' },
                  { value: '수소연료전지 1호', label: '수소연료전지 1호' },
                ]}
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
              />
            </div>
          </>
        }
      >
        <DataTable columns={columns} data={filtered} rowKey={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
