// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Wind,
  Battery,
  Zap,
  Activity,
  CreditCard,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Building2,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  StatCard,
  StatsGrid,
  GenerationTrendCard,
  OnboardingStepper,
  GENERATOR_ONBOARDING_STEPS,
} from '@/components/features';
import type { OnboardingStep as StepperStep } from '@/components/features/OnboardingStepper';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { RmsAreaLineChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnboardings } from '@/hooks/common/useOnboarding';
import { usePowerStations } from '@/hooks/common/usePowerStations';

/* ───────────────────────── Types & Mock ───────────────────────── */

type ResourceType = 'pv' | 'wind' | 'ess' | 'fuelCell';
type PlantStatus = 'normal' | 'maintenance' | 'fault';
type TimeUnit = 'hour' | 'day' | 'month';

interface Plant {
  id: string;
  name: string;
  type: ResourceType;
  resourceLabel: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  ring: string;
  capacityKw: number;
  currentKw: number;
  status: PlantStatus;
  utilization: number; // 가동률 %
  efficiency: number; // 설비효율 %
  cumulativeHours: number; // 누적 가동시간
  todayKwh: number;
  monthKwh: number;
  monthRevenue: number; // ₩
  alert?: { type: 'maintenance' | 'fault'; message: string; meta: string };
}

import { useMonitoringPlants, useMonitoringPlantHistory } from '@/hooks/monitoring/useMonitoring';
import { useMyPlantMatcher, filterPlantsByOwnership } from '@/hooks/monitoring/useMyPlantFilter';

const STATIC_PLANTS: Plant[] = [];

/* ── 시계열 데이터 생성 ───────────────────────────────────────────── */

const TIME_UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'hour', label: '시간' },
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];

const UNIT_DESCRIPTION: Record<TimeUnit, string> = {
  hour: '오늘 시간대별 발전량 (kW)',
  day: '최근 30일 일별 발전량 (kWh)',
  month: '연중 월별 발전량 (kWh)',
};

/* ───────────────────────── Page ───────────────────────── */

export default function GeneratorPpaDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;
  const { data: monitoringPlants } = useMonitoringPlants(true);
  const myPlantMatcher = useMyPlantMatcher();

  const PLANTS: Plant[] = useMemo(() => {
    const raw = (monitoringPlants ?? []) as any[];
    if (raw.length === 0) return STATIC_PLANTS;

    const filtered = filterPlantsByOwnership(raw, myPlantMatcher);

    const typeMap: Record<string, ResourceType> = { SOLAR: 'pv', ORC: 'fuelCell', FUEL_CELL: 'fuelCell' };
    const iconMap: Record<string, LucideIcon> = { pv: Sun, wind: Wind, ess: Battery, fuelCell: Zap };
    const colorMap: Record<string, string> = {
      pv: 'text-amber-400',
      wind: 'text-sky-400',
      ess: 'text-rose-400',
      fuelCell: 'text-violet-400',
    };
    const bgMap: Record<string, string> = {
      pv: 'bg-amber-500/[0.10]',
      wind: 'bg-sky-500/[0.10]',
      ess: 'bg-rose-500/[0.10]',
      fuelCell: 'bg-violet-500/[0.10]',
    };
    const ringMap: Record<string, string> = {
      pv: 'ring-amber-500/30',
      wind: 'ring-sky-500/30',
      ess: 'ring-rose-500/30',
      fuelCell: 'ring-violet-500/30',
    };
    const labelMap: Record<string, string> = { pv: '태양광', wind: '풍력', ess: 'ESS', fuelCell: '연료전지' };
    return filtered.map((p: any) => {
      const rt: ResourceType = typeMap[p.type] ?? 'pv';
      return {
        id: String(p.plantId ?? p.id),
        name: p.name ?? '발전소',
        type: rt,
        resourceLabel: labelMap[rt],
        icon: iconMap[rt],
        color: colorMap[rt],
        bg: bgMap[rt],
        ring: ringMap[rt],
        capacityKw: p.capacity ?? 0,
        currentKw: p.currentOutput ?? 0,
        status: (p.status === 'NORMAL'
          ? 'normal'
          : p.status === 'MAINTENANCE'
            ? 'maintenance'
            : 'fault') as PlantStatus,
        utilization: p.capacity > 0 ? Math.round((p.currentOutput / p.capacity) * 100) : 0,
        efficiency: p.capacity > 0 ? Math.round((p.dailyEnergy / (p.capacity * 24)) * 100 * 10) / 10 : 0,
        cumulativeHours: Math.round(2000 + Math.random() * 3000),
        todayKwh: p.dailyEnergy ?? 0,
        monthKwh: (p.dailyEnergy ?? 0) * 28,
        monthRevenue: Math.round((p.dailyEnergy ?? 0) * 28 * 110),
      } as Plant;
    });
  }, [monitoringPlants, myPlantMatcher]);

  const [scopeId, setScopeId] = useState<'all' | string>('all');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('hour');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyYear, setHistoryYear] = useState(() => new Date().getFullYear());

  const scopedPlants = scopeId === 'all' ? PLANTS : PLANTS.filter((p) => p.id === scopeId);
  const isAll = scopeId === 'all';

  // Date label and shift (시간별=일 / 일별=월 / 월별=연 단위로 이동)
  const formatDateLabel = (d: Date) => {
    if (timeUnit === 'hour')
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (timeUnit === 'day') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${d.getFullYear()}`;
  };

  const shiftDate = (delta: number) => {
    setSelectedDate((d) => {
      const next = new Date(d);
      if (timeUnit === 'hour') next.setDate(d.getDate() + delta);
      else if (timeUnit === 'day') next.setMonth(d.getMonth() + delta);
      else next.setFullYear(d.getFullYear() + delta);
      return next;
    });
  };

  const kpis = useMemo(() => {
    const currentKw = scopedPlants.reduce((s, p) => s + p.currentKw, 0);
    const todayKwh = scopedPlants.reduce((s, p) => s + p.todayKwh, 0);
    const monthKwh = scopedPlants.reduce((s, p) => s + p.monthKwh, 0);
    const monthRevenue = scopedPlants.reduce((s, p) => s + p.monthRevenue, 0);
    const totalCap = scopedPlants.reduce((s, p) => s + p.capacityKw, 0);
    const utilizationNow = totalCap > 0 ? Math.round((currentKw / totalCap) * 1000) / 10 : 0;
    return { currentKw, todayKwh, monthKwh, monthRevenue, totalCap, utilizationNow };
  }, [scopedPlants]);

  // 실데이터 조회 — 시간별: plantHistory API 사용 (QA #3)
  const historyDateStr = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    if (timeUnit === 'hour') return { from: `${y}-${m}-${d}`, to: `${y}-${m}-${d}` };
    if (timeUnit === 'day') {
      const start = `${y}-${m}-01`;
      const lastDay = new Date(y, selectedDate.getMonth() + 1, 0).getDate();
      return { from: start, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
    }
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }, [selectedDate, timeUnit]);

  const firstPlantId = scopedPlants.length > 0 ? Number(scopedPlants[0].id) : 0;
  const { data: realHistory } = useMonitoringPlantHistory(firstPlantId, historyDateStr.from, historyDateStr.to);

  const chartData = useMemo(() => {
    const rt = scopedPlants[0]?.type ?? 'pv';
    const todayStr = new Date().toISOString().slice(0, 10);

    if (realHistory && Array.isArray(realHistory) && realHistory.length > 0) {
      if (timeUnit === 'hour') {
        return realHistory.map((h) => {
          const timeLabel = h.time ? h.time.slice(11, 16) : '';
          const power = h.acPower ?? h.dcPower ?? 0;
          const val = Math.round(power * 10) / 10;
          return {
            time: timeLabel,
            [rt]: val,
            total: val,
            operatingHours: power > 0 ? 1 : 0,
            pv: rt === 'pv' ? val : 0,
            wind: rt === 'wind' ? val : 0,
            ess: rt === 'ess' ? val : 0,
            fuelCell: rt === 'fuelCell' ? val : 0,
          };
        });
      }

      if (timeUnit === 'day') {
        const byDate = new Map<string, number>();
        for (const h of realHistory) {
          const dk = h.time ? h.time.slice(0, 10) : '';
          if (!dk || dk > todayStr) continue;
          byDate.set(dk, Math.max(byDate.get(dk) ?? 0, h.dailyEnergy ?? 0));
        }
        const y = selectedDate.getFullYear();
        const m = selectedDate.getMonth() + 1;
        const daysInMonth = new Date(y, m, 0).getDate();
        const mStr = `${y}-${String(m).padStart(2, '0')}`;
        const lastDay = mStr === todayStr.slice(0, 7) ? Number(todayStr.slice(8, 10)) : daysInMonth;
        return Array.from({ length: lastDay }, (_, i) => {
          const day = i + 1;
          const dk = `${mStr}-${String(day).padStart(2, '0')}`;
          const kwh = Math.round(byDate.get(dk) ?? 0);
          return {
            time: `${m}/${day}`,
            [rt]: kwh,
            total: kwh,
            operatingHours: kwh > 0 ? 1 : 0,
            pv: rt === 'pv' ? kwh : 0,
            wind: rt === 'wind' ? kwh : 0,
            ess: rt === 'ess' ? kwh : 0,
            fuelCell: rt === 'fuelCell' ? kwh : 0,
          };
        });
      }

      if (timeUnit === 'month') {
        const byDate = new Map<string, number>();
        for (const h of realHistory) {
          const dk = h.time ? h.time.slice(0, 10) : '';
          if (!dk || dk > todayStr) continue;
          byDate.set(dk, Math.max(byDate.get(dk) ?? 0, h.dailyEnergy ?? 0));
        }
        const byMonth = new Map<string, number>();
        for (const [date, kwh] of byDate) {
          const mKey = date.slice(0, 7);
          byMonth.set(mKey, (byMonth.get(mKey) ?? 0) + kwh);
        }
        const year = selectedDate.getFullYear();
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const lastMonth = year === currentYear ? currentMonth : 12;
        return Array.from({ length: lastMonth }, (_, i) => {
          const mKey = `${year}-${String(i + 1).padStart(2, '0')}`;
          const kwh = Math.round(byMonth.get(mKey) ?? 0);
          return {
            time: `${i + 1}월`,
            [rt]: kwh,
            total: kwh,
            operatingHours: kwh > 0 ? 1 : 0,
            pv: rt === 'pv' ? kwh : 0,
            wind: rt === 'wind' ? kwh : 0,
            ess: rt === 'ess' ? kwh : 0,
            fuelCell: rt === 'fuelCell' ? kwh : 0,
          };
        });
      }
    }
    return [];
  }, [timeUnit, scopedPlants, realHistory, selectedDate]);

  // 최근 6개월 요약 데이터
  const summaryRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const y1 = from.getFullYear(),
      m1 = String(from.getMonth() + 1).padStart(2, '0');
    const y2 = now.getFullYear(),
      m2 = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y2, now.getMonth() + 1, 0).getDate();
    return { from: `${y1}-${m1}-01`, to: `${y2}-${m2}-${String(lastDay).padStart(2, '0')}` };
  }, []);
  const { data: summaryHistory } = useMonitoringPlantHistory(firstPlantId, summaryRange.from, summaryRange.to);

  const monthlySummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const byDate = new Map<string, number>();
    if (summaryHistory && Array.isArray(summaryHistory)) {
      for (const h of summaryHistory) {
        const dk = h.time ? h.time.slice(0, 10) : '';
        if (!dk || dk > todayStr) continue;
        byDate.set(dk, Math.max(byDate.get(dk) ?? 0, h.dailyEnergy ?? 0));
      }
    }
    const byMonth = new Map<string, number>();
    for (const [date, kwh] of byDate) {
      const m = date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + kwh);
    }
    const sorted = Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([period, kwh]) => ({ period, kwh: Math.round(kwh) }));
    return sorted;
  }, [summaryHistory]);

  // 연도별 이력 모달용 데이터
  const yearlyRange = useMemo(() => {
    const prevYear = historyYear - 1;
    return { from: `${prevYear}-01-01`, to: `${historyYear}-12-31` };
  }, [historyYear]);
  const { data: yearlyRawHistory } = useMonitoringPlantHistory(firstPlantId, yearlyRange.from, yearlyRange.to);

  const yearlyData = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const byDate = new Map<string, number>();
    if (yearlyRawHistory && Array.isArray(yearlyRawHistory)) {
      for (const h of yearlyRawHistory) {
        const dk = h.time ? h.time.slice(0, 10) : '';
        if (!dk || dk > todayStr) continue;
        byDate.set(dk, Math.max(byDate.get(dk) ?? 0, h.dailyEnergy ?? 0));
      }
    }
    const byYearMonth = new Map<string, number>();
    for (const [date, kwh] of byDate) {
      const ym = date.slice(0, 7);
      byYearMonth.set(ym, (byYearMonth.get(ym) ?? 0) + kwh);
    }

    const buildYear = (year: number) =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const isFuture = year > currentYear || (year === currentYear && month > currentMonth);
        const mKey = `${year}-${String(month).padStart(2, '0')}`;
        return { month, kwh: isFuture ? 0 : Math.round(byYearMonth.get(mKey) ?? 0), isFuture };
      });

    return { current: buildYear(historyYear), prev: buildYear(historyYear - 1) };
  }, [yearlyRawHistory, historyYear]);

  // 차트 요약값 — 발전량 합계 + 발전시간 합계
  const chartSummary = useMemo(() => {
    const totalKwh = chartData.reduce((s, r) => s + r.total, 0);
    const totalHours = chartData.reduce((s, r) => s + r.operatingHours, 0);
    return {
      totalKwh: Math.round(totalKwh * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  }, [chartData]);

  const summaryUnit = timeUnit === 'hour' ? 'kWh' : 'kWh';
  const summaryLabel = timeUnit === 'hour' ? '발전량' : '누적 발전량';
  const hoursLabel = timeUnit === 'hour' ? '발전시간' : timeUnit === 'day' ? '평균 발전시간/일' : '누적 발전시간';

  // 자원이 보유한 것만 area 표시
  const hasResource = (type: ResourceType) => scopedPlants.some((p) => p.type === type);
  const areas = [
    hasResource('pv') && { key: 'pv', name: '태양광', color: '#F59E0B' },
    hasResource('wind') && { key: 'wind', name: '풍력', color: '#06B6D4' },
    hasResource('fuelCell') && { key: 'fuelCell', name: '연료전지', color: '#A78BFA' },
    hasResource('ess') && { key: 'ess', name: 'ESS', color: '#F43F5E' },
  ].filter(Boolean) as { key: string; name: string; color: string }[];

  const todayDate = useMemo(() => new Date(), []);

  // Dropdown 표시 라벨
  const selectedPlantLabel = isAll ? `전체 합산 (${PLANTS.length})` : (scopedPlants[0]?.name ?? '전체 합산');

  // 온보딩 상태
  const { data: onboardings } = useOnboardings(companyId);
  const { data: stationsData } = usePowerStations(companyId ? ({ companyId } as any) : undefined);

  const { onboardingSteps, isPendingApproval } = useMemo(() => {
    const { icons } = GENERATOR_ONBOARDING_STEPS;
    const onboarding = Array.isArray(onboardings) ? onboardings[0] : null;
    const stationList = (stationsData as any)?.content ?? stationsData ?? [];
    const hasStations = Array.isArray(stationList) && stationList.length > 0;
    const hasActiveStation = hasStations && stationList.some((s: any) => s.status === 'ACTIVE');

    const signupDone = !!user;
    const resourceDone = hasStations || PLANTS.length > 0;
    const approvalDone = hasActiveStation;
    const dashboardDone = approvalDone;

    const obSteps = onboarding?.steps ?? [];
    const approvalStep = obSteps.find((s: any) => s.stepCode === 'APPROVAL' || s.stepCode === 'SPC_APPROVAL');
    const approvalRejected = approvalStep?.status === 'REJECTED';
    const approvalReason = approvalStep?.rejectionReason;

    const steps: StepperStep[] = [
      {
        label: '회원가입',
        description: '발전사업자 계정 생성',
        status: signupDone ? 'completed' : 'current',
        icon: icons.signup,
      },
      {
        label: '자원 등록',
        description: '발전소 · 설비 등록',
        status: resourceDone ? 'completed' : signupDone ? 'current' : 'pending',
        icon: icons.resource,
      },
      {
        label: 'SPC/Admin 승인',
        description: '등록 자원 검토 · 승인',
        status: approvalRejected ? 'rejected' : approvalDone ? 'completed' : resourceDone ? 'current' : 'pending',
        icon: icons.approval,
        rejectionReason: approvalRejected ? approvalReason : undefined,
      },
      {
        label: '대시보드 노출',
        description: '모니터링 · 거래 활성화',
        status: dashboardDone ? 'completed' : approvalDone ? 'current' : 'pending',
        icon: icons.dashboard,
      },
    ];

    return { onboardingSteps: steps, isPendingApproval: resourceDone && !approvalDone };
  }, [user, onboardings, stationsData, PLANTS.length]);

  const isOnboardingComplete = onboardingSteps.every((s) => s.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: '발전소', path: '/dashboard' }, { label: '발전현황' }]} />

      {/* Header — 우측 사업장 Dropdown (lease/dashboard 패턴 정합) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">발전 현황</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAll
              ? `${PLANTS.length}개 발전소 통합 · 총 ${kpis.totalCap.toLocaleString()} kW`
              : `${scopedPlants[0]?.name} · ${scopedPlants[0]?.capacityKw.toLocaleString()} kW`}
          </p>
        </div>
        <Dropdown
          align="right"
          trigger={
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[200px] cursor-pointer text-white hover:bg-white/[0.08]">
              <span className="text-xs text-slate-500 shrink-0">발전소</span>
              <span className="font-medium truncate flex-1">{selectedPlantLabel}</span>
              <ChevronDown size={14} className="text-slate-500 shrink-0" />
            </div>
          }
        >
          <DropdownItem onClick={() => setScopeId('all' as any)}>
            <div className="flex items-center gap-2">
              <Building2 size={14} />
              <div>
                <p className="text-sm">전체 합산</p>
                <p className="text-xs text-slate-500">{PLANTS.length}개 발전소</p>
              </div>
            </div>
          </DropdownItem>
          <div className="my-1 border-t border-white/[0.06]" />
          {PLANTS.map((p) => (
            <DropdownItem key={p.id} onClick={() => setScopeId(p.id as any)}>
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                <div>
                  <p className="text-sm">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.capacityKw.toLocaleString()} kW</p>
                </div>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>
      </div>

      {/* 온보딩 진행 현황 */}
      {!isOnboardingComplete && <OnboardingStepper steps={onboardingSteps} />}

      {isPendingApproval && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-500/[0.06] ring-1 ring-blue-500/20 p-4">
          <Clock size={18} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-300">승인 대기 중</p>
            <p className="text-xs text-slate-400 mt-0.5">
              등록하신 자원이 SPC/Admin의 검토를 기다리고 있습니다. 승인이 완료되면 대시보드에 발전소 데이터가
              노출됩니다.
            </p>
          </div>
        </div>
      )}

      {/* KPI 4 */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<Activity size={18} className="text-emerald-400" />}
          label="현재 시각 발전량"
          value={`${kpis.currentKw.toLocaleString()} kW`}
          sub={`가동률 ${kpis.utilizationNow}%`}
        />
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="오늘 누적 발전량"
          value={`${kpis.todayKwh.toLocaleString()} kWh`}
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-blue-400" />}
          label="이번달 누적 발전량"
          value={`${(kpis.monthKwh / 1000).toFixed(1)} MWh`}
        />
        <StatCard
          icon={<CreditCard size={18} className="text-violet-400" />}
          label="이번달 예상 수익"
          value={`₩${kpis.monthRevenue.toLocaleString()}`}
        />
      </StatsGrid>

      {/* Main Chart */}
      <GenerationTrendCard
        description={`${UNIT_DESCRIPTION[timeUnit]} · 자원별 누적`}
        timeUnits={TIME_UNIT_OPTIONS}
        activeUnit={timeUnit}
        onUnitChange={(v) => setTimeUnit(v as TimeUnit)}
        dateLabel={formatDateLabel(selectedDate)}
        onPrev={() => shiftDate(-1)}
        onNext={() => {
          const next = new Date(selectedDate);
          if (timeUnit === 'hour') next.setDate(next.getDate() + 1);
          else if (timeUnit === 'day') next.setMonth(next.getMonth() + 1);
          else next.setFullYear(next.getFullYear() + 1);
          if (next <= todayDate) shiftDate(1);
        }}
        summaryBar={
          <>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="text-slate-400">
                {summaryLabel}{' '}
                <span className="text-primary font-semibold tabular-nums ml-1">
                  {chartSummary.totalKwh.toLocaleString()} {summaryUnit}
                </span>
              </span>
              <span className="h-3 w-px bg-white/[0.10]" />
              <span className="text-slate-400">
                {hoursLabel}{' '}
                <span className="text-amber-400 font-semibold tabular-nums ml-1">
                  {chartSummary.totalHours.toLocaleString()} 시간
                </span>
              </span>
            </div>
          </>
        }
        footer={
          <div className="border-t border-white/[0.06] px-6 py-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">발전소별 최근 3개월</p>
            <div className="divide-y divide-white/[0.04]">
              {PLANTS.map((p) => {
                const recent3 = monthlySummary.slice(0, 3);
                return (
                  <div key={p.id} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('flex h-5 w-5 items-center justify-center rounded', p.bg)}>
                          <p.icon size={11} className={p.color} />
                        </span>
                        <span className="text-sm text-slate-300">{p.name}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-1.5 ml-7">
                      {recent3.map((m) => (
                        <div key={m.period} className="text-xs">
                          <span className="text-slate-500">{m.period.slice(5)}월</span>
                          <span className="text-white font-semibold tabular-nums ml-1.5">
                            {m.kwh.toLocaleString()} kWh
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      >
        <div className="px-2 pt-2 pb-2">
          {areas.length > 0 ? (
            <RmsAreaLineChart data={chartData} xKey="time" areas={areas} stacked height={300} />
          ) : null}
        </div>
      </GenerationTrendCard>

      {/* 연도별 발전량 이력 Modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="연도별 발전량 이력" size="md">
        {(() => {
          const yearMin = 2024;
          const yearMax = new Date().getFullYear();
          const data = yearlyData.current;
          const prevData = historyYear > yearMin ? yearlyData.prev : null;
          const yearTotal = data.reduce((s, m) => s + m.kwh, 0);
          const prevYearTotal = prevData ? prevData.reduce((s, m) => s + m.kwh, 0) : null;
          const yoy =
            prevYearTotal && prevYearTotal > 0
              ? Math.round(((yearTotal - prevYearTotal) / prevYearTotal) * 1000) / 10
              : null;

          return (
            <div className="space-y-4">
              {/* Year stepper + total */}
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] ring-1 ring-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setHistoryYear((y) => Math.max(yearMin, y - 1))}
                    disabled={historyYear <= yearMin}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-base font-bold text-white tabular-nums min-w-[72px] text-center">
                    {historyYear}년
                  </span>
                  <button
                    type="button"
                    onClick={() => setHistoryYear((y) => Math.min(yearMax, y + 1))}
                    disabled={historyYear >= yearMax}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">연간 합계</p>
                  <p className="text-base font-bold text-white tabular-nums">
                    {yearTotal.toLocaleString()} <span className="text-xs text-slate-500">kWh</span>
                  </p>
                  {yoy !== null && (
                    <p className={cn('text-[10px] tabular-nums', yoy >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                      전년 대비 {yoy >= 0 ? '▲' : '▼'} {Math.abs(yoy)}%
                    </p>
                  )}
                </div>
              </div>

              {/* 12개월 grid */}
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {data.map((m) => {
                  const prevMonthSameYear = prevData?.[m.month - 1];
                  const monthYoY =
                    prevMonthSameYear && prevMonthSameYear.kwh > 0 && !m.isFuture
                      ? Math.round(((m.kwh - prevMonthSameYear.kwh) / prevMonthSameYear.kwh) * 1000) / 10
                      : null;
                  return (
                    <div
                      key={m.month}
                      className={cn(
                        'rounded-lg p-2.5 ring-1',
                        m.isFuture
                          ? 'bg-white/[0.01] ring-white/[0.04] opacity-50'
                          : 'bg-white/[0.03] ring-white/[0.06]',
                      )}
                    >
                      <p className="text-[10px] text-slate-500 tabular-nums">{String(m.month).padStart(2, '0')}월</p>
                      {m.isFuture ? (
                        <p className="text-xs text-slate-600 tabular-nums mt-1">—</p>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-white tabular-nums mt-0.5">
                            {(m.kwh / 1000).toFixed(1)}
                            <span className="text-[10px] text-slate-500 ml-0.5">MWh</span>
                          </p>
                          {monthYoY !== null && (
                            <p
                              className={cn(
                                'text-[10px] tabular-nums mt-0.5',
                                monthYoY >= 0 ? 'text-emerald-400' : 'text-amber-400',
                              )}
                            >
                              {monthYoY >= 0 ? '▲' : '▼'} {Math.abs(monthYoY)}%
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                ※ 2026년 5월은 4일 기준 partial · 회색은 미래 (집계 전)
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
