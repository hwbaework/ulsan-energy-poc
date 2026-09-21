'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores';
import {
  FileText,
  Zap,
  Sun,
  ChevronRight,
  ChevronLeft,
  Monitor,
  BarChart3,
  TrendingUp,
  Wallet,
  X,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { StatCard, StatsGrid, OnboardingModal, AssetRegistrationBanner } from '@/components/features';

import { RmsAreaLineChart, RmsLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useScopedPlants, usePlantsHistory } from '@/hooks/monitoring/useScopedPlants';
import { useMyPlantIds } from '@/hooks/monitoring/useMyPlantFilter';
import { useEnergySettings } from '@/hooks/common/useSettings';
import { useMarketPrices } from '@/hooks/trading/useTrading';

// ── Mock Data ──

const PLANTS: {
  id: number;
  name: string;
  shortName: string;
  dataKey: string;
  color: string;
  customer: string;
  capacityKw: number;
  monthlyGenKwh: number;
  monthlySupplyKwh: number;
  status: 'normal' | 'maintenance' | 'fault';
}[] = [];

const PLANT_STATUS_NORMAL = {
  tone: 'text-emerald-300',
  bg: 'bg-emerald-500/[0.10]',
  ring: 'ring-emerald-500/30',
  label: '정상',
} as const;

// 시간/일/월 단위 토글 (lease/dashboard 패턴)
type TimeUnit = 'hour' | 'day' | 'month';
const TIME_UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'hour', label: '시간' },
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];

const DEFAULT_SMP_PRICE_CAP = 180;
const SMP_MARKETS = [
  { id: 'land', label: '육지', color: '#3B82F6' },
  { id: 'jeju', label: '제주도', color: '#F97316' },
  { id: 'cap', label: '상한가', color: '#EF4444' },
] as const;

function buildSmpFromApi(data: any[] | undefined, smpCap: number) {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  const byDate = new Map<string, { land?: number; jeju?: number }>();
  for (const d of data) {
    const key = d.priceDate;
    const entry = byDate.get(key) ?? {};
    if (d.region === 'LAND') entry.land = Number(d.price);
    else if (d.region === 'JEJU') entry.jeju = Number(d.price);
    byDate.set(key, entry);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      x: `${date.slice(5).replace('-', '/')}`,
      land: v.land ?? 0,
      jeju: v.jeju ?? 0,
      cap: smpCap,
    }));
}

/** 예상 발전량 — 설비 용량 × 표준 일사 곡선. 시간 단위는 kW, 일/월 단위는 kWh(일 3.4h 등가 가동 기준) */
function withForecast(rows: Array<Record<string, unknown> & { x: string }>, tu: TimeUnit, capacityKw: number) {
  const peak = capacityKw * 0.9; // 표준 일사 기준 피크 — 실측(기상 감쇠 반영)보다 완만하게 높음
  return rows.map((row, i) => {
    let forecast: number;
    if (tu === 'hour') {
      const hour = Number(String(row.x).slice(0, 2));
      const sun = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
      forecast = Math.round(peak * sun * 10) / 10;
    } else if (tu === 'day') {
      // 일별: 3.4h 등가 가동 ± 완만한 기상 변동
      forecast = Math.round(capacityKw * 3.4 * (1 + Math.sin(i / 2.7) * 0.12));
    } else {
      // 월별: 계절 계수(여름 높고 겨울 낮음) × 30일
      const season = 1 + Math.sin(((i + 1 - 3) / 12) * Math.PI * 2) * 0.22;
      forecast = Math.round(capacityKw * 3.4 * 30 * season);
    }
    return { ...row, forecast };
  });
}

const DEFAULT_CO2_EMISSION_FACTOR = 0.4594;
const EMPTY_IDS: number[] = [];
const PLANT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#EAB308'] as const;
const plantKey = (id: number) => `p_${id}`;
const shortPlantName = (name: string) => name.replace(/^울산\s*/, '');

/** 시간대별(오늘) 발전량 행 — 이력이 없으면 빈 배열(가짜 값 금지) */
function buildHourlyGenData(history: any[] | undefined): { x: string; generation: number }[] {
  if (!history || !Array.isArray(history) || history.length === 0) return [];
  return history.map((h) => ({ x: h.time ? h.time.slice(11, 16) : '', generation: h.acPower ?? h.dcPower ?? 0 }));
}

const GEN_SERIES = [
  { id: 'generation', label: '현재 발전량', color: '#10B981' },
  { id: 'forecast', label: '예상 발전량', color: '#F59E0B' },
] as const;
type GenSeriesId = (typeof GEN_SERIES)[number]['id'];

const CO2_LINES = [{ id: 'hanil', label: '전체', color: '#10B981' }] as const;

type Co2Unit = 'day' | 'month' | 'year';
const CO2_UNIT_OPTIONS: { value: Co2Unit; label: string }[] = [
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
  { value: 'year', label: '년' },
];

const toTonWith = (kwh: number, factor: number) => Math.round((kwh * factor) / 10) / 100;

function buildCo2FromHistory(history: any[] | undefined, unit: Co2Unit, factor: number) {
  if (!history || !Array.isArray(history) || history.length === 0) return [];

  const byDate = new Map<string, number>();
  for (const h of history) {
    const dateKey = h.time ? h.time.slice(0, 10) : '';
    if (!dateKey) continue;
    const cur = byDate.get(dateKey) ?? 0;
    byDate.set(dateKey, Math.max(cur, h.dailyEnergy ?? 0));
  }

  if (unit === 'day') {
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
    return sorted.map(([date, kwh]) => ({
      x: `${date.slice(5).replace('-', '/')}`,
      hanil: toTonWith(kwh, factor),
    }));
  }

  if (unit === 'month') {
    const byMonth = new Map<string, number>();
    for (const [date, kwh] of byDate) {
      const m = date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + kwh);
    }
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`;
      return { x: `${i + 1}월`, hanil: toTonWith(byMonth.get(m) ?? 0, factor) };
    });
  }

  // year
  const byYear = new Map<string, number>();
  for (const [date, kwh] of byDate) {
    const y = date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + kwh);
  }
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = String(currentYear - 4 + i);
    return { x: y, hanil: toTonWith(byYear.get(y) ?? 0, factor) };
  });
}

function buildDailyGenData(history: any[] | undefined, month: string) {
  const today = new Date().toISOString().slice(0, 10);
  const byDate = new Map<string, number>();
  if (history && Array.isArray(history)) {
    for (const h of history) {
      const dateKey = h.time ? h.time.slice(0, 10) : '';
      if (!dateKey || dateKey > today) continue;
      const cur = byDate.get(dateKey) ?? 0;
      byDate.set(dateKey, Math.max(cur, h.dailyEnergy ?? 0));
    }
  }
  const [y = 0, m = 1] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lastDay = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth;
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    const dateKey = `${month}-${String(day).padStart(2, '0')}`;
    return { x: `${day}일`, generation: byDate.get(dateKey) ?? 0 };
  });
}

function buildMonthlyGenData(history: any[] | undefined, year: number) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayStr = today.toISOString().slice(0, 10);

  const byMonth = new Map<string, number>();
  if (history && Array.isArray(history)) {
    const byDate = new Map<string, number>();
    for (const h of history) {
      const dateKey = h.time ? h.time.slice(0, 10) : '';
      if (!dateKey || dateKey > todayStr) continue;
      const cur = byDate.get(dateKey) ?? 0;
      byDate.set(dateKey, Math.max(cur, h.dailyEnergy ?? 0));
    }
    for (const [date, kwh] of byDate) {
      const m = date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + kwh);
    }
  }
  const lastMonth = year === currentYear ? currentMonth : 12;
  return Array.from({ length: lastMonth }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { x: `${i + 1}월`, generation: Math.round(byMonth.get(m) ?? 0) };
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { isCompleted, complete, hydrate } = useOnboardingStore();
  const onboarded = isCompleted('generator');

  const { data: energySettings } = useEnergySettings();
  const co2Factor = energySettings?.CO2_EMISSION_FACTOR
    ? Number(energySettings.CO2_EMISSION_FACTOR)
    : DEFAULT_CO2_EMISSION_FACTOR;
  const smpPriceCap = energySettings?.SMP_PRICE_CAP ? Number(energySettings.SMP_PRICE_CAP) : DEFAULT_SMP_PRICE_CAP;

  // 칩 X/Plus 토글 — 클릭으로 차트 라인 표시/숨김
  // 발전소 발전·공급 시리즈 토글 (현재/예상 발전량)
  const [hiddenGenSeries, setHiddenGenSeries] = useState<Set<GenSeriesId>>(new Set());
  const toggleGenSeries = (id: GenSeriesId) => {
    setHiddenGenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 시간/일/월 + < 날짜 > picker
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);
  const todayYear = useMemo(() => new Date().getFullYear(), []);
  const [genCtl, setGenCtl] = useState<{ tu: TimeUnit; date: string; month: string; year: number }>({
    tu: 'hour',
    date: todayStr,
    month: todayMonth,
    year: todayYear,
  });

  // CO₂ 저감량 토글 + 단위 (일/월/년)
  const [co2Unit, setCo2Unit] = useState<Co2Unit>('day');
  const [hiddenCo2Lines, setHiddenCo2Lines] = useState<Set<string>>(new Set());
  const toggleCo2Line = (id: string) => {
    setHiddenCo2Lines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // SMP 시장 토글 + 단위 (일/월/년)
  // SMP — 최근 30일만 표시
  const [hiddenSmpMarkets, setHiddenSmpMarkets] = useState<Set<string>>(new Set());
  const toggleSmpMarket = (id: string) => {
    setHiddenSmpMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const smpRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { from: fmt(from), to: fmt(to) };
  }, []);
  const { data: smpRaw } = useMarketPrices(smpRange);
  const smpChartData = useMemo(() => buildSmpFromApi(smpRaw, smpPriceCap), [smpRaw, smpPriceCap]);

  const { hasPlants, isGenerator } = useMyPlantIds();
  // 역할별 범위: 관리자=전체, 발전사업자·전기사용자=자사 계약 발전소
  const { plants: scopedPlants } = useScopedPlants();
  const scopedIds = useMemo(() => scopedPlants.map((p) => p.plantId), [scopedPlants]);
  const plant = useMemo(
    () => ({
      currentOutput: scopedPlants.reduce((sum, p) => sum + p.currentOutput, 0),
      capacity: scopedPlants.reduce((sum, p) => sum + p.capacity, 0),
      dailyEnergy: scopedPlants.reduce((sum, p) => sum + (p.dailyEnergy ?? 0), 0),
    }),
    [scopedPlants],
  );
  // 발전소별 선 표시 토글 (기본 꺼짐 — 칩으로 켠다)
  const [visiblePlantKeys, setVisiblePlantKeys] = useState<Set<string>>(new Set());
  const togglePlantKey = (key: string) => {
    setVisiblePlantKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 전일 데이터 — 기존 plantHistory API로 계산
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const { merged: yesterdayHistory } = usePlantsHistory(scopedIds, yesterdayStr, yesterdayStr);

  const yesterdayEnergy = useMemo(() => {
    if (!yesterdayHistory || !Array.isArray(yesterdayHistory) || yesterdayHistory.length === 0) return 0;
    const maxEnergy = Math.max(...yesterdayHistory.map((h) => h.dailyEnergy ?? 0));
    return maxEnergy;
  }, [yesterdayHistory]);

  const yesterdayHours = useMemo(() => {
    if (!yesterdayHistory || !Array.isArray(yesterdayHistory)) return 0;
    const activePoints = yesterdayHistory.filter((h) => (h.acPower ?? 0) > 0).length;
    const totalPoints = yesterdayHistory.length;
    if (totalPoints === 0) return 0;
    const intervalMinutes = Math.round((24 * 60) / totalPoints);
    return Math.round(((activePoints * intervalMinutes) / 60) * 10) / 10;
  }, [yesterdayHistory]);

  const PPA_UNIT_PRICE = 92.6;
  const yesterdayAmount = yesterdayEnergy * PPA_UNIT_PRICE;

  // CO₂ 저감 — plant API 실시간 연동 (QA #7)
  const monthStart = useMemo(() => `${todayStr.slice(0, 7)}-01`, [todayStr]);
  const yearStart = useMemo(() => `${todayYear}-01-01`, [todayYear]);
  const { merged: monthHistory } = usePlantsHistory(scopedIds, monthStart, todayStr);
  const { merged: yearHistory, byPlant: yearByPlant } = usePlantsHistory(scopedIds, yearStart, todayStr);

  const sumDailyEnergy = (history: typeof monthHistory) => {
    if (!history || !Array.isArray(history) || history.length === 0) return 0;
    const byDate = new Map<string, number>();
    for (const h of history) {
      const dateKey = h.time ? h.time.slice(0, 10) : '';
      if (!dateKey) continue;
      const cur = byDate.get(dateKey) ?? 0;
      byDate.set(dateKey, Math.max(cur, h.dailyEnergy ?? 0));
    }
    let total = 0;
    for (const v of byDate.values()) total += v;
    return total;
  };

  const monthlyEnergyKwh = useMemo(() => sumDailyEnergy(monthHistory), [monthHistory]);
  const yearlyEnergyKwh = useMemo(() => sumDailyEnergy(yearHistory), [yearHistory]);
  // CO₂ 저감 — 전체(hanil) + 발전소별(p_<id>) 시리즈
  const [visibleCo2PlantKeys, setVisibleCo2PlantKeys] = useState<Set<string>>(new Set());
  const toggleCo2PlantKey = (key: string) => {
    setVisibleCo2PlantKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const co2ChartData = useMemo(() => {
    const rows = buildCo2FromHistory(yearHistory, co2Unit, co2Factor) as Array<Record<string, string | number>>;
    const perPlant = new Map<string, Record<string, number>>();
    for (const pl of scopedPlants) {
      const hist = yearByPlant[pl.plantId];
      if (!hist || hist.length === 0) continue;
      for (const r of buildCo2FromHistory(hist, co2Unit, co2Factor) as Array<Record<string, string | number>>) {
        const x = String(r.x);
        const cur = perPlant.get(x) ?? {};
        cur[plantKey(pl.plantId)] = Number(r.hanil ?? 0);
        perPlant.set(x, cur);
      }
    }
    return rows.map((r) => ({ ...r, ...(perPlant.get(String(r.x)) ?? {}) }));
  }, [yearHistory, yearByPlant, scopedPlants, co2Unit, co2Factor]);

  const co2TodayTon = toTonWith(plant?.dailyEnergy ?? 0, co2Factor);
  const co2ThisMonthTon = toTonWith(monthlyEnergyKwh > 0 ? monthlyEnergyKwh : (plant?.dailyEnergy ?? 0), co2Factor);
  const co2YtdTon = toTonWith(yearlyEnergyKwh > 0 ? yearlyEnergyKwh : (plant?.dailyEnergy ?? 0), co2Factor);

  // 일별 차트: 선택 월의 1일~말일 범위
  const dailyRange = useMemo(() => {
    const [y = 0, m = 1] = genCtl.month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${genCtl.month}-01`, to: `${genCtl.month}-${String(last).padStart(2, '0')}` };
  }, [genCtl.month]);
  const { merged: dailyHistory, byPlant: dailyByPlant } = usePlantsHistory(
    genCtl.tu === 'day' ? scopedIds : EMPTY_IDS,
    dailyRange.from,
    dailyRange.to,
  );

  // 월별 차트: 선택 연도 1/1~12/31 범위
  const yearlyRange = useMemo(
    () => ({
      from: `${genCtl.year}-01-01`,
      to: `${genCtl.year}-12-31`,
    }),
    [genCtl.year],
  );
  const { merged: monthlyHistory, byPlant: monthlyByPlant } = usePlantsHistory(
    genCtl.tu === 'month' ? scopedIds : EMPTY_IDS,
    yearlyRange.from,
    yearlyRange.to,
  );

  const { merged: historyData, byPlant: hourlyByPlant } = usePlantsHistory(
    genCtl.tu === 'hour' ? scopedIds : EMPTY_IDS,
    genCtl.date,
    genCtl.date,
  );
  const hourlyData = useMemo(() => buildHourlyGenData(historyData), [historyData]);

  const genChartData = useMemo(() => {
    const base =
      genCtl.tu === 'hour'
        ? hourlyData
        : genCtl.tu === 'day'
          ? buildDailyGenData(dailyHistory, genCtl.month)
          : buildMonthlyGenData(monthlyHistory, genCtl.year);
    const rows = withForecast(base, genCtl.tu, plant?.capacity ?? 500) as Array<Record<string, unknown> & { x: string }>;
    // 발전소별 시리즈 — 같은 x 라벨에 p_<id> 값을 붙인다
    const byPlant = genCtl.tu === 'hour' ? hourlyByPlant : genCtl.tu === 'day' ? dailyByPlant : monthlyByPlant;
    const perPlant = new Map<string, Record<string, number>>();
    for (const p of scopedPlants) {
      const hist = byPlant[p.plantId];
      if (!hist || hist.length === 0) continue;
      const prows =
        genCtl.tu === 'hour'
          ? buildHourlyGenData(hist)
          : genCtl.tu === 'day'
            ? buildDailyGenData(hist, genCtl.month)
            : buildMonthlyGenData(hist, genCtl.year);
      for (const r of prows) {
        const cur = perPlant.get(r.x) ?? {};
        cur[plantKey(p.plantId)] = Number((r as Record<string, unknown>).generation ?? 0);
        perPlant.set(r.x, cur);
      }
    }
    return rows.map((r) => ({ ...r, ...(perPlant.get(r.x) ?? {}) }));
  }, [
    genCtl.tu,
    genCtl.month,
    genCtl.year,
    hourlyData,
    dailyHistory,
    monthlyHistory,
    plant?.capacity,
    hourlyByPlant,
    dailyByPlant,
    monthlyByPlant,
    scopedPlants,
  ]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const completeOnboarding = () => complete('generator');

  return (
    <div className="space-y-6">
      <OnboardingModal
        open={!onboarded}
        onComplete={completeOnboarding}
        persona="generator"
        welcomeIcon={Sun}
        welcomeIconColor="text-amber-400"
        welcomeIconBg="bg-amber-500/[0.10]"
        welcomeTitle="발전사업자 포털에 오신 것을 환영합니다"
        welcomeDescription="발전 자원 등록부터 PPA 거래, 수익 관리까지 한 곳에서."
        steps={[
          {
            icon: Sun,
            iconColor: 'text-amber-400',
            iconBg: 'bg-amber-500/[0.10]',
            title: '발전소 등록',
            description: '태양광, 풍력 등 발전 자원을 등록하고 실시간 출력을 관리합니다.',
            features: [
              { icon: Zap, label: '자원 등록', desc: '발전소 정보 입력' },
              { icon: Monitor, label: '실시간 모니터링', desc: '출력/상태 관제' },
            ],
          },
          {
            icon: Zap,
            iconColor: 'text-blue-400',
            iconBg: 'bg-blue-500/[0.10]',
            title: 'PPA 계약 매칭',
            description: '수용가의 계약 요청을 확인하고 거래를 진행합니다.',
            features: [
              { icon: FileText, label: '거래 요청', desc: '매칭 요청 확인' },
              { icon: TrendingUp, label: '이행률 관리', desc: '계약 이행 현황' },
            ],
          },
          {
            icon: TrendingUp,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/[0.10]',
            title: '수익 관리',
            description: '정산 내역과 수익을 분석하고, REC 신청을 관리합니다.',
            features: [
              { icon: Wallet, label: '수익 분석', desc: '월별 정산 추이' },
              { icon: BarChart3, label: 'REC 관리', desc: 'REC 신청/현황' },
            ],
          },
        ]}
        ctaLabel="발전소 등록하기"
        ctaIcon={Sun}
        onCtaClick={() => {
          completeOnboarding();
          router.push('/generator/ppa/resources/register');
        }}
      />
      {/* Asset Registration Banner */}
      <AssetRegistrationBanner persona="generator" />

      {/* Breadcrumb — QA #0 */}
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '대시보드' }]} />

      {isGenerator && !hasPlants && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/[0.10] ring-1 ring-amber-500/30 mb-4">
            <Sun size={28} className="text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white">등록된 발전소가 없습니다</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            자원 관리에서 발전소를 등록하면 실시간 출력, 발전량, 수익 현황을 확인할 수 있습니다.
          </p>
          <button
            onClick={() => router.push('/generator/ppa/resources/register')}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Sun size={16} />
            자원 등록하기
          </button>
        </div>
      )}

      {/* Header */}
      {hasPlants && (
        <>
          <h1 className="text-xl font-bold text-white">대시보드</h1>

          {/* Stats — QA #1 전일발전량 표시, #2 전일대비 삭제, #4 금액 계산식 */}
          <StatsGrid columns={4}>
            <StatCard
              label="현재 출력"
              value={plant?.currentOutput !== undefined ? `${plant.currentOutput.toFixed(1)} kW` : '- kW'}
            />

            <StatCard
              label="발전량"
              value={yesterdayEnergy > 0 ? `${yesterdayEnergy.toFixed(1)} kWh` : '- kWh'}
            />

            <StatCard
              label="발전시간"
              value={yesterdayHours > 0 ? `${yesterdayHours} 시간` : '- 시간'}
            />

            <StatCard
              label="금액"
              value={yesterdayAmount > 0 ? `${(yesterdayAmount / 10000).toFixed(1)} 만원` : '- 만원'}
            />
          </StatsGrid>

          {/* 발전소 발전·공급 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-md font-semibold text-white">발전소 발전·공급</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {genCtl.tu === 'hour' && '오늘 시간대별 발전량 (kW)'}
                  {genCtl.tu === 'day' && '최근 30일 일별 발전량 (kWh)'}
                  {genCtl.tu === 'month' && '최근 12개월 월별 발전량 (kWh)'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
                  {TIME_UNIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGenCtl((s) => ({ ...s, tu: opt.value }))}
                      className={cn(
                        'rounded px-2.5 h-7 text-xs transition-colors',
                        genCtl.tu === opt.value
                          ? 'bg-primary text-white font-medium'
                          : 'text-slate-400 hover:text-white',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
                {/* 발전소 칩 — 클릭으로 차트 라인 토글 */}
                <div className="flex flex-wrap gap-1.5">
                  {GEN_SERIES.map((m) => {
                    const hidden = hiddenGenSeries.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleGenSeries(m.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                          hidden
                            ? 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400'
                            : 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]',
                        )}
                        aria-pressed={!hidden}
                        title={hidden ? '클릭해서 다시 표시' : '클릭해서 숨김'}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                          style={{ backgroundColor: m.color, opacity: hidden ? 0.3 : 1 }}
                        />
                        {m.label}
                        {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
                      </button>
                    );
                  })}
                  {scopedPlants.length > 1 && <span className="mx-1 h-4 w-px bg-white/10" />}
                  {scopedPlants.length > 1 &&
                    scopedPlants.map((p, i) => {
                      const key = plantKey(p.plantId);
                      const on = visiblePlantKeys.has(key);
                      const color = PLANT_COLORS[i % PLANT_COLORS.length];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePlantKey(key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                            on
                              ? 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]'
                              : 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400',
                          )}
                          aria-pressed={on}
                          title={on ? '클릭해서 숨김' : '클릭해서 표시'}
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                            style={{ backgroundColor: color, opacity: on ? 1 : 0.3 }}
                          />
                          {shortPlantName(p.name)}
                          {on ? <X size={10} className="opacity-70" /> : <Plus size={10} className="opacity-50" />}
                        </button>
                      );
                    })}
                </div>
                {/* < 날짜 > picker */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (genCtl.tu === 'hour') {
                        const d = new Date(genCtl.date);
                        d.setDate(d.getDate() - 1);
                        setGenCtl((s) => ({
                          ...s,
                          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                        }));
                      } else if (genCtl.tu === 'day') {
                        const [y = 0, m = 1] = genCtl.month.split('-').map(Number);
                        const d = new Date(y, m - 2, 1);
                        setGenCtl((s) => ({
                          ...s,
                          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                        }));
                      } else {
                        setGenCtl((s) => ({ ...s, year: s.year - 1 }));
                      }
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                    aria-label="이전"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-sm font-semibold text-white tabular-nums px-2 min-w-[100px] text-center">
                    {genCtl.tu === 'hour' && genCtl.date}
                    {genCtl.tu === 'day' && genCtl.month}
                    {genCtl.tu === 'month' && `${genCtl.year}년`}
                  </span>
                  {(() => {
                    const isAtFutureBound =
                      (genCtl.tu === 'hour' && genCtl.date >= todayStr) ||
                      (genCtl.tu === 'day' && genCtl.month >= todayMonth) ||
                      (genCtl.tu === 'month' && genCtl.year >= todayYear);
                    return (
                      <button
                        type="button"
                        disabled={isAtFutureBound}
                        onClick={() => {
                          if (isAtFutureBound) return;
                          if (genCtl.tu === 'hour') {
                            const d = new Date(genCtl.date);
                            d.setDate(d.getDate() + 1);
                            setGenCtl((s) => ({
                              ...s,
                              date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                            }));
                          } else if (genCtl.tu === 'day') {
                            const [y = 0, m = 1] = genCtl.month.split('-').map(Number);
                            const d = new Date(y, m, 1);
                            setGenCtl((s) => ({
                              ...s,
                              month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                            }));
                          } else {
                            setGenCtl((s) => ({ ...s, year: s.year + 1 }));
                          }
                        }}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/[0.06]',
                          isAtFutureBound
                            ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                            : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]',
                        )}
                        aria-label="다음"
                      >
                        <ChevronRight size={13} />
                      </button>
                    );
                  })()}
                </div>
              </div>
              <RmsAreaLineChart
                data={genChartData as Array<Record<string, string | number>>}
                xKey="x"
                stacked={false}
                areas={
                  hiddenGenSeries.has('generation')
                    ? []
                    : [
                        {
                          key: 'generation',
                          name: genCtl.tu === 'hour' ? '현재 발전량 (kW)' : '현재 발전량 (kWh)',
                          color: '#10B981',
                        },
                      ]
                }
                lines={[
                  ...(hiddenGenSeries.has('forecast')
                    ? []
                    : [
                        {
                          key: 'forecast',
                          name: genCtl.tu === 'hour' ? '예상 발전량 (kW)' : '예상 발전량 (kWh)',
                          color: '#F59E0B',
                          dashed: true,
                        },
                      ]),
                  ...scopedPlants
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => visiblePlantKeys.has(plantKey(p.plantId)))
                    .map(({ p, i }) => ({
                      key: plantKey(p.plantId),
                      name: shortPlantName(p.name),
                      color: PLANT_COLORS[i % PLANT_COLORS.length],
                    })),
                ]}
                height={280}
              />
            </div>

            {/* 발전소 상태 보드 1줄 — lease/dashboard 패턴 단순화 */}
            <div className="border-t border-white/[0.06] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-4 py-2 text-left font-medium">발전소</th>
                    <th className="px-4 py-2 text-left font-medium">상태</th>
                    <th className="px-4 py-2 text-left font-medium">용량</th>
                    <th className="px-4 py-2 text-left font-medium">이번 달 발전</th>
                    <th className="px-4 py-2 text-left font-medium">수용가 공급</th>
                    <th className="px-4 py-2 text-left font-medium">수용가</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANTS.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/[0.10]">
                            <Sun size={13} className="text-amber-400" />
                          </span>
                          <p className="text-sm font-semibold text-white">{p.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1',
                            PLANT_STATUS_NORMAL.bg,
                            PLANT_STATUS_NORMAL.tone,
                            PLANT_STATUS_NORMAL.ring,
                          )}
                        >
                          <CheckCircle2 size={10} />
                          {PLANT_STATUS_NORMAL.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm text-white">{p.capacityKw.toLocaleString()} kW</td>
                      <td className="px-4 py-3 tabular-nums text-sm text-violet-300">
                        {p.monthlyGenKwh.toLocaleString()} kWh
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm text-emerald-300 font-semibold">
                        {p.monthlySupplyKwh.toLocaleString()} kWh
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{p.customer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-md font-semibold text-white">CO₂ 저감량</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {co2Unit === 'day' && '최근 30일 일별 CO₂ 저감 (tCO₂)'}
                  {co2Unit === 'month' && '최근 12개월 월별 CO₂ 저감 (tCO₂)'}
                  {co2Unit === 'year' && '최근 5년 연 누적 CO₂ 저감 (tCO₂)'}
                </p>
              </div>
              <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
                {CO2_UNIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCo2Unit(opt.value)}
                    className={cn(
                      'rounded px-2.5 h-7 text-xs transition-colors',
                      co2Unit === opt.value ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4">
              {/* 누적 KPI 카드 — 오늘 / 이번 달 / 올해 누적 (단위: tCO₂) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 p-3">
                  <p className="text-sm text-emerald-300/90">오늘 CO₂ 저감</p>
                  <p className="text-xl font-semibold text-emerald-300 tabular-nums mt-1">
                    {co2TodayTon.toFixed(2)} <span className="text-emerald-300">tCO₂</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                  <p className="text-sm text-slate-300">이번 달 CO₂ 저감</p>
                  <p className="text-xl font-semibold text-white tabular-nums mt-1">
                    {co2ThisMonthTon.toFixed(2)} <span className="text-white">tCO₂</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                  <p className="text-sm text-slate-300">올해 누적 (YTD)</p>
                  <p className="text-xl font-semibold text-white tabular-nums mt-1">
                    {co2YtdTon.toFixed(2)} <span className="text-white">tCO₂</span>
                  </p>
                </div>
              </div>

              {/* 시리즈 칩 — 전체 / 발전소별 토글 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {CO2_LINES.map((m) => {
                  const hidden = hiddenCo2Lines.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleCo2Line(m.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                        hidden
                          ? 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400'
                          : 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]',
                      )}
                      aria-pressed={!hidden}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                        style={{ backgroundColor: m.color, opacity: hidden ? 0.3 : 1 }}
                      />
                      {m.label}
                      {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
                    </button>
                  );
                })}
                {scopedPlants.length > 1 && <span className="mx-1 h-4 w-px bg-white/10" />}
                {scopedPlants.length > 1 &&
                  scopedPlants.map((pl, i) => {
                    const key = plantKey(pl.plantId);
                    const on = visibleCo2PlantKeys.has(key);
                    const color = PLANT_COLORS[i % PLANT_COLORS.length];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCo2PlantKey(key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                          on
                            ? 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]'
                            : 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400',
                        )}
                        aria-pressed={on}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                          style={{ backgroundColor: color, opacity: on ? 1 : 0.3 }}
                        />
                        {shortPlantName(pl.name)}
                        {on ? <X size={10} className="opacity-70" /> : <Plus size={10} className="opacity-50" />}
                      </button>
                    );
                  })}
              </div>
              <RmsLineChart
                data={co2ChartData}
                xKey="x"
                lines={[
                  ...CO2_LINES.filter((m) => !hiddenCo2Lines.has(m.id)).map((m) => ({
                    key: m.id,
                    name: `${m.label} (tCO₂)`,
                    color: m.color,
                  })),
                  ...scopedPlants
                    .map((pl, i) => ({ pl, i }))
                    .filter(({ pl }) => visibleCo2PlantKeys.has(plantKey(pl.plantId)))
                    .map(({ pl, i }) => ({
                      key: plantKey(pl.plantId),
                      name: `${shortPlantName(pl.name)} (tCO₂)`,
                      color: PLANT_COLORS[i % PLANT_COLORS.length],
                    })),
                ]}
                height={260}
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-md font-semibold text-white">SMP 시장 정보</h3>
                <p className="mt-0.5 text-xs text-slate-400">최근 30일 일평균 SMP (₩/kWh)</p>
              </div>
              <span className="text-[11px] text-red-400">상한가 {smpPriceCap} ₩/kWh</span>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SMP_MARKETS.map((m) => {
                  const hidden = hiddenSmpMarkets.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleSmpMarket(m.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                        hidden
                          ? 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400'
                          : 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]',
                      )}
                      aria-pressed={!hidden}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                        style={{ backgroundColor: m.color, opacity: hidden ? 0.3 : 1 }}
                      />
                      {m.label}
                      {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
                    </button>
                  );
                })}
              </div>
              <RmsLineChart
                data={smpChartData}
                xKey="x"
                lines={SMP_MARKETS.filter((m) => !hiddenSmpMarkets.has(m.id)).map((m) => ({
                  key: m.id,
                  name: m.id === 'cap' ? `${m.label} (₩/kWh)` : `${m.label} (₩/kWh)`,
                  color: m.color,
                  ...(m.id === 'cap' ? { strokeDasharray: '5 5' } : {}),
                }))}
                height={260}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
