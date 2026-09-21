'use client';

import { useState, useMemo } from 'react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';

import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { RmsBarChart } from '@/components/ui/Chart';
import { usePlantPerformance, usePlantComparison } from '@/hooks/monitoring/usePerformance';
import { LASEE_PLANTS } from '@/constants/plant-mapping';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

export default function PlantPerformancePage() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [from, setFrom] = useState<string>(formatDate(monthAgo));
  const [to, setTo] = useState<string>(formatDate(today));
  const myPlantMatcher = useMyPlantMatcher();

  const myPlants = useMemo(() => {
    const mapped = LASEE_PLANTS.map((p) => ({ ...p, plantId: p.laseeId, name: p.name }));
    return filterPlantsByOwnership(mapped, myPlantMatcher);
  }, [myPlantMatcher]);

  const [selectedPlant, setSelectedPlant] = useState(LASEE_PLANTS[0]?.laseeId ?? 0);

  const detailQuery = usePlantPerformance(selectedPlant, from, to);
  const detail = detailQuery.data;
  const compareQuery = usePlantComparison(from, to);
  const allComparisons = compareQuery.data ?? [];

  const comparisons = useMemo(() => {
    return filterPlantsByOwnership(
      allComparisons.map((p: any) => ({ ...p, plantId: p.plantId, name: p.name })),
      myPlantMatcher,
    );
  }, [allComparisons, myPlantMatcher]);

  const barData = comparisons.map((p: any) => ({
    name: p.name?.replace(/울산\s*/, '') ?? `Plant-${p.plantId}`,
    이용률: p.capacityFactorPct ?? 0,
    PR: p.performanceRatioPct ?? 0,
  }));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '성능 분석' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">발전소 성능 분석</h1>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-slate-200"
          />
          <span className="text-slate-500 self-center">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-slate-200"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {myPlants.map((p) => (
          <button
            key={p.laseeId}
            onClick={() => setSelectedPlant(p.laseeId)}
            className={`h-8 px-3.5 inline-flex items-center rounded-lg text-xs font-medium transition-colors border ${
              selectedPlant === p.laseeId
                ? 'bg-primary text-white border-primary'
                : 'bg-white/[0.02] text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            {p.name.replace(/울산\s*/, '')}
          </button>
        ))}
      </div>

      {detail && (
        <StatsGrid columns={4}>
          <StatCard
            label="이용률 (CF)"
            value={`${detail.capacityFactorPct}%`}
            sub={detail.period}
          />
          <StatCard
            label="성능비 (PR)"
            value={`${detail.performanceRatioPct}%`}
          />
          <StatCard
            label="총 발전량"
            value={`${(detail.totalGenerationKwh / 1000).toFixed(1)} MWh`}
          />
          <StatCard
            label="피크 출력"
            value={`${detail.peakOutputKw.toFixed(1)} kW`}
            sub={`평균 ${detail.avgOutputKw.toFixed(1)} kW`}
          />
        </StatsGrid>
      )}

      <SectionCard title="발전소 간 성능 비교" description={`${from} ~ ${to}`}>
        {barData.length > 0 ? (
          <div className="px-2 py-2">
            <RmsBarChart
              data={barData}
              xKey="name"
              bars={[
                { key: '이용률', name: '이용률 CF (%)', color: '#10B981' },
                { key: 'PR', name: '성능비 PR (%)', color: '#3B82F6' },
              ]}
              height={300}
            />
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-sm">데이터 로딩 중...</div>
        )}
      </SectionCard>

      {comparisons.length > 0 && (
        <SectionCard title="상세 비교 테이블">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                <tr>
                  <th className="px-4 py-3 font-medium">발전소</th>
                  <th className="px-4 py-3 font-medium text-right">용량(kW)</th>
                  <th className="px-4 py-3 font-medium text-right">발전량(MWh)</th>
                  <th className="px-4 py-3 font-medium text-right">이용률(%)</th>
                  <th className="px-4 py-3 font-medium text-right">PR(%)</th>
                  <th className="px-4 py-3 font-medium text-right">피크(kW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {comparisons.map((p: any) => (
                  <tr key={p.plantId} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white">{p.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                      {p.capacityKw?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                      {(p.totalGenerationKwh / 1000).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.capacityFactorPct > 15 ? 'success' : 'warning'}>{p.capacityFactorPct}%</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.performanceRatioPct > 80 ? 'success' : 'warning'}>
                        {p.performanceRatioPct}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{p.peakOutputKw?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
