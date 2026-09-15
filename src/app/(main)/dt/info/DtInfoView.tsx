'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Wind, Droplets, Thermometer, CloudRain } from 'lucide-react';
import {
  Zap,
  Sun,
  Battery,
  Gauge,
  TrendingUp,
  DollarSign,
  Factory,
  Activity,
  MapPin,
  X,
  Maximize2,
  Minimize2,
  CircleCheck,
  AlertTriangle,
  Building2,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { StatusBadge } from '@/components/features/StatusBadge';
import { GenerationTrendCard } from '@/components/features/dashboard/GenerationTrendCard';
import { PlantStatusTable, type PlantRow } from '@/components/features/dashboard/PlantStatusTable';
import { Badge } from '@/components/ui/Badge';
import {
  MapBackdrop,
  type MapView,
  type MapStyleKey,
  type LightPreset,
  type Weather,
  type WxStation,
  type WxLayer,
} from './MapBackdrop';

type Tier = 'L0' | 'L1' | 'L2' | 'L3';

const TIER_META: Record<Tier, { name: string; scope: string; sees: string; view: MapView }> = {
  L0: {
    name: '계통·거래',
    scope: '전국 송전망',
    sees: '변전소 · 거래액',
    view: { center: [128.15, 36.3], zoom: 6.05, pitch: 24, bearing: -8 },
  },
  L1: {
    name: '지역',
    scope: '울산권',
    sees: '산단 · 부하',
    view: { center: [129.36, 35.46], zoom: 10.4, pitch: 46, bearing: -14 },
  },
  L2: {
    name: '관리·DT',
    scope: '온산국가산단',
    sees: '단지 트윈 · PPA',
    view: { center: [129.34, 35.435], zoom: 13.6, pitch: 55, bearing: -20 },
  },
  L3: {
    name: '모니터링',
    scope: '온산 · 설비',
    sees: '설비 상태 · 알람',
    view: { center: [129.34, 35.435], zoom: 15.6, pitch: 60, bearing: -24 },
  },
};

// 세로축 = 고도. 위(L0) = 전국/고고도, 아래(L3) = 설비/지상
const TIERS: Tier[] = ['L0', 'L1', 'L2', 'L3'];

// ── 인라인 스파크라인 (Chart 의존 없이 발전량 추이 표현) ──
function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  const w = 640,
    h = 150,
    pad = 8;
  const max = Math.max(...data),
    min = Math.min(...data);
  const nx = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const ny = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${nx(i).toFixed(1)},${ny(v).toFixed(1)}`).join(' ');
  const area = `${line} L${nx(data.length - 1)},${h} L${nx(0)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 150 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function TrendBlock({ desc, data, color }: { desc: string; data: number[]; color?: string }) {
  const [unit, setUnit] = useState('day');
  return (
    <GenerationTrendCard
      description={desc}
      timeUnits={[
        { value: 'day', label: '일' },
        { value: 'month', label: '월' },
        { value: 'year', label: '연' },
      ]}
      activeUnit={unit}
      onUnitChange={setUnit}
      dateLabel="2026-07-01"
      onPrev={() => {}}
      onNext={() => {}}
    >
      <Sparkline data={data} color={color} />
    </GenerationTrendCard>
  );
}

// ── 미니 테이블 행 (L0/L1 요약) ──
function Row({
  icon,
  name,
  sub,
  right,
  tone,
}: {
  icon: ReactNode;
  name: string;
  sub: string;
  right: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-slate-500">{sub}</p>
      </div>
      <span className={`text-sm font-semibold ${tone ?? 'text-white'}`}>{right}</span>
    </div>
  );
}

// ── 실기상(KMA /api/weather) HUD — 온도/강수/풍향 클릭 시 지도 레이어 토글 ──
const COMPASS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
const toCompass = (deg: number) => COMPASS[Math.round((deg % 360) / 45) % 8]!;
const WX_LEGEND: Record<
  Exclude<WxLayer, 'none'>,
  { from: string; to: string; lo: string; hi: string; title: string }
> = {
  temp: { from: '#dcfce7', to: '#166534', lo: '8°', hi: '30°', title: '기온' },
  precip: { from: '#e0e7ff', to: '#312e81', lo: '0', hi: '15㎜', title: '강수' },
  wind: { from: '#cffafe', to: '#0e7490', lo: '0', hi: '12㎧', title: '풍속' },
};

function WeatherHud({
  st,
  active,
  onToggle,
}: {
  st: WxStation | null;
  active: WxLayer;
  onToggle: (m: WxLayer) => void;
}) {
  if (!st) {
    return (
      <div className="rounded-xl bg-[#0d1520]/85 px-3 py-2.5 text-[11px] text-slate-500 ring-1 ring-white/[0.08] backdrop-blur">
        기상 불러오는 중…
      </div>
    );
  }
  const chip = (m: WxLayer) =>
    `flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs transition-colors ${active === m ? 'bg-primary/20 ring-1 ring-primary text-white' : 'text-slate-300 hover:bg-white/[0.05]'}`;
  return (
    <div className="rounded-xl bg-[#0d1520]/85 px-3 py-2.5 ring-1 ring-white/[0.08] backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-primary">기상 · {st.name}</span>
        <span className="text-[10px] text-slate-500">눌러서 지도 표시</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button className={chip('temp')} onClick={() => onToggle('temp')}>
          <Thermometer className="h-3.5 w-3.5 text-rose-400" />
          <b className="text-white">{st.temperature.toFixed(1)}°</b>
        </button>
        <button className={chip('precip')} onClick={() => onToggle('precip')}>
          <CloudRain className="h-3.5 w-3.5 text-sky-400" />
          <b className="text-white">{st.precipitationType === '없음' ? '무강수' : st.precipitationType}</b>
        </button>
        <button className={`col-span-2 ${chip('wind')}`} onClick={() => onToggle('wind')}>
          <Wind className="h-3.5 w-3.5 text-emerald-400" />
          <span className="inline-block text-slate-400" style={{ transform: `rotate(${st.windDirection + 180}deg)` }}>
            ↑
          </span>
          <b className="text-white">
            {toCompass(st.windDirection)} {st.windSpeed.toFixed(1)} m/s
          </b>
          <Droplets className="ml-auto h-3.5 w-3.5 text-sky-400" />
          <span className="text-slate-300">{st.humidity}%</span>
        </button>
      </div>
      {active !== 'none' && (
        <div className="mt-2 border-t border-white/[0.06] pt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>{WX_LEGEND[active].title} · 시도별 색면</span>
          </div>
          <div
            className="h-2 rounded"
            style={{ background: `linear-gradient(90deg, ${WX_LEGEND[active].from}, ${WX_LEGEND[active].to})` }}
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
            <span>{WX_LEGEND[active].lo}</span>
            <span>{WX_LEGEND[active].hi}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 환경 컨트롤 세그먼트 (스타일/시각/날씨 공통)
function Seg<T extends string>({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: { key: T; label: string }[];
  value: T;
  onPick: (k: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-[#0d1520]/85 px-2 py-1.5 ring-1 ring-white/[0.08] backdrop-blur">
      <span className="px-1 text-[10px] font-semibold text-slate-400">{label}</span>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onPick(it.key)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            it.key === value ? 'bg-primary text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function LoadBar({ name, pct, status }: { name: string; pct: number; status: string }) {
  const color = pct >= 80 ? 'bg-amber-400' : pct >= 60 ? 'bg-primary' : 'bg-emerald-400';
  return (
    <div className="py-2.5 border-b border-white/[0.05] last:border-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-white">{name}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm font-semibold text-white tabular-nums">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── L3 설비 상태 보드 데이터 ──
const OK = {
  label: '정상',
  tone: 'text-emerald-400',
  bg: 'bg-emerald-500/10',
  ring: 'ring-emerald-500/30',
  icon: CircleCheck,
};
const WARN = {
  label: '주의',
  tone: 'text-amber-400',
  bg: 'bg-amber-500/10',
  ring: 'ring-amber-500/30',
  icon: AlertTriangle,
};
const FAC_ROWS: PlantRow[] = [
  {
    id: 'inv01',
    name: 'INV-01 인버터',
    icon: Sun,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    status: OK,
    resource: '태양광',
    capacityKw: 500,
    dailyGenKwh: 3120,
    genHours: 6.2,
    monthlyKwh: 84200,
    inverter: { normal: 12, total: 12 },
  },
  {
    id: 'pcs02',
    name: 'PCS-02',
    icon: Zap,
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    status: OK,
    resource: 'PCS',
    capacityKw: 400,
    dailyGenKwh: 2860,
    genHours: 6.0,
    monthlyKwh: 78400,
    inverter: { normal: 8, total: 8 },
  },
  {
    id: 'ess01',
    name: 'ESS-01',
    icon: Battery,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    status: WARN,
    resource: 'ESS',
    capacityKw: 250,
    dailyGenKwh: -120,
    genHours: null,
    monthlyKwh: null,
    inverter: { normal: 3, total: 4 },
    alarm: { title: 'SOC 저하', detail: '충전율 18%', severity: 'warning' },
  },
  {
    id: 'm07',
    name: '계량기 M-07',
    icon: Gauge,
    iconBg: 'bg-slate-500/10',
    iconColor: 'text-slate-300',
    status: OK,
    resource: '계량',
    capacityKw: 0,
    dailyGenKwh: null,
    genHours: null,
    monthlyKwh: null,
  },
];

const LIGHTS: { key: LightPreset; label: string }[] = [
  { key: 'dawn', label: '새벽' },
  { key: 'day', label: '낮' },
  { key: 'dusk', label: '해질녘' },
  { key: 'night', label: '밤' },
];
const WEATHERS: { key: Weather; label: string }[] = [
  { key: 'clear', label: '맑음' },
  { key: 'rain', label: '비' },
  { key: 'snow', label: '눈' },
];
const STYLES: { key: MapStyleKey; label: string }[] = [
  { key: 'standard', label: '3D' },
  { key: 'satellite', label: '위성' },
  { key: 'dark', label: '다크' },
];

export default function DtInfoView() {
  const [tier, setTier] = useState<Tier>('L0');
  const [immerse, setImmerse] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('standard');
  const [light, setLight] = useState<LightPreset>('day');
  const [weather, setWeather] = useState<Weather>('clear');
  const [wx, setWx] = useState<WxStation[]>([]);
  const [wxLayer, setWxLayer] = useState<WxLayer>('none');
  const [infoHidden, setInfoHidden] = useState(false);
  const router = useRouter();
  const meta = TIER_META[tier];

  // 실기상 로드 (KMA 프록시, self origin → CSP 통과)
  useEffect(() => {
    let alive = true;
    fetch('/mock/weather.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.stations) setWx(d.stations as WxStation[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 현재 고도 중심에 가장 가까운 관측소
  const [cx, cy] = meta.view.center;
  const nearest = wx.length
    ? wx.reduce((a, b) => ((b.lng - cx) ** 2 + (b.lat - cy) ** 2 < (a.lng - cx) ** 2 + (a.lat - cy) ** 2 ? b : a))
    : null;

  return (
    <div className="fixed inset-0 bg-[#060a14] text-white">
      <MapBackdrop
        view={meta.view}
        tier={tier}
        mapStyle={mapStyle}
        lightPreset={light}
        weather={weather}
        wxStations={wx}
        wxLayer={wxLayer}
        onTierChange={setTier}
        onMapClick={() => setInfoHidden((h) => !h)}
      />

      {/* ── 환경 컨트롤 (스타일 · 시각/그림자 · 날씨) — 하단 중앙 ── */}
      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <Seg label="스타일" items={STYLES} value={mapStyle} onPick={(k) => setMapStyle(k as MapStyleKey)} />
        <Seg label="시각" items={LIGHTS} value={light} onPick={(k) => setLight(k as LightPreset)} />
        <Seg label="날씨" items={WEATHERS} value={weather} onPick={(k) => setWeather(k as Weather)} />
      </div>

      {/* ── 왼쪽 LOD 레일 (세로축 = 고도) — 컴팩트 ── */}
      <aside className="absolute left-3 top-3 z-30 flex w-[172px] flex-col gap-1.5">
        <div className="flex items-center gap-1.5 rounded-lg bg-[#0d1520]/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary ring-1 ring-white/[0.08] backdrop-blur">
          <Layers className="h-3.5 w-3.5" /> LOD 레이어
        </div>

        <WeatherHud st={nearest} active={wxLayer} onToggle={(m) => setWxLayer((cur) => (cur === m ? 'none' : m))} />

        <div className="flex flex-col gap-1">
          {TIERS.map((t) => {
            const m = TIER_META[t];
            const active = t === tier;
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                  active
                    ? 'border-primary bg-primary/15 ring-1 ring-primary'
                    : 'border-white/[0.06] bg-[#0d1520]/70 hover:border-white/20'
                }`}
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${active ? 'bg-primary text-white' : 'bg-white/[0.06] text-slate-300'}`}
                >
                  {t}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[13px] font-semibold leading-tight ${active ? 'text-white' : 'text-slate-300'}`}
                  >
                    {m.name}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">{m.sees}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => setImmerse((v) => !v)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#0d1520]/85 px-2 py-1.5 text-[11px] font-semibold text-slate-300 ring-1 ring-white/[0.08] backdrop-blur hover:text-white"
          >
            {immerse ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {immerse ? 'FOCUS' : 'IMMERSE'}
          </button>
          <button
            onClick={() => router.push('/dt')}
            title="맵뷰로"
            className="flex items-center justify-center rounded-lg bg-[#0d1520]/85 px-2 py-1.5 text-slate-300 ring-1 ring-white/[0.08] backdrop-blur hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </aside>

      {/* ── 대시보드 (정보 뷰) — 맵 클릭 시 숨김(infoHidden) ── */}
      <div
        className={`absolute bottom-0 right-0 top-0 z-10 overflow-y-auto px-6 py-5 transition-all duration-300 ${
          immerse ? 'left-[196px]' : 'left-[196px] xl:left-[42%]'
        } ${infoHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      >
        {/* 레이어 헤더 — 지금 대시보드가 어느 레이어인지 명시 (공간 연속성) */}
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-extrabold tracking-wide">{tier}</span>
          <span className="text-base font-semibold">{meta.name} 뷰</span>
          <span className="text-xs text-slate-400">· {meta.scope}</span>
        </div>

        {tier === 'L0' && <L0 />}
        {tier === 'L1' && <L1 />}
        {tier === 'L2' && <L2 />}
        {tier === 'L3' && <L3 />}

        <p className="mt-5 text-[11px] text-slate-500">
          실데이터 · 육지 SMP 114.96원/kWh · REC 71,945원 (KPX 2026.6) · 거래액 = SMP×발전량 추정
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  L0 — 계통·거래 (trading)
// ─────────────────────────────────────────────
function L0() {
  return (
    <div className="space-y-4">
      <StatsGrid columns={4}>
        <StatCard icon={<Factory className="h-5 w-5" />} label="총 발전량" value="6,000 MW" sub="3 발전 · 2 변전" />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="총 거래액 (일)"
          value="₩ 165.5억"
          change={{ value: 2.1, label: '전일 대비' }}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="육지 SMP"
          value="114.96 ₩/kWh"
          change={{ value: -5.2, label: '전월 대비', unit: '' }}
        />
        <StatCard icon={<Activity className="h-5 w-5" />} label="계통 노드" value="5" sub="765/345kV" />
      </StatsGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="발전소 · 변전소 거래" count={5} countUnit="개" className="lg:col-span-2">
          <div>
            <Row
              icon={<Sun className="h-4 w-4" />}
              name="신고리원전"
              sub="원자력 · 765kV 송출"
              right="₩ 77.2억/일"
              tone="text-emerald-400"
            />
            <Row
              icon={<Zap className="h-4 w-4" />}
              name="울산화력"
              sub="LNG 복합 · 345kV"
              right="₩ 33.1억/일"
              tone="text-emerald-400"
            />
            <Row
              icon={<Factory className="h-4 w-4" />}
              name="삼천포화력"
              sub="석탄 · 고성 하이면"
              right="₩ 55.2억/일"
              tone="text-emerald-400"
            />
            <Row
              icon={<Building2 className="h-4 w-4" />}
              name="북경남변전소"
              sub="765kV S/S · 창녕"
              right="송전 허브"
              tone="text-slate-300"
            />
            <Row
              icon={<Building2 className="h-4 w-4" />}
              name="신진주변전소"
              sub="345kV S/S · 진주"
              right="송전 허브"
              tone="text-slate-300"
            />
          </div>
        </SectionCard>
        <SectionCard title="거래 요약">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">육지 SMP</span>
              <span className="font-semibold">114.96 ₩/kWh</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">REC 가중평균</span>
              <span className="font-semibold">71,945 원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">주 송전선</span>
              <Badge variant="primary">765kV 신고리–북경남</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">전력 흐름</span>
              <span className="font-semibold text-purple-300">조류 / 거래</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  L1 — 지역 (dashboard / platform)
// ─────────────────────────────────────────────
function L1() {
  return (
    <div className="space-y-4">
      <StatsGrid columns={4}>
        <StatCard icon={<Factory className="h-5 w-5" />} label="산단" value="3 개" sub="온산 · 미포 · 용연" />
        <StatCard
          icon={<Gauge className="h-5 w-5" />}
          label="평균 부하율"
          value="73%"
          change={{ value: 4, label: '전주 대비' }}
        />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="이상 설비" value="3 건" sub="주의 2 · 경보 1" />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="지역 발전량"
          value="2.9 MW"
          change={{ value: -1.4, label: '전일 대비' }}
        />
      </StatsGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="산단별 부하율" count={3} countUnit="개">
          <div>
            <LoadBar name="온산국가산단" pct={64} status="NORMAL" />
            <LoadBar name="미포국가산단" pct={81} status="WARNING" />
            <LoadBar name="용연공단" pct={73} status="NORMAL" />
          </div>
        </SectionCard>
        <TrendBlock
          desc="울산권 지역 발전량 추이 · 24시간"
          data={[8, 9, 12, 20, 34, 52, 68, 74, 70, 66, 58, 40, 26, 18, 12, 9]}
          color="#38bdf8"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  L2 — 관리·DT (ppa / lease / settlement)
// ─────────────────────────────────────────────
function L2() {
  return (
    <div className="space-y-4">
      <StatsGrid columns={4}>
        <StatCard icon={<Building2 className="h-5 w-5" />} label="건물 (동)" value="20 동" sub="온산 단지 트윈" />
        <StatCard
          icon={<Gauge className="h-5 w-5" />}
          label="구내 부하율"
          value="64%"
          change={{ value: 1.8, label: '전일 대비' }}
        />
        <StatCard icon={<Zap className="h-5 w-5" />} label="발전량 (오늘)" value="1,240 kW" sub="예상 정산 ₩ 342만" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="관리 알람" value="2 건" sub="주의 2" />
      </StatsGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendBlock
            desc="온산 단지 발전량 추이 · 24시간"
            data={[2, 3, 5, 12, 24, 40, 52, 58, 55, 50, 42, 30, 18, 10, 6, 3]}
            color="#3b82f6"
          />
        </div>
        <SectionCard title="PPA 자원 배치" count={2} countUnit="유형">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <i className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                온사이트 PPA
              </span>
              <span className="font-semibold">17 동</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <i className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                오프사이트 PPA
              </span>
              <span className="font-semibold">3 동</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 border-t border-white/[0.06] pt-3 text-xs text-slate-400">
              구내 배전 결선 · 동선 흐름 <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  L3 — 모니터링 (monitoring / operator)
// ─────────────────────────────────────────────
function L3() {
  return (
    <div className="space-y-4">
      <StatsGrid columns={4}>
        <StatCard icon={<Activity className="h-5 w-5" />} label="설비" value="4" sub="인버터·PCS·ESS·계량" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="경보" value="1 건" sub="ESS-01 SOC 저하" />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="실시간 발전"
          value="1,240 kW"
          change={{ value: 3.2, label: '5분 전 대비' }}
        />
        <StatCard icon={<Gauge className="h-5 w-5" />} label="가동률" value="92%" sub="원천 스트림" />
      </StatsGrid>
      <PlantStatusTable plants={FAC_ROWS} />
    </div>
  );
}
