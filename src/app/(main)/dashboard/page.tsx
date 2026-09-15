// @ts-nocheck
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
  Clock,
  X,
  Plus,
  CheckCircle2,
  _ArrowRight,
} from 'lucide-react';
import { StatCard, StatsGrid, OnboardingModal, AssetRegistrationBanner } from '@/components/features';
import { RmsAreaChart, RmsLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useMonitoringPlantDetail, useMonitoringPlantHistory } from '@/hooks/monitoring/useMonitoring';
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

const DEFAULT_CO2_EMISSION_FACTOR = 0.4594;
const CO2_LINES = [{ id: 'hanil', label: '내 발전소', color: '#10B981' }] as const;

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
  const [y, m] = month.split('-').map(Number);
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
  const [hiddenPlants, setHiddenPlants] = useState<Set<number>>(new Set());
  const togglePlant = (id: number) => {
    setHiddenPlants((prev) => {
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
  const [co2Unit, setCo2Unit] = useState<Co2Unit>('month');
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

  const { plantIds, hasPlants, isGenerator } = useMyPlantIds();
  const myPlantId = plantIds[0] || (isGenerator ? 0 : 17514);

  const { data: plantDetail } = useMonitoringPlantDetail(myPlantId);
  const plant = plantDetail ?? { currentOutput: 0, capacity: 0, dailyEnergy: 0 };

  // 전일 데이터 — 기존 plantHistory API로 계산
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const { data: yesterdayHistory } = useMonitoringPlantHistory(myPlantId, yesterdayStr, yesterdayStr);

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

  // 현재시간 실시간 표시
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // CO₂ 저감 — plant API 실시간 연동 (QA #7)
  const monthStart = useMemo(() => `${todayStr.slice(0, 7)}-01`, [todayStr]);
  const yearStart = useMemo(() => `${todayYear}-01-01`, [todayYear]);
  const { data: monthHistory } = useMonitoringPlantHistory(myPlantId, monthStart, todayStr);
  const { data: yearHistory } = useMonitoringPlantHistory(myPlantId, yearStart, todayStr);

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
  const co2ChartData = useMemo(
    () => buildCo2FromHistory(yearHistory, co2Unit, co2Factor),
    [yearHistory, co2Unit, co2Factor],
  );

  const co2TodayTon = toTonWith(plant?.dailyEnergy ?? 0, co2Factor);
  const co2ThisMonthTon = toTonWith(monthlyEnergyKwh > 0 ? monthlyEnergyKwh : (plant?.dailyEnergy ?? 0), co2Factor);
  const co2YtdTon = toTonWith(yearlyEnergyKwh > 0 ? yearlyEnergyKwh : (plant?.dailyEnergy ?? 0), co2Factor);

  // 일별 차트: 선택 월의 1일~말일 범위
  const dailyRange = useMemo(() => {
    const [y, m] = genCtl.month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${genCtl.month}-01`, to: `${genCtl.month}-${String(last).padStart(2, '0')}` };
  }, [genCtl.month]);
  const { data: dailyHistory } = useMonitoringPlantHistory(
    genCtl.tu === 'day' ? myPlantId : 0,
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
  const { data: monthlyHistory } = useMonitoringPlantHistory(
    genCtl.tu === 'month' ? myPlantId : 0,
    yearlyRange.from,
    yearlyRange.to,
  );

  const { data: historyData } = useMonitoringPlantHistory(myPlantId, genCtl.date, genCtl.date);
  const hourlyData = useMemo(() => {
    if (historyData && Array.isArray(historyData) && historyData.length > 0) {
      return historyData.map((h) => ({
        x: h.time ? h.time.slice(11, 16) : '',
        generation: h.acPower ?? h.dcPower ?? 0,
      }));
    }
    const isToday = genCtl.date === todayStr;
    const currentHourNum = isToday ? new Date().getHours() : 24;
    return Array.from({ length: 24 }, (_, hour) => {
      const xLabel = `${String(hour).padStart(2, '0')}:00`;
      if (hour > currentHourNum) return { x: xLabel };
      const isDay = hour >= 6 && hour <= 18;
      if (!isDay) return { x: xLabel, generation: 0 };
      const kw = Math.round(Math.sin(((hour - 6) / 12) * Math.PI) * 110 * 10) / 10;
      return { x: xLabel, generation: kw };
    });
  }, [historyData, genCtl.date, todayStr]);

  const genChartData = useMemo(() => {
    if (genCtl.tu === 'hour') return hourlyData;
    if (genCtl.tu === 'day') return buildDailyGenData(dailyHistory, genCtl.month);
    return buildMonthlyGenData(monthlyHistory, genCtl.year);
  }, [genCtl.tu, genCtl.month, genCtl.year, hourlyData, dailyHistory, monthlyHistory]);

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
      <Breadcrumb items={[{ label: '발전소', path: '/dashboard' }, { label: '대시보드' }]} />

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">대시보드</h1>
              <p className="mt-1 text-sm text-slate-400">오늘의 에너지 현황</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white tabular-nums">
                {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-slate-400">
                {currentTime.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </p>
            </div>
          </div>

          {/* Stats — QA #1 전일발전량 표시, #2 전일대비 삭제, #4 금액 계산식 */}
          <StatsGrid columns={4}>
            <StatCard
              icon={<Sun size={18} className="text-amber-400" />}
              label="현재 출력"
              value={plant?.currentOutput !== undefined ? `${plant.currentOutput.toFixed(1)} kW` : '- kW'}
              sub={
                plant?.currentOutput !== undefined && plant.capacity && plant.capacity > 0
                  ? `${Math.round((plant.currentOutput / plant.capacity) * 100)}% (발전소 용량 대비)`
                  : '- (발전소 용량 대비)'
              }
            />

            <StatCard
              icon={<Zap size={18} className="text-blue-400" />}
              label="발전량 (전일)"
              value={yesterdayEnergy > 0 ? `${yesterdayEnergy.toFixed(1)} kWh` : '- kWh'}
              sub={`${yesterdayStr} 기준`}
            />

            <StatCard
              icon={<Clock size={18} className="text-emerald-400" />}
              label="발전시간 (전일)"
              value={yesterdayHours > 0 ? `${yesterdayHours} 시간` : '- 시간'}
              sub={`${yesterdayStr} 기준`}
            />

            <StatCard
              icon={<Wallet size={18} className="text-violet-400" />}
              label="금액"
              value={yesterdayAmount > 0 ? `${(yesterdayAmount / 10000).toFixed(1)} 만원` : '- 만원'}
              sub={
                yesterdayEnergy > 0 ? `${yesterdayEnergy.toFixed(0)} kWh × ₩${PPA_UNIT_PRICE}/kWh` : '공급량 × PPA 단가'
              }
            />
          </StatsGrid>

          {/* 내 발전소 발전·공급 — lease/dashboard "발전량 추이" 패턴 정합 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-md font-semibold text-white">내 발전소 발전·공급</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {genCtl.tu === 'hour' && '오늘 시간대별 발전량 (kW)'}
                  {genCtl.tu === 'day' && '최근 30일 일별 발전량 (kWh)'}
                  {genCtl.tu === 'month' && '최근 12개월 월별 발전량 (kWh)'}
                  {' · '}전체 {PLANTS.length}개 발전소
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-600 cursor-not-allowed" title="전년도 데이터 없음">
                  전년 동기 대비 <span className="font-semibold">—</span>
                </span>
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
                  {PLANTS.map((p) => {
                    const hidden = hiddenPlants.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlant(p.id)}
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
                          style={{ backgroundColor: p.color, opacity: hidden ? 0.3 : 1 }}
                        />
                        {p.shortName}
                        {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
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
                        const [y, m] = genCtl.month.split('-').map(Number);
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
                            const [y, m] = genCtl.month.split('-').map(Number);
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
              {/* 현재 발전량 표시 — QA #6 */}
              {genCtl.tu === 'hour' && genCtl.date === todayStr && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-400">
                    현재 출력:{' '}
                    <span className="text-white font-semibold">{plant?.currentOutput?.toFixed(1) ?? '-'} kW</span>
                    {' · '}
                    {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
                  </span>
                </div>
              )}
              <RmsAreaChart
                data={genChartData}
                xKey="x"
                areas={
                  PLANTS.length > 0
                    ? PLANTS.filter((p) => !hiddenPlants.has(p.id)).map((p) => ({
                        key: p.dataKey,
                        name: genCtl.tu === 'hour' ? `${p.shortName} (kW)` : `${p.shortName} (kWh)`,
                        color: p.color,
                      }))
                    : [
                        {
                          key: 'generation',
                          name: genCtl.tu === 'hour' ? '발전량 (kW)' : '발전량 (kWh)',
                          color: '#10B981',
                        },
                      ]
                }
                height={260}
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
                  <p className="text-[11px] text-emerald-300/80 uppercase tracking-wide">오늘 CO₂ 저감</p>
                  <p className="text-xl font-bold text-emerald-300 tabular-nums mt-1">
                    {co2TodayTon.toFixed(2)} <span className="text-xs font-normal text-slate-400">tCO₂</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">이번 달 CO₂ 저감</p>
                  <p className="text-xl font-bold text-white tabular-nums mt-1">
                    {co2ThisMonthTon.toFixed(2)} <span className="text-xs font-normal text-slate-400">tCO₂</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">올해 누적 (YTD)</p>
                  <p className="text-xl font-bold text-white tabular-nums mt-1">
                    {co2YtdTon.toFixed(2)} <span className="text-xs font-normal text-slate-400">tCO₂</span>
                  </p>
                </div>
              </div>

              {/* 비교 라인 칩 — 한일튜브/동종평균 토글 */}
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
              </div>
              <RmsLineChart
                data={co2ChartData}
                xKey="x"
                lines={CO2_LINES.filter((m) => !hiddenCo2Lines.has(m.id)).map((m) => ({
                  key: m.id,
                  name: `${m.label} (tCO₂)`,
                  color: m.color,
                }))}
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
