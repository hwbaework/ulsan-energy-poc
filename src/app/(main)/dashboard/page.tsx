'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { useOnboardingStore } from '@/stores';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, usePersonaOverride } from '@/lib/persona';
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
} from 'lucide-react';
import { StatCard, StatsGrid, OnboardingModal, AssetRegistrationBanner } from '@/components/features';

import { RmsAreaLineChart, RmsBarChart, RmsLineChart } from '@/components/ui/Chart';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useScopedPlants, usePlantsHistory } from '@/hooks/monitoring/useScopedPlants';
import { expandByContract } from '@/lib/contract-plants';
import { useMyPlantIds } from '@/hooks/monitoring/useMyPlantFilter';
import { useEnergySettings } from '@/hooks/common/useSettings';
import * as monitoringApi from '@/api/monitoring';
import type { PlantHistoryPoint } from '@/api/monitoring/monitoring';
import { monitoringKeys } from '@/api/queryKeys';

// ── Mock Data ──


// 시간/일/월 단위 토글 (lease/dashboard 패턴)
type TimeUnit = 'hour' | 'day' | 'month';
const TIME_UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'hour', label: '시간' },
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];

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

// ── 관리자: 회사(계약 발전소) 하나를 골라 작년·올해 발전량을 막대로 비교 ──
type CompareUnit = 'month' | 'year';
const COMPARE_UNIT_OPTIONS: { value: CompareUnit; label: string }[] = [
  { value: 'month', label: '월' },
  { value: 'year', label: '년' },
];
const COMPARE_COLORS = { prev: '#3B82F6', cur: '#10B981', other: '#475569' } as const; // other = 년 단위에서 비교 대상이 아닌 해

interface YearEnergy {
  /** 1월~12월 발전량(kWh) */
  months: number[];
  total: number;
}

/** 시간별 이력 → 일별 최대 dailyEnergy → 월별 합. 해당 연도·오늘까지만 센다 */
function sumByMonth(history: PlantHistoryPoint[] | undefined, year: number, todayStr: string): YearEnergy {
  const months = Array<number>(12).fill(0);
  if (!history || history.length === 0) return { months, total: 0 };
  const byDate = new Map<string, number>();
  for (const h of history) {
    const dateKey = h.time ? h.time.slice(0, 10) : '';
    if (!dateKey || dateKey > todayStr || Number(dateKey.slice(0, 4)) !== year) continue;
    byDate.set(dateKey, Math.max(byDate.get(dateKey) ?? 0, h.dailyEnergy ?? 0));
  }
  let total = 0;
  for (const [date, kwh] of byDate) {
    const m = Number(date.slice(5, 7)) - 1;
    months[m] = (months[m] ?? 0) + kwh;
    total += kwh;
  }
  return { months, total };
}

/** 발전소 하나의 연도별 발전량 — 연도마다 1/1~12/31 이력을 한 번씩 조회 */
function usePlantYearlyEnergy(plantId: number, years: number[], todayStr: string) {
  const results = useQueries({
    queries: years.map((y) => ({
      queryKey: monitoringKeys.plantHistory(plantId, `${y}-01-01`, `${y}-12-31`),
      queryFn: () => monitoringApi.getPlantHistory(plantId, `${y}-01-01`, `${y}-12-31`),
      staleTime: 5 * 60_000,
      enabled: plantId > 0,
    })),
  });
  const dataKey = results.map((r) => (r.data ? r.data.length : -1)).join(',');
  return useMemo(() => {
    const byYear: Record<number, YearEnergy> = {};
    years.forEach((y, i) => {
      byYear[y] = sumByMonth(results[i]?.data, y, todayStr);
    });
    return { byYear, isLoading: results.some((r) => r.isLoading) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, plantId, years.join(','), todayStr]);
}

export default function DashboardPage() {
  const router = useRouter();
  const { isCompleted, complete, hydrate } = useOnboardingStore();
  const onboarded = isCompleted('generator');

  const { data: energySettings } = useEnergySettings();
  const co2Factor = energySettings?.CO2_EMISSION_FACTOR
    ? Number(energySettings.CO2_EMISSION_FACTOR)
    : DEFAULT_CO2_EMISSION_FACTOR;

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

  const user = useAuthStore((s) => s.user);
  const personaOverride = usePersonaOverride((s) => s.override);
  const isAdmin = (personaOverride ?? getPersona(user)) === 'admin';

  const { hasPlants, isGenerator } = useMyPlantIds();
  // 역할별 범위: 관리자=전체, 발전사업자·전기사용자=자사 계약 발전소
  const { plants: scopedPlants } = useScopedPlants();
  // 발전소별 칩·계열은 계약 단위 — 한일튜브(자가소비)·한일튜브(onsite). 이력은 발전소 것에 계약 몫(share)을 곱한다
  const allContractPlants = useMemo(() => expandByContract(scopedPlants), [scopedPlants]);

  // 관리자: 회사(계약 발전소) 하나만 골라 본다 — 지표·발전량 비교·CO₂ 전부 그 회사 기준
  const [selectedCompanyKey, setSelectedCompanyKey] = useState('');
  const selectedCompany = useMemo(
    () => allContractPlants.find((p) => p.key === selectedCompanyKey) ?? allContractPlants[0],
    [allContractPlants, selectedCompanyKey],
  );
  const companyOptions = useMemo(
    () => allContractPlants.map((p) => ({ value: p.key, label: shortPlantName(p.displayName) })),
    [allContractPlants],
  );
  const activePlants = useMemo(
    () => (isAdmin ? (selectedCompany ? [selectedCompany] : []) : scopedPlants),
    [isAdmin, selectedCompany, scopedPlants],
  );
  const scopedIds = useMemo(() => activePlants.map((p) => p.plantId), [activePlants]);
  // 관리자가 고른 계약의 몫 — 이력은 설비 전체 값이라 곱해서 쓴다
  const activeShare = isAdmin ? (selectedCompany?.share ?? 1) : 1;
  // 발전소별 칩은 관리자 화면엔 없다(회사 하나만 보니까)
  const contractPlants = useMemo(() => (isAdmin ? [] : allContractPlants), [isAdmin, allContractPlants]);
  const plant = useMemo(
    () => ({
      currentOutput: activePlants.reduce((sum, p) => sum + p.currentOutput, 0),
      capacity: activePlants.reduce((sum, p) => sum + p.capacity, 0),
      dailyEnergy: activePlants.reduce((sum, p) => sum + (p.dailyEnergy ?? 0), 0),
    }),
    [activePlants],
  );
  // 발전소별 선 표시 토글 (기본 꺼짐 — 칩으로 켠다)
  const [visiblePlantKeys, setVisiblePlantKeys] = useState<Set<string>>(new Set());
  // 계약 단위 항목이 여럿이면 처음부터 전부 켜 둔다 — 한일튜브(자가소비)·(onsite) 가 바로 보이게
  const chipsInitRef = useRef(false);
  useEffect(() => {
    if (chipsInitRef.current || contractPlants.length <= 1) return;
    chipsInitRef.current = true;
    const all = new Set(contractPlants.map((p) => p.key));
    setVisiblePlantKeys(all);
  }, [contractPlants]);
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
    return maxEnergy * activeShare;
  }, [yesterdayHistory, activeShare]);

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
  const { merged: yearHistory } = usePlantsHistory(scopedIds, yearStart, todayStr);
  // CO₂ 발전소별 계열 — 관리자도 전 회사(계약 발전소)를 다 그린다. 발전사업자·전기사용자는 자사 계약 발전소
  const co2Plants = allContractPlants;
  const co2PlantIds = useMemo(() => Array.from(new Set(allContractPlants.map((p) => p.plantId))), [allContractPlants]);
  const { byPlant: yearByPlantCo2 } = usePlantsHistory(co2PlantIds, yearStart, todayStr);

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

  const monthlyEnergyKwh = useMemo(() => sumDailyEnergy(monthHistory) * activeShare, [monthHistory, activeShare]);
  const yearlyEnergyKwh = useMemo(() => sumDailyEnergy(yearHistory) * activeShare, [yearHistory, activeShare]);
  // CO₂ 저감 — 전체(hanil) + 발전소별(p_<id>) 시리즈
  const [visibleCo2PlantKeys, setVisibleCo2PlantKeys] = useState<Set<string>>(new Set());
  // CO₂ 회사별 선은 처음부터 전부 켠다 (관리자: 전 회사, 그 외: 자사 계약 발전소)
  const co2ChipsInitRef = useRef(false);
  useEffect(() => {
    if (co2ChipsInitRef.current || co2Plants.length === 0) return;
    co2ChipsInitRef.current = true;
    setVisibleCo2PlantKeys(new Set(co2Plants.map((p) => p.key)));
  }, [co2Plants]);

  const toggleCo2PlantKey = (key: string) => {
    setVisibleCo2PlantKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const co2ChartData = useMemo(() => {
    const rows: Array<Record<string, string | number>> = (
      buildCo2FromHistory(yearHistory, co2Unit, co2Factor) as Array<Record<string, string | number>>
    ).map((r) => ({ ...r, hanil: Math.round(Number(r.hanil ?? 0) * activeShare * 100) / 100 }));
    const perPlant = new Map<string, Record<string, number>>();
    for (const pl of co2Plants) {
      const hist = yearByPlantCo2[pl.plantId];
      if (!hist || hist.length === 0) continue;
      for (const r of buildCo2FromHistory(hist, co2Unit, co2Factor) as Array<Record<string, string | number>>) {
        const x = String(r.x);
        const cur = perPlant.get(x) ?? {};
        cur[pl.key] = Math.round(Number(r.hanil ?? 0) * pl.share * 1000) / 1000;
        perPlant.set(x, cur);
      }
    }
    return rows.map((r) => ({ ...r, ...(perPlant.get(String(r.x)) ?? {}) }));
  }, [yearHistory, yearByPlantCo2, co2Plants, co2Unit, co2Factor, activeShare]);
  // CO₂ 기본 계열 이름 — 관리자는 고른 회사, 그 외는 전체
  const co2MainLabel = isAdmin && selectedCompany ? shortPlantName(selectedCompany.displayName) : '전체';

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
    genCtl.tu === 'day' && !isAdmin ? scopedIds : EMPTY_IDS,
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
    genCtl.tu === 'month' && !isAdmin ? scopedIds : EMPTY_IDS,
    yearlyRange.from,
    yearlyRange.to,
  );

  const { merged: historyData, byPlant: hourlyByPlant } = usePlantsHistory(
    genCtl.tu === 'hour' && !isAdmin ? scopedIds : EMPTY_IDS,
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
    for (const p of contractPlants) {
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
        cur[p.key] = Math.round(Number((r as Record<string, unknown>).generation ?? 0) * p.share);
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
    contractPlants,
  ]);

  // 관리자: 발전량 비교 — 월 = 고른 해와 그 전 해의 월별, 년 = 고른 해까지 5년 연간. 요약은 둘 다 고른 해 vs 전 해
  const [cmpUnit, setCmpUnit] = useState<CompareUnit>('month');
  const [cmpYear, setCmpYear] = useState(todayYear);
  const cmpBaseYear = cmpYear;
  const cmpYears = useMemo(
    () => (cmpUnit === 'month' ? [cmpYear - 1, cmpYear] : Array.from({ length: 5 }, (_, i) => cmpYear - 4 + i)),
    [cmpUnit, cmpYear],
  );
  const { byYear: cmpByYear } = usePlantYearlyEnergy(isAdmin ? (selectedCompany?.plantId ?? 0) : 0, cmpYears, todayStr);
  // 동기 비교 범위 — 올해면 1~이번 달, 지난 해면 연간
  const cmpLastMonth = cmpBaseYear === todayYear ? Number(todayStr.slice(5, 7)) : 12;
  const cmpChartData = useMemo(() => {
    const scale = (v: number) => Math.round(v * activeShare);
    if (cmpUnit === 'month') {
      const prev = cmpByYear[cmpYear - 1]?.months ?? [];
      const cur = cmpByYear[cmpYear]?.months ?? [];
      return Array.from({ length: 12 }, (_, i) => ({
        x: `${i + 1}월`,
        prev: scale(prev[i] ?? 0),
        // 아직 오지 않은 달은 올해 막대를 그리지 않는다
        ...(i < cmpLastMonth ? { cur: scale(cur[i] ?? 0) } : {}),
      }));
    }
    // 년: 비교 대상(전 해 · 고른 해)은 월 단위와 같은 색으로, 나머지 해는 회색
    return cmpYears.map((y) => {
      const total = scale(cmpByYear[y]?.total ?? 0);
      return { x: `${y}년`, ...(y === cmpYear ? { cur: total } : y === cmpYear - 1 ? { prev: total } : { other: total }) };
    });
  }, [cmpUnit, cmpYear, cmpYears, cmpByYear, cmpLastMonth, activeShare]);
  const cmpSummary = useMemo(() => {
    const sumTo = (y: number) =>
      (cmpByYear[y]?.months ?? []).slice(0, cmpLastMonth).reduce((s, v) => s + v, 0) * activeShare;
    const prev = Math.round(sumTo(cmpBaseYear - 1));
    const cur = Math.round(sumTo(cmpBaseYear));
    const diffPct = prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
    return { prev, cur, diffPct };
  }, [cmpByYear, cmpBaseYear, cmpLastMonth, activeShare]);
  const cmpRangeLabel = cmpLastMonth === 12 ? '연간' : `1~${cmpLastMonth}월`;

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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-xl font-bold text-white">대시보드</h1>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">회사</span>
                <div className="w-52">
                  <Select
                    options={companyOptions}
                    value={selectedCompany?.key ?? ''}
                    placeholder="회사 선택"
                    onChange={(e) => setSelectedCompanyKey(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

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

          {/* 관리자 — 작년·올해 발전량 비교 */}
          {isAdmin && (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-md font-semibold text-white">발전량 비교</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {cmpUnit === 'month'
                      ? `${cmpYear - 1}년 · ${cmpYear}년 월별 발전량 (kWh)`
                      : `${cmpYear - 4}년 ~ ${cmpYear}년 연간 발전량 (kWh)`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                {/* < 연도 > — 월·년 모두 고른 해 기준 */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCmpYear((y) => y - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                    aria-label="이전"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-sm font-semibold text-white tabular-nums px-1 min-w-[56px] text-center">{cmpYear}년</span>
                  <button
                    type="button"
                    disabled={cmpYear >= todayYear}
                    onClick={() => setCmpYear((y) => Math.min(y + 1, todayYear))}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/[0.06]',
                      cmpYear >= todayYear
                        ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]',
                    )}
                    aria-label="다음"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
                  {COMPARE_UNIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCmpUnit(opt.value)}
                      className={cn(
                        'rounded px-2.5 h-7 text-xs transition-colors',
                        cmpUnit === opt.value ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                </div>
              </div>
              <div className="px-5 py-4">
                {/* 동기 비교 — 전 해 / 고른 해 / 증감 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                    <p className="text-sm text-slate-300">
                      {cmpBaseYear - 1}년 {cmpRangeLabel} 발전량
                    </p>
                    <p className="text-xl font-semibold text-white tabular-nums mt-1">
                      {cmpSummary.prev.toLocaleString()} <span className="text-white">kWh</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 p-3">
                    <p className="text-sm text-emerald-300/90">
                      {cmpBaseYear}년 {cmpRangeLabel} 발전량
                    </p>
                    <p className="text-xl font-semibold text-emerald-300 tabular-nums mt-1">
                      {cmpSummary.cur.toLocaleString()} <span className="text-emerald-300">kWh</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                    <p className="text-sm text-slate-300">전년 동기 대비</p>
                    <p
                      className={cn(
                        'text-xl font-semibold tabular-nums mt-1',
                        cmpSummary.diffPct == null
                          ? 'text-slate-500'
                          : cmpSummary.diffPct >= 0
                            ? 'text-emerald-300'
                            : 'text-red-400',
                      )}
                    >
                      {cmpSummary.diffPct == null
                        ? '-'
                        : `${cmpSummary.diffPct > 0 ? '+' : ''}${cmpSummary.diffPct}%`}
                    </p>
                  </div>
                </div>

                <RmsBarChart
                  data={cmpChartData}
                  xKey="x"
                  bars={
                    cmpUnit === 'month'
                      ? [
                          { key: 'prev', name: `${cmpYear - 1}년 (kWh)`, color: COMPARE_COLORS.prev },
                          { key: 'cur', name: `${cmpYear}년 (kWh)`, color: COMPARE_COLORS.cur },
                        ]
                      : [
                          { key: 'other', name: '연간 발전량 (kWh)', color: COMPARE_COLORS.other },
                          { key: 'prev', name: `${cmpYear - 1}년 (kWh)`, color: COMPARE_COLORS.prev },
                          { key: 'cur', name: `${cmpYear}년 (kWh)`, color: COMPARE_COLORS.cur },
                        ]
                  }
                  height={280}
                  stacked={cmpUnit !== 'month'} // 년: 해마다 계열 하나뿐이라 한 자리에 그린다(빈 칸 없이)
                />
              </div>
            </div>
          )}

          {/* 발전소 발전·공급 — 발전사업자·전기사용자 */}
          {!isAdmin && (
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
                  {contractPlants.length > 1 && <span className="mx-1 h-4 w-px bg-white/10" />}
                  {contractPlants.length > 1 &&
                    contractPlants.map((p, i) => {
                      const key = p.key;
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
                          {shortPlantName(p.displayName)}
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
                  ...contractPlants
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => visiblePlantKeys.has(p.key))
                    .map(({ p, i }) => ({
                      key: p.key,
                      name: shortPlantName(p.displayName),
                      color: PLANT_COLORS[i % PLANT_COLORS.length],
                    })),
                ]}
                height={280}
              />
            </div>
          </div>
          )}

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
                {!isAdmin &&
                  CO2_LINES.map((m) => {
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
                      {co2MainLabel}
                      {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
                    </button>
                  );
                })}
                {!isAdmin && co2Plants.length > 1 && <span className="mx-1 h-4 w-px bg-white/10" />}
                {(isAdmin || co2Plants.length > 1) &&
                  co2Plants.map((pl, i) => {
                    const key = pl.key;
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
                        {shortPlantName(pl.displayName)}
                        {on ? <X size={10} className="opacity-70" /> : <Plus size={10} className="opacity-50" />}
                      </button>
                    );
                  })}
              </div>
              <RmsLineChart
                data={co2ChartData}
                xKey="x"
                lines={[
                  ...(isAdmin ? [] : CO2_LINES.filter((m) => !hiddenCo2Lines.has(m.id))).map((m) => ({
                    key: m.id,
                    name: `${co2MainLabel} (tCO₂)`,
                    color: m.color,
                  })),
                  ...co2Plants
                    .map((pl, i) => ({ pl, i }))
                    .filter(({ pl }) => visibleCo2PlantKeys.has(pl.key))
                    .map(({ pl, i }) => ({
                      key: pl.key,
                      name: `${shortPlantName(pl.displayName)} (tCO₂)`,
                      color: PLANT_COLORS[i % PLANT_COLORS.length],
                    })),
                ]}
                height={260}
              />
            </div>
          </div>

        </>
      )}
    </div>
  );
}
