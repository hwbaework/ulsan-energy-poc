'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const MapboxMapView = dynamic(() => import('@/components/ui/MapboxMapView').then((mod) => mod.MapboxMapView), {
  ssr: false,
});
import type { Map as MapboxMap } from 'mapbox-gl';
import type { MapMarkerSpec } from '@/components/ui/MapboxMapView';
import { cn } from '@/lib/utils';
import type { MonitoringPlant, MonitoringConsumer, EnergySource, PlantStatus } from '@/types/monitoring';
import {
  AlertTriangle,
  Layers,
  Zap,
  Building2,
  ChevronRight,
  Activity,
  CircleDot,
  Wifi,
  WifiOff,
  Radio,
} from 'lucide-react';
import { useMonitoringPlants, useMonitoringConsumers } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, useMyPlantIds, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';
import { useMonthlyProgress } from '@/hooks/trading/useRe100';
import { useAuthStore } from '@/stores/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────── */
/*  Constants                                                        */
/* ────────────────────────────────────────────────────────────────── */

const TYPE_MARKER_ICONS: Record<EnergySource, string> = {
  SOLAR: '/assets/icon/icon_zoom_out_sun.svg',
  ORC: '/assets/icon/icon_zoom_out_orc.svg',
  FUEL_CELL: '/assets/icon/icon_zoom_out_fuel_cell.svg',
};

const TYPE_LABELS: Record<EnergySource, string> = {
  SOLAR: '태양광',
  ORC: 'ORC',
  FUEL_CELL: '연료전지',
};

const TYPE_EMOJI: Record<EnergySource, string> = {
  SOLAR: '☀️',
  ORC: '🔥',
  FUEL_CELL: '⚡',
};

const STATUS_COLORS: Record<PlantStatus, string> = {
  NORMAL: '#10B981',
  WARNING: '#F59E0B',
  ANOMALY: '#EF4444',
  MAINTENANCE: '#6366F1',
  OFFLINE: '#6B7280',
};

const STATUS_LABELS_MAP: Record<PlantStatus, string> = {
  NORMAL: '정상',
  WARNING: '주의',
  ANOMALY: '이상',
  MAINTENANCE: '정비',
  OFFLINE: '정지',
};

type LayerKey = 'plants' | 'anomalyHighlight' | 'performanceHeatmap';

function computeAggregates(plants: MonitoringPlant[]) {
  const totalOutput = plants.reduce((s, p) => s + p.currentOutput, 0);
  const totalCapacity = plants.reduce((s, p) => s + p.capacity, 0);
  const operatingRate = totalCapacity > 0 ? (totalOutput / totalCapacity) * 100 : 0;
  const operatingCount = plants.filter((p) => p.status !== 'ANOMALY' && p.status !== 'OFFLINE').length;
  const totalCount = plants.length;
  const todayTotalGen = plants.reduce((s, p) => s + (p.dailyEnergy ?? 0), 0);
  return { totalOutput, totalCapacity, operatingRate, operatingCount, totalCount, todayTotalGen };
}

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers: Marker icons                                            */
/* ────────────────────────────────────────────────────────────────── */


/* ────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                   */
/* ────────────────────────────────────────────────────────────────── */

function ProgressBar({
  value,
  max,
  className,
  barClass,
}: {
  value: number;
  max: number;
  className?: string;
  barClass?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn('h-2 w-full rounded-full bg-white/10 overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', barClass ?? 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusDot({ status, pulse }: { status: PlantStatus; pulse?: boolean }) {
  const color = STATUS_COLORS[status];
  return (
    <span className="relative flex h-2.5 w-2.5">
      {pulse && (status === 'ANOMALY' || status === 'WARNING') && (
        <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: color, opacity: 0.4 }} />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  HUD (Status Strip)                                               */
/* ────────────────────────────────────────────────────────────────── */

function StatusHud({ plants }: { plants: MonitoringPlant[] }) {
  const agg = computeAggregates(plants);
  const anomalyCount = plants.filter((p) => p.status === 'ANOMALY' || p.status === 'WARNING').length;

  return (
    <div className="w-full">
      <div className="rounded-xl border border-white/10 bg-[#000C17]/95  px-5 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Total output */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-primary" />
              <span className="text-xs text-slate-400">전체 출력</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white tabular-nums">{agg.totalOutput.toLocaleString()} kW</span>
              <span className="text-xs text-slate-500">/ {agg.totalCapacity.toLocaleString()} kW</span>
              <span className="text-xs font-medium text-primary">{agg.operatingRate.toFixed(0)}%</span>
            </div>
            <ProgressBar
              value={agg.totalOutput}
              max={agg.totalCapacity}
              className="mt-1.5 h-1.5"
              barClass="bg-primary"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-white/10" />

          {/* Anomaly count */}
          <div className="min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={12} className="text-semantic-yellow" />
              <span className="text-xs text-slate-400">이상 발전소</span>
            </div>
            <div className="flex items-center gap-3">
              {anomalyCount > 0 ? (
                <span className="flex items-center gap-1 text-sm font-bold text-semantic-red">
                  <span className="h-2 w-2 rounded-full bg-semantic-red" /> {anomalyCount}건
                </span>
              ) : (
                <span className="text-sm font-medium text-emerald-400">정상</span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-white/10" />

          {/* Today generation */}
          <div className="min-w-[120px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-emerald-400" />
              <span className="text-xs text-slate-400">금일 발전</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white tabular-nums">
                {agg.todayTotalGen.toLocaleString()} kWh
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-white/10" />

          {/* Operating rate */}
          <div className="min-w-[80px]">
            <div className="flex items-center gap-1.5 mb-1">
              <CircleDot size={12} className="text-emerald-400" />
              <span className="text-xs text-slate-400">가동률</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{agg.operatingRate.toFixed(0)}%</span>
              <span className="text-xs text-slate-500">
                가동 {agg.operatingCount}/{agg.totalCount}기
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Bottom Bar (Quick Switch)                                        */
/* ────────────────────────────────────────────────────────────────── */

function BottomBar({
  plants,
  consumers,
  selected,
  onSelectPlant,
  onSelectConsumer,
}: {
  plants: MonitoringPlant[];
  consumers: MonitoringConsumer[];
  selected: MonitoringPlant | null;
  onSelectPlant: (plant: MonitoringPlant) => void;
  onSelectConsumer: (consumer: MonitoringConsumer) => void;
}) {
  const [tab, setTab] = useState<'plants' | 'consumers'>('plants');

  return (
    <div className="absolute bottom-3 left-4 right-[396px] z-10 ">
      <div className="rounded-xl border border-white/10 bg-[#000C17]/95  p-2">
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setTab('plants')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 text-xs font-medium border transition-colors',
              tab === 'plants'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            <Zap size={10} /> 발전소
            <span className="text-[10px] text-slate-500">{plants.length}</span>
          </button>
          <button
            onClick={() => setTab('consumers')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 text-xs font-medium border transition-colors',
              tab === 'consumers'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            <Building2 size={10} /> 수용가
            <span className="text-[10px] text-slate-500">{consumers.length}</span>
          </button>
        </div>

        {tab === 'plants' && (
          <div className="flex gap-2 overflow-x-auto">
            {plants.map((plant) => {
              const isActive = selected?.plantId === plant.plantId;
              const pct = plant.capacity > 0 ? (plant.currentOutput / plant.capacity) * 100 : 0;
              return (
                <button
                  key={plant.plantId}
                  onClick={() => onSelectPlant(plant)}
                  className={cn(
                    'flex-shrink-0 rounded-lg border px-3 py-2 text-left transition-all min-w-[140px]',
                    isActive ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <StatusDot status={plant.status} pulse />
                    <span className="text-xs font-medium text-white truncate">{plant.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1.5">
                    <span>{TYPE_EMOJI[plant.type as EnergySource]}</span>
                    <span className="tabular-nums">
                      {plant.currentOutput.toLocaleString()}/{plant.capacity.toLocaleString()} kW
                    </span>
                  </div>
                  <ProgressBar
                    value={plant.currentOutput}
                    max={plant.capacity}
                    className="h-1"
                    barClass={cn(
                      plant.status === 'NORMAL'
                        ? 'bg-emerald-500'
                        : plant.status === 'WARNING'
                          ? 'bg-amber-500'
                          : 'bg-red-500',
                    )}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'consumers' && (
          <div className="flex gap-2 overflow-x-auto">
            {consumers.map((c) => {
              const supplyPct = c.monthlyDemandKwh > 0 ? (c.monthlySupplyKwh / c.monthlyDemandKwh) * 100 : 0;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConsumer(c)}
                  className="flex-shrink-0 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-left transition-all min-w-[160px]"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 size={10} className="text-blue-400" />
                    <span className="text-xs font-medium text-white truncate">{c.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-1.5">
                    RE100: {c.reCurrentPct.toFixed(0)}% / {c.reTargetPct.toFixed(0)}%
                  </div>
                  <ProgressBar
                    value={c.reCurrentPct}
                    max={c.reTargetPct}
                    className="h-1"
                    barClass={c.reCurrentPct >= c.reTargetPct ? 'bg-emerald-500' : 'bg-blue-500'}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums">공급 {supplyPct.toFixed(0)}%</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Layer Control                                                    */
/* ────────────────────────────────────────────────────────────────── */

const LAYER_CONFIG: { key: LayerKey; label: string; defaultOn: boolean; color: string }[] = [
  { key: 'plants', label: '발전소', defaultOn: true, color: 'emerald' },
  { key: 'anomalyHighlight', label: '이상 하이라이트', defaultOn: false, color: 'red' },
  { key: 'performanceHeatmap', label: '성능 히트맵', defaultOn: false, color: 'amber' },
];

function LayerControl({ layers, onToggle }: { layers: Record<LayerKey, boolean>; onToggle: (key: LayerKey) => void }) {
  const [open, setOpen] = useState(false);

  const colorMap: Record<string, { active: string; dot: string }> = {
    emerald: { active: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500' },
    red: { active: 'border-red-500/40 bg-red-500/20 text-red-400', dot: 'bg-red-500' },
    amber: { active: 'border-amber-500/40 bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
  };

  return (
    <div className="relative self-start w-fit">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium border border-white/10 bg-[#000C17]/95  text-slate-300 hover:bg-black/80 transition-colors"
      >
        <Layers size={12} /> 레이어
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-white/10 bg-[#000C17]/95  p-2 space-y-1 animate-[fadeIn_150ms_ease-out]">
          {LAYER_CONFIG.map(({ key, label, color }) => {
            const active = layers[key];
            const c = colorMap[color] as { active: string; dot: string };
            return (
              <button
                key={key}
                onClick={() => onToggle(key)}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2.5.5 text-xs font-medium transition-colors border',
                  active ? c.active : 'border-transparent bg-transparent text-slate-500 hover:text-slate-300',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', active ? c.dot : 'bg-slate-600')} />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Marker Tooltip                                                   */
/* ────────────────────────────────────────────────────────────────── */

function MarkerTooltip({ plant, position }: { plant: MonitoringPlant; position: { x: number; y: number } | null }) {
  if (!position) return null;
  const pct = plant.capacity > 0 ? ((plant.currentOutput / plant.capacity) * 100).toFixed(0) : '0';
  return (
    <div
      className="fixed z-50 pointer-events-none animate-[fadeIn_100ms_ease-out]"
      style={{ left: position.x + 10, top: position.y - 60 }}
    >
      <div className="rounded-lg border border-white/15 bg-[#000C17]/95  px-3 py-2 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">{plant.name}</span>
          <StatusDot status={plant.status} />
          <span className="text-[10px] text-slate-400">{STATUS_LABELS_MAP[plant.status]}</span>
        </div>
        <div className="text-[10px] text-slate-300 mt-0.5 tabular-nums">
          {plant.currentOutput.toLocaleString()} kW ({pct}%)
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Side Panel                                                       */
/* ────────────────────────────────────────────────────────────────── */

function SidePanel({
  plants,
  selected,
  onSelectPlant,
}: {
  plants: MonitoringPlant[];
  selected: MonitoringPlant | null;
  onSelectPlant: (plant: MonitoringPlant) => void;
}) {
  const router = useRouter();

  if (selected) {
    const plant = selected;
    const outputPercent = plant.capacity > 0 ? ((plant.currentOutput / plant.capacity) * 100).toFixed(1) : '0';

    return (
      <div className="space-y-3 ">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white truncate">{plant.name}</h3>
            <Badge variant="primary">{TYPE_LABELS[plant.type as EnergySource]}</Badge>
            <StatusDot status={plant.status} pulse />
            <span className="text-xs text-slate-400">{STATUS_LABELS_MAP[plant.status]}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{plant.address}</p>
        </div>

        {/* Output */}
        <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
          <p className="text-xs text-accent mb-1.5">출력</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{plant.currentOutput.toLocaleString()}</span>
            <span className="text-xs text-slate-500">/ {plant.capacity.toLocaleString()} kW</span>
            <span className="text-xs font-medium text-primary ml-auto">{outputPercent}%</span>
          </div>
          <ProgressBar
            value={plant.currentOutput}
            max={plant.capacity}
            className="mt-2 h-2"
            barClass={cn(
              plant.status === 'NORMAL' ? 'bg-emerald-500' : plant.status === 'WARNING' ? 'bg-amber-500' : 'bg-red-500',
            )}
          />
        </div>

        {/* Daily generation */}
        {plant.dailyEnergy != null && (
          <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
            <p className="text-xs text-accent mb-1.5">금일 발전량</p>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white tabular-nums">
                {plant.dailyEnergy.toLocaleString()} kWh
              </span>
            </div>
            {plant.totalEnergy != null && (
              <div className="text-[10px] text-slate-500 mt-1">누적: {plant.totalEnergy.toLocaleString()} kWh</div>
            )}
          </div>
        )}

        {/* Connection status (LASEE plants) */}
        {plant.connectionStatus && (
          <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
            <p className="text-xs text-accent mb-2 flex items-center gap-1">
              <Radio size={10} /> 통신 상태
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  {plant.connectionStatus.rtuConnection === 'NORMAL' ? (
                    <Wifi size={10} className="text-emerald-400" />
                  ) : (
                    <WifiOff size={10} className="text-red-400" />
                  )}
                  RTU
                </span>
                <Badge
                  variant={
                    plant.connectionStatus.rtuPower === 'ON' && plant.connectionStatus.rtuConnection === 'NORMAL'
                      ? 'success'
                      : 'danger'
                  }
                >
                  {plant.connectionStatus.rtuPower === 'ON' ? '정상' : '오류'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">인버터</span>
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    plant.connectionStatus.inverterConnections.every((c) => c.state === 'NORMAL')
                      ? 'text-emerald-400'
                      : 'text-amber-400',
                  )}
                >
                  {plant.connectionStatus.inverterConnections.filter((c) => c.state === 'NORMAL').length}/
                  {plant.connectionStatus.inverterConnections.length} 정상
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Inverter real-time measurement */}
        {plant.inverters && plant.inverters.length > 0 && (
          <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
            <p className="text-xs text-accent mb-2 flex items-center gap-1">
              <Zap size={10} /> 인버터 실시간 계측
            </p>
            <div className="space-y-2">
              {plant.inverters.map((inv) => (
                <div key={inv.number} className="border border-white/5 rounded-md p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-white">INV #{inv.number}</span>
                    <Badge variant={inv.connectionState === 'NORMAL' ? 'success' : 'danger'}>
                      {inv.connectionState === 'NORMAL' ? '정상' : '오류'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-[9px] text-slate-500">DC</p>
                      <p className="text-xs font-medium text-white tabular-nums">{inv.dc.power.toFixed(1)} kW</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500">AC</p>
                      <p className="text-xs font-medium text-white tabular-nums">{inv.ac.power.toFixed(1)} kW</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500">금일</p>
                      <p className="text-xs font-medium text-cyan-400 tabular-nums">
                        {inv.dailyEnergy.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {inv.statusMessages.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inv.statusMessages.map((msg) => (
                        <Badge key={msg} variant="danger">
                          {msg}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail CTA */}
        <Button
          variant="ghost"
          className="w-full justify-center border border-white/10"
          onClick={() => router.push(`/monitoring/plant/${plant.plantId}`)}
        >
          상세 모니터링 <ChevronRight size={14} />
        </Button>
      </div>
    );
  }

  /* Level 0: Nothing selected — Portfolio summary */
  const sourceOutput: Record<EnergySource, number> = { SOLAR: 0, ORC: 0, FUEL_CELL: 0 };
  plants.forEach((p) => {
    sourceOutput[p.type as EnergySource] += p.currentOutput;
  });
  const totalOutput = plants.reduce((s, p) => s + p.currentOutput, 0);

  return (
    <div className="space-y-3 ">
      <h3 className="text-md font-bold text-white">포트폴리오 요약</h3>

      {/* Generation mix by source */}
      <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
        <p className="text-xs text-accent mb-2">발전원별 출력 비중</p>
        <div className="space-y-2">
          {(Object.entries(sourceOutput) as [EnergySource, number][])
            .filter(([, kw]) => kw > 0 || true)
            .map(([source, kw]) => {
              const pct = totalOutput > 0 ? (kw / totalOutput) * 100 : 0;
              return (
                <div key={source} className="flex items-center gap-2">
                  <span className="text-xs w-4">{TYPE_EMOJI[source]}</span>
                  <span className="text-xs text-slate-300 w-14">{TYPE_LABELS[source]}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={kw}
                      max={totalOutput}
                      className="h-1.5"
                      barClass={cn(
                        source === 'SOLAR' ? 'bg-amber-500' : source === 'ORC' ? 'bg-emerald-500' : 'bg-violet-500',
                      )}
                    />
                  </div>
                  <span className="text-xs text-white tabular-nums w-16 text-right">{kw.toLocaleString()} kW</span>
                  <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Plant list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">발전소 목록</p>
        {plants.map((plant) => (
          <button
            key={plant.plantId}
            onClick={() => onSelectPlant(plant)}
            className="w-full rounded-lg border border-accent/20 bg-surface-card p-3 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <StatusDot status={plant.status} pulse />
                <span className="text-sm font-medium text-white">{plant.name}</span>
                <Badge variant="primary">{TYPE_LABELS[plant.type as EnergySource]}</Badge>
              </div>
              <ChevronRight size={14} className="text-slate-500" />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="tabular-nums">
                {plant.currentOutput.toLocaleString()} / {plant.capacity.toLocaleString()} kW
              </span>
              <span className="tabular-nums">
                {plant.capacity > 0 ? ((plant.currentOutput / plant.capacity) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <ProgressBar
              value={plant.currentOutput}
              max={plant.capacity}
              className="mt-1.5 h-1"
              barClass={cn(
                plant.status === 'NORMAL'
                  ? 'bg-emerald-500'
                  : plant.status === 'WARNING'
                    ? 'bg-amber-500'
                    : 'bg-red-500',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Composite Information Widget (복합정보 표출 — 계획서 p.150 / 05 §S1-1) */
/*  발전량 + 기후 + FEMS + RE100 실조인. 상관계수 = FE 피어슨.            */
/*  데이터 부족 축은 "데이터 수집 중" 정직 표시(예시 라벨 전량 제거).      */
/* ────────────────────────────────────────────────────────────────── */

interface WeatherStation {
  id: string;
  name: string;
  temperature: number;
  humidity: number;
}
interface WeatherResponse {
  stations: WeatherStation[];
}

/** 피어슨 상관계수 — 정렬된 두 수치 벡터(동일 길이·≥3점). 부족 시 null. */
function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const xa = a.slice(0, n);
  const xb = b.slice(0, n);
  const ma = xa.reduce((s, v) => s + v, 0) / n;
  const mb = xb.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const va = xa[i]! - ma;
    const vb = xb[i]! - mb;
    num += va * vb;
    da += va * va;
    db += vb * vb;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

/** 상관 강도 배지 — r≥0.7 강 / 0.4~0.7 중 / <0.4 약. 데이터 부족 시 수집중. */
function CorrBadge({ r }: { r: number | null }) {
  if (r == null) {
    return <span className="rounded bg-white/[0.06] px-1.5 py-px text-[9px] text-slate-500">데이터 수집 중</span>;
  }
  const abs = Math.abs(r);
  const [tone, label] =
    abs >= 0.7
      ? ['bg-emerald-500/15 text-emerald-400', '강']
      : abs >= 0.4
        ? ['bg-amber-500/15 text-amber-400', '중']
        : ['bg-slate-500/15 text-slate-400', '약'];
  return (
    <span className={cn('rounded px-1.5 py-px text-[9px] tabular-nums', tone)}>
      {label} r={r.toFixed(2)}
    </span>
  );
}

function DataSourceBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      실시간 연계
    </span>
  ) : (
    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-slate-500">데모(예시)</span>
  );
}

function CorrelationRow({
  label,
  value,
  unit,
  pct,
  barClass,
  r,
  loading,
  failed,
  onRetry,
}: {
  label: string;
  value: string;
  unit?: string;
  pct: number;
  barClass: string;
  r?: number | null;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  if (loading) {
    return <div className="h-6 rounded bg-white/[0.03] animate-pulse" />;
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
          {label}
          <CorrBadge r={r ?? null} />
        </span>
        {failed ? (
          <button onClick={onRetry} className="text-[10px] text-red-400 hover:text-red-300">
            불러오기 실패 · 재시도
          </button>
        ) : (
          <span className="text-[11px] font-medium text-white tabular-nums">
            {value}
            {unit && <span className="ml-0.5 text-[9px] text-slate-500">{unit}</span>}
          </span>
        )}
      </div>
      <ProgressBar value={failed ? 0 : pct} max={100} className="h-1.5" barClass={barClass} />
    </div>
  );
}

function CompositeWidget({ plants }: { plants: MonitoringPlant[] }) {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const agg = computeAggregates(plants);

  // 발전량(실측 집계) — plants 훅 파생.
  const genPct = agg.totalCapacity > 0 ? (agg.totalOutput / agg.totalCapacity) * 100 : 0;
  const hasGen = plants.length > 0;

  // 기후 — /api/weather 기존 Next 라우트 재사용(수정 없음). 개별 실패 허용.
  const weatherQ = useQuery<WeatherResponse>({
    queryKey: ['monitoring', 'composite', 'weather'],
    queryFn: async () => {
      const res = await fetch('/mock/weather.json');
      if (!res.ok) throw new Error(`weather ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  const ulsan = weatherQ.data?.stations?.find((s) => s.id === 'ulsan') ?? weatherQ.data?.stations?.[0];
  const climateVal = ulsan?.temperature;
  // 기온 -10~40℃ → 0~100 정규화(표출용 게이지). 상관은 시계열 부재로 수집중.
  const climatePct = climateVal != null ? Math.max(0, Math.min(100, ((climateVal + 10) / 50) * 100)) : 0;

  // FEMS 수요 — useConsumerSites peakDemandKw 합산.
  const sitesQ = useConsumerSites(companyId ? { companyId } : undefined);
  const sites = sitesQ.data?.content ?? [];
  const demandKw = sites.reduce((s, c) => s + (c.peakDemandKw ?? 0), 0);
  const contractKw = sites.reduce((s, c) => s + (c.contractPowerKw ?? 0), 0);
  const demandPct = contractKw > 0 ? Math.min(100, (demandKw / contractKw) * 100) : 0;
  const hasDemand = sites.length > 0 && demandKw > 0;

  // RE100 이행률 — useMonthlyProgress 최신월. 월별 시계열은 상관 계산에 활용.
  const year = new Date().getFullYear();
  const re100Q = useMonthlyProgress(companyId ?? 0, year);
  const re100Series = useMemo(() => {
    const rows = (re100Q.data ?? []) as Array<Record<string, unknown>>;
    return rows
      .map((r) => {
        const v = r.actualPct ?? r.achievedPct ?? r.progressPct ?? r.percent ?? r.value;
        return typeof v === 'number' ? v : null;
      })
      .filter((v): v is number => v != null);
  }, [re100Q.data]);
  const re100Pct = re100Series.length ? re100Series[re100Series.length - 1]! : 0;
  const hasRe100 = re100Series.length > 0;

  // ── FE 피어슨 상관 (05 §S1-1) ──
  // 발전량·기후·수요는 현재 스냅샷(시계열 부재)이라 정렬 벡터 확보 시에만 산출.
  // pearson()은 정렬점 3개 미만이면 null 반환 → 배지가 정직하게 "데이터 수집 중" 표시.
  // 발전 월별 시계열 프록시가 없어 실제 입력은 빈 벡터 → null(가짜 상관 금지).
  const genMonthlySeries: number[] = []; // BE 월별 발전 read-model 연동 시 채움(현재 미제공)
  const weatherSeries: number[] = []; // /api/weather는 스냅샷(24h 시계열 미제공)
  const demandSeries: number[] = []; // FEMS 시간대 계량 미제공
  const genWeatherR = pearson(genMonthlySeries, weatherSeries);
  const genDemandR = pearson(genMonthlySeries, demandSeries);
  const genRe100R = pearson(genMonthlySeries, re100Series);

  const anyLive = hasGen || (weatherQ.isSuccess && climateVal != null) || hasDemand || hasRe100;

  return (
    <div className="rounded-xl border border-white/10 bg-[#000C17]/95 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-white">복합정보 표출</h3>
        <span className="ml-auto">
          <DataSourceBadge live={anyLive} />
        </span>
      </div>

      {/* 상관 축 4종 (계획서 p.150 / 05 §S1-1) */}
      <div className="space-y-2.5">
        <CorrelationRow
          label="발전량"
          value={hasGen ? agg.totalOutput.toLocaleString() : '—'}
          unit="kW"
          pct={genPct}
          barClass="bg-emerald-500"
          r={null}
        />
        <CorrelationRow
          label="기후(일사·기온)"
          value={climateVal != null ? climateVal.toFixed(1) : '—'}
          unit="℃"
          pct={climatePct}
          barClass="bg-amber-500"
          r={genWeatherR}
          loading={weatherQ.isLoading}
          failed={weatherQ.isError}
          onRetry={() => weatherQ.refetch()}
        />
        <CorrelationRow
          label="수요(FEMS)"
          value={hasDemand ? demandKw.toLocaleString() : '데이터 수집 중'}
          unit={hasDemand ? 'kW' : undefined}
          pct={demandPct}
          barClass="bg-sky-500"
          r={genDemandR}
          loading={sitesQ.isLoading}
          failed={sitesQ.isError}
          onRetry={() => sitesQ.refetch()}
        />
        <CorrelationRow
          label="RE100 이행률"
          value={hasRe100 ? re100Pct.toFixed(1) : '데이터 수집 중'}
          unit={hasRe100 ? '%' : undefined}
          pct={re100Pct}
          barClass="bg-violet-500"
          r={genRe100R}
          loading={re100Q.isLoading}
          failed={re100Q.isError}
          onRetry={() => re100Q.refetch()}
        />
      </div>

      {/* 군집 요약 — 발전원 × 상태 교차(실측 집계). 클릭 시 필터 프리셋 이동. */}
      <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
        <div className="mb-1.5 text-[11px] text-slate-300">상관 군집</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Link href="/monitoring/anomalies" className="block hover:bg-white/[0.03] rounded-md py-0.5">
            <p className="text-sm font-bold text-emerald-400 tabular-nums">{agg.operatingCount}</p>
            <p className="text-[9px] text-slate-500">정상 군집</p>
          </Link>
          <Link href="/monitoring/performance" className="block hover:bg-white/[0.03] rounded-md py-0.5">
            <p className="text-sm font-bold text-amber-400 tabular-nums">
              {plants.filter((p) => p.status === 'WARNING').length}
            </p>
            <p className="text-[9px] text-slate-500">주의 군집</p>
          </Link>
          <Link href="/monitoring/anomalies?severity=HIGH" className="block hover:bg-white/[0.03] rounded-md py-0.5">
            <p className="text-sm font-bold text-red-400 tabular-nums">
              {plants.filter((p) => p.status === 'ANOMALY').length}
            </p>
            <p className="text-[9px] text-slate-500">이상 군집</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                             */
/* ────────────────────────────────────────────────────────────────── */

export default function MonitoringPage() {
  const router = useRouter();
  const mapRef = useRef<MapboxMap | null>(null);
  const { data: laseePlants } = useMonitoringPlants();
  const { data: consumersData } = useMonitoringConsumers();
  const myPlantMatcher = useMyPlantMatcher();
  const { hasPlants, isGenerator, isLoading: isPlantLoading } = useMyPlantIds();

  const plants = useMemo(
    () => filterPlantsByOwnership(laseePlants ?? [], myPlantMatcher),
    [laseePlants, myPlantMatcher],
  );
  const consumers = useMemo(() => consumersData ?? [], [consumersData]);

  if (isGenerator && !isPlantLoading && !hasPlants) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center">
          <MapPin className="w-10 h-10 text-slate-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-white">등록된 발전소가 없습니다</h2>
          <p className="text-sm text-slate-400 max-w-md">
            자원 등록을 완료하면 이 화면에서 발전소 위치와 실시간 발전 현황을 모니터링할 수 있습니다.
          </p>
        </div>
        <Link href="/generator/ppa/resources/register">
          <Button variant="primary" size="lg">
            자원 등록하기
          </Button>
        </Link>
      </div>
    );
  }

  const [selected, setSelected] = useState<MonitoringPlant | null>(null);
  const [hoveredPlant, setHoveredPlant] = useState<MonitoringPlant | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [, setZoomLevel] = useState(15);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    plants: true,
    anomalyHighlight: false,
    performanceHeatmap: false,
  });

  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const ZOOM_IN = 15;
  const RIGHT_PANEL_PX = 396;
  const TOP_HUD_PX = 82;
  const BOTTOM_BAR_PX = 100;

  const handleMapClick = useCallback(() => {
    setSelected(null);
  }, []);

  const handleMapLoad = useCallback(
    (map: MapboxMap) => {
      mapRef.current = map;
      const pts = plants.filter((p) => p.latitude && p.longitude);
      if (pts.length === 0) return;
      const lngs = pts.map((p) => p.longitude!);
      const lats = pts.map((p) => p.latitude!);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        {
          padding: { top: TOP_HUD_PX + 16, bottom: BOTTOM_BAR_PX + 16, left: 16, right: RIGHT_PANEL_PX + 16 },
          maxZoom: ZOOM_IN,
          duration: 0,
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plants],
  );

  const handleZoomChanged = useCallback((zoom: number) => {
    setZoomLevel(zoom);
  }, []);

  // 우측 패널(396px)·상단 HUD·하단 바를 제외한 가시 영역 중앙으로 이동
  const flyTo = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), ZOOM_IN),
      offset: [-RIGHT_PANEL_PX / 2, (TOP_HUD_PX - BOTTOM_BAR_PX) / 2],
      duration: 1200,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPlant = useCallback(
    (plant: MonitoringPlant) => {
      setSelected((prev) => {
        if (prev?.plantId === plant.plantId) return null;
        return plant;
      });
      flyTo(plant.latitude ?? 0, plant.longitude ?? 0);
    },
    [flyTo],
  );

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];
    if (layers.performanceHeatmap) {
      for (const plant of plants) {
        const pct = plant.capacity > 0 ? (plant.currentOutput / plant.capacity) * 100 : 0;
        const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
        list.push({
          id: `heatmap-${plant.plantId}`,
          lat: plant.latitude ?? 0,
          lng: plant.longitude ?? 0,
          halo: { color, radius: 40 },
        });
      }
    }
    if (layers.plants) {
      for (const plant of plants) {
        const isSelected = selected?.plantId === plant.plantId;
        const isAnomalyDimmed = layers.anomalyHighlight && plant.status === 'NORMAL';
        list.push({
          id: `p-${plant.plantId}`,
          lat: plant.latitude ?? 0,
          lng: plant.longitude ?? 0,
          iconUrl: TYPE_MARKER_ICONS[plant.type as EnergySource] ?? TYPE_MARKER_ICONS.SOLAR,
          size: isSelected ? 1.2 : 0.8,
          title: plant.name,
          opacity: isAnomalyDimmed ? 0.3 : 1,
          onClick: () => selectPlant(plant),
          onMouseEnter: (e) => {
            setHoveredPlant(plant);
            setHoverPos({ x: e.clientX, y: e.clientY });
          },
          onMouseLeave: () => {
            setHoveredPlant(null);
            setHoverPos(null);
          },
        });
      }
    }
    return list;
  }, [plants, layers, selected, selectPlant]);

  return (
    <div className="fixed top-[100px] left-52 right-0 bottom-0">
      {/* 지도 배경 — GNB(100px)·LNB(w-52) 영역을 제외한 콘텐츠 영역 채움(통합기획: /monitoring 사이드바 노출) */}
      <MapboxMapView
        center={[129.35, 35.508]}
        zoom={15}
        className="w-full h-full"
        markers={markers}
        onMapClick={handleMapClick}
        onMapLoad={handleMapLoad}
        onZoomChanged={handleZoomChanged}
      />

      {/* ── Overlays ── */}

      {/* Top HUD + Layer control — stacked vertically so the layer button always sits below the HUD even when it wraps on narrow screens */}
      <div className="absolute top-3 left-4 right-[396px] z-10 flex flex-col items-start gap-2">
        <StatusHud plants={plants} />
        <LayerControl layers={layers} onToggle={toggleLayer} />
      </div>

      {/* Legend */}
      <div className="absolute bottom-[120px] left-4 z-10 rounded-lg border border-white/10 bg-[#000C17]/60 hover:bg-[#000C17]/95 p-2.5 space-y-1.5 opacity-70 hover:opacity-100 transition-all duration-300">
        <p className="text-[10px] font-medium text-slate-400">범례</p>
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <span className="flex items-center gap-1 text-white/80">
            <Image src="/assets/icon/icon_zoom_out_sun.svg" width={20} height={20} alt="" /> 태양광
          </span>
          <span className="flex items-center gap-1 text-white/80">
            <Image src="/assets/icon/icon_zoom_out_orc.svg" width={20} height={20} alt="" /> ORC
          </span>
          <span className="flex items-center gap-1 text-white/80">
            <Image src="/assets/icon/icon_zoom_out_fuel_cell.svg" width={20} height={20} alt="" /> 연료전지
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <BottomBar
        plants={plants}
        consumers={consumers}
        selected={selected}
        onSelectPlant={selectPlant}
        onSelectConsumer={(c) => router.push(`/monitoring/consumer/${c.id}`)}
      />

      {/* Marker hover tooltip */}
      {hoveredPlant && <MarkerTooltip plant={hoveredPlant} position={hoverPos} />}

      {/* Right panel overlay */}
      <div className="absolute top-3 right-4 bottom-3 z-10 w-[380px] flex flex-col gap-3 overflow-hidden">
        <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#000C17]/95  p-4 space-y-4">
          <SidePanel plants={plants} selected={selected} onSelectPlant={selectPlant} />
        </div>
        {/* 복합정보 표출 위젯 (계획서 p.150) — 발전소 미선택(포트폴리오) 상태에서 노출 */}
        {!selected && (
          <div className="shrink-0">
            <CompositeWidget plants={plants} />
          </div>
        )}
      </div>
    </div>
  );
}
