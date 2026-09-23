'use client';

/**
 * 보고서 1단계 — 누구의 보고서를 볼지 먼저 고른다: 전체 발전소 또는 발전소 하나.
 * 발전소가 1개인 역할(발전사업자·전기사용자)은 바로 그 발전소 보고서로 이동.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import { isAnomaly } from '@/lib/design';
import type { MonitoringPlant } from '@/types/monitoring';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

const now = new Date();
const THIS_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const LAST_REPORT = `${prev.getFullYear()}년 ${prev.getMonth() + 1}월`; // 마감된 최근 보고서

interface Row {
  key: string; // 'all' | plantId
  plant: MonitoringPlant | null; // null = 전체
  capacity: number;
  anomalies: number; // 이번 달
}

export default function ReportsEntryPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const { data: allPlants, isLoading } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  // 연료전지·ORC 는 아직 보고서 항목이 정해지지 않아 값을 비워 둔다(목록에는 표시)
  const plants = useMemo(() => filterPlantsByOwnership(allPlants ?? [], myPlantMatcher), [allPlants, myPlantMatcher]);
  const hasReport = (p: MonitoringPlant) => p.type === 'SOLAR';

  // 발전소가 1개면 고를 게 없으니 바로 그 발전소 보고서로
  useEffect(() => {
    if (!isLoading && plants.length === 1) router.replace(`/monitoring/reports/${plants[0]!.plantId}`);
  }, [isLoading, plants, router]);

  const { data: anomalyData } = useAnomalies({ size: 100 });
  const anomalyCount = useMemo(() => {
    const raw: any[] = anomalyData ? (Array.isArray(anomalyData) ? anomalyData : ((anomalyData as any)?.content ?? [])) : [];
    const m = new Map<number, number>();
    raw
      .filter((a) => isAnomaly(a.severity ?? 'normal', a.status ?? 'NORMAL') && String(a.detectedAt ?? '').startsWith(THIS_MONTH))
      .forEach((a) => m.set(a.plantId, (m.get(a.plantId) ?? 0) + 1));
    return m;
  }, [anomalyData]);

  // 행을 누르면 그 발전소 보고서로 (전체 행 없음, 버튼 없음)
  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    return plants
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q))
      .map((p) => ({ key: String(p.plantId), plant: p, capacity: p.capacity, anomalies: anomalyCount.get(p.plantId) ?? 0 }));
  }, [plants, query, anomalyCount]);

  const columns: Column<Row>[] = [
    { key: 'plant', header: '발전소', width: '240px', render: (r) => <PlantNameCell type={r.plant!.type} name={r.plant!.name} /> },
    { key: 'address' as keyof Row, header: '위치', render: (r) => <span className="text-sm text-slate-300">{r.plant?.address ?? '-'}</span> },
    { key: 'capacity', header: '설비용량', width: '130px', render: (r) => <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{r.capacity.toLocaleString()} kW</span> },
    { key: 'last' as keyof Row, header: '최근 보고서', width: '140px', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{hasReport(r.plant!) ? LAST_REPORT : ''}</span> },
    { key: 'anomalies', header: '이번 달 이상', width: '120px', render: (r) => (hasReport(r.plant!) ? <span className={`text-sm tabular-nums whitespace-nowrap ${r.anomalies > 0 ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>{r.anomalies} 건</span> : null) },
    { key: 'go' as keyof Row, header: '', width: '48px', render: () => <ChevronRight size={16} className="text-slate-500" /> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '보고서' }]} />
      <h1 className="text-2xl font-bold text-white">보고서</h1>

      <SectionCard
        title="발전소 선택"
        actions={
          <div className="relative w-64">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="발전소명 · 위치 검색" className="pl-8" />
          </div>
        }
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.key} onRowClick={(r) => router.push(`/monitoring/reports/${r.key}`)} emptyMessage="검색 결과가 없습니다" />
      </SectionCard>
    </div>
  );
}
