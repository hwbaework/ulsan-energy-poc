'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { StatusBadge, StatusPill } from '@/components/ui/Design';

const MapboxMapView = dynamic(() => import('@/components/ui/MapboxMapView').then((mod) => mod.MapboxMapView), {
  ssr: false,
});
import type { Map as MapboxMap } from 'mapbox-gl';
import type { MapMarkerSpec } from '@/components/ui/MapboxMapView';
import { cn } from '@/lib/utils';
import type { MonitoringPlant, EnergySource, PlantStatus } from '@/types/monitoring';
import { SOURCE, SOURCE_ORDER } from '@/lib/design';
import {
  Zap,
  ChevronRight,
  ChevronLeft,
  Wifi,
  WifiOff,
  Radio,
  Thermometer,
  Wind,
  Sunrise,
  Sunset,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, useMyPlantIds, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';
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

/** 이상감지 시 핀을 빨강으로 보이게 하는 필터. 각 핀 색(design.ts SOURCE.color)의 hue 를 0°(빨강)로 회전 — 핀 색이 바뀌면 같이 조정 */
const ANOMALY_PIN_FILTER: Record<EnergySource, string> = {
  SOLAR: 'hue-rotate(-38deg) saturate(1.4)', // #F59E0B (38°)
  ORC: 'hue-rotate(102deg) saturate(1.4)', // #8B5CF6 (258°)
  FUEL_CELL: 'hue-rotate(-217deg) saturate(1.4)', // #3B82F6 (217°)
};

const TYPE_LABELS: Record<EnergySource, string> = {
  SOLAR: '태양광',
  ORC: 'ORC',
  FUEL_CELL: '연료전지',
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
  const capacityMw = (agg.totalCapacity / 1000).toFixed(2);

  return (
    <div className="w-full">
      <div className="rounded-xl border border-white/10 bg-[#000C17]/95 px-5 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          {/* 전체 출력 */}
          <div className="flex-1 min-w-[190px]">
            <div className="mb-1">
              <span className="text-sm text-slate-300">전체 출력</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white tabular-nums">{agg.totalOutput.toLocaleString()} kW</span>
              <span className="text-sm text-slate-400">설비 {capacityMw} MW</span>
            </div>
          </div>

          <div className="w-px h-11 bg-white/10" />

          {/* 이상 사업장 */}
          <div className="min-w-[100px]">
            <div className="mb-1">
              <span className="text-sm text-slate-300">이상 사업장</span>
            </div>
            {anomalyCount > 0 ? (
              <span className="flex items-center gap-1.5 text-sm font-bold text-semantic-red">
                <span className="h-2 w-2 rounded-full bg-semantic-red" /> {anomalyCount}건
              </span>
            ) : (
              <span className="text-sm font-bold text-emerald-400">정상</span>
            )}
          </div>

          <div className="w-px h-11 bg-white/10" />

          {/* 기온 */}
          <div className="min-w-[80px]">
            <div className="flex items-center gap-2 mb-1">
              <Thermometer size={16} className="text-sky-400" />
              <span className="text-sm text-slate-300">기온</span>
            </div>
            <span className="text-sm font-bold text-white tabular-nums">25.4°C</span>
          </div>

          <div className="w-px h-11 bg-white/10" />

          {/* 풍향/풍속 */}
          <div className="min-w-[120px]">
            <div className="flex items-center gap-2 mb-1">
              <Wind size={16} className="text-slate-300" />
              <span className="text-sm text-slate-300">풍향/풍속</span>
            </div>
            <span className="text-sm font-bold text-white tabular-nums">남남동 3.1m/s</span>
          </div>

          <div className="w-px h-11 bg-white/10" />

          {/* 일출 */}
          <div className="min-w-[95px]">
            <div className="flex items-center gap-2 mb-1">
              <Sunrise size={16} className="text-amber-400" />
              <span className="text-sm text-slate-300">일출</span>
            </div>
            <span className="text-sm font-bold text-white tabular-nums">06시 09분</span>
          </div>

          <div className="w-px h-11 bg-white/10" />

          {/* 일몰 */}
          <div className="min-w-[95px]">
            <div className="flex items-center gap-2 mb-1">
              <Sunset size={16} className="text-orange-400" />
              <span className="text-sm text-slate-300">일몰</span>
            </div>
            <span className="text-sm font-bold text-white tabular-nums">18시 29분</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Marker Tooltip                                                   */
/* ────────────────────────────────────────────────────────────────── */

function MarkerTooltip({ plant, position }: { plant: MonitoringPlant; position: { x: number; y: number } | null }) {
  if (!position) return null;
  return (
    <div
      className="fixed z-50 pointer-events-none animate-[fadeIn_100ms_ease-out]"
      style={{ left: position.x + 10, top: position.y - 60 }}
    >
      <div className="rounded-lg border border-white/15 bg-[#000C17]/95  px-3 py-2 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">{plant.name}</span>
          <StatusDot status={plant.status} />
          <span className="text-xs text-slate-400">{STATUS_LABELS_MAP[plant.status]}</span>
        </div>
        <div className="text-xs text-slate-300 mt-0.5 tabular-nums">{plant.currentOutput.toLocaleString()} kW</div>
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
  onBack,
}: {
  plants: MonitoringPlant[];
  selected: MonitoringPlant | null;
  onSelectPlant: (plant: MonitoringPlant) => void;
  onBack?: () => void;
}) {
  const router = useRouter();

  if (selected) {
    const plant = selected;
    const src = SOURCE[plant.type as EnergySource];
    const SrcIcon = src.icon;

    return (
      <div className="space-y-3 ">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="목록으로"
              className="-ml-1.5 shrink-0 rounded-md p-1 text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-base font-bold text-white truncate">{plant.name}</h3>
            {/* 계약 사업장 목록과 같은 발전원 칩 */}
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-semibold text-white">
              <SrcIcon size={13} style={{ color: src.color }} />
              {src.label}
            </span>
            <StatusBadge status={plant.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{plant.address}</p>
        </div>

        {/* Output */}
        <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
          <p className="text-sm text-slate-300 mb-1.5">출력</p>
          {/* 상단 HUD '전체 출력'과 같은 표기: 값 kW + 설비 용량. 퍼센트 없음 */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{plant.currentOutput.toLocaleString()} kW</span>
            <span className="text-sm text-slate-400 tabular-nums">설비 {plant.capacity.toLocaleString()} kW</span>
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
            <p className="text-sm text-slate-300 mb-1.5">금일 발전량</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white tabular-nums">{plant.dailyEnergy.toLocaleString()} kWh</span>
            </div>
            {plant.totalEnergy != null && (
              <div className="text-xs text-slate-400 mt-1 tabular-nums">누적 {plant.totalEnergy.toLocaleString()} kWh</div>
            )}
          </div>
        )}

        {/* Connection status (LASEE plants) */}
        {plant.connectionStatus && (
          <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
            <p className="text-sm text-slate-300 mb-2 flex items-center gap-1.5">
              <Radio size={14} /> 통신 상태
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300 flex items-center gap-1.5">
                  {plant.connectionStatus.rtuConnection === 'NORMAL' ? (
                    <Wifi size={14} className="text-emerald-400" />
                  ) : (
                    <WifiOff size={14} className="text-red-400" />
                  )}
                  RTU
                </span>
                {plant.connectionStatus.rtuPower === 'ON' && plant.connectionStatus.rtuConnection === 'NORMAL' ? (
                  <StatusPill tone="normal" label="정상" />
                ) : (
                  <StatusPill tone="danger" label="오류" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">인버터</span>
                <span
                  className={cn(
                    'text-sm font-medium tabular-nums',
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
            <p className="text-sm text-slate-300 mb-2 flex items-center gap-1.5">
              <Zap size={14} /> 인버터 실시간 계측
            </p>
            <div className="space-y-2">
              {plant.inverters.map((inv) => (
                <div key={inv.number} className="border border-white/5 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">INV #{inv.number}</span>
                    {inv.connectionState === 'NORMAL' ? (
                      <StatusPill tone="normal" label="정상" />
                    ) : (
                      <StatusPill tone="danger" label="오류" />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-xs text-slate-400">DC</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{inv.dc.power.toFixed(1)} kW</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">AC</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{inv.ac.power.toFixed(1)} kW</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">금일</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{inv.dailyEnergy.toLocaleString()} kWh</p>
                    </div>
                  </div>
                  {inv.statusMessages.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inv.statusMessages.map((msg) => (
                        <StatusPill key={msg} tone="danger" label={msg} />
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
  const sourceCapacity: Record<EnergySource, number> = { SOLAR: 0, ORC: 0, FUEL_CELL: 0 };
  plants.forEach((p) => {
    sourceCapacity[p.type as EnergySource] += p.capacity;
  });
  const totalCapacity = plants.reduce((s, p) => s + p.capacity, 0);

  return (
    <div className="space-y-3 ">
      <h3 className="text-md font-bold text-white">포트폴리오 요약</h3>

      {/* 발전원별 설비 용량 */}
      <div className="rounded-lg border border-accent/20 bg-surface-card p-3">
        <p className="text-sm text-slate-300 mb-2">발전원별 설비 용량 · 합계 {(totalCapacity / 1000).toFixed(2)} MW</p>
        <div className="space-y-2">
          {SOURCE_ORDER.map((source) => {
            const cap = sourceCapacity[source];
            return (
              <div key={source} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: SOURCE[source].color }}
                />
                <span className="text-sm text-slate-300 w-16">{TYPE_LABELS[source]}</span>
                <div className="flex-1">
                  <ProgressBar value={cap} max={totalCapacity} className="h-1.5" barClass={SOURCE[source].barClass} />
                </div>
                <span className="text-sm font-medium text-white tabular-nums w-20 text-right">
                  {(cap / 1000).toFixed(2)} MW
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 계약 사업장 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">계약 사업장</p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> 정상
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> 이상감지
            </span>
          </div>
        </div>
        {plants.map((plant) => {
          return (
            <button
              key={plant.plantId}
              onClick={() => onSelectPlant(plant)}
              className="w-full rounded-lg border border-accent/20 bg-surface-card p-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusDot status={plant.status} pulse />
                  <span className="text-sm font-medium text-white">{plant.name}</span>
                  {(() => {
                    const src = SOURCE[plant.type as EnergySource];
                    const Icon = src.icon;
                    return (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-semibold text-white">
                        <Icon size={13} style={{ color: src.color }} />
                        {src.label}
                      </span>
                    );
                  })()}
                </div>
                <ChevronRight size={14} className="text-slate-500" />
              </div>
              <div className="text-sm text-slate-300 tabular-nums">
                {plant.currentOutput.toLocaleString()} / {plant.capacity.toLocaleString()} kW
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
          );
        })}
      </div>
    </div>
  );
}


/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                             */
/* ────────────────────────────────────────────────────────────────── */

export default function MonitoringPage() {
  const mapRef = useRef<MapboxMap | null>(null);
  const { data: laseePlants } = useMonitoringPlants();
  const myPlantMatcher = useMyPlantMatcher();
  const { hasPlants, isGenerator, isLoading: isPlantLoading } = useMyPlantIds();

  const plants = useMemo(
    () => filterPlantsByOwnership(laseePlants ?? [], myPlantMatcher),
    [laseePlants, myPlantMatcher],
  );

  const [selected, setSelected] = useState<MonitoringPlant | null>(null);
  const [hoveredPlant, setHoveredPlant] = useState<MonitoringPlant | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [, setZoomLevel] = useState(15);
  const [overlaysHidden, setOverlaysHidden] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<EnergySource>>(new Set());
  const toggleType = (t: EnergySource) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const layers: Record<LayerKey, boolean> = {
    plants: true,
    anomalyHighlight: false,
    performanceHeatmap: false,
  };


  const ZOOM_IN = 15;
  const RIGHT_PANEL_PX = 396;
  const BOTTOM_BAR_PX = 100;
  // 상단 HUD(출력·기온 + 발전원 칩)는 내용에 따라 높이가 변하므로 실측값을 쓴다
  const hudRef = useRef<HTMLDivElement>(null);
  const topHudPx = () => (hudRef.current?.offsetHeight ?? 82) + 12;

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
          // top 에 핀 높이(80×0.8)를 더해 맨 위 핀 몸통이 HUD·칩에 가리지 않게
          padding: { top: topHudPx() + 64 + 16, bottom: BOTTOM_BAR_PX + 16, left: 16, right: RIGHT_PANEL_PX + 16 },
          maxZoom: ZOOM_IN,
          duration: 0,
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plants],
  );

  // 발전소 데이터가 지도 로드보다 늦게 오면 fitBounds 가 빈 배열로 끝나 마커가 화면 밖에 남는다 → 데이터 도착 시 다시 맞춤
  useEffect(() => {
    if (mapRef.current && plants.length > 0) handleMapLoad(mapRef.current);
  }, [plants, handleMapLoad]);

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
      offset: [-RIGHT_PANEL_PX / 2, (topHudPx() - BOTTOM_BAR_PX) / 2],
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
        if (hiddenTypes.has(plant.type as EnergySource)) continue;
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
          // 이상감지: 핀 색을 빨강으로 (핀 PNG 색상을 hue 회전 — 흰 아이콘은 그대로)
          iconFilter: plant.status === 'ANOMALY' ? ANOMALY_PIN_FILTER[plant.type as EnergySource] : undefined,
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
  }, [plants, layers, selected, selectPlant, hiddenTypes]);

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

      {!overlaysHidden && (
        <>
          {/* Top HUD + 발전원 필터 칩 */}
          <div ref={hudRef} className="absolute top-3 left-4 right-[396px] z-10 flex flex-col items-start gap-2">
            <StatusHud plants={plants} />
            <SourceChips plants={plants} hidden={hiddenTypes} onToggle={toggleType} />
          </div>

          {/* Marker hover tooltip */}
          {hoveredPlant && <MarkerTooltip plant={hoveredPlant} position={hoverPos} />}

          {/* Right panel overlay */}
          <div className="absolute top-3 right-4 bottom-3 z-10 w-[380px] flex flex-col gap-3 overflow-hidden">
            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#000C17]/95 p-4 space-y-4">
              <SidePanel plants={plants} selected={selected} onSelectPlant={selectPlant} onBack={() => setSelected(null)} />
            </div>
          </div>
        </>
      )}

      {/* 패널 숨기기 / 보이기 */}
      <button
        type="button"
        onClick={() => setOverlaysHidden((v) => !v)}
        className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-[#000C17]/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-[#000C17] transition-colors"
        title={overlaysHidden ? '패널 보이기' : '패널 숨기기'}
      >
        {overlaysHidden ? <Eye size={16} /> : <EyeOff size={16} />}
        {overlaysHidden ? '패널 보이기' : '패널 숨기기'}
      </button>
    </div>
  );
}

/** 발전원 필터 칩 — 태양광 / ORC / 연료전지 (개수 표시, 끄면 회색 + 마커 숨김) */
function SourceChips({
  plants,
  hidden,
  onToggle,
}: {
  plants: MonitoringPlant[];
  hidden: Set<EnergySource>;
  onToggle: (t: EnergySource) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#000C17]/95 p-1.5">
      {SOURCE_ORDER.map((type) => {
        const { label, color, icon: Icon } = SOURCE[type];
        const count = plants.filter((p) => (p.type as EnergySource) === type).length;
        const off = hidden.has(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => onToggle(type)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/[0.08]',
              off ? 'text-slate-500' : 'text-white',
            )}
          >
            <Icon size={16} style={{ color: off ? '#64748B' : color }} />
            {label}
            <span className={cn('text-xs font-medium', off ? 'text-slate-600' : 'text-slate-400')}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
