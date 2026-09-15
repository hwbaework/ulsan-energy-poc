'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RmsAreaChart, RmsLineChart, ScrollableChart } from '@/components/ui/Chart';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import {
  ArrowLeft,
  AlertTriangle,
  ClipboardCheck,
  MapPin,
  Phone,
  Sun,
  Thermometer,
  Wind,
  Zap,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Power,
  ChevronDown,
  ChevronUp,
  Radio,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import type { EnergySource, PlantStatus, InverterStatus, PlantConnectionStatus } from '@/types/monitoring';
import { isLaseePlant } from '@/constants/plant-mapping';
import { useMonitoringPlantDetail, useMonitoringPlantHistory } from '@/hooks/monitoring/useMonitoring';

const TYPE_LABELS: Record<EnergySource, string> = {
  SOLAR: '태양광',
  ORC: 'ORC',
  FUEL_CELL: '연료전지',
};

const STATUS_VARIANT: Record<PlantStatus, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  NORMAL: 'success',
  WARNING: 'warning',
  ANOMALY: 'danger',
  MAINTENANCE: 'info',
  OFFLINE: 'default',
};

const STATUS_LABEL: Record<PlantStatus, string> = {
  NORMAL: '정상',
  WARNING: '주의',
  ANOMALY: '이상',
  MAINTENANCE: '점검',
  OFFLINE: '오프라인',
};

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

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
};

const STATUS_MSG_VARIANT: Record<string, 'info' | 'warning' | 'danger'> = {
  Wait: 'info',
  Checking: 'warning',
  Normal: 'info',
  Run: 'info',
};

/* ── Connection Status Banner ── */

function ConnectionBanner({ status, inverters }: { status: PlantConnectionStatus; inverters?: InverterStatus[] }) {
  const normalCount = status.inverterConnections.filter((c) => c.state === 'NORMAL').length;
  const totalCount = status.inverterConnections.length;
  const allNormal = status.rtuPower === 'ON' && status.rtuConnection === 'NORMAL' && normalCount === totalCount;
  const lastData = inverters?.reduce((latest, inv) => (inv.lastDataAt > latest ? inv.lastDataAt : latest), '') ?? '';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex items-center gap-4 flex-wrap',
        allNormal ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <Power size={14} className={status.rtuPower === 'ON' ? 'text-emerald-400' : 'text-red-400'} />
        <span className="text-xs text-slate-300">RTU 전원</span>
        <Badge variant={status.rtuPower === 'ON' ? 'success' : 'danger'}>{status.rtuPower}</Badge>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        {status.rtuConnection === 'NORMAL' ? (
          <Wifi size={14} className="text-emerald-400" />
        ) : (
          <WifiOff size={14} className="text-red-400" />
        )}
        <span className="text-xs text-slate-300">RTU 통신</span>
        <Badge variant={status.rtuConnection === 'NORMAL' ? 'success' : 'danger'}>
          {status.rtuConnection === 'NORMAL' ? '정상' : '오류'}
        </Badge>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <Radio size={14} className={normalCount === totalCount ? 'text-emerald-400' : 'text-amber-400'} />
        <span className="text-xs text-slate-300">인버터 통신</span>
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            normalCount === totalCount ? 'text-emerald-400' : 'text-amber-400',
          )}
        >
          {normalCount}/{totalCount} 정상
        </span>
      </div>

      {lastData && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Activity size={10} /> 마지막 수집: {lastData}
          </span>
        </>
      )}
    </div>
  );
}

/* ── Inverter Detail Table ── */

function InverterDetailSection({ inverters }: { inverters: InverterStatus[] }) {
  const [expandedInv, setExpandedInv] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<number>(inverters[0]?.number ?? 0);

  const totalDailyEnergy = inverters.reduce((s, inv) => s + inv.dailyEnergy, 0);
  const totalAcPower = inverters.reduce((s, inv) => s + inv.ac.power, 0);

  const alertInverters = inverters.filter((inv) => inv.statusMessages.length > 0 || inv.connectionState === 'ERROR');

  return (
    <div className="space-y-4">
      {/* Status Messages Alert */}
      {alertInverters.length > 0 && (
        <div className="space-y-2">
          {alertInverters.map((inv) => (
            <div
              key={`alert-${inv.number}`}
              className={cn(
                'rounded-lg border p-3 flex items-start gap-3',
                inv.connectionState === 'ERROR'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-amber-500/30 bg-amber-500/5',
              )}
            >
              <AlertTriangle
                size={14}
                className={inv.connectionState === 'ERROR' ? 'text-red-400 mt-0.5' : 'text-amber-400 mt-0.5'}
              />
              <div>
                <p className="text-xs font-medium text-white">
                  INV-{String(inv.number).padStart(3, '0')}
                  {inv.connectionState === 'ERROR' && ' — 통신 오류'}
                </p>
                {inv.statusMessages.length > 0 && (
                  <div className="flex gap-1.5 mt-1">
                    {inv.statusMessages.map((msg) => (
                      <Badge key={msg} variant={STATUS_MSG_VARIANT[msg] ?? 'danger'}>
                        {msg}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {/* 인버터 수: 데이터에서 직접 카운트 */}
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
          <p className="text-[10px] text-slate-500">인버터 수</p>
          <p className="text-lg font-bold text-white tabular-nums">
            {inverters.length}
            <span className="text-xs font-normal text-slate-500">대</span>
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
          <p className="text-[10px] text-slate-500">총 AC 출력</p>
          <p className="text-lg font-bold text-white tabular-nums">{totalAcPower.toFixed(1)}</p>
          <p className="text-[10px] text-slate-600">kW</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
          <p className="text-[10px] text-slate-500">금일 합산 발전</p>
          <p className="text-lg font-bold text-white tabular-nums">{totalDailyEnergy.toFixed(1)}</p>
          <p className="text-[10px] text-slate-600">kWh</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
          <p className="text-[10px] text-slate-500">평균 역률</p>
          <p className="text-lg font-bold text-slate-500 tabular-nums">-</p>
        </div>
      </div>

      {/* Inverter Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left">
            <tr className="border-b border-white/10">
              <th className="text-left text-slate-400 font-medium py-2 px-3">인버터</th>
              <th className="text-slate-400 font-medium py-2 px-3">DC전압</th>
              <th className="text-slate-400 font-medium py-2 px-3">DC전류</th>
              <th className="text-slate-400 font-medium py-2 px-3">DC전력</th>
              <th className="text-slate-400 font-medium py-2 px-3">AC전력</th>
              <th className="text-slate-400 font-medium py-2 px-3">역률</th>
              <th className="text-slate-400 font-medium py-2 px-3">주파수</th>
              <th className="text-slate-400 font-medium py-2 px-3">일발전</th>
              <th className="text-slate-400 font-medium py-2 px-3">통신</th>
              <th className="text-slate-400 font-medium py-2 px-3">상태</th>
              <th className="py-2 px-1 w-8" />
            </tr>
          </thead>
          <tbody>
            {inverters.map((inv) => (
              <Fragment key={inv.number}>
                <tr
                  className={cn(
                    'border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors',
                    expandedInv === inv.number && 'bg-white/[0.03]',
                  )}
                  onClick={() => setExpandedInv(expandedInv === inv.number ? null : inv.number)}
                >
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-white">INV-{String(inv.number).padStart(3, '0')}</span>
                    <span className="text-slate-500 ml-1.5">{inv.capacity}kW</span>
                  </td>
                  {/* DC전압: LASEE 미제공 — 백엔드 추가 시 inv.dc.voltage 사용 */}
                  <td className="py-2.5 px-3 text-slate-500">-</td>
                  {/* DC전류: LASEE 미제공 */}
                  <td className="py-2.5 px-3 text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-white tabular-nums">{inv.dc.power.toFixed(1)} kW</td>
                  <td className="py-2.5 px-3 text-white tabular-nums">{inv.ac.power.toFixed(1)} kW</td>
                  <td className="py-2.5 px-3 text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-white tabular-nums">{inv.dailyEnergy.toFixed(1)} kWh</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={cn(
                        'inline-flex h-2 w-2 rounded-full',
                        inv.connectionState === 'NORMAL' ? 'bg-emerald-500' : 'bg-red-500',
                      )}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    {inv.statusMessages.length > 0 ? (
                      <Badge variant={STATUS_MSG_VARIANT[inv.statusMessages[0] as string] ?? 'danger'}>
                        {inv.statusMessages[0]}
                      </Badge>
                    ) : (
                      <Badge variant="success">정상</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-1">
                    {expandedInv === inv.number ? (
                      <ChevronUp size={12} className="text-slate-500" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-500" />
                    )}
                  </td>
                </tr>
                {/* AC 3-phase expanded row */}
                {expandedInv === inv.number && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={11} className="px-3 py-3">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* AC Voltage 3-phase */}
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                          <p className="text-[10px] text-slate-500 mb-2">AC 전압 (3상)</p>
                          <div className="space-y-1.5">
                            {(['R', 'S', 'T'] as const).map((phase) => {
                              const key = `volt${phase}` as 'voltR' | 'voltS' | 'voltT';
                              return (
                                <div key={phase} className="flex items-center justify-between">
                                  <span
                                    className={cn(
                                      'text-[10px] font-medium w-4',
                                      phase === 'R'
                                        ? 'text-red-400'
                                        : phase === 'S'
                                          ? 'text-amber-400'
                                          : 'text-blue-400',
                                    )}
                                  >
                                    {phase}
                                  </span>
                                  <span className="text-xs text-white tabular-nums">{inv.ac[key].toFixed(1)} V</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* AC Current 3-phase */}
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                          <p className="text-[10px] text-slate-500 mb-2">AC 전류 (3상)</p>
                          <div className="space-y-1.5">
                            {(['R', 'S', 'T'] as const).map((phase) => {
                              const key = `current${phase}` as 'currentR' | 'currentS' | 'currentT';
                              return (
                                <div key={phase} className="flex items-center justify-between">
                                  <span
                                    className={cn(
                                      'text-[10px] font-medium w-4',
                                      phase === 'R'
                                        ? 'text-red-400'
                                        : phase === 'S'
                                          ? 'text-amber-400'
                                          : 'text-blue-400',
                                    )}
                                  >
                                    {phase}
                                  </span>
                                  <span className="text-xs text-white tabular-nums">{inv.ac[key].toFixed(1)} A</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Additional info */}
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                          <p className="text-[10px] text-slate-500 mb-2">상세 정보</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">누적 발전</span>
                              <span className="text-xs text-white tabular-nums">
                                {inv.totalEnergy.toLocaleString()} kWh
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">마지막 수집</span>
                              <span className="text-[10px] text-slate-300">{inv.lastDataAt}</span>
                            </div>
                            {inv.statusMessages.length > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400">상태 메시지</span>
                                <span className="text-[10px] text-amber-400">{inv.statusMessages.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-inverter realtime tab */}
      <div className="border-t border-accent/10 pt-4">
        <p className="text-sm font-medium text-white mb-3 flex items-center gap-1.5">
          <Zap size={14} className="text-primary" /> 인버터별 실시간 계측
        </p>
        <div className="flex gap-1 mb-3">
          {inverters.map((inv) => (
            <button
              key={inv.number}
              onClick={() => setActiveTab(inv.number)}
              className={cn(
                'px-3.5 rounded-md text-xs font-medium transition-colors',
                activeTab === inv.number
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              INV-{String(inv.number).padStart(3, '0')}
              <span
                className={cn(
                  'ml-1.5 inline-flex h-1.5 w-1.5 rounded-full',
                  inv.connectionState === 'NORMAL' ? 'bg-emerald-500' : 'bg-red-500',
                )}
              />
            </button>
          ))}
        </div>
        {(() => {
          const inv = inverters.find((i) => i.number === activeTab);
          if (!inv) return null;
          return (
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {/* DC 전압: LASEE 미제공 */}
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-slate-500">DC 전압</p>
                <p className="text-lg font-bold text-slate-500 tabular-nums">-</p>
                <p className="text-[10px] text-slate-600">V</p>
              </div>
              {/* DC 전류: LASEE 미제공 */}
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-slate-500">DC 전류</p>
                <p className="text-lg font-bold text-slate-500 tabular-nums">-</p>
                <p className="text-[10px] text-slate-600">A</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-slate-500">DC 전력</p>
                <p className="text-lg font-bold text-white tabular-nums">{inv.dc.power.toFixed(1)}</p>
                <p className="text-[10px] text-slate-600">kW</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-slate-500">AC 전력</p>
                <p className="text-lg font-bold text-white tabular-nums">{inv.ac.power.toFixed(1)}</p>
                <p className="text-[10px] text-slate-600">kW</p>
              </div>
              {/* 역률: LASEE 미제공 */}
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-slate-500">역률</p>
                <p className="text-lg font-bold text-slate-500 tabular-nums">-</p>
                <p className="text-[10px] text-slate-600">PF</p>
              </div>
              {/* 주파수: LASEE 미제공 */}
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-slate-500">주파수</p>
                <p className="text-lg font-bold text-slate-500 tabular-nums">-</p>
                <p className="text-[10px] text-slate-600">Hz</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
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
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectNote, setInspectNote] = useState('');
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
    { key: 'title', header: '이상유형', render: (r) => <span className="text-sm text-white">{r.title}</span> },
    {
      key: 'severity',
      header: '심각도',
      width: '80px',
      render: (r) => <Badge variant={SEVERITY_VARIANT[r.severity] ?? 'default'}>{r.severity}</Badge>,
    },
    {
      key: 'detectedAt',
      header: '감지 시간',
      render: (r) => (
        <span className="text-sm text-slate-400 tabular-nums">{new Date(r.detectedAt).toLocaleString('ko-KR')}</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (r) => <Badge variant="default">{r.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Breadcrumb items={[{ label: '모니터링', path: '/monitoring' }, { label: '발전소 상세' }]} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => router.push('/monitoring')}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{plant.name}</h1>
            <Badge variant="primary">{TYPE_LABELS[plant.type]}</Badge>
            <Badge variant={STATUS_VARIANT[plant.status]}>{STATUS_LABEL[plant.status]}</Badge>
            {hasLasee && <Badge variant="info">LASEE 연동</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-0.5">
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <MapPin size={12} /> {plant.address}
            </p>
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <Phone size={12} /> {plant.manager} ({plant.managerPhone})
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setActionModalOpen(true)}>
            <ClipboardCheck size={14} className="mr-1" /> 조치 기록
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setInspectModalOpen(true)}>
            <AlertTriangle size={14} className="mr-1" /> 현장 점검 요청
          </Button>
        </div>
      </div>

      {/* Connection Status Banner (LASEE plants only) */}
      {hasLasee && plant.connectionStatus && (
        <ConnectionBanner status={plant.connectionStatus} inverters={plant.inverters} />
      )}

      {/* KPI Row */}
      {hasLasee ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">현재 출력</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.currentOutput.toLocaleString()} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
            <div className="mt-2">
              <ProgressBar
                value={outputPercent}
                variant={outputPercent > 70 ? 'success' : outputPercent > 30 ? 'warning' : 'danger'}
                showValue
                label="가동률"
              />
            </div>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">금일 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.todayGeneration.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">설비 용량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.capacity.toLocaleString()} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">인버터 {plant.inverters?.length ?? 0}대</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">누적 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {((apiPlant as any)?.totalEnergy ?? 0).toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">금일 발전시간</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {((apiPlant as any)?.generationHours ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
              <span className="text-sm font-normal text-slate-500">h</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              예상 일조 ({((apiPlant as any)?.expectedHours ?? 0).toFixed(2)}h/일)
            </p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">금액</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {((apiPlant as any)?.revenueAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
              <span className="text-sm font-normal text-slate-500">원</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">금일 발전량 기준</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">현재 출력</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.currentOutput.toLocaleString()} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
            <div className="mt-2">
              <ProgressBar
                value={outputPercent}
                variant={outputPercent > 70 ? 'success' : outputPercent > 30 ? 'warning' : 'danger'}
                showValue
                label="가동률"
              />
            </div>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">오늘 발전량</p>
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
            <p className="text-xs text-accent mb-1">오늘 예상 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.expectedGeneration.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">AI 예측 기반</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">이번 달 발전량</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.monthGeneration.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">누적 (4월)</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
            <p className="text-xs text-accent mb-1">일사량 누적</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {plant.irradianceCumulative} <span className="text-sm font-normal text-slate-500">kWh/m²</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">현재 {plant.irradiance} W/m²</p>
          </div>
        </div>
      )}

      {/* 이상감지 + 실시간 계측 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {hasLasee ? (
          <SectionCard title="이상감지" description="최근 7일">
            {plant.anomalies.length > 0 ? (
              <DataTable
                columns={anomalyCols}
                data={plant.anomalies}
                rowKey={(r) => r.id}
                onRowClick={(r) => router.push(`/monitoring/anomalies/${r.id}`)}
              />
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">최근 7일간 이상 감지 내역이 없습니다</p>
            )}
          </SectionCard>
        ) : (
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

        {/* 큰 차트: 금일 발전량 추이 (스크롤/휠로 확대·축소) */}
        <div className="lg:col-span-2">
          {hasLasee && historyData && historyData.length > 0 ? (
            <ScrollableChart
              data={historyData.map((p) => ({
                time: new Date(p.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                energy: +p.dailyEnergy.toFixed(1),
              }))}
              xKey="time"
              lines={[{ key: 'energy', name: '누적 발전량 (kWh)', color: '#10B981', type: 'area' }]}
              title="금일 발전량 추이"
              description="스크롤/휠로 확대·축소"
              height={280}
              initialWindow={60}
              minWindow={10}
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
            description="LASEE 60초 간격 수집"
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
        <SectionCard title="인버터 상세 현황" description={`${plant.inverters.length}대 · LASEE 실시간 연동`}>
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
                onRowClick={(r) => router.push(`/monitoring/anomalies/${r.id}`)}
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

      <Modal open={actionModalOpen} onClose={() => setActionModalOpen(false)} title="조치 기록" size="md">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">
              발전소: <span className="text-white font-medium">{plant.name}</span>
            </p>
            <p className="text-xs text-slate-400">
              현재 상태: <Badge variant={STATUS_VARIANT[plant.status]}>{STATUS_LABEL[plant.status]}</Badge>
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">조치 내용</label>
            <textarea
              rows={4}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="수행한 조치 내용을 입력하세요..."
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setActionModalOpen(false)}>
              취소
            </Button>
            <Button
              disabled={!actionNote.trim()}
              onClick={() => {
                useToastStore.getState().add('success', '조치 기록이 저장되었습니다');
                setActionNote('');
                setActionModalOpen(false);
              }}
            >
              저장
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={inspectModalOpen} onClose={() => setInspectModalOpen(false)} title="현장 점검 요청" size="md">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">
              발전소: <span className="text-white font-medium">{plant.name}</span>
            </p>
            <p className="text-xs text-slate-400">
              담당자: {plant.manager} ({plant.managerPhone})
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">점검 요청 사유</label>
            <textarea
              rows={4}
              value={inspectNote}
              onChange={(e) => setInspectNote(e.target.value)}
              placeholder="점검이 필요한 사유를 입력하세요..."
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setInspectModalOpen(false)}>
              취소
            </Button>
            <Button
              disabled={!inspectNote.trim()}
              onClick={() => {
                useToastStore.getState().add('success', `${plant.manager}에게 현장 점검 요청을 발송했습니다`);
                setInspectNote('');
                setInspectModalOpen(false);
              }}
            >
              요청 발송
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
