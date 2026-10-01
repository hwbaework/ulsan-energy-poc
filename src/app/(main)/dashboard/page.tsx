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

import { RmsAreaLineChart } from '@/components/ui/Chart';
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

type Co2Unit = 'day' | 'month';
const CO2_UNIT_OPTIONS: { value: Co2Unit; label: string }[] = [
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];

const toTonWith = (kwh: number, factor: number) => Math.round((kwh * factor) / 10) / 100;

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
  // 축은 늘 1일~말일 전부, 아직 오지 않은 날은 값 없이 둔다(선이 거기서 멈춤)
  const lastDay = month > today.slice(0, 7) ? 0 : month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateKey = `${month}-${String(day).padStart(2, '0')}`;
    return day <= lastDay ? { x: `${day}일`, generation: byDate.get(dateKey) ?? 0 } : { x: `${day}일` };
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
  // 축은 늘 1~12월 전부, 아직 오지 않은 달은 값 없이 둔다
  const lastMonth = year > currentYear ? 0 : year === currentYear ? currentMonth : 12;
  return Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    return i < lastMonth ? { x: `${i + 1}월`, generation: Math.round(byMonth.get(m) ?? 0) } : { x: `${i + 1}월` };
  });
}

// ── 관리자: 회사(계약 발전소) 하나를 골라 작년·올해 발전량을 막대로 비교 ──
type CompareUnit = 'day' | 'month';
const COMPARE_UNIT_OPTIONS: { value: CompareUnit; label: string }[] = [
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];
const COMPARE_COLORS = { prev: '#3B82F6', cur: '#10B981' } as const;

interface YearEnergy {
  /** 1월~12월 발전량(kWh) */
  months: number[];
  total: number;
  /** 'MM' → 1일~31일 발전량(kWh) */
  days: Record<string, number[]>;
}

/** 시간별 이력 → 일별 최대 dailyEnergy → 월별 합. 해당 연도·오늘까지만 센다 */
function sumByMonth(history: PlantHistoryPoint[] | undefined, year: number, todayStr: string): YearEnergy {
  const months = Array<number>(12).fill(0);
  const days: Record<string, number[]> = {};
  if (!history || history.length === 0) return { months, total: 0, days };
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
    const mm = date.slice(5, 7);
    const dayArr = days[mm] ?? (days[mm] = Array<number>(31).fill(0));
    dayArr[Number(date.slice(8, 10)) - 1] = kwh;
  }
  return { months, total, days };
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

/** 여러 발전소 × 여러 해 — 발전소별·연도별 발전량 (CO₂ 저감 차트·카드용) */
function usePlantsYearlyEnergy(plantIds: number[], years: number[], todayStr: string) {
  const pairs = plantIds.flatMap((id) => years.map((y) => ({ id, y })));
  const results = useQueries({
    queries: pairs.map(({ id, y }) => ({
      queryKey: monitoringKeys.plantHistory(id, `${y}-01-01`, `${y}-12-31`),
      queryFn: () => monitoringApi.getPlantHistory(id, `${y}-01-01`, `${y}-12-31`),
      staleTime: 5 * 60_000,
      enabled: id > 0,
    })),
  });
  const dataKey = results.map((r) => (r.data ? r.data.length : -1)).join(',');
  return useMemo(() => {
    const out: Record<number, Record<number, YearEnergy>> = {};
    pairs.forEach(({ id, y }, i) => {
      (out[id] ??= {})[y] = sumByMonth(results[i]?.data, y, todayStr);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, plantIds.join(','), years.join(','), todayStr]);
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

  const user = useAuthStore((s) => s.user);
  const personaOverride = usePersonaOverride((s) => s.override);
  const isAdmin = (personaOverride ?? getPersona(user)) === 'admin';

  const { hasPlants, isGenerator } = useMyPlantIds();
  // 역할별 범위: 관리자=전체, 발전사업자·전기사용자=자사 계약 발전소
  const { plants: scopedPlants } = useScopedPlants();
  // 발전소별 칩·계열은 계약 단위 — 한일튜브(자가소비)·한일튜브(onsite). 이력은 발전소 것에 계약 몫(share)을 곱한다
  const allContractPlants = useMemo(() => expandByContract(scopedPlants), [scopedPlants]);

  // 관리자: 발전량 비교에서만 회사(계약 발전소) 하나를 골라 비교한다 — 지표·CO₂ 는 전체(전 회사)
  const [selectedCompanyKey, setSelectedCompanyKey] = useState('');
  const selectedCompany = useMemo(
    () => allContractPlants.find((p) => p.key === selectedCompanyKey) ?? allContractPlants[0],
    [allContractPlants, selectedCompanyKey],
  );
  const companyOptions = useMemo(
    () => allContractPlants.map((p) => ({ value: p.key, label: shortPlantName(p.displayName) })),
    [allContractPlants],
  );
  const activePlants = scopedPlants; // 관리자는 전체 합산, 발전사업자·전기사용자는 자사 범위
  const scopedIds = useMemo(() => activePlants.map((p) => p.plantId), [activePlants]);
  // 지표·CO₂ 는 설비 전체 값 그대로 (계약 몫은 발전량 비교에서만 곱한다)
  const activeShare = 1;
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
  const { merged: yesterdayHistory, byPlant: yesterdayByPlant } = usePlantsHistory(scopedIds, yesterdayStr, yesterdayStr);

  const yesterdayEnergy = useMemo(() => {
    if (!yesterdayHistory || !Array.isArray(yesterdayHistory) || yesterdayHistory.length === 0) return 0;
    const maxEnergy = Math.max(...yesterdayHistory.map((h) => h.dailyEnergy ?? 0));
    return maxEnergy * activeShare;
  }, [yesterdayHistory, activeShare]);

  // 발전시간 — 발전소마다 따로 세어 더한다 (관리자 전체 = 전 발전소 발전시간 합)
  const yesterdayHours = useMemo(() => {
    const hoursOf = (hist: PlantHistoryPoint[] | undefined) => {
      if (!hist || !Array.isArray(hist) || hist.length === 0) return 0;
      const activePoints = hist.filter((h) => (h.acPower ?? 0) > 0).length;
      const intervalMinutes = Math.round((24 * 60) / hist.length);
      return (activePoints * intervalMinutes) / 60;
    };
    const ids = Object.keys(yesterdayByPlant);
    const total = ids.length === 0 ? hoursOf(yesterdayHistory) : ids.reduce((sum, id) => sum + hoursOf(yesterdayByPlant[Number(id)]), 0);
    return Math.round(total * 10) / 10;
  }, [yesterdayHistory, yesterdayByPlant]);

  const PPA_UNIT_PRICE = 92.6;
  const yesterdayAmount = yesterdayEnergy * PPA_UNIT_PRICE;

  // ── CO₂ 저감 — 역할 공통: 월·년 + ‹ 연도 › 피커. 관리자는 회사 셀렉트로 한 회사, 그 외는 자사 계약 발전소(전체 + 발전소별 선)
  const co2Plants = allContractPlants;
  const [co2CompanyKey, setCo2CompanyKey] = useState('');
  const co2Company = isAdmin ? (co2Plants.find((p) => p.key === co2CompanyKey) ?? co2Plants[0]) : undefined;
  // 발전사업자·전기사용자 — 발전소 칩(발전소 발전·공급과 같은 디자인)으로 끄고 켠다. 처음엔 전부 켬. 카드·선은 켜진 것만
  const [co2Off, setCo2Off] = useState<Set<string>>(new Set());
  const toggleCo2Plant = (key: string) =>
    setCo2Off((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const co2Targets = useMemo(
    () => (isAdmin ? (co2Company ? [co2Company] : []) : co2Plants.filter((p) => !co2Off.has(p.key))),
    [isAdmin, co2Company, co2Plants, co2Off],
  );
  // ‹ › 피커 — 일: 고른 달(달 단위로 넘김, 연도 경계 넘김), 월: 고른 해(해 단위)
  const [co2Year, setCo2Year] = useState(todayYear);
  const [co2Month, setCo2Month] = useState(Number(todayStr.slice(5, 7)));
  const co2Years = useMemo(() => [co2Year], [co2Year]);
  const co2PlantIds = useMemo(() => Array.from(new Set(co2Targets.map((p) => p.plantId))), [co2Targets]);
  const co2ByPlantYear = usePlantsYearlyEnergy(co2PlantIds, co2Years, todayStr);
  const co2Step = (delta: number) => {
    const tm = Number(todayStr.slice(5, 7));
    if (co2Unit === 'month') {
      setCo2Year((y) => Math.min(y + delta, todayYear));
      return;
    }
    let m = co2Month + delta;
    let y = co2Year;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (y > todayYear || (y === todayYear && m > tm)) return;
    setCo2Year(y);
    setCo2Month(m);
  };
  const co2AtLatest = co2Unit === 'day' ? co2Year === todayYear && co2Month === Number(todayStr.slice(5, 7)) : co2Year >= todayYear;
  // 계약 발전소의 그 해(또는 그 달) 발전량 — 이력은 설비 전체라 계약 몫(share)을 곱한다
  type Co2Plant = (typeof co2Plants)[number];
  const co2KwhOf = (p: Co2Plant, year: number, monthIdx?: number, dayIdx?: number) => {
    const ye = co2ByPlantYear[p.plantId]?.[year];
    if (!ye) return 0;
    if (monthIdx === undefined) return ye.total * p.share;
    if (dayIdx === undefined) return (ye.months[monthIdx] ?? 0) * p.share;
    return (ye.days[String(monthIdx + 1).padStart(2, '0')]?.[dayIdx] ?? 0) * p.share;
  };
  const co2ChartData = useMemo((): Array<Record<string, string | number>> => {
    const tm = Number(todayStr.slice(5, 7));
    const td = Number(todayStr.slice(8, 10));
    const row = (x: string, pick: (p: Co2Plant) => number) => {
      const r: Record<string, string | number> = { x, hanil: toTonWith(co2Targets.reduce((a, p) => a + pick(p), 0), co2Factor) };
      if (!isAdmin) for (const p of co2Targets) r[p.key] = toTonWith(pick(p), co2Factor);
      return r;
    };
    // 축은 늘 전부(1일~말일 · 1~12월), 아직 오지 않은 날·달은 값 없이 둔다
    if (co2Unit === 'day') {
      const n = new Date(co2Year, co2Month, 0).getDate();
      const last = co2Year === todayYear && co2Month === tm ? td : n;
      return Array.from({ length: n }, (_, i) => (i < last ? row(`${i + 1}일`, (p) => co2KwhOf(p, co2Year, co2Month - 1, i)) : { x: `${i + 1}일` }));
    }
    const last = co2Year === todayYear ? tm : 12;
    return Array.from({ length: 12 }, (_, i) => (i < last ? row(`${i + 1}월`, (p) => co2KwhOf(p, co2Year, i)) : { x: `${i + 1}월` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [co2Targets, co2ByPlantYear, co2Unit, co2Year, co2Month, co2Factor, isAdmin, todayStr, todayYear]);
  // CO₂ 기본 계열 이름 — 관리자는 고른 회사, 그 외는 전체
  const co2MainLabel = isAdmin && co2Company ? shortPlantName(co2Company.displayName) : '전체';
  // 카드 — 오늘 / 이번 달 / 올해 누적. 피커와 무관하게 늘 오늘 기준 (관리자: 고른 회사, 그 외: 자사 계약 발전소 합)
  const co2KpiYears = useMemo(() => [todayYear], [todayYear]);
  const co2KpiByPlant = usePlantsYearlyEnergy(co2PlantIds, co2KpiYears, todayStr);
  const co2TodayTon = toTonWith(co2Targets.reduce((a, p) => a + (p.dailyEnergy ?? 0) * p.share, 0), co2Factor);
  const co2ThisMonthTon = toTonWith(
    co2Targets.reduce((a, p) => a + (co2KpiByPlant[p.plantId]?.[todayYear]?.months[Number(todayStr.slice(5, 7)) - 1] ?? 0) * p.share, 0),
    co2Factor,
  );
  const co2YtdTon = toTonWith(co2Targets.reduce((a, p) => a + (co2KpiByPlant[p.plantId]?.[todayYear]?.total ?? 0) * p.share, 0), co2Factor);

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

  // 관리자: 발전량 비교 — 일 = 고른 달의 일별(전 해 같은 달과), 월 = 고른 해의 월별(전 해와). 요약은 고른 해 vs 전 해 같은 기간
  const [cmpUnit, setCmpUnit] = useState<CompareUnit>('month');
  const [cmpYear, setCmpYear] = useState(todayYear);
  const todayMonthNum = Number(todayStr.slice(5, 7));
  const todayDayNum = Number(todayStr.slice(8, 10));
  const [cmpMonth, setCmpMonth] = useState(todayMonthNum);
  const cmpBaseYear = cmpYear;
  const cmpYears = useMemo(() => [cmpYear - 1, cmpYear], [cmpYear]);
  const { byYear: cmpByYear } = usePlantYearlyEnergy(isAdmin ? (selectedCompany?.plantId ?? 0) : 0, cmpYears, todayStr);
  // 같은 기간 비교 — 월: 올해면 끝난 달까지(이번 달은 집계 중이라 제외), 지난 해면 연간. 일: 이번 달이면 오늘까지, 아니면 그 달 전부
  const cmpLastMonth = cmpBaseYear === todayYear ? Math.max(0, todayMonthNum - 1) : 12;
  const cmpDaysInMonth = new Date(cmpYear, cmpMonth, 0).getDate();
  const cmpLastDay =
    cmpYear === todayYear && cmpMonth === todayMonthNum
      ? todayDayNum
      : cmpYear > todayYear || (cmpYear === todayYear && cmpMonth > todayMonthNum)
        ? 0
        : cmpDaysInMonth;
  // 고른 회사(계약)의 몫 — 이력은 설비 전체 값이라 곱해서 쓴다 (한일튜브 자가소비·onsite 분리)
  const cmpShare = selectedCompany?.share ?? 1;
  const cmpChartData = useMemo(() => {
    const scale = (v: number) => Math.round(v * cmpShare);
    // 축은 전부(1일~말일 · 1~12월), 아직 오지 않은 날·달은 값 없이 둔다
    if (cmpUnit === 'day') {
      const mm = String(cmpMonth).padStart(2, '0');
      const prev = cmpByYear[cmpYear - 1]?.days[mm] ?? [];
      const cur = cmpByYear[cmpYear]?.days[mm] ?? [];
      return Array.from({ length: cmpDaysInMonth }, (_, i) => ({
        x: `${i + 1}일`,
        prev: scale(prev[i] ?? 0),
        ...(i < cmpLastDay ? { cur: scale(cur[i] ?? 0) } : {}),
      }));
    }
    const prev = cmpByYear[cmpYear - 1]?.months ?? [];
    const cur = cmpByYear[cmpYear]?.months ?? [];
    return Array.from({ length: 12 }, (_, i) => ({
      x: `${i + 1}월`,
      prev: scale(prev[i] ?? 0),
      ...(i < cmpLastMonth ? { cur: scale(cur[i] ?? 0) } : {}),
    }));
  }, [cmpUnit, cmpYear, cmpMonth, cmpByYear, cmpLastMonth, cmpLastDay, cmpDaysInMonth, cmpShare]);
  const cmpSummary = useMemo(() => {
    const sumTo = (y: number) =>
      cmpUnit === 'day'
        ? (cmpByYear[y]?.days[String(cmpMonth).padStart(2, '0')] ?? []).slice(0, cmpLastDay).reduce((a, v) => a + v, 0) * cmpShare
        : (cmpByYear[y]?.months ?? []).slice(0, cmpLastMonth).reduce((a, v) => a + v, 0) * cmpShare;
    const prev = Math.round(sumTo(cmpBaseYear - 1));
    const cur = Math.round(sumTo(cmpBaseYear));
    const diffPct = prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
    return { prev, cur, diffPct };
  }, [cmpUnit, cmpMonth, cmpByYear, cmpBaseYear, cmpLastMonth, cmpLastDay, cmpShare]);
  // 기간 라벨 — 날짜는 하이픈 양식: 2025-01 ~ 2025-09 · 2025-10-01 ~ 2025-10-01 · 2025 연간
  const cmpRangeLabel = (y: number) => {
    if (cmpUnit === 'day') {
      const mm = String(cmpMonth).padStart(2, '0');
      return cmpLastDay === 0 ? `${y}-${mm}` : `${y}-${mm}-01 ~ ${y}-${mm}-${String(cmpLastDay).padStart(2, '0')}`;
    }
    if (cmpLastMonth === 12) return `${y} 연간`;
    if (cmpLastMonth === 0) return `${y} (집계 전)`;
    return `${y}-01 ~ ${y}-${String(cmpLastMonth).padStart(2, '0')}`;
  };
  // ‹ › 피커 — 일은 달 단위(연도 경계 넘김), 월은 해 단위. 오늘 이후로는 못 간다
  const cmpStep = (delta: number) => {
    if (cmpUnit === 'month') {
      setCmpYear((y) => Math.min(y + delta, todayYear));
      return;
    }
    let m = cmpMonth + delta;
    let y = cmpYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (y > todayYear || (y === todayYear && m > todayMonthNum)) return;
    setCmpYear(y);
    setCmpMonth(m);
  };
  const cmpAtLatest = cmpUnit === 'day' ? cmpYear === todayYear && cmpMonth === todayMonthNum : cmpYear >= todayYear;

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
          </div>

          {/* Stats — QA #1 전일발전량 표시, #2 전일대비 삭제, #4 금액 계산식 */}
          <StatsGrid columns={4}>
            <StatCard
              label={isAdmin ? '전체 출력' : '현재 출력'}
              value={
                plant?.currentOutput === undefined
                  ? '- kW'
                  : isAdmin && plant.currentOutput >= 1000
                    ? `${(plant.currentOutput / 1000).toFixed(2)} MW` // 관리자 전체 합산만 MW, 그 외는 kW
                    : `${plant.currentOutput.toFixed(1)} kW`
              }
            />

            <StatCard
              label={isAdmin ? '전체 발전량' : '발전량'}
              value={
                yesterdayEnergy <= 0
                  ? '- kWh'
                  : isAdmin && yesterdayEnergy >= 1000
                    ? `${(yesterdayEnergy / 1000).toFixed(2)} MWh` // 관리자 전체 합산만 MWh, 그 외는 kWh
                    : `${yesterdayEnergy.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kWh`
              }
            />

            <StatCard
              label={isAdmin ? '전체 발전시간' : '발전시간'}
              value={yesterdayHours > 0 ? `${yesterdayHours} 시간` : '- 시간'}
            />

            <StatCard
              label={isAdmin ? '전체 금액' : '금액'}
              value={yesterdayAmount > 0 ? `${Math.round(yesterdayAmount).toLocaleString('ko-KR')} 원` : '- 원'} // 1원 단위 그대로
            />
          </StatsGrid>

          {/* 관리자 — 작년·올해 발전량 비교 */}
          {isAdmin && (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-md font-semibold text-white">발전량 비교</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {cmpUnit === 'day'
                      ? `${cmpYear - 1}-${String(cmpMonth).padStart(2, '0')} · ${cmpYear}-${String(cmpMonth).padStart(2, '0')} 일별 발전량 (kWh)`
                      : `${cmpYear - 1} · ${cmpYear} 월별 발전량 (kWh)`}
                  </p>
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
              <div className="px-5 py-4">
                {/* 동기 비교 — 전 해 / 고른 해 / 증감 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                    <p className="text-sm text-slate-300">
                      {cmpRangeLabel(cmpBaseYear - 1)} 발전량
                    </p>
                    <p className="text-xl font-semibold text-white tabular-nums mt-1">
                      {cmpSummary.prev.toLocaleString()} <span className="text-white">kWh</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 p-3">
                    <p className="text-sm text-emerald-300/90">
                      {cmpRangeLabel(cmpBaseYear)} 발전량
                    </p>
                    <p className="text-xl font-semibold text-emerald-300 tabular-nums mt-1">
                      {cmpSummary.cur.toLocaleString()} <span className="text-emerald-300">kWh</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
                    <p className="text-sm text-slate-300">{cmpBaseYear - 1} 같은 기간 대비</p>
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

                {/* 차트 컨트롤 — 회사(계약) 하나씩 비교, 전체 합산 없음 · 연도 */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-48">
                    <Select
                      options={companyOptions}
                      value={selectedCompany?.key ?? ''}
                      placeholder="회사 선택"
                      onChange={(e) => setSelectedCompanyKey(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => cmpStep(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                    aria-label="이전"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-sm font-semibold text-white tabular-nums px-1 min-w-[88px] text-center">
                    {cmpUnit === 'day' ? `${cmpYear}-${String(cmpMonth).padStart(2, '0')}` : `${cmpYear}`}
                  </span>
                  <button
                    type="button"
                    disabled={cmpAtLatest}
                    onClick={() => cmpStep(1)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/[0.06]',
                      cmpAtLatest
                        ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]',
                    )}
                    aria-label="다음"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
                </div>
                {/* 두 해 모두 반투명 면(전 해 파랑 · 고른 해 초록)으로 겹쳐 그려 차이 구간이 보이게 */}
                <RmsAreaLineChart
                  data={cmpChartData}
                  xKey="x"
                  stacked={false}
                  areas={[
                    { key: 'prev', name: `${cmpYear - 1} (kWh)`, color: COMPARE_COLORS.prev },
                    { key: 'cur', name: `${cmpYear} (kWh)`, color: COMPARE_COLORS.cur },
                  ]}
                  height={280}
                />
                {/* 월별 증감 — 전 해 같은 달 대비 */}
                {cmpUnit === 'month' && (
                  <div className="mt-3 ml-[45px] grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {cmpChartData.map((row) => {
                      const r = row as { x: string; prev?: number; cur?: number };
                      const prev = r.prev ?? 0;
                      const pct = r.cur === undefined || prev <= 0 ? null : Math.round(((r.cur - prev) / prev) * 1000) / 10;
                      return (
                        <div key={r.x} className="rounded-md bg-white/[0.03] ring-1 ring-white/[0.06] px-1 py-2 text-center">
                          <p className="text-sm text-slate-400">{r.x}</p>
                          <p
                            className={cn(
                              'text-base font-semibold tabular-nums mt-0.5',
                              pct === null ? 'text-slate-600' : pct >= 0 ? 'text-emerald-300' : 'text-red-400',
                            )}
                          >
                            {pct === null ? '-' : `${pct > 0 ? '+' : ''}${pct}%`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    {genCtl.tu === 'month' && `${genCtl.year}`}
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
                  {co2Unit === 'day' ? `${co2Year}-${String(co2Month).padStart(2, '0')} 일별 CO₂ 저감 (tCO₂)` : `${co2Year} 월별 CO₂ 저감 (tCO₂)`}
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

              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  {isAdmin ? (
                  <div className="w-48">
                    <Select
                      options={companyOptions}
                      value={co2Company?.key ?? ''}
                      placeholder="회사 선택"
                      onChange={(e) => setCo2CompanyKey(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  ) : (
                  /* 발전소 칩 — 발전소 발전·공급 차트의 칩과 같은 디자인 (색 점 · 켜짐 × / 꺼짐 +) */
                  <div className="flex flex-wrap gap-1.5">
                    {co2Plants.map((pl, i) => {
                      const on = !co2Off.has(pl.key);
                      const color = PLANT_COLORS[i % PLANT_COLORS.length];
                      return (
                        <button
                          key={pl.key}
                          type="button"
                          onClick={() => toggleCo2Plant(pl.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                            on
                              ? 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]'
                              : 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400',
                          )}
                          aria-pressed={on}
                        >
                          <span className="h-2 w-2 rounded-full shrink-0 transition-opacity" style={{ backgroundColor: color, opacity: on ? 1 : 0.3 }} />
                          {shortPlantName(pl.displayName)}
                          {on ? <X size={10} className="opacity-70" /> : <Plus size={10} className="opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => co2Step(-1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                      aria-label="이전"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="text-sm font-semibold text-white tabular-nums px-1 min-w-[88px] text-center">
                      {co2Unit === 'day' ? `${co2Year}-${String(co2Month).padStart(2, '0')}` : `${co2Year}`}
                    </span>
                    <button
                      type="button"
                      disabled={co2AtLatest}
                      onClick={() => co2Step(1)}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/[0.06]',
                        co2AtLatest
                          ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
                          : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]',
                      )}
                      aria-label="다음"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
              </div>
              {/* 선 아래를 칠한 면 그래프 — 관리자: 고른 회사 한 선, 그 외: 계약 발전소별 선 (한일튜브 자가소비·onsite) */}
              <RmsAreaLineChart
                data={co2ChartData}
                xKey="x"
                stacked={false}
                areas={
                  isAdmin
                    ? [{ key: 'hanil', name: `${co2MainLabel} (tCO₂)`, color: CO2_LINES[0].color }]
                    : co2Plants
                        .map((pl, i) => ({ pl, i }))
                        .filter(({ pl }) => co2Targets.includes(pl))
                        .map(({ pl, i }) => ({
                          key: pl.key,
                          name: `${shortPlantName(pl.displayName)} (tCO₂)`,
                          color: PLANT_COLORS[i % PLANT_COLORS.length],
                        }))
                }
                height={260}
              />
            </div>
          </div>

        </>
      )}
    </div>
  );
}
