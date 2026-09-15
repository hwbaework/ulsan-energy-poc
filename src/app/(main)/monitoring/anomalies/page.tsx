'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { AlertTriangle, CheckCircle, Clock, XCircle, Wrench } from 'lucide-react';
import type { AnomalyEvent } from '@/types/monitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { usePromoteAnomaly } from '@/hooks/control/useControl';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { useQueries } from '@tanstack/react-query';
import { anomalyKeys } from '@/api/queryKeys';
import * as anomalyApi from '@/api/monitoring/anomalies';

interface AnomalyRow extends AnomalyEvent {
  plantType?: string;
  description?: string;
  affectedConsumers?: string[];
  actions?: unknown[];
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

  const detailQueries = useQueries({
    queries: rawList.map((a: any) => ({
      queryKey: anomalyKeys.detail(a.id),
      queryFn: () => anomalyApi.getAnomaly(a.id),
      staleTime: 30_000,
      enabled: !!a.id,
    })),
  });

  const actionMap = new Map<number, any[]>();
  detailQueries.forEach((q, idx) => {
    if (q.data) {
      const d = q.data as any;
      const detail = d?.data ?? d;
      actionMap.set(rawList[idx]?.id, detail?.actions ?? []);
    }
  });

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
    affectedConsumers: a.affectedConsumers ?? [],
    actions: actionMap.get(a.id) ?? a.actions ?? [],
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
  const resolvedCount = anomalies.filter((a) => a.status === 'RESOLVED').length;
  const falseAlarmCount = anomalies.filter((a) => a.status === 'FALSE_ALARM').length;

  const columns: Column<AnomalyRow>[] = [
    {
      key: 'detectedAt',
      header: '시간',
      width: '180px',
      render: (r) => (
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
          {new Date(r.detectedAt).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
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
      key: 'affectedConsumers',
      header: '영향 수용가',
      width: '100px',
      render: (r) => (
        <span className="text-xs text-slate-400 truncate block">
          {(r.affectedConsumers?.length ?? 0) > 0 ? r.affectedConsumers!.join(', ') : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '조치',
      width: '90px',
      render: (r) => {
        const actionCount = r.actions?.length ?? 0;
        return actionCount > 0 ? (
          <span className="flex items-center gap-1 text-xs">
            <Wrench size={12} className="text-primary" />
            <span className="text-slate-300">{actionCount}건</span>
          </span>
        ) : (
          <span className="text-xs text-slate-500">-</span>
        );
      },
    },
    {
      key: 'detail' as any,
      header: '',
      width: '150px',
      render: (r) => {
        // 관제 루프 승격 게이트 (기획 12 §4): HIGH/CRITICAL & 미종결만 DiSOP 승격 가능
        const promotable = ['HIGH', 'CRITICAL'].includes(r.severity) && ['DETECTED', 'ACKNOWLEDGED'].includes(r.status);
        return (
          <span className="flex items-center gap-1">
            {promotable && (
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
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/monitoring/anomalies/${r.id}`);
              }}
            >
              상세
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '모니터링', path: '/monitoring' }, { label: '이상감지 관리' }]} />
      <div>
        <h1 className="text-xl font-bold text-white">이상감지 관리</h1>
        <p className="mt-1 text-sm text-slate-400">발전소 이상 감지 현황을 관리합니다</p>
      </div>

      <StatsGrid columns={4}>
        <StatCard icon={<AlertTriangle size={18} className="text-red-400" />} label="활성 이상" value={activeCount} />
        <StatCard
          icon={<XCircle size={18} className="text-semantic-red" />}
          label="긴급(CRITICAL)"
          value={criticalCount}
        />
        <StatCard
          icon={<CheckCircle size={18} className="text-emerald-400" />}
          label="해결 완료"
          value={resolvedCount}
        />
        <StatCard icon={<Clock size={18} className="text-slate-400" />} label="오탐" value={falseAlarmCount} />
      </StatsGrid>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-36">
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
        <div className="w-36">
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
        <div className="w-44">
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
      </div>

      <SectionCard title="이상 감지 목록" description={`총 ${filtered.length}건`}>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/monitoring/anomalies/${r.id}`)}
        />
      </SectionCard>
    </div>
  );
}
