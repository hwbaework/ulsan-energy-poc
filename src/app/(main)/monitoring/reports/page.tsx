'use client';

import { useState, useMemo } from 'react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RmsBarChart, RmsLineChart } from '@/components/ui/Chart';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';

import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Download } from 'lucide-react';
import { exportPdf } from '@/lib/utils';
import { useQueries } from '@tanstack/react-query';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useReportSummary } from '@/hooks/monitoring/useReadings';
import * as readingApi from '@/api/monitoring/readings';
import { usePowerStations } from '@/hooks/common/usePowerStations';
import { filterPlantsByOwnership, useMyPlantMatcher } from '@/hooks/monitoring/useMyPlantFilter';

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export default function ReportsPage() {
  const defaults = defaultDateRange();
  const [station, setStation] = useState('all');
  const [startDate, setStartDate] = useState(defaults.from);
  const [endDate, setEndDate] = useState(defaults.to);

  const { data: stationsRaw } = usePowerStations({ size: 200 } as any);
  const { data: anomalyData } = useAnomalies();
  const myPlantMatcher = useMyPlantMatcher();

  const myStations = useMemo(() => {
    const list = (stationsRaw as any)?.content ?? (Array.isArray(stationsRaw) ? stationsRaw : []);
    return filterPlantsByOwnership(
      list.map((s: any) => ({ ...s, plantId: s.externalPlantId ? Number(s.externalPlantId) : undefined })),
      myPlantMatcher,
    );
  }, [stationsRaw, myPlantMatcher]);

  const myStationIds = useMemo(() => myStations.map((s: any) => s.id as number), [myStations]);

  const stationOptions = useMemo(() => {
    const opts = [{ value: 'all', label: '전체 발전소' }];
    myStations.forEach((s: any) => opts.push({ value: String(s.id), label: s.name }));
    return opts;
  }, [myStations]);

  const isGeneratorAll = station === 'all' && !!myPlantMatcher && myStationIds.length > 0;
  const useMulti = isGeneratorAll && myStationIds.length > 1;

  const singleParams = useMemo(() => {
    if (isGeneratorAll && myStationIds.length > 1) return null;
    const p: { from: string; to: string; powerStationId?: number } = { from: startDate, to: endDate };
    if (station !== 'all') {
      p.powerStationId = Number(station);
    } else if (isGeneratorAll) {
      p.powerStationId = myStationIds[0];
    }
    return p;
  }, [station, startDate, endDate, isGeneratorAll, myStationIds]);
  const { data: singleReport, isLoading: singleLoading } = useReportSummary(singleParams ?? { from: '', to: '' });

  const multiQueries = useQueries({
    queries: useMulti
      ? myStationIds.map((id) => ({
          queryKey: ['readings', 'report-summary', { from: startDate, to: endDate, powerStationId: id }],
          queryFn: () => readingApi.getReportSummary({ from: startDate, to: endDate, powerStationId: id }),
          staleTime: 60_000,
        }))
      : [],
  });

  const reportData = useMemo(() => {
    if (useMulti) {
      const merged = new Map<
        string,
        { solar: number; orc: number; fuelCell: number; effSum: number; effCount: number }
      >();
      for (const q of multiQueries) {
        if (!q.data) continue;
        for (const r of q.data) {
          const key = r.date;
          const prev = merged.get(key) ?? { solar: 0, orc: 0, fuelCell: 0, effSum: 0, effCount: 0 };
          prev.solar += r.solar;
          prev.orc += r.orc;
          prev.fuelCell += r.fuelCell;
          prev.effSum += r.efficiency;
          prev.effCount += 1;
          merged.set(key, prev);
        }
      }
      return [...merged.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          solar: v.solar,
          orc: v.orc,
          fuelCell: v.fuelCell,
          efficiency: v.effCount > 0 ? Math.round((v.effSum / v.effCount) * 10) / 10 : 0,
        }));
    }
    return singleReport ?? [];
  }, [isGeneratorAll, myStationIds.length, multiQueries, singleReport]);

  const isLoading = useMulti ? multiQueries.some((q) => q.isLoading) : singleLoading;

  const dailyData = useMemo(() => {
    if (!reportData?.length) return [];
    return reportData.map((r: any) => ({
      date: r.date.slice(5).replace('-', '/'),
      solar: Math.round(r.solar),
      orc: Math.round(r.orc),
      fuelCell: Math.round(r.fuelCell),
    }));
  }, [reportData]);

  const efficiencyData = useMemo(() => {
    if (!reportData?.length) return [];
    return reportData.map((r: any) => ({
      date: r.date.slice(5).replace('-', '/'),
      efficiency: r.efficiency,
    }));
  }, [reportData]);

  const totalGeneration = dailyData.reduce((s, d) => s + d.solar + d.orc + d.fuelCell, 0);
  const avgEfficiency =
    efficiencyData.length > 0
      ? (efficiencyData.reduce((s, d) => s + d.efficiency, 0) / efficiencyData.length).toFixed(1)
      : '0.0';
  const anomalyCount = anomalyData?.content?.length ?? 0;
  const dayCount = dailyData.length || 1;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '보고서' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">보고서</h1>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            exportPdf(
              `발전보고서-${startDate}-${endDate}`,
              `발전 현황 보고서 (${startDate} ~ ${endDate})`,
              ['일자', '태양광(kWh)', 'ORC(kWh)', '연료전지(kWh)'],
              dailyData.map((d) => [d.date, String(d.solar), String(d.orc), String(d.fuelCell)]),
            )
          }
        >
          <Download size={14} className="mr-1" /> 보고서 내보내기
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-44">
          <Select options={stationOptions} value={station} onChange={(e) => setStation(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <span className="text-slate-500">~</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          label="총 발전량"
          value={isLoading ? '...' : `${(totalGeneration / 1000).toFixed(1)} MWh`}
        />
        <StatCard
          label="평균 효율"
          value={isLoading ? '...' : `${avgEfficiency}%`}
        />
        <StatCard
          label="이상 감지"
          value={`${anomalyCount}건`}
        />
        <StatCard
          label="일평균 발전량"
          value={isLoading ? '...' : `${(totalGeneration / dayCount / 1000).toFixed(1)} MWh`}
        />
      </StatsGrid>

      <SectionCard title="일별 발전량" description="에너지원별 일간 발전량 (kWh)">
        {dailyData.length === 0 && !isLoading ? (
          <p className="py-12 text-center text-slate-500">해당 기간의 발전 데이터가 없습니다</p>
        ) : (
          <RmsBarChart
            data={dailyData}
            xKey="date"
            bars={[
              { key: 'solar', name: '태양광', color: '#F59E0B' },
              { key: 'orc', name: 'ORC', color: '#10B981' },
              { key: 'fuelCell', name: '연료전지', color: '#8B5CF6' },
            ]}
            height={320}
          />
        )}
      </SectionCard>

      <SectionCard title="효율 추이" description="일간 평균 발전 효율 (%)">
        {efficiencyData.length === 0 && !isLoading ? (
          <p className="py-12 text-center text-slate-500">해당 기간의 효율 데이터가 없습니다</p>
        ) : (
          <RmsLineChart
            data={efficiencyData}
            xKey="date"
            lines={[{ key: 'efficiency', name: '효율 (%)', color: '#2563EB' }]}
            height={280}
          />
        )}
      </SectionCard>
    </div>
  );
}
