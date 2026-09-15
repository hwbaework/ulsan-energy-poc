// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  _TrendingUp,
  Target,
  AlertTriangle,
  AlertCircle,
  _CheckCircle2,
  Sun,
  Wind,
  Battery,
  Zap,
  Cloud,
  CloudRain,
  _Wifi,
  Calendar,
  ChevronDown,
  Download,
  FileText,
  FileSpreadsheet,
  _Activity,
  GitBranch,
  RefreshCcw,
  Cpu,
  Database,
  _Hash,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsLineChart, RmsBarChart } from '@/components/ui/Chart';
import { cn, exportCsv, exportExcel } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';

/* ─────────────────────────────────────────────
   Types & meta
   ───────────────────────────────────────────── */
export type Tab = 'prediction' | 'compare' | 'error' | 'model';
type EnergySource = 'solar' | 'wind' | 'ess' | 'bio';

const SOURCE_META_MAP: Record<string, { label: string; icon: any; color: string; bg: string; ring: string }> = {
  solar: { label: '태양광', icon: Sun, color: 'text-amber-400', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  wind: { label: '풍력', icon: Wind, color: 'text-sky-400', bg: 'bg-sky-500/[0.10]', ring: 'ring-sky-500/30' },
  ess: { label: 'ESS', icon: Battery, color: 'text-rose-400', bg: 'bg-rose-500/[0.10]', ring: 'ring-rose-500/30' },
  bio: { label: '바이오', icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/[0.10]', ring: 'ring-violet-500/30' },
};
const SOURCE_META = new Proxy(SOURCE_META_MAP, {
  get: (t, k) =>
    t[k as string] ?? {
      label: '기타',
      icon: Zap,
      color: 'text-slate-400',
      bg: 'bg-slate-500/[0.10]',
      ring: 'ring-slate-500/30',
    },
}) as Record<EnergySource, (typeof SOURCE_META_MAP)[string]>;

type Plant = { id: string; name: string; owner: string; source: EnergySource; capacity: number };
const STATIC_PLANTS: Plant[] = [];

/* ─────────────────────────────────────────────
   D+1 예측 (시간 단위 — 15분 단위는 다운로드용)
   ───────────────────────────────────────────── */
function buildD1Forecast(plant: Plant) {
  const capacityKw = plant.capacity * 1000;
  return Array.from({ length: 24 }, (_, i) => {
    const isDay = i >= 6 && i <= 18;
    let p50 = 0;
    if (plant.source === 'solar') p50 = isDay ? Math.sin(((i - 6) / 12) * Math.PI) * capacityKw * 0.85 : 0;
    else if (plant.source === 'wind') p50 = capacityKw * (0.45 + Math.random() * 0.3);
    else if (plant.source === 'ess') p50 = i >= 18 || i <= 6 ? capacityKw * 0.7 : capacityKw * 0.2;
    else p50 = capacityKw * 0.85;
    const p90 = p50 * 0.78;
    return {
      time: `${String(i).padStart(2, '0')}h`,
      P50: Math.round(p50),
      P90: Math.round(p90),
    };
  });
}

/* 모델별 비교 (시간 단위) */
function buildModelCompare(plant: Plant) {
  const capacityKw = plant.capacity * 1000;
  return Array.from({ length: 24 }, (_, i) => {
    const isDay = i >= 6 && i <= 18;
    const base =
      plant.source === 'solar'
        ? isDay
          ? Math.sin(((i - 6) / 12) * Math.PI) * capacityKw * 0.85
          : 0
        : plant.source === 'wind'
          ? capacityKw * (0.5 + Math.random() * 0.25)
          : capacityKw * 0.5;
    return {
      time: `${String(i).padStart(2, '0')}h`,
      LSTM: Math.round(base * (1 + (Math.random() - 0.5) * 0.06)),
      XGBoost: Math.round(base * (1 + (Math.random() - 0.5) * 0.08)),
      앙상블: Math.round(base * (1 + (Math.random() - 0.5) * 0.04)),
    };
  });
}

/* 예측 vs 실적 비교 차트 (현재까지) */
function buildPredictionVsActual(plant: Plant, hours: number) {
  const capacityKw = plant.capacity * 1000;
  return Array.from({ length: hours }, (_, i) => {
    const isDay = i % 24 >= 6 && i % 24 <= 18;
    const baseGen =
      plant.source === 'solar'
        ? isDay
          ? Math.sin((((i % 24) - 6) / 12) * Math.PI) * capacityKw * 0.85
          : 0
        : plant.source === 'wind'
          ? capacityKw * (0.5 + Math.random() * 0.25)
          : capacityKw * 0.5;
    const predicted = Math.round(baseGen);
    const actual = Math.round(baseGen * (1 + (Math.random() - 0.5) * 0.12));
    return {
      time: hours <= 24 ? `${String(i).padStart(2, '0')}h` : `${i + 1}일`,
      예측: predicted,
      실적: actual,
    };
  });
}

/* ─────────────────────────────────────────────
   기상예보 (D+1)
   ───────────────────────────────────────────── */
const WEATHER_FORECAST = [
  { time: '06h', temp: 14, condition: 'cloud', irradiance: 220, windSpeed: 2.4 },
  { time: '09h', temp: 18, condition: 'sun', irradiance: 580, windSpeed: 3.1 },
  { time: '12h', temp: 22, condition: 'sun', irradiance: 820, windSpeed: 4.2 },
  { time: '15h', temp: 23, condition: 'cloud', irradiance: 540, windSpeed: 5.1 },
  { time: '18h', temp: 19, condition: 'rain', irradiance: 80, windSpeed: 3.8 },
  { time: '21h', temp: 16, condition: 'cloud', irradiance: 0, windSpeed: 2.6 },
];

const WEATHER_ICON = {
  sun: { Icon: Sun, color: 'text-amber-400' },
  cloud: { Icon: Cloud, color: 'text-slate-300' },
  rain: { Icon: CloudRain, color: 'text-sky-400' },
};

/* ─────────────────────────────────────────────
   오차 분석
   ───────────────────────────────────────────── */
type ErrorRow = {
  id: string;
  plantId: string;
  plantName: string;
  source: EnergySource;
  errorAvg: number; // %
  rmse: number; // kWh
  over4pct: number; // ±4% 초과 횟수
  over6pct: number; // ±6% 초과 (KPX 페널티 임계)
  trend: number; // 전월 대비 (% point)
};

function buildErrorRows(plants: Plant[]): ErrorRow[] {
  const seeds = [
    { errorAvg: 4.1, rmse: 52, over4pct: 6, over6pct: 1, trend: -0.3 },
    { errorAvg: 3.9, rmse: 48, over4pct: 5, over6pct: 1, trend: -0.5 },
    { errorAvg: 5.4, rmse: 18, over4pct: 8, over6pct: 2, trend: +0.6 },
    { errorAvg: 4.8, rmse: 38, over4pct: 7, over6pct: 2, trend: +0.2 },
    { errorAvg: 3.5, rmse: 42, over4pct: 4, over6pct: 0, trend: -0.1 },
  ];
  return plants.map((p, i) => ({
    id: `e${i + 1}`,
    plantId: p.id,
    plantName: p.name,
    source: p.source,
    ...seeds[i % seeds.length],
  }));
}

/* 발전소별 30일 누적 오차 추이 */
function buildErrorTrend(errorRows: ErrorRow[], plantId: string) {
  const baseError = errorRows.find((e) => e.plantId === plantId)?.errorAvg ?? 5;
  return Array.from({ length: 30 }, (_, i) => ({
    day: `${i + 1}일`,
    오차율: +(baseError + (Math.random() - 0.5) * 2.5).toFixed(1),
    임계_KPX: 6,
  }));
}

/* ─────────────────────────────────────────────
   페널티 발생 로그
   ───────────────────────────────────────────── */
type PenaltyLog = {
  id: string;
  datetime: string;
  plantName: string;
  reason: string;
  errorPct: number;
  amount: number;
  bearer: 'generator' | 'spc' | 'shared';
  bearerNote: string;
};

function buildPenaltyLogs(plants: Plant[]): PenaltyLog[] {
  const templates = [
    {
      datetime: '2026-05-22 14:30',
      reason: '일사량 급변 (구름)',
      errorPct: 7.8,
      amount: 12000,
      bearer: 'generator' as const,
      bearerNote: '기상 예보 오차',
    },
    {
      datetime: '2026-05-15 09:00',
      reason: '인버터 일시 정지',
      errorPct: 6.2,
      amount: 18000,
      bearer: 'shared' as const,
      bearerNote: '설비 특성에 따른 공동 분담',
    },
  ];
  return templates.map((t, i) => ({
    id: `pl${i + 1}`,
    plantName: plants[Math.min(i + 2, plants.length - 1)]?.name ?? '알 수 없음',
    ...t,
  }));
}

const BEARER_META = {
  generator: { label: '발전사업자', tone: 'text-amber-300', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  spc: { label: 'SPC', tone: 'text-violet-300', bg: 'bg-violet-500/[0.10]', ring: 'ring-violet-500/30' },
  shared: { label: '공동 분담', tone: 'text-blue-300', bg: 'bg-blue-500/[0.10]', ring: 'ring-blue-500/30' },
};

const RESPONSIBILITY = [
  { name: '발전사업자', 분담률: 56 },
  { name: 'SPC', 분담률: 30 },
  { name: '공동 분담', 분담률: 14 },
];

/* ─────────────────────────────────────────────
   모델 성능
   ───────────────────────────────────────────── */
type ModelInfo = {
  name: string;
  version: string;
  accuracy: number; // %
  lastTrained: string;
  status: 'active' | 'staging' | 'deprecated';
  description: string;
};

const MODELS: ModelInfo[] = [
  {
    name: 'LSTM',
    version: 'v3.2.1',
    accuracy: 94.8,
    lastTrained: '2026-04-28',
    status: 'active',
    description: '시계열 딥러닝 기반 예측 모델',
  },
  {
    name: 'XGBoost',
    version: 'v2.1.0',
    accuracy: 92.4,
    lastTrained: '2026-04-25',
    status: 'active',
    description: '기상·시간 피처 기반 앙상블',
  },
  {
    name: '앙상블',
    version: 'v1.5.0',
    accuracy: 96.2,
    lastTrained: '2026-04-28',
    status: 'active',
    description: 'LSTM + XGBoost 가중 평균',
  },
];

const MODEL_ACCURACY_TREND = [
  { month: '12월', LSTM: 92.1, XGBoost: 90.4, 앙상블: 93.8 },
  { month: '1월', LSTM: 92.8, XGBoost: 91.2, 앙상블: 94.5 },
  { month: '2월', LSTM: 93.4, XGBoost: 91.8, 앙상블: 95.1 },
  { month: '3월', LSTM: 93.6, XGBoost: 92.0, 앙상블: 95.4 },
  { month: '4월', LSTM: 94.8, XGBoost: 92.4, 앙상블: 96.2 },
];

function buildRetrainAlerts(plants: Plant[]) {
  const templates = [
    { reason: '정확도 임계 미달 (88.2% < 90%)', severity: 'critical' as const },
    { reason: '오차율 상승 추세 (3주 연속 +1.0%p)', severity: 'warning' as const },
    { reason: '학습 데이터 부족 (90일 미만)', severity: 'info' as const },
  ];
  return templates.slice(0, Math.min(templates.length, plants.length)).map((t, i) => ({
    plantName: plants[i]?.name ?? '알 수 없음',
    ...t,
  }));
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
function _fmtEnergy(kwh: number) {
  if (Math.abs(kwh) >= 1_000_000) return `${(kwh / 1_000_000).toFixed(2)} GWh`;
  if (Math.abs(kwh) >= 1_000) return `${(kwh / 1_000).toFixed(1)} MWh`;
  return `${kwh.toLocaleString()} kWh`;
}
function fmtKrw(n: number) {
  if (Math.abs(n) >= 100_000_000) return `₩ ${(n / 100_000_000).toFixed(2)}억`;
  if (Math.abs(n) >= 10_000) return `₩ ${(n / 10_000).toFixed(0)}만`;
  return `₩ ${n.toLocaleString()}`;
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export function PlatformPpaForecastContent({ defaultTab = 'prediction' }: { defaultTab?: Tab }) {
  const _router = useRouter();
  const { data: monitoringPlants } = useMonitoringPlants();
  const [tab, _setTab] = useState<Tab>(defaultTab);
  const [showConfidence, setShowConfidence] = useState(true);
  const [showModels, setShowModels] = useState(false);
  const [compareRange, setCompareRange] = useState<'1d' | '7d' | '30d'>('1d');
  const [modelDetail, setModelDetail] = useState<ModelInfo | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerAccuracy, setTriggerAccuracy] = useState(90);
  const [triggerErrorPct, setTriggerErrorPct] = useState(6);
  const [triggerMinDays, setTriggerMinDays] = useState(90);

  const PLANTS = useMemo<Plant[]>(() => {
    if (!monitoringPlants?.length) return STATIC_PLANTS;
    return monitoringPlants.map((mp) => ({
      id: `p-${mp.plantId}`,
      name: mp.name,
      owner: mp.name.replace(/^울산\s*/, ''),
      source: (mp.type === 'SOLAR'
        ? 'solar'
        : mp.type === 'WIND'
          ? 'wind'
          : mp.type === 'ESS'
            ? 'ess'
            : 'solar') as EnergySource,
      capacity: mp.capacity / 1000,
    }));
  }, [monitoringPlants]);

  const [plantId, setPlantId] = useState<string>('');
  const effectivePlantId = plantId || PLANTS[0]?.id || 'p-17511';
  const plant = PLANTS.find((p) => p.id === effectivePlantId) ?? PLANTS[0];
  const _meta = plant ? SOURCE_META[plant.source] : SOURCE_META['solar'];
  const compareHours = compareRange === '1d' ? 24 : compareRange === '7d' ? 7 : 30;

  const ERROR_ROWS = useMemo(() => buildErrorRows(PLANTS), [PLANTS]);
  const PENALTY_LOGS = useMemo(() => buildPenaltyLogs(PLANTS), [PLANTS]);
  const RETRAIN_ALERTS = useMemo(() => buildRetrainAlerts(PLANTS), [PLANTS]);

  const errorTotals = useMemo(() => {
    if (!ERROR_ROWS.length) return { avg: 0, over4: 0, over6: 0 };
    const avg = ERROR_ROWS.reduce((s, r) => s + r.errorAvg, 0) / ERROR_ROWS.length;
    const over4 = ERROR_ROWS.reduce((s, r) => s + r.over4pct, 0);
    const over6 = ERROR_ROWS.reduce((s, r) => s + r.over6pct, 0);
    return { avg, over4, over6 };
  }, [ERROR_ROWS]);

  const penaltyTotal = PENALTY_LOGS.reduce((s, p) => s + p.amount, 0);

  if (!plant) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">발전소 데이터를 불러오는 중...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <Breadcrumb
        items={[
          { label: '전력거래', path: '/platform/trading' },
          { label: '직접 PPA' },
          { label: '발전량 예측·오차율' },
        ]}
      />

      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">발전량 예측·오차율</h1>
          <p className="mt-1 text-sm text-slate-400">
            D+1 예측 (KPX 의무 제출) · 실시간 보정 · 오차 추적 · 페널티 관리
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
          <Calendar size={12} />
          <span>2026-05-05 (월)</span>
        </div>
      </div>

      {/* 발전소 셀렉터 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-500">발전소</span>
        <div className="flex flex-wrap gap-1.5">
          {PLANTS.map((p) => {
            const m = SOURCE_META[p.source];
            const isActive = effectivePlantId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPlantId(p.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border h-8 px-3.5 text-xs transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/[0.10] text-primary font-semibold'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white',
                )}
              >
                <m.icon size={12} className={m.color} />
                <span>{p.name}</span>
                <span className="text-[10px] opacity-60 tabular-nums">{p.capacity} MW</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────── 예측 ─────────────── */}
      {tab === 'prediction' && (
        <div className="space-y-6">
          {/* D+1 예측 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <Target size={14} className="text-emerald-300" />
                  D+1 예측
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.10] ring-1 ring-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300">
                    KPX 의무 제출
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {plant.name} · 시간대별 (15분 단위 다운로드 가능) · KMA 기상예보 연동
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfidence((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border h-8 px-3.5 text-xs transition-colors',
                    showConfidence
                      ? 'border-violet-500/30 bg-violet-500/[0.08] text-violet-300'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white',
                  )}
                >
                  <GitBranch size={11} />
                  P50 / P90 신뢰구간
                </button>
                <Dropdown
                  align="right"
                  trigger={
                    <button className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 text-xs text-emerald-200 hover:bg-emerald-500/[0.12]">
                      <Download size={11} />
                      KPX 제출 양식
                      <ChevronDown size={11} className="opacity-60" />
                    </button>
                  }
                >
                  <DropdownItem
                    onClick={() => {
                      const d = buildD1Forecast(plant);
                      exportCsv(
                        `예측-${plant.name}-${new Date().toISOString().slice(0, 10)}`,
                        ['시간', 'P50(kWh)', 'P90(kWh)'],
                        d.map((r) => [r.time, r.P50, r.P90]),
                      );
                    }}
                  >
                    <FileText size={12} className="mr-2 inline" />
                    CSV (15분 단위)
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      const d = buildD1Forecast(plant);
                      exportExcel(
                        `예측-${plant.name}-${new Date().toISOString().slice(0, 10)}`,
                        'KPX제출',
                        ['시간', 'P50(kWh)', 'P90(kWh)'],
                        d.map((r) => [r.time, r.P50, r.P90]),
                      );
                    }}
                  >
                    <FileSpreadsheet size={12} className="mr-2 inline" />
                    Excel (KPX 제출 양식)
                  </DropdownItem>
                </Dropdown>
              </div>
            </div>

            <RmsLineChart
              data={buildD1Forecast(plant)}
              xKey="time"
              lines={
                showConfidence
                  ? [
                      { key: 'P50', name: 'P50 (예상치)', color: '#10B981' },
                      { key: 'P90', name: 'P90 (보수치)', color: '#8B5CF6' },
                    ]
                  : [{ key: 'P50', name: '예측 발전량 (kWh)', color: '#10B981' }]
              }
              height={260}
              className="!p-0 !ring-0 !bg-transparent"
            />

            {showConfidence && (
              <div className="rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] p-3 text-[11px]">
                <p className="text-violet-200 font-medium mb-1">신뢰구간 해석</p>
                <p className="text-violet-300/80">
                  <span className="font-semibold">P50</span> = 가장 가능성 높은 추정치 (예상 발전량) ·
                  <span className="font-semibold ml-1">P90</span> = 보수적 추정치 (해당 값 이하일 확률 90%, 페널티
                  회피용)
                </p>
              </div>
            )}

            {/* 기상예보 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">D+1 기상예보 (KMA)</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {WEATHER_FORECAST.map((w, i) => {
                  const wi = WEATHER_ICON[w.condition];
                  return (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
                      <p className="text-[11px] text-slate-500 tabular-nums">{w.time}</p>
                      <wi.Icon size={20} className={cn('mx-auto my-1.5', wi.color)} />
                      <p className="text-sm text-white tabular-nums">{w.temp}°</p>
                      <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                        {plant.source === 'solar' ? `${w.irradiance} W/m²` : `${w.windSpeed} m/s`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* D-day 실시간 보정 + 모델 비교 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <RefreshCcw size={14} className="text-blue-300" />
                  D-day 실시간 보정
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">실측치 기반 잔여시간 재예측 · 모델별 비교</p>
              </div>
              <button
                onClick={() => setShowModels((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border h-8 px-3.5 text-xs transition-colors',
                  showModels
                    ? 'border-blue-500/30 bg-blue-500/[0.08] text-blue-300'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white',
                )}
              >
                <Cpu size={11} />
                모델별 비교 {showModels ? '숨김' : '표시'}
              </button>
            </div>

            {showModels ? (
              <RmsLineChart
                data={buildModelCompare(plant)}
                xKey="time"
                lines={[
                  { key: 'LSTM', name: 'LSTM', color: '#3B82F6' },
                  { key: 'XGBoost', name: 'XGBoost', color: '#F59E0B' },
                  { key: '앙상블', name: '앙상블', color: '#10B981' },
                ]}
                height={240}
                className="!p-0 !ring-0 !bg-transparent"
              />
            ) : (
              <div className="rounded-lg border border-blue-500/[0.20] bg-blue-500/[0.04] p-4 text-xs text-slate-400">
                실시간 보정은 매 시간 KPX 계량 데이터 수신 후 자동 갱신됩니다.
                <span className="ml-2 text-blue-300">최근 갱신: 14:15</span>
              </div>
            )}

            {showModels && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="font-semibold text-blue-300">LSTM</p>
                  <p className="text-slate-400 mt-0.5">시계열 딥러닝. 시간 패턴 강점, 태양광·풍력 적합.</p>
                </div>
                <div>
                  <p className="font-semibold text-amber-300">XGBoost</p>
                  <p className="text-slate-400 mt-0.5">그래디언트 부스팅. 빠르고 변수 영향력 해석 가능.</p>
                </div>
                <div>
                  <p className="font-semibold text-emerald-300">앙상블</p>
                  <p className="text-slate-400 mt-0.5">여러 모델 가중평균. 일반적으로 단일 모델보다 정확.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────── 예측 vs 실적 ─────────────── */}
      {tab === 'compare' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-md font-semibold text-white">{plant.name} · 예측 vs 실적</h3>
                <p className="mt-0.5 text-xs text-slate-400">예측·실적 라인 + 오차 영역 · 단위: kWh</p>
              </div>
              <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06] text-xs">
                {(['1d', '7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setCompareRange(r)}
                    className={cn(
                      'rounded px-3',
                      compareRange === r ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                    )}
                  >
                    {r === '1d' ? '1일' : r === '7d' ? '7일' : '30일'}
                  </button>
                ))}
              </div>
            </div>
            <RmsLineChart
              data={buildPredictionVsActual(plant, compareHours)}
              xKey="time"
              lines={[
                { key: '예측', name: '예측', color: '#8B5CF6' },
                { key: '실적', name: '실적', color: '#10B981' },
              ]}
              height={300}
              className="!p-0 !ring-0 !bg-transparent"
            />
          </div>
        </div>
      )}

      {/* ─────────────── 오차·페널티 ─────────────── */}
      {tab === 'error' && (
        <div className="space-y-6">
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="평균 오차율"
              value={`${errorTotals.avg.toFixed(1)}%`}
              sub="KPX 임계 ±5%"
              icon={Target}
              tone={errorTotals.avg <= 5 ? 'emerald' : 'amber'}
            />
            <KpiCard
              label="±4% 초과"
              value={`${errorTotals.over4}회`}
              sub="누적 (30일)"
              icon={AlertCircle}
              tone="amber"
            />
            <KpiCard
              label="±6% 초과"
              value={`${errorTotals.over6}회`}
              sub="KPX 페널티 발생"
              icon={AlertTriangle}
              tone="rose"
            />
            <KpiCard
              label="페널티 누적"
              value={fmtKrw(penaltyTotal)}
              sub={`${PENALTY_LOGS.length}건`}
              icon={AlertCircle}
              tone="rose"
            />
          </div>

          {/* 발전소별 오차 테이블 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3">
              <h3 className="text-md font-semibold text-white">발전소별 오차 통계</h3>
              <p className="mt-0.5 text-xs text-slate-400">KPX 정산 임계 ±4%, ±6% 초과 카운트</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                    <th className="text-left font-medium px-4 py-3">발전소</th>
                    <th className="font-medium px-3 py-3">평균 오차율</th>
                    <th className="font-medium px-3 py-3">RMSE</th>
                    <th className="font-medium px-3 py-3">±4% 초과</th>
                    <th className="font-medium px-3 py-3">±6% 초과 (KPX)</th>
                    <th className="font-medium px-3 py-3">전월 대비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {ERROR_ROWS.map((e) => {
                    const m = SOURCE_META[e.source];
                    return (
                      <tr
                        key={e.id}
                        onClick={() => setPlantId(e.plantId)}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn('flex h-7 w-7 items-center justify-center rounded ring-1', m.bg, m.ring)}
                            >
                              <m.icon size={12} className={m.color} />
                            </span>
                            <span className="font-medium text-white">{e.plantName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          <span
                            className={cn(
                              'font-medium',
                              e.errorAvg <= 4
                                ? 'text-emerald-300'
                                : e.errorAvg <= 6
                                  ? 'text-amber-300'
                                  : 'text-rose-300',
                            )}
                          >
                            {e.errorAvg.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-slate-300">{e.rmse.toLocaleString()} kWh</td>
                        <td className="px-3 py-3 tabular-nums text-amber-300">{e.over4pct}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {e.over6pct > 0 ? (
                            <span className="text-rose-300 font-semibold">{e.over6pct}</span>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          <span className={e.trend < 0 ? 'text-emerald-300' : 'text-rose-300'}>
                            {e.trend > 0 ? '+' : ''}
                            {e.trend.toFixed(1)}p
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 30일 오차 추이 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-md font-semibold text-white">{plant.name} · 30일 오차율 추이</h3>
                <p className="mt-0.5 text-xs text-slate-400">KPX 페널티 임계 ±6% 점선 표시</p>
              </div>
            </div>
            <RmsLineChart
              data={buildErrorTrend(ERROR_ROWS, effectivePlantId)}
              xKey="day"
              lines={[
                { key: '오차율', name: '오차율 (%)', color: '#3B82F6' },
                { key: '임계_KPX', name: 'KPX 임계 (±6%)', color: '#EF4444' },
              ]}
              height={240}
              className="!p-0 !ring-0 !bg-transparent"
            />
          </div>

          {/* 페널티 발생 로그 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-3">
                <h3 className="text-md font-semibold text-white">페널티 발생 로그</h3>
                <p className="mt-0.5 text-xs text-slate-400">사유 · 부담 주체 · 분담률</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {PENALTY_LOGS.map((p) => {
                  const bm = BEARER_META[p.bearer];
                  return (
                    <div key={p.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="rounded bg-rose-500/[0.10] ring-1 ring-rose-500/30 p-2 mt-0.5">
                          <AlertTriangle size={12} className="text-rose-300" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-white font-medium">{p.plantName}</p>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1',
                                bm.bg,
                                bm.tone,
                                bm.ring,
                              )}
                            >
                              {bm.label}
                            </span>
                            <span className="text-[10px] text-slate-500 tabular-nums">{p.bearerNote}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">{p.reason}</p>
                          <div className="mt-1 flex items-center gap-3 text-[11px]">
                            <span className="text-slate-500 tabular-nums">{p.datetime}</span>
                            <span className="text-rose-300 tabular-nums font-medium">
                              오차 {p.errorPct > 0 ? '+' : ''}
                              {p.errorPct}%
                            </span>
                            <span className="ml-auto tabular-nums text-rose-300 font-bold">{fmtKrw(p.amount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 책임 분배 */}
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
              <h3 className="text-md font-semibold text-white mb-1">책임 분배율</h3>
              <p className="text-[11px] text-slate-500 mb-3">누적 페널티 부담 비율 (%)</p>
              <RmsBarChart
                data={RESPONSIBILITY}
                xKey="name"
                bars={[{ key: '분담률', name: '분담률 (%)', color: '#F59E0B' }]}
                height={220}
                className="!p-0 !ring-0 !bg-transparent"
              />
              <div className="mt-3 rounded-lg bg-white/[0.02] p-3 text-[11px] text-slate-400">
                <p className="text-white font-medium mb-1">총 누적 페널티</p>
                <p className="text-rose-300 text-base font-bold tabular-nums">{fmtKrw(penaltyTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── 모델 성능 ─────────────── */}
      {tab === 'model' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] p-3 text-xs text-violet-200 flex items-start gap-2">
            <Cpu size={13} className="mt-0.5" />
            <span>예측 모델 모니터링 — 운영자/AI 엔지니어용 화면</span>
          </div>

          {/* 모델 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MODELS.filter((m) => m.status === 'active').map((m) => (
              <div key={`${m.name}-${m.version}`} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                  <span className="rounded bg-violet-500/[0.10] ring-1 ring-violet-500/30 px-1.5 py-0.5 text-[10px] tabular-nums text-violet-300 font-mono">
                    {m.version}
                  </span>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {m.accuracy.toFixed(1)}
                  <span className="text-sm text-slate-500 font-normal">%</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  최종 학습: <span className="tabular-nums">{m.lastTrained}</span>
                </p>
                <p className="mt-2 text-[11px] text-slate-400">{m.description}</p>
                <button
                  onClick={() => setModelDetail(m)}
                  className="mt-3 text-[11px] text-primary hover:text-primary/80 inline-flex items-center gap-1"
                >
                  상세
                  <ArrowRight size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* 정확도 추이 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <h3 className="text-md font-semibold text-white mb-1">모델 버전별 정확도 추이</h3>
            <p className="text-[11px] text-slate-500 mb-3">최근 5개월 · 단위: %</p>
            <RmsLineChart
              data={MODEL_ACCURACY_TREND}
              xKey="month"
              lines={[
                { key: 'LSTM', name: 'LSTM', color: '#3B82F6' },
                { key: 'XGBoost', name: 'XGBoost', color: '#F59E0B' },
                { key: '앙상블', name: '앙상블', color: '#10B981' },
              ]}
              height={240}
              className="!p-0 !ring-0 !bg-transparent"
            />
          </div>

          {/* 재학습 트리거 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-md font-semibold text-white">재학습 트리거 / 데이터 부족 알림</h3>
                <p className="mt-0.5 text-xs text-slate-400">정확도 임계 미달 / 데이터 부족 자동 감지</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setTriggerOpen(true)}>
                <Settings size={12} className="mr-1.5" />
                트리거 설정
              </Button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {RETRAIN_ALERTS.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      a.severity === 'critical'
                        ? 'bg-rose-500/[0.12]'
                        : a.severity === 'warning'
                          ? 'bg-amber-500/[0.12]'
                          : 'bg-blue-500/[0.10]',
                    )}
                  >
                    {a.severity === 'critical' ? (
                      <AlertCircle size={14} className="text-rose-300" />
                    ) : a.severity === 'warning' ? (
                      <AlertTriangle size={14} className="text-amber-300" />
                    ) : (
                      <Database size={14} className="text-blue-300" />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{a.plantName}</p>
                    <p className="text-[11px] text-slate-500">{a.reason}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `${a.plantName} 모델 재학습을 시작하시겠습니까?\n학습 완료까지 약 30분~1시간 소요됩니다.`,
                        )
                      )
                        return;
                      useToastStore
                        .getState()
                        .add('success', `${a.plantName} 재학습이 시작되었습니다. 완료 시 알림됩니다.`);
                    }}
                  >
                    <RefreshCcw size={11} className="mr-1.5" />
                    재학습 시작
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 트리거 설정 모달 */}
      <Modal open={triggerOpen} onClose={() => setTriggerOpen(false)} title="재학습 트리거 설정" size="md">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">정확도 임계값 (%)</label>
            <p className="text-[11px] text-slate-500">모델 정확도가 이 값 미만이면 재학습 트리거</p>
            <input
              type="number"
              min={50}
              max={100}
              step={1}
              value={triggerAccuracy}
              onChange={(e) => setTriggerAccuracy(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">오차율 임계값 (%)</label>
            <p className="text-[11px] text-slate-500">KPX 기준 오차율이 이 값을 초과하면 알림</p>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={triggerErrorPct}
              onChange={(e) => setTriggerErrorPct(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">최소 학습 데이터 (일)</label>
            <p className="text-[11px] text-slate-500">이 일수 미만이면 데이터 부족 알림</p>
            <input
              type="number"
              min={30}
              max={365}
              step={1}
              value={triggerMinDays}
              onChange={(e) => setTriggerMinDays(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setTriggerOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                useToastStore
                  .getState()
                  .add(
                    'success',
                    `트리거 설정 저장: 정확도 ${triggerAccuracy}%, 오차율 ${triggerErrorPct}%, 최소 ${triggerMinDays}일`,
                  );
                setTriggerOpen(false);
              }}
            >
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* 모델 상세 모달 */}
      {modelDetail && (
        <Modal
          open={!!modelDetail}
          onClose={() => setModelDetail(null)}
          size="md"
          title={`${modelDetail.name} ${modelDetail.version}`}
          footer={
            <Button variant="ghost" onClick={() => setModelDetail(null)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <DetailRow label="모델" value={`${modelDetail.name} ${modelDetail.version}`} mono />
              <DetailRow label="정확도" value={`${modelDetail.accuracy.toFixed(1)}%`} mono />
              <DetailRow label="최종 학습" value={modelDetail.lastTrained} mono />
              <DetailRow
                label="상태"
                value={
                  modelDetail.status === 'active' ? '운영중' : modelDetail.status === 'staging' ? '검증중' : '폐기'
                }
              />
            </div>
            <div className="rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] p-3 text-[11px] text-violet-200">
              {modelDetail.description}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Reusable bits
   ───────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
}) {
  const map = {
    emerald: 'text-emerald-300 bg-emerald-500/[0.10]',
    amber: 'text-amber-300 bg-amber-500/[0.10]',
    rose: 'text-rose-300 bg-rose-500/[0.10]',
    blue: 'text-blue-300 bg-blue-500/[0.10]',
    violet: 'text-violet-300 bg-violet-500/[0.10]',
  };
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', map[tone])}>
        <Icon size={16} />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 tabular-nums">{sub}</p>}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={cn('text-sm text-white text-right truncate', mono && 'tabular-nums')}>{value}</span>
    </div>
  );
}
