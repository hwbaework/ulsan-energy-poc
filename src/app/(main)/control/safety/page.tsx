'use client';

import { useMemo, useState } from 'react';
import { Breadcrumb } from '@/components/layout';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { StatusPill, type StatusTone } from '@/components/ui/Design';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSafetyItems, type SafetyItem, type SafetyRiskLevel } from '@/hooks/control/useControl';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

// 안전 — 전기안전 진단(ITS API-006/007). 발전소별 진단 결과가 주기적으로 누적되는 로그.
// 회사 스코프: 각 업체는 자기 발전소만 본다(발전사업자=본인 발전소, 관리자=전체).
// 발전원(태양광/연료전지/ORC)은 안전 API에 없어 plantCode로 발전소 정보를 조인해 표기한다.
const RISK_PILL: Record<SafetyRiskLevel, { tone: StatusTone; label: string }> = {
  normal: { tone: 'normal', label: '정상' },
  caution: { tone: 'warning', label: '주의' },
  warning: { tone: 'danger', label: '위험' },
};

export default function SafetyPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const itemsQ = useSafetyItems(companyId);
  const myPlantMatcher = useMyPlantMatcher();
  const items = filterPlantsByOwnership(itemsQ.data, myPlantMatcher);

  // 발전소 발전원(type) 조인용 — plantId → type
  const { data: allPlants = [] } = useMonitoringPlants();
  const plantTypeById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of allPlants) m.set(p.plantId, p.type);
    return m;
  }, [allPlants]);

  const columns: Column<SafetyItem>[] = useMemo(
    () => [
      {
        key: 'diagnosedAt',
        header: '시각',
        width: '150px',
        sortable: true,
        sortValue: (r) => new Date(r.diagnosedAt).getTime(),
        render: (r) => (
          <span className="text-xs tabular-nums text-slate-400 whitespace-nowrap">
            {new Date(r.diagnosedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        ),
      },
      {
        key: 'plantName',
        header: '발전소',
        render: (r) => <PlantNameCell type={plantTypeById.get(r.plantId) ?? 'SOLAR'} name={r.plantName} />,
      },
      {
        key: 'safetyIndex',
        header: '안전지수',
        width: '100px',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.safetyIndex,
        render: (r) => <span className="tabular-nums font-semibold text-white">{r.safetyIndex}</span>,
      },
      {
        key: 'anomalyScore',
        header: '이상점수',
        width: '100px',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.anomalyScore ?? 0,
        render: (r) => <span className="tabular-nums text-slate-300">{r.anomalyScore ?? '-'}</span>,
      },
      { key: 'riskLevel', header: '위험등급', width: '110px', render: (r) => <StatusPill tone={RISK_PILL[r.riskLevel].tone} label={RISK_PILL[r.riskLevel].label} /> },
    ],
    [plantTypeById],
  );

  const [risk, setRisk] = useState<'all' | SafetyRiskLevel>('all');
  const [plant, setPlant] = useState<'all' | string>('all');

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 안전 데이터를 불러올 수 없습니다'
      : itemsQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  // KPI는 발전소별 '최신' 진단 기준으로 위험도 발전소 수를 센다(로그 행 수가 아니라 현재 상태).
  const latestByPlant = new Map<number, SafetyItem>();
  for (const it of items) {
    const cur = latestByPlant.get(it.plantId);
    if (!cur || new Date(it.diagnosedAt) > new Date(cur.diagnosedAt)) latestByPlant.set(it.plantId, it);
  }
  const latest = [...latestByPlant.values()];
  const countBy = (lvl: SafetyRiskLevel) => latest.filter((l) => l.riskLevel === lvl).length;

  // 발전소 필터 옵션 — 회사 스코프로 보이는 발전소만(중복 제거).
  const plantOptions = [
    { value: 'all', label: '전체 발전소' },
    ...[...new Map(items.map((i) => [i.plantId, i.plantName])).entries()].map(([id, name]) => ({
      value: String(id),
      label: name,
    })),
  ];

  const filtered = items.filter(
    (i) => (risk === 'all' || i.riskLevel === risk) && (plant === 'all' || String(i.plantId) === plant),
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '안전' }]} />
      <h1 className="text-xl font-bold text-white">안전</h1>
      {guardReason && <p className="text-xs text-amber-400">{guardReason}</p>}

      <StatsGrid columns={3}>
        <StatCard label="위험" value={countBy('warning')} />
        <StatCard label="주의" value={countBy('caution')} />
        <StatCard label="정상" value={countBy('normal')} />
      </StatsGrid>

      <SectionCard
        title="전기안전 진단"
        description={`총 ${filtered.length}건`}
        actions={
          <>
            <div className="w-40">
              <Select options={plantOptions} value={plant} onChange={(e) => setPlant(e.target.value)} />
            </div>
            <div className="w-32">
              <Select
                options={[
                  { value: 'all', label: '전체 상태' },
                  { value: 'normal', label: '정상' },
                  { value: 'caution', label: '주의' },
                  { value: 'warning', label: '위험' },
                ]}
                value={risk}
                onChange={(e) => setRisk(e.target.value as 'all' | SafetyRiskLevel)}
              />
            </div>
          </>
        }
      >
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          defaultSort={{ key: 'diagnosedAt', direction: 'desc' }}
          emptyMessage="전기안전 진단 데이터가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
