// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  Sun,
  Zap,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  AlertCircle,
  Receipt,
  ClipboardCheck,
} from 'lucide-react';
import { useToastStore } from '@/stores/useToastStore';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { RmsAreaChart, RmsBarLineChart } from '@/components/ui/Chart';
import { StatCard, StatsGrid, SectionCard, PlantStatusTable, GenerationTrendCard } from '@/components/features';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { ChevronDown } from 'lucide-react';
import { useMonitoringPlantDetail } from '@/hooks/monitoring/useMonitoring';
import { useVolumeContracts, useSavingsContracts } from '@/hooks/lease/useLease';

/* ───────────────────────── Types ───────────────────────── */

type PlantStatus = '정상' | '점검' | '이상';

interface LeasePlant {
  id: string;
  name: string;
  resource: '태양광';
  icon: LucideIcon;
  color: string;
  bg: string;
  capacityKw: number;
  currentKw: number;
  // 이전 가동률/설비효율/누적시간 — API 없어 제거
  status: PlantStatus;
  alarmTitle?: string;
  alarmDetail?: string;
  site: string;
  // API 가용 필드 (mock 채워서 화면 표시)
  monthlyEnergyKwh?: number; // 이번 달 누적 (kWh) — 백엔드 monitoring monthlyEnergy 연동값
  totalEnergyKwh?: number; // 누적 발전량 (kWh, lifetime) — API totalEnergy
  inverterCount?: number; // 인버터 개수 — API inverters.length
  inverterNormal?: number; // 정상 인버터 수 — API connectionStatus.inverterConnections
  dailyGenHours?: number; // 일평균 발전시간 (h, Peak Sun Hours) — 한일튜브 4.38h 실측
}

// 차트 라인 색상 팔레트 — 사업장 수가 늘어도 자동 cycle
const SITE_COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#a855f7', '#ec4899', '#f43f5e', '#06b6d4', '#84cc16'];

// (할 일 섹션 제거 — 정산서 동의·납부 안내는 KPI sub 텍스트 + 세금계산서 페이지에서 처리)

/* ── 직접 PPA 수익 분배 모델 (trading/contracts/매칭 정합) ──
 *   발전 수익 = 자가소비 발전량 × 한전 단가 (수용가가 절약한 한전 요금)
 *   발전사 분배 = 발전 수익 × 분배율(30%) / 수용가 순이익 = 70%
 *   ※ 단가(₩/kWh)가 아니라 분배율(%) 구조 — Lease 도메인 규칙
 */
const KEPCO_AVG_PRICE = 119.6; // ₩/kWh — 한전 산업용 평균 (자가소비 절감 환산 기준)
const GEN_SHARE_PCT = 30; // 발전사 분배율 (%) — 수용가 70%
// 사업장 월 전력 사용량 — 계약 기준값(한일튜브 실사용 규모). 한전 수전량 자동연동 전까지 수기 기준으로 운용.
const MONTHLY_USAGE_KWH = 180_000;

// 월별 사용·충당·절감 — 계약 2026-01 ~ 운영 중 (수용가 관점)
//   룰: 계약 이전(1월) = 충당 0·전량 한전, 미래(6~12월) = null, 계약 기간(2~5월) = 실측 발전량 기반
//   revenue(총 절감)/genShare(SPC 납부)/myNet(순 절감) = 백만원 / pvMwh·gridMwh = 사용 구성 (MWh)
const toM = (kwh: number, ratio = 1) => Math.round((kwh * KEPCO_AVG_PRICE * ratio) / 1_000) / 1_000; // 백만원, 소수3
const leaseMonth = (month: string, kwh: number | null, usageKwh = MONTHLY_USAGE_KWH) =>
  kwh == null
    ? {
        month,
        generationKwh: null,
        usageKwh: null,
        pvMwh: null,
        gridMwh: null,
        revenue: null,
        genShare: null,
        myNet: null,
      }
    : {
        month,
        generationKwh: kwh,
        usageKwh,
        pvMwh: Math.round(kwh / 100) / 10, // 태양광 자가소비 (MWh)
        gridMwh: Math.round((usageKwh - kwh) / 100) / 10, // 한전 수전 (MWh)
        revenue: toM(kwh),
        genShare: toM(kwh, GEN_SHARE_PCT / 100),
        myNet: toM(kwh, 1 - GEN_SHARE_PCT / 100),
      };
const LEASE_MONTHLY = [
  leaseMonth('1월', 0), // 계약 전 — 전량 한전 수전
  leaseMonth('2월', 45_823),
  leaseMonth('3월', 48_617),
  leaseMonth('4월', 51_272),
  leaseMonth('5월', 53_999), // 정합: 53,999 kWh → 총 절감 ₩6,458,280 / SPC 납부 30% ₩1,937,484 / 순 절감 70% ₩4,520,796
  leaseMonth('6월', null),
  leaseMonth('7월', null),
  leaseMonth('8월', null),
  leaseMonth('9월', null),
  leaseMonth('10월', null),
  leaseMonth('11월', null),
  leaseMonth('12월', null),
];

/* ───────────────────────── Mock ───────────────────────── */

// 직접 PPA 발전소들 — 사업장당 1개 (용역사가 1회 설치)
// 한일튜브 본사 옥상 태양광 — 용량 429.22 kW (API 값 우선, 사용자 결정)
const LEASE_PLANTS: LeasePlant[] = [
  {
    id: 'lp-1',
    name: '한일튜브 본사 옥상 태양광',
    resource: '태양광',
    icon: Sun,
    color: 'text-amber-400',
    bg: 'bg-amber-500/[0.10]',
    capacityKw: 429.22,
    currentKw: 385,
    status: '정상',
    site: '한일튜브 본사',
    monthlyEnergyKwh: 53999, // 이번 달 누적 — API 실값 (한일튜브 plant 17514, 5/29 기준 진행 중)
    totalEnergyKwh: 1689320, // 누적 (계약 시작 2026-01-15 ~ 현재, 약 4.4개월)
    inverterCount: 4,
    inverterNormal: 4, // 4개 모두 정상
    dailyGenHours: 4.38, // 일평균 발전시간 (실측)
  },
];

const STATUS_META: Record<PlantStatus, { tone: string; bg: string; ring: string; icon: LucideIcon; label: string }> = {
  정상: {
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
    icon: CheckCircle2,
    label: '정상',
  },
  점검: { tone: 'text-amber-300', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30', icon: Wrench, label: '점검' },
  이상: {
    tone: 'text-rose-300',
    bg: 'bg-rose-500/[0.10]',
    ring: 'ring-rose-500/30',
    icon: AlertTriangle,
    label: '이상',
  },
};

// 24시간 시간대별 발전량 — 내 옥상 설비 발전 곡선 (수용가도 내 건물 발전량은 직접 확인)
// 종모양 (6~18시), 사업장별 용량 비례
function genSolarCurve(peakKw: number) {
  return Array.from({ length: 24 }, (_, h) => {
    return h >= 6 && h <= 18 ? Math.round(Math.sin(((h - 6) / 12) * Math.PI) * peakKw) : 0;
  });
}
// 사업장별 발전 곡선 — 각 발전소의 capacity 기반 peak (확장 가능)
const SOLAR_BY_SITE: Record<string, number[]> = Object.fromEntries(
  LEASE_PLANTS.map((p) => [p.site, genSolarCurve(Math.round(p.capacityKw * 0.82))]),
);

// 차트용 데이터 생성 — view (시간/일/월) × 사업장 필터 (전사 합산 or 단일)
type ChartView = '시간' | '일' | '월';

function buildGenData(view: ChartView, filter: string, sites: string[]) {
  const isAll = filter === 'all';
  const targetSites = isAll ? sites : [filter];

  if (view === '시간') {
    return Array.from({ length: 24 }, (_, h) => {
      const row: Record<string, string | number> = { x: `${String(h).padStart(2, '0')}:00` };
      targetSites.forEach((site) => {
        row[site] = SOLAR_BY_SITE[site]?.[h] ?? 0;
      });
      if (!isAll) row['전년 동기'] = Math.round((SOLAR_BY_SITE[filter]?.[h] ?? 0) * 0.88);
      return row;
    });
  }
  if (view === '일') {
    const dailySum: Record<string, number> = Object.fromEntries(
      sites.map((s) => [s, (SOLAR_BY_SITE[s] ?? []).reduce((sum, v) => sum + v, 0)]),
    );
    return Array.from({ length: 30 }, (_, d) => {
      const variance = 0.85 + Math.sin(d / 4) * 0.1 + Math.sin(d * 7) * 0.05;
      const row: Record<string, string | number> = { x: `${d + 1}일` };
      targetSites.forEach((site) => {
        row[site] = Math.round((dailySum[site] ?? 0) * variance);
      });
      if (!isAll) row['전년 동기'] = Math.round((dailySum[filter] ?? 0) * variance * 0.88);
      return row;
    });
  }
  // 월: 최근 12개월
  const months = ['6월', '7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월'];
  const seasonal = [1.05, 1.1, 1.05, 1.0, 0.85, 0.7, 0.55, 0.55, 0.65, 0.85, 1.0, 1.05];
  const monthlySum: Record<string, number> = Object.fromEntries(
    sites.map((s) => [s, (SOLAR_BY_SITE[s] ?? []).reduce((sum, v) => sum + v, 0) * 30]),
  );
  return months.map((m, i) => {
    const row: Record<string, string | number> = { x: m };
    targetSites.forEach((site) => {
      row[site] = Math.round((monthlySum[site] ?? 0) * seasonal[i]);
    });
    if (!isAll) row['전년 동기'] = Math.round((monthlySum[filter] ?? 0) * seasonal[i] * 0.88);
    return row;
  });
}

/* ───────────────────────── Page ───────────────────────── */

export default function LeaseDashboardPage() {
  const [view, setView] = useState<'시간' | '일' | '월'>('시간');
  // 오늘 기준 — view 별로 다른 picker
  const _now = new Date();
  const _today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(_today); // 시간 view: YYYY-MM-DD
  const [month, setMonth] = useState(_today.slice(0, 7)); // 일 view:  YYYY-MM
  const [year, setYear] = useState(_now.getFullYear()); // 월 view:  YYYY
  // 사업장 목록 — LEASE_PLANTS에서 동적 추출 (중복 제거, 등록 순)
  const ALL_SITES = useMemo(() => {
    const seen = new Set<string>();
    return LEASE_PLANTS.filter((p) => !seen.has(p.site) && seen.add(p.site)).map((p) => p.site);
  }, []);

  // 사업장 다중 선택 — 24/7 CFE 대시보드 패턴 (체크박스 추가/제거)
  //   default: 전체 선택 (전사 합산 모드와 동일)
  const [selectedSites, setSelectedSites] = useState<Set<string>>(() => new Set(ALL_SITES));
  const selectedSitesArr = useMemo(() => Array.from(selectedSites), [selectedSites]);
  const isAllSelected = selectedSites.size === ALL_SITES.length && ALL_SITES.length > 0;
  const isSingleSelected = selectedSites.size === 1;
  const onlySelectedSite = isSingleSelected ? selectedSitesArr[0] : null;

  const toggleSite = (site: string) => {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(site)) next.delete(site);
      else next.add(site);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedSites((prev) => (prev.size === ALL_SITES.length ? new Set() : new Set(ALL_SITES)));
  };

  // 차트 라인 숨김 — pill X 클릭으로 토글
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const toggleLine = (key: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 발전소 상세 모달
  const [detailPlantId, setDetailPlantId] = useState<string | null>(null);
  const detailPlant = detailPlantId ? (LEASE_PLANTS.find((p) => p.id === detailPlantId) ?? null) : null;

  const plantQuery = useMonitoringPlantDetail(17514);
  const plant = plantQuery.data;

  // Lease 계약 API 호출 (데이터 있으면 사용, 없으면 mock fallback)
  const { data: volumeData } = useVolumeContracts();
  const { data: savingsData } = useSavingsContracts();
  const _apiVolumeContracts = volumeData?.content ?? [];
  const _apiSavingsContracts = savingsData?.content ?? [];

  // 선택된 사업장에 속한 발전소만 — 카드 합산/상태 보드/월별 표에서 공통 사용
  const filteredPlants = useMemo(() => LEASE_PLANTS.filter((p) => selectedSites.has(p.site)), [selectedSites]);

  // 통계 — 한일튜브 plant API 의 capacity 우선 (실 PPA 등록 용량, 예: 329.6 kW)
  //         API 없으면 LEASE_PLANTS mock 합산으로 fallback
  // 다중 사이트 확장 시: 각 사이트마다 별도 plant API 호출 + 합산 로직 필요
  const mockTotalCapacityKw = filteredPlants.reduce((s, p) => s + p.capacityKw, 0);
  const totalCapacityKw = plant?.capacity ?? mockTotalCapacityKw;
  const totalCurrentKw = filteredPlants.reduce((s, p) => s + p.currentKw, 0);

  // 차트 데이터 — view × 선택 사업장 동적 생성
  const chartData = useMemo(
    () => buildGenData(view, isSingleSelected ? onlySelectedSite! : 'all', selectedSitesArr),
    [view, isSingleSelected, onlySelectedSite, selectedSitesArr],
  );
  // 차트 가능 라인 — 단일: 사이트만 (전년 동기는 2025 데이터 없어서 제외) / 다중: 선택된 사이트들
  const availableLines = useMemo(() => {
    if (isSingleSelected && onlySelectedSite) {
      return [
        {
          key: onlySelectedSite,
          name: onlySelectedSite,
          color: SITE_COLORS[ALL_SITES.indexOf(onlySelectedSite) % SITE_COLORS.length],
        },
      ];
    }
    return selectedSitesArr.map((site) => ({
      key: site,
      name: site,
      color: SITE_COLORS[ALL_SITES.indexOf(site) % SITE_COLORS.length],
    }));
  }, [isSingleSelected, onlySelectedSite, selectedSitesArr, ALL_SITES]);
  // pill 토글로 끈 라인 제외
  const chartAreas = useMemo(
    () => availableLines.filter((l) => !hiddenLines.has(l.key)),
    [availableLines, hiddenLines],
  );
  // KPI는 "오늘" 기준이므로 시간 view 데이터로 고정 합산
  // 한일튜브 실측 — 4월 51,272 kWh, 일평균 4.38h
  //   5월 누적 (5/29 기준 진행 중): 53,999 kWh — API 실값 (plant 17514)
  //   FIXME: monitoring 타입에 monthlyEnergy 필드 없음. 백엔드가 실제로는 반환하므로
  //          types/monitoring.ts 에 monthlyEnergy?: number 추가 + plant.monthlyEnergy 로 교체 필요
  const DAILY_GEN_HOURS_FALLBACK = 4.38; // API 미수신 시 fallback
  const MONTHLY_CUMULATIVE_KWH = 53999; // 이번 달 누적 — API 실값 (한일튜브 plant 17514, 5/29 기준 진행 중)

  // 발전시간 — 추이 차트와 동일 공식: API dailyEnergy ÷ capacity (= Peak Sun Hours)
  const dailyGenHours =
    plant?.dailyEnergy != null && plant?.capacity ? plant.dailyEnergy / plant.capacity : DAILY_GEN_HOURS_FALLBACK;

  // 이번 달 수용가 지표 — 커버리지 / 절감 / SPC 납부 / 순 절감 (분배율 모델, trading/매칭 정합)
  //   5월은 정산 미확정 (익월 15일 이후 확정) → 모두 예상치
  //   총 절감 (한전 대비)   = 발전량 × 한전 단가 = 53,999 × 119.6 = ₩6,458,280
  //   SPC 납부 (분배 30%)   = ₩1,937,484
  //   내 순 절감 (70%)      = ₩4,520,796 ← 자동
  const MONTHLY_REVENUE_KRW = Math.round(MONTHLY_CUMULATIVE_KWH * KEPCO_AVG_PRICE);
  const MONTHLY_GEN_SHARE_KRW = Math.round((MONTHLY_REVENUE_KRW * GEN_SHARE_PCT) / 100);
  const MONTHLY_MY_NET_KRW = MONTHLY_REVENUE_KRW - MONTHLY_GEN_SHARE_KRW;
  // 태양광 커버리지 — 내 사업장 사용량 중 자가소비 비율 (수용가 핵심 지표)
  const COVERAGE_PCT = Math.round((MONTHLY_CUMULATIVE_KWH / MONTHLY_USAGE_KWH) * 1000) / 10;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '전력 현황' }]}
      />

      {/* 헤더 — 사업장 다중 선택 드롭다운 (24/7 CFE 패턴) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">대시보드</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAllSelected
              ? `전사 합산 · ${ALL_SITES.length}개 사업장 · ${filteredPlants.length}개 직접 PPA`
              : isSingleSelected
                ? `${onlySelectedSite} · ${filteredPlants.length}개 직접 PPA`
                : `${selectedSites.size}개 사업장 선택 · ${filteredPlants.length}개 직접 PPA`}
            <span className="text-slate-600">
              {' '}
              · 설비 {totalCapacityKw.toLocaleString()} kW · 현재 출력{' '}
              {(plant?.currentOutput ?? totalCurrentKw).toLocaleString()} kW
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <Dropdown
            align="left"
            closeOnItemClick={false}
            trigger={
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[180px] cursor-pointer text-white hover:bg-white/[0.08]">
                <span className="text-xs text-slate-500 shrink-0">사업장</span>
                <span className="font-medium truncate flex-1">
                  {isAllSelected
                    ? `전체 ${ALL_SITES.length}개`
                    : isSingleSelected
                      ? onlySelectedSite
                      : `${selectedSites.size}개 선택`}
                </span>
                <ChevronDown size={14} className="text-slate-500 shrink-0" />
              </div>
            }
          >
            {/* 전체 토글 */}
            <DropdownItem onClick={toggleAll}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1',
                    isAllSelected
                      ? 'bg-primary ring-primary'
                      : selectedSites.size > 0
                        ? 'bg-primary/40 ring-primary/60'
                        : 'bg-transparent ring-white/20',
                  )}
                >
                  {isAllSelected && <CheckCircle2 size={10} className="text-white" />}
                  {!isAllSelected && selectedSites.size > 0 && <span className="h-0.5 w-2 rounded bg-white" />}
                </span>
                <div>
                  <p className="text-sm font-medium">전체 ({ALL_SITES.length}개)</p>
                  <p className="text-xs text-slate-500">{filteredPlants.length}개 직접 PPA 선택 중</p>
                </div>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {/* 사이트별 체크박스 */}
            {ALL_SITES.map((s) => {
              const plant = LEASE_PLANTS.find((p) => p.site === s);
              const checked = selectedSites.has(s);
              return (
                <DropdownItem key={s} onClick={() => toggleSite(s)}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1',
                        checked ? 'bg-primary ring-primary' : 'bg-transparent ring-white/20',
                      )}
                    >
                      {checked && <CheckCircle2 size={10} className="text-white" />}
                    </span>
                    <div>
                      <p className="text-sm">{s}</p>
                      <p className="text-xs text-slate-500">
                        {plant ? `${plant.capacityKw.toLocaleString()} kW · ${plant.status}` : '—'}
                      </p>
                    </div>
                  </div>
                </DropdownItem>
              );
            })}
          </Dropdown>
        </div>
      </div>

      {/* KPI 4 — 수용가 관점: 커버리지 / 절감 / SPC 납부 / 순 절감 (설비·출력 지표는 헤더·설비 상세로) */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="태양광 커버리지"
          value={`${COVERAGE_PCT}%`}
          sub={`이번 달 사용 ${MONTHLY_USAGE_KWH.toLocaleString()} kWh 중 ${MONTHLY_CUMULATIVE_KWH.toLocaleString()} kWh 충당`}
        />
        <StatCard
          icon={<TrendingDown size={18} className="text-emerald-400" />}
          label="이번 달 요금 절감 (한전 대비)"
          value={`₩${MONTHLY_REVENUE_KRW.toLocaleString()}`}
          sub={`한전 ₩${KEPCO_AVG_PRICE}/kWh 기준 — 태양광이 없었다면 더 냈을 금액`}
        />
        <StatCard
          icon={<Receipt size={18} className="text-rose-400" />}
          label="SPC 납부 예정"
          value={`₩${MONTHLY_GEN_SHARE_KRW.toLocaleString()}`}
          sub={`발전사 분배 ${GEN_SHARE_PCT}% · 익월 15일 정산 확정 후 청구`}
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          label="이번 달 순 절감"
          value={`₩${MONTHLY_MY_NET_KRW.toLocaleString()}`}
          sub={`절감액의 ${100 - GEN_SHARE_PCT}% — 납부 차감 후 실 이득`}
        />
      </StatsGrid>

      {/* RE100 달성 현황 — 직접 PPA(ppa/status) 패턴 차용: 자가소비 = 재생E 사용 실적 */}
      <SectionCard
        title="RE100 달성 현황"
        description="온사이트 PPA 자가소비 기준 재생에너지 사용 비중 — 전체는 직접 PPA 전력 현황에서"
      >
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-400 tabular-nums">
                {COVERAGE_PCT}
                <span className="text-base font-normal text-slate-400">%</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                이번 달 자가소비 {MONTHLY_CUMULATIVE_KWH.toLocaleString()} kWh / 총 사용{' '}
                {MONTHLY_USAGE_KWH.toLocaleString()} kWh
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-300 tabular-nums">
                목표까지 {(60 - COVERAGE_PCT).toFixed(1)}%p
              </p>
              <p className="text-[11px] text-slate-500">2030 RE100 목표 60%</p>
            </div>
          </div>
          {/* 진행 바 — 현재 이행률 + 목표 마커 (면 처리, 테두리 없음) */}
          <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${Math.min(COVERAGE_PCT, 100)}%` }}
            />
            <div className="absolute top-0 h-full w-0.5 bg-amber-400" style={{ left: '60%' }} title="2030 목표 60%" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
            <span>0%</span>
            <span className="text-amber-400">▲ 목표 60%</span>
            <span>100%</span>
          </div>
        </div>
      </SectionCard>

      {/* 월별 전력 사용 구성 — 태양광이 내 사용량을 얼마나 충당하는지 (수용가 1차 질문) */}
      <SectionCard
        title="월별 전력 사용 — 태양광 충당 vs 한전 수전"
        description="내 사업장 사용량 중 태양광 자가소비가 충당한 비중 — 한전 수전이 줄수록 절감 효과 큼"
      >
        <div className="px-2">
          <RmsBarLineChart
            data={LEASE_MONTHLY}
            xKey="month"
            bars={[
              { key: 'pvMwh', name: '태양광 자가소비 (MWh)', color: '#F59E0B' },
              { key: 'gridMwh', name: '한전 수전 (MWh)', color: '#64748B' },
            ]}
            lines={[]}
            yUnit="MWh"
            height={260}
          />
        </div>
      </SectionCard>

      {/* 월별 절감 · 납부 (수익 분배율 30/70 모델) */}
      <SectionCard
        title="월별 절감 · 납부"
        description={`한전 대비 총 절감에서 SPC 납부(발전사 분배 ${GEN_SHARE_PCT}%)를 빼면 내 순 절감 ${100 - GEN_SHARE_PCT}%`}
      >
        <div className="px-2">
          <RmsBarLineChart
            data={LEASE_MONTHLY}
            xKey="month"
            bars={[
              { key: 'revenue', name: '총 절감 — 한전 대비 (백만원)', color: '#10B981' },
              { key: 'genShare', name: `SPC 납부 ${GEN_SHARE_PCT}% (백만원)`, color: '#F43F5E' },
            ]}
            lines={[{ key: 'myNet', name: `내 순 절감 ${100 - GEN_SHARE_PCT}% (백만원)`, color: '#6366F1' }]}
            yUnit="백만원"
            height={280}
          />
        </div>
        <div className="border-t border-white/[0.06] px-4 py-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              // generationKwh 는 이미 kWh 단위 → 그대로 합산 (consumer/billing 정합값과 동일)
              {
                label: '올해 누적 자가소비',
                value: `${LEASE_MONTHLY.reduce((s, m) => s + (m.generationKwh ?? 0), 0).toLocaleString()} kWh`,
              },
              // myNet 은 백만원 단위 → 원으로 환산 시 × 1,000,000 (소수점 손실 방지 위해 round)
              {
                label: `올해 누적 순 절감 (내 ${100 - GEN_SHARE_PCT}%)`,
                value: `₩ ${Math.round(LEASE_MONTHLY.reduce((s, m) => s + (m.myNet ?? 0), 0) * 1_000_000).toLocaleString()}`,
                highlight: true,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  'rounded-lg px-5 py-4',
                  item.highlight ? 'bg-primary/[0.10] ring-1 ring-primary/40' : 'bg-[#0d1520] ring-1 ring-white/[0.06]',
                )}
              >
                <p className="text-xs text-slate-400">{item.label}</p>
                <p
                  className={cn(
                    'mt-1.5 text-2xl font-bold tabular-nums',
                    item.highlight ? 'text-primary' : 'text-white',
                  )}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* 내 옥상 발전 현황 — 수용가도 내 건물 위 발전량은 직접 확인 (시간/일/월) */}
      <GenerationTrendCard
        description={(() => {
          const isMulti = !isSingleSelected && selectedSites.size > 1;
          const sitesLabel = isMulti
            ? isAllSelected
              ? ` · 전사 합산 ${ALL_SITES.length}개`
              : ` · ${selectedSites.size}개 사업장 스택 합산`
            : isSingleSelected
              ? ` · ${onlySelectedSite}`
              : ' · 선택된 사업장 없음';
          if (view === '시간') return `오늘 시간대별 내 옥상 발전량 (kW)${sitesLabel}`;
          if (view === '일') return `최근 30일 일별 발전량 (kWh)${sitesLabel}`;
          return `최근 12개월 월별 발전량 (kWh)${sitesLabel}`;
        })()}
        timeUnits={[
          { value: '시간', label: '시간' },
          { value: '일', label: '일' },
          { value: '월', label: '월' },
        ]}
        activeUnit={view}
        onUnitChange={(v) => setView(v as typeof view)}
        yoyLabel={
          <span className="text-slate-600 cursor-not-allowed" title="2025년 데이터 없음 — 2027년부터 표시">
            전년 동기 대비 <span className="font-semibold">—</span>
          </span>
        }
        dateLabel={view === '시간' ? date : view === '일' ? month : `${year}년`}
        onPrev={() => {
          if (view === '시간') {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            );
          } else if (view === '일') {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m - 2, 1);
            setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          } else {
            setYear((y) => y - 1);
          }
        }}
        onNext={() => {
          if (view === '시간') {
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            setDate(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            );
          } else if (view === '일') {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m, 1);
            setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          } else {
            setYear((y) => y + 1);
          }
        }}
        lines={availableLines}
        hiddenLines={hiddenLines}
        onToggleLine={toggleLine}
      >
        <RmsAreaChart
          data={chartData}
          xKey="x"
          areas={chartAreas}
          height={320}
          stacked={!isSingleSelected && selectedSites.size > 1}
        />
      </GenerationTrendCard>

      {/* 발전소 상태 보드 — 내 옥상 설비 상태·오늘 발전·인버터 (상세 모달 연결) */}
      <PlantStatusTable
        plants={filteredPlants.map((p) => {
          const sm = STATUS_META[p.status];
          const apiGenHours = plant?.dailyEnergy != null && plant?.capacity ? plant.dailyEnergy / plant.capacity : null;
          return {
            id: p.id,
            name: p.name,
            icon: p.icon,
            iconBg: p.bg,
            iconColor: p.color,
            status: sm,
            resource: p.resource,
            capacityKw: p.capacityKw,
            dailyGenKwh:
              p.id === 'lp-1' && plant?.dailyEnergy != null
                ? plant.dailyEnergy
                : p.dailyGenHours != null
                  ? Math.round(p.dailyGenHours * p.capacityKw)
                  : null,
            genHours: p.id === 'lp-1' && apiGenHours != null ? apiGenHours : (p.dailyGenHours ?? null),
            monthlyKwh: p.monthlyEnergyKwh ?? null,
            inverter:
              (p.inverterCount ?? 0) > 0 ? { normal: p.inverterNormal ?? 0, total: p.inverterCount ?? 0 } : undefined,
            alarm: p.alarmTitle
              ? {
                  title: p.alarmTitle,
                  detail: p.alarmDetail,
                  severity: p.status === '이상' ? ('error' as const) : ('warning' as const),
                }
              : undefined,
            onDetail: () => setDetailPlantId(p.id),
          };
        })}
      />

      {/* 발전소 상세 모달 */}
      {detailPlant && (
        <Modal
          open={!!detailPlant}
          onClose={() => setDetailPlantId(null)}
          title={`${detailPlant.name} — 상세`}
          size="lg"
          footer={
            <Button variant="ghost" onClick={() => setDetailPlantId(null)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-4">
            {/* 상태 헤더 */}
            {(() => {
              const sm = STATUS_META[detailPlant.status];
              return (
                <div className={cn('rounded-lg ring-1 px-4 py-3 flex items-center justify-between', sm.bg, sm.ring)}>
                  <div className="flex items-center gap-3">
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', detailPlant.bg)}>
                      <detailPlant.icon size={18} className={detailPlant.color} />
                    </span>
                    <div>
                      <p className="text-sm text-white font-semibold">{detailPlant.name}</p>
                      <p className="text-[11px] text-slate-400">{detailPlant.site} · 옥상 태양광</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1',
                      sm.bg,
                      sm.tone,
                      sm.ring,
                    )}
                  >
                    <sm.icon size={11} />
                    {sm.label}
                  </span>
                </div>
              );
            })()}

            {/* 알람 (있으면) */}
            {detailPlant.alarmTitle && (
              <div
                className={cn(
                  'rounded-md ring-1 px-3 py-2.5',
                  detailPlant.status === '이상'
                    ? 'bg-rose-500/[0.06] ring-rose-500/30'
                    : 'bg-amber-500/[0.06] ring-amber-500/30',
                )}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    size={13}
                    className={cn(
                      'mt-0.5 shrink-0',
                      detailPlant.status === '이상' ? 'text-rose-300' : 'text-amber-300',
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        detailPlant.status === '이상' ? 'text-rose-200' : 'text-amber-200',
                      )}
                    >
                      {detailPlant.alarmTitle}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{detailPlant.alarmDetail}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 설비 정보 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">설비 정보</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                  <p className="text-[10px] text-slate-500 mb-1">설비 용량</p>
                  <p className="text-sm font-bold text-white tabular-nums">
                    {detailPlant.capacityKw.toLocaleString()} kW
                  </p>
                </div>
                <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                  <p className="text-[10px] text-slate-500 mb-1">현재 발전량</p>
                  <p className="text-sm font-bold text-emerald-300 tabular-nums">
                    {detailPlant.currentKw.toLocaleString()} kW
                  </p>
                </div>
                <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                  <p className="text-[10px] text-slate-500 mb-1">이번 달 누적</p>
                  <p className="text-sm font-bold text-amber-300 tabular-nums">
                    {detailPlant.monthlyEnergyKwh?.toLocaleString() ?? '—'}{' '}
                    {detailPlant.monthlyEnergyKwh != null && (
                      <span className="text-xs font-normal text-slate-400">kWh</span>
                    )}
                  </p>
                </div>
                <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                  <p className="text-[10px] text-slate-500 mb-1">누적 발전량</p>
                  <p className="text-sm font-bold text-blue-300 tabular-nums">
                    {detailPlant.totalEnergyKwh?.toLocaleString() ?? '—'}{' '}
                    {detailPlant.totalEnergyKwh != null && (
                      <span className="text-xs font-normal text-slate-400">kWh</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 운영 정보 — trading 페이지의 한일튜브 계약 정보와 정합 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">운영 정보</p>
              <div className="rounded-md ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                <DetailRow label="발전사 (소유·운영)" value="라씨" />
                <DetailRow label="계약번호" value="LS-2026-001" />
                <DetailRow label="설치 완료일" value="2026-01-15" />
                <DetailRow label="계약 기간" value="2026-01-15 ~ 2046-01-14 (20년)" />
                <DetailRow
                  label="발전사 분배율"
                  value={`${GEN_SHARE_PCT}% (내 순이익 ${100 - GEN_SHARE_PCT}%)`}
                  valueClass="text-emerald-300"
                />
                <DetailRow
                  label="인버터"
                  value={`${detailPlant.inverterNormal ?? 0}/${detailPlant.inverterCount ?? 0} 정상`}
                  valueClass={
                    (detailPlant.inverterNormal ?? 0) === (detailPlant.inverterCount ?? 0)
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }
                />
                <DetailRow label="모니터링 통신" value="정상 (5분 주기)" valueClass="text-emerald-300" />
                <DetailRow label="다음 정기 점검" value="2026-06-15 (D-19)" />
              </div>
            </div>

            {/* 액션 */}
            <div className="rounded-md ring-1 ring-violet-500/30 bg-violet-500/[0.04] px-3 py-2.5 flex items-start gap-2">
              <AlertCircle size={12} className="text-violet-300 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-300">
                <p className="text-violet-200 font-medium">이상 발견 시 즉시 발전사에게 자동 통보됩니다</p>
                <p className="text-slate-400 mt-0.5 text-[11px]">
                  긴급 시 발전사 콜센터 1588-0000 또는 우리 시설팀으로 연락하세요.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn('text-white tabular-nums', valueClass)}>{value}</span>
    </div>
  );
}
