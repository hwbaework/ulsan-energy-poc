'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RmsAreaChart, RmsLineChart } from '@/components/ui/Chart';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SourceBadge, StatusBadge, StatusPill } from '@/components/ui/Design';
import { commStatusOf, gradeOf } from '@/lib/design';
import { ArrowLeft, Sun, Thermometer, Wind, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnergySource, PlantStatus, InverterStatus, PlantConnectionStatus } from '@/types/monitoring';
import { isLaseePlant } from '@/constants/plant-mapping';
import { useMonitoringPlantDetail, useMonitoringPlantHistory } from '@/hooks/monitoring/useMonitoring';
import { ConnectionBanner, InverterDetailSection } from '@/components/features/monitoring/InverterPanels';


interface MockPlantDetail {
  id: number;
  name: string;
  type: EnergySource;
  status: PlantStatus;
  capacity: number;
  currentOutput: number;
  address: string;
  manager: string;
  managerPhone: string;
  todayGeneration: number;
  monthGeneration: number;
  expectedGeneration: number;
  irradiance: number;
  irradianceCumulative: number;
  ambientTemp: number;
  moduleTemp: number;
  windSpeed: number;
  realtime: { pvVoltage: number; pvCurrent: number; pvPower: number };
  equipment: {
    id: number;
    name: string;
    type: string;
    output: number;
    capacity: number;
    temp: string;
    status: string;
  }[];
  anomalies: { id: number; title: string; severity: string; detectedAt: string; status: string }[];
  consumers: { id: number; name: string; contractType: string; capacity: number; contractAmount: number }[];
  connectionStatus?: PlantConnectionStatus;
  inverters?: InverterStatus[];
}

const HOURLY = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  output: Math.round(Math.max(0, Math.sin(((i - 4) / 16) * Math.PI) * 400 + Math.random() * 40)),
}));

const FORECAST_DATA = Array.from({ length: 24 }, (_, i) => {
  const base = Math.max(0, Math.sin(((i - 4) / 16) * Math.PI) * 420);
  return {
    time: `${String(i).padStart(2, '0')}:00`,
    actual: i <= 14 ? Math.round(base + (Math.random() - 0.5) * 60) : 0,
    forecast: Math.round(base + (Math.random() - 0.5) * 30),
  };
});

const REALTIME_SERIES = Array.from({ length: 60 }, (_, i) => {
  const min = i;
  const hour = 14;
  return {
    time: `${hour}:${String(min).padStart(2, '0')}`,
    voltage: +(370 + Math.random() * 20).toFixed(1),
    current: +(0.9 + Math.random() * 0.3).toFixed(2),
    power: +(360 + Math.random() * 60).toFixed(1),
  };
});

const MAX_REALTIME_POINTS = 120;

interface RealtimePoint {
  [key: string]: string | number;
  time: string;
  dcPower: number;
  acPower: number;
  dailyEnergy: number;
}

function useRealtimeAccumulator(inverters: InverterStatus[] | undefined) {
  const [points, setPoints] = useState<RealtimePoint[]>([]);
  const lastDataRef = useRef<string>('');

  useEffect(() => {
    if (!inverters || inverters.length === 0) return;
    const latestDataAt = inverters.reduce((latest, inv) => (inv.lastDataAt > latest ? inv.lastDataAt : latest), '');
    if (latestDataAt === lastDataRef.current) return;
    lastDataRef.current = latestDataAt;

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const dcPower = +inverters.reduce((s, inv) => s + inv.dc.power, 0).toFixed(1);
    const acPower = +inverters.reduce((s, inv) => s + inv.ac.power, 0).toFixed(1);
    const dailyEnergy = +inverters.reduce((s, inv) => s + inv.dailyEnergy, 0).toFixed(1);

    setPoints((prev) => [...prev.slice(-(MAX_REALTIME_POINTS - 1)), { time, dcPower, acPower, dailyEnergy }]);
  }, [inverters]);

  return points;
}

/* ── Main Page ── */

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const numId = Number(id);
  const { data: apiPlant, isError } = useMonitoringPlantDetail(numId);
  const realtimeSeries = useRealtimeAccumulator((apiPlant as any)?.inverters);

  const historyRange = useMemo(() => {
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }, []);
  const { data: historyData } = useMonitoringPlantHistory(
    isLaseePlant(numId) ? numId : 0,
    historyRange.from,
    historyRange.to,
  );

  const plant: MockPlantDetail =
    !isError && apiPlant
      ? {
          id: (apiPlant as any).id ?? numId,
          name: (apiPlant as any).name ?? '',
          type: ((apiPlant as any).type ?? 'SOLAR') as EnergySource,
          status: ((apiPlant as any).status ?? 'NORMAL') as PlantStatus,
          capacity: (apiPlant as any).capacity ?? 0,
          currentOutput: (apiPlant as any).currentOutput ?? 0,
          address: (apiPlant as any).address ?? '',
          manager: (apiPlant as any).manager ?? '',
          managerPhone: (apiPlant as any).managerPhone ?? '',
          todayGeneration: (apiPlant as any).dailyEnergy ?? (apiPlant as any).todayGeneration ?? 0,
          monthGeneration: (apiPlant as any).monthGeneration ?? 0,
          expectedGeneration: (apiPlant as any).expectedGeneration ?? 0,
          irradiance: (apiPlant as any).irradiance ?? 0,
          irradianceCumulative: (apiPlant as any).irradianceCumulative ?? 0,
          ambientTemp: (apiPlant as any).ambientTemp ?? 0,
          moduleTemp: (apiPlant as any).moduleTemp ?? 0,
          windSpeed: (apiPlant as any).windSpeed ?? 0,
          realtime: (apiPlant as any).realtime ?? { pvVoltage: 0, pvCurrent: 0, pvPower: 0 },
          equipment: (apiPlant as any).equipment ?? [],
          anomalies: (apiPlant as any).anomalies ?? [],
          consumers: (apiPlant as any).consumers ?? [],
          connectionStatus: (apiPlant as any).connectionStatus,
          inverters: (apiPlant as any).inverters,
        }
      : (undefined as any);
  const [selectedConsumer, setSelectedConsumer] = useState(plant?.consumers?.[0]?.id ?? 0);
  if (!plant) return null;

  const hasLasee = isLaseePlant(plant.id);
  const outputPercent = plant.capacity > 0 ? (plant.currentOutput / plant.capacity) * 100 : 0;
  const genDiff =
    plant.expectedGeneration > 0 ? ((plant.todayGeneration / plant.expectedGeneration - 1) * 100).toFixed(1) : '0';
  const genDiffPositive = Number(genDiff) >= 0;

  const activeConsumer = plant.consumers.find((c) => c.id === selectedConsumer);

  const equipCols: Column<(typeof plant.equipment)[0]>[] = [
    {
      key: 'name',
      header: '설비명',
      width: '140px',
      render: (r) => <span className="text-sm font-medium text-white">{r.name}</span>,
    },
    { key: 'type', header: '유형', render: (r) => <span className="text-sm text-slate-300">{r.type}</span> },
    {
      key: 'output',
      header: '출력',
      render: (r) => (
        <span className="text-sm text-white tabular-nums">
          {r.output} / {r.capacity} kW
        </span>
      ),
    },
    {
      key: 'temp',
      header: '온도',
      render: (r) => <span className="text-sm text-slate-400 tabular-nums">{r.temp}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (r) => (
        <Badge variant={r.status === 'normal' ? 'success' : r.status === 'warning' ? 'warning' : 'danger'}>
          {r.status === 'normal' ? '정상' : r.status === 'warning' ? '주의' : '이상'}
        </Badge>
      ),
    },
  ];

  const anomalyCols: Column<(typeof plant.anomalies)[0]>[] = [
    { key: 'title', header: '이상 내용', render: (r) => <span className="text-sm text-white">{r.title}</span> },
    {
      key: 'severity',
      header: '심각도',
      width: '90px',
      render: (r) => {
        const s = gradeOf(r.severity);
        return <StatusPill tone={s.tone} label={s.label} />;
      },
    },
    {
      key: 'detectedAt',
      header: '감지 시각',
      width: '180px',
      render: (r) => (
        <span className="text-sm text-slate-400 tabular-nums">{new Date(r.detectedAt).toLocaleString('ko-KR')}</span>
      ),
    },
    {
      key: 'status',
      header: '처리',
      width: '90px',
      render: (r) => {
        const s = commStatusOf(r.status);
        return <StatusPill tone={s.tone} label={s.label} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '발전소 상세' }]} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => router.push('/monitoring/plant')} aria-label="발전소 목록으로">
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{plant.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <SourceBadge type={plant.type} />
            <StatusBadge status={plant.status} />
            <span className="text-sm text-slate-400">{plant.address}</span>
          </div>
        </div>
      </div>

      {/* Connection Status Banner (LASEE plants only) */}
      {hasLasee && plant.connectionStatus && (
        <ConnectionBanner status={plant.connectionStatus} />
      )}

      {/* KPI Row */}
      {hasLasee ? (
        /* KPI: 라벨 + 수치 + 단위(값과 같은 색·크기). 퍼센트·아이콘 없음 */
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">현재 출력</p>
            <p className="text-2xl font-bold text-white tabular-nums">{plant.currentOutput.toLocaleString()} kW</p>
            <div className="mt-2">
              <ProgressBar value={outputPercent} variant="success" />
            </div>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">금일 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">{plant.todayGeneration.toLocaleString()} kWh</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">설비 용량</p>
            <p className="text-2xl font-bold text-white tabular-nums">{plant.capacity.toLocaleString()} kW</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">누적 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {((apiPlant as any)?.totalEnergy ?? 0).toLocaleString()} kWh
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">금일 발전시간</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {((apiPlant as any)?.generationHours ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} h
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">금액</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {((apiPlant as any)?.revenueAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} 원
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">현재 출력</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.currentOutput.toLocaleString()} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
            <div className="mt-2">
              <ProgressBar value={outputPercent} variant="success" showValue label="가동률" />
            </div>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">오늘 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.todayGeneration.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
            <div className="flex items-center gap-1 mt-1">
              {genDiffPositive ? (
                <TrendingUp size={12} className="text-emerald-400" />
              ) : (
                <TrendingDown size={12} className="text-red-400" />
              )}
              <span className={cn('text-xs tabular-nums', genDiffPositive ? 'text-emerald-400' : 'text-red-400')}>
                예상 대비 {genDiffPositive ? '+' : ''}
                {genDiff}%
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">오늘 예상 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.expectedGeneration.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">이번 달 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.monthGeneration.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-sm text-slate-300 mb-1">일사량 누적</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.irradianceCumulative} <span className="text-sm font-normal text-slate-500">kWh/m²</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">현재 {plant.irradiance} W/m²</p>
          </div>
        </div>
      )}

      {/* 금일 발전량 추이(전폭) — 비 LASEE 는 현장 정보 + 실시간 계측 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {hasLasee ? null : (
          <div className="rounded-lg border border-accent/20 bg-surface-card p-5 space-y-4">
            <p className="text-sm font-medium text-white">현장 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Sun size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">일사량</p>
                  <p className="text-sm font-medium text-white tabular-nums">{plant.irradiance} W/m²</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <Thermometer size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">외기 온도</p>
                  <p className="text-sm font-medium text-white tabular-nums">{plant.ambientTemp}°C</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                  <Thermometer size={16} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">모듈 온도</p>
                  <p className="text-sm font-medium text-white tabular-nums">{plant.moduleTemp}°C</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Wind size={16} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">풍속</p>
                  <p className="text-sm font-medium text-white tabular-nums">{plant.windSpeed} m/s</p>
                </div>
              </div>
            </div>

            <div className="border-t border-accent/10 pt-4">
              <p className="text-sm font-medium text-white mb-3 flex items-center gap-1.5">
                <Zap size={14} className="text-primary" /> 실시간 계측 데이터
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-slate-500">PV 전압</p>
                  <p className="text-lg font-bold text-white tabular-nums">{plant.realtime.pvVoltage.toFixed(1)}</p>
                  <p className="text-[10px] text-slate-600">V</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-slate-500">PV 전류</p>
                  <p className="text-lg font-bold text-white tabular-nums">{plant.realtime.pvCurrent.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-600">A</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-slate-500">PV 전력</p>
                  <p className="text-lg font-bold text-white tabular-nums">{plant.realtime.pvPower.toFixed(1)}</p>
                  <p className="text-[10px] text-slate-600">kW</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 큰 차트: 금일 발전량 추이 */}
        <div className={hasLasee ? 'lg:col-span-3' : 'lg:col-span-2'}>
          {hasLasee && historyData && historyData.length > 0 ? (
            <RmsAreaChart
              data={historyData.map((p) => ({
                time: new Date(p.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                energy: +p.dailyEnergy.toFixed(1),
              }))}
              xKey="time"
              areas={[{ key: 'energy', name: '누적 발전량 (kWh)', color: '#10B981' }]}
              title="금일 발전량 추이"
              description="최근 24시간"
              height={280}
            />
          ) : !hasLasee ? (
            <RmsLineChart
              data={REALTIME_SERIES}
              xKey="time"
              lines={[
                { key: 'voltage', name: '전압 (V)', color: '#F59E0B' },
                { key: 'current', name: '전류 (A)', color: '#10B981' },
                { key: 'power', name: '전력 (kW)', color: '#3B82F6' },
              ]}
              title="실시간 계측 추이"
              description="최근 1시간"
              height={280}
            />
          ) : (
            <div className="rounded-lg border border-accent/20 bg-surface-card p-8 text-center h-[280px] flex items-center justify-center">
              <p className="text-sm text-slate-500">발전량 데이터를 수집 중입니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 아래 그리드: 실시간 출력 추이 + 24시간 출력 추이 */}
      {hasLasee && historyData && historyData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RmsLineChart
            data={realtimeSeries}
            xKey="time"
            lines={[
              { key: 'dcPower', name: 'DC 전력 (kW)', color: '#F59E0B' },
              { key: 'acPower', name: 'AC 전력 (kW)', color: '#3B82F6' },
            ]}
            title="실시간 출력 추이"
            description="60초 간격 수집"
            height={220}
          />
          <RmsAreaChart
            data={historyData.map((p) => ({
              time: new Date(p.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              output: +p.acPower.toFixed(1),
            }))}
            xKey="time"
            areas={[{ key: 'output', name: 'AC 출력 (kW)', color: '#2563EB' }]}
            title="24시간 출력 추이"
            description="1분 간격 수집"
            height={220}
          />
        </div>
      ) : !hasLasee ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RmsAreaChart
            data={HOURLY}
            xKey="time"
            areas={[{ key: 'output', name: '발전량 (kW)', color: '#2563EB' }]}
            title="24시간 발전 추이"
            height={220}
          />
          <RmsLineChart
            data={FORECAST_DATA}
            xKey="time"
            lines={[
              { key: 'actual', name: '실제 (kW)', color: '#3B82F6' },
              { key: 'forecast', name: '예측 (kW)', color: '#F97316' },
            ]}
            title="예측 오차 추이 (Actual vs Forecast)"
            description="AI 예측 정확도"
            height={220}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-accent/20 bg-surface-card p-8 text-center">
          <p className="text-sm text-slate-500">출력 이력 데이터를 수집 중입니다. 잠시 후 차트가 표시됩니다.</p>
        </div>
      )}

      {/* 인버터 상세 (LASEE plants) */}
      {hasLasee && plant.inverters && plant.inverters.length > 0 && (
        <SectionCard title="인버터 상세 현황" description={`${plant.inverters.length}대`}>
          <InverterDetailSection inverters={plant.inverters} />
        </SectionCard>
      )}

      {/* 설비 현황 (non-LASEE plants or as fallback) */}
      {!hasLasee && (
        <SectionCard title="설비 현황" description={`${plant.equipment.length}대 등록`}>
          <DataTable columns={equipCols} data={plant.equipment} rowKey={(r) => r.id} />
        </SectionCard>
      )}

      {/* 이상감지 + 대상 수용가 (non-LASEE only) */}
      {!hasLasee && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="이상감지" description="최근 7일">
            {plant.anomalies.length > 0 ? (
              <DataTable
                columns={anomalyCols}
                data={plant.anomalies}
                rowKey={(r) => r.id}
              />
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">최근 7일간 이상 감지 내역이 없습니다</p>
            )}
          </SectionCard>

          <SectionCard title="대상 수용가" description={`${plant.consumers.length}개사`}>
            <div className="space-y-4">
              <select
                value={selectedConsumer}
                onChange={(e) => setSelectedConsumer(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-accent/30 bg-surface-dark px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {plant.consumers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {activeConsumer && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-[10px] text-slate-500">계약 유형</p>
                      <Badge variant="primary" className="mt-1">
                        {activeConsumer.contractType}
                      </Badge>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-[10px] text-slate-500">계약 용량</p>
                      <p className="text-sm font-medium text-white tabular-nums mt-1">{activeConsumer.capacity} kW</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                      <p className="text-[10px] text-slate-500">계약 단가</p>
                      <p className="text-sm font-medium text-white tabular-nums mt-1">
                        {activeConsumer.contractAmount} 원/kWh
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push(`/monitoring/consumer/${activeConsumer.id}`)}
                  >
                    수용가 상세보기
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

    </div>
  );
}
