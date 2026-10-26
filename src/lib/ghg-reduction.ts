// 온실가스 인벤토리 — 태양광으로 줄인 탄소(감축량)만 다룬다.
// · 발전량: 데이터 마켓과 같은 출처(useDataMarketStore.generationOf). 기업이 쓰는 전기 = 발전량 전부(자가소비)
// · 감축량 = 발전량(MWh) × 전력 배출계수 / 화석에너지 대체 = MWh × TOE 계수 / 소나무 식재 = tCO₂ × 그루 계수
// · 계수는 관리 › 에너지 설정 한 곳에서 읽는다(없으면 고시 기본값)
// · 회사 전체 전력 사용량 · 배출량은 다루지 않는다(매월 다르고 파워플래너로만 알 수 있어 임의 값으로 만들지 않음)
import { ELEC_FACTOR } from '@/lib/constants/emission-factor';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { energyNum, useEnergySettings } from '@/hooks/common/useSettings';
import { GHG_FACTORS, type GhgFactor } from '@/lib/ghg-factors';
import { useMemo } from 'react';
import { DM_TODAY, genHoursOf, generationOf } from '@/stores/useDataMarketStore';
import { useHydrateTradingPoc, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Contract } from '@/types/trading-poc';
import type { EnergySource } from '@/types/monitoring';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';

/** 설비 구분 — 자가소비(기업이 설치) · onsite(EPC 설치, 기업이 쓴 만큼 사용료) */
export type FacilityKind = '자가소비' | 'PPA';

/** 배출원 = 전력거래에서 체결된 계약의 태양광 설비. 따로 입력하지 않고 체결되면 생긴다 */
export interface Facility {
  /** 계약 id */
  id: number;
  companyId: number;
  company: string;
  address: string;
  kind: FacilityKind;
  kw: number;
  contractNo: string;
  /** 체결일 */
  signedAt: string;
  /** 가동일 = 계약 시작일 */
  startDate: string;
  /** 수집 시작 달 = 계약 시작 달 */
  startMonth: string;
  /** 해지한 달 — 그 달까지만 */
  endMonth?: string;
  status: 'ACTIVE' | 'TERMINATED';
  /** 발전원 — 설비(발전소) 종류를 따른다. 계약에 발전소가 없으면 태양광 */
  source: EnergySource;
}

/** 체결(이용 중 · 해지 포함) 계약 → 배출원. 서명 전 계약은 아직 아니다 */
export function facilitiesOf(
  contracts: Contract[],
  typeOf: (plantId?: number) => EnergySource = () => 'SOLAR',
): Facility[] {
  return contracts
    .filter((c) => c.status === 'ACTIVE' || c.status === 'TERMINATED')
    .map((c) => ({
      id: c.id,
      companyId: c.consumerCompanyId,
      company: c.consumerCompanyName,
      address: c.address,
      kind: c.kind === 'ONSITE' ? ('PPA' as const) : ('자가소비' as const),
      kw: c.capacityKw,
      contractNo: c.no,
      signedAt: (c.signedAt ?? c.createdAt).slice(0, 10),
      startDate: c.startDate.slice(0, 10),
      startMonth: c.startDate.slice(0, 7),
      endMonth: c.terminatedAt?.slice(0, 7),
      status: c.status === 'TERMINATED' ? ('TERMINATED' as const) : ('ACTIVE' as const),
      source: typeOf(c.plantId),
    }))
    .sort((a, b) => a.company.localeCompare(b.company, 'ko') || a.id - b.id);
}

/** 배출원이 있는 기업 */
export function companiesOf(fs: Facility[]) {
  return [...new Map(fs.map((f) => [f.companyId, f])).values()]
    .map((f) => ({ id: f.companyId, name: f.company, address: f.address }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** 전력거래 계약에서 배출원 — 화면마다 이 훅 하나 */
export function useFacilities(): Facility[] {
  useHydrateTradingPoc();
  const contracts = useTradingPocStore((s) => s.contracts);
  const { data: plants } = useMonitoringPlants();
  return useMemo(() => {
    const types = new Map((plants ?? []).map((p) => [p.plantId, p.type as EnergySource]));
    return facilitiesOf(contracts, (id) => (id != null ? (types.get(id) ?? 'SOLAR') : 'SOLAR'));
  }, [contracts, plants]);
}

/** 수집 시작 달 · 마지막 달 — 데이터 마켓 발전 정보와 같다 */
export const FIRST_MONTH = '2025-03';
export const LAST_MONTH = '2026-09';

/** 계수 — 에너지 설정 값 */
export interface GhgFactors {
  co2: number;
  toe: number;
  pine: number;
  /** 배출계수 기준 연도 · 공표일 */
  year: string;
  published: string;
}
export function useGhgFactorValues(): GhgFactors {
  const { data: es } = useEnergySettings();
  return {
    co2: energyNum(es, 'CO2_EMISSION_FACTOR', ELEC_FACTOR),
    toe: energyNum(es, 'TOE_PER_MWH', TOE_PER_MWH),
    pine: energyNum(es, 'PINE_PER_TCO2', PINE_PER_TCO2),
    year: es?.CO2_FACTOR_YEAR ?? '2023',
    published: es?.CO2_FACTOR_PUBLISHED ?? '2025-12-17',
  };
}

/** 배출원 계수 목록 — 에너지 설정(GHG_FACTORS, JSON)에 저장한 값. 없거나 깨졌으면 지침 기본값 */
export const GHG_FACTORS_KEY = 'GHG_FACTORS';
export function parseGhgFactors(raw: string | undefined): GhgFactor[] {
  if (!raw) return GHG_FACTORS;
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list as GhgFactor[]) : GHG_FACTORS;
  } catch {
    return GHG_FACTORS;
  }
}
export function useGhgFactorList(): GhgFactor[] {
  const { data: es } = useEnergySettings();
  return useMemo(() => parseGhgFactors(es?.[GHG_FACTORS_KEY]), [es]);
}

/** 한 줄 — 설비 × 달 */
export interface ReductionRow {
  key: string;
  month: string;
  facility: Facility;
  /** 하루 평균 발전시간(h) */
  hours: number;
  kwh: number;
  mwh: number;
  tco2: number;
  toe: number;
  pine: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 설비별 월 발전량 — 기업 설비 용량 합으로 기업 발전량(데이터 마켓과 같은 식)을 내고 용량 비율로 나눈다.
 *  끝수는 마지막 설비에. 계약 시작 달부터(해지면 해지 달까지)만 */
function facilityMonths(
  facilities: Facility[],
): { facility: Facility; month: string; hours: number; kwh: number }[] {
  const byCompany = [...new Set(facilities.map((f) => f.companyId))];
  return byCompany.flatMap((id) => {
    const fs = facilities.filter((f) => f.companyId === id);
    const kw = fs.reduce((a, f) => a + f.kw, 0);
    const solarKw = Math.round(kw * 100) / 100;
    const gen = generationOf({ id, name: fs[0]?.company ?? '', solarKw });
    // 금월 — 데이터 마지막 달 뒤면 같은 식(설비 용량 × 발전시간 × 날수)으로 한 달 치
    if (TODAY_MONTH > LAST_MONTH) {
      const hours = genHoursOf(id, TODAY_MONTH);
      gen.push({
        month: TODAY_MONTH,
        hours,
        kwh: Math.round(solarKw * hours * daysIn(TODAY_MONTH)),
      });
    }
    return gen.flatMap((g) => {
      let left = g.kwh;
      return fs
        .map((f, i) => {
          const kwh = i === fs.length - 1 ? left : Math.round((g.kwh * f.kw) / kw);
          left -= kwh;
          return { facility: f, month: g.month, hours: g.hours, kwh };
        })
        .filter(
          (r) =>
            r.month >= r.facility.startMonth &&
            (!r.facility.endMonth || r.month <= r.facility.endMonth),
        );
    });
  });
}

/** 금일 — 데이터 마켓 기준일과 같다 */
export const GHG_TODAY = DM_TODAY;
export const TODAY_MONTH = GHG_TODAY.slice(0, 7);
const daysIn = (month: string) => {
  const [y = 2025, m = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** 0 ~ 1 사이 고정 난수 — 같은 입력이면 같은 값 */
const noise = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
/** 설비 달 발전량을 날마다(맑음 · 흐림 0.6 ~ 1.1배, 합 = 그 달). 같은 기업 설비는 같은 날씨 */
function splitDays(companyId: number, month: string, kwh: number): { date: string; kwh: number }[] {
  const n = daysIn(month);
  const day0 = Number(month.replace('-', '')) * 100;
  const f = Array.from({ length: n }, (_, i) => 0.6 + 0.5 * noise(companyId, day0 + i + 1));
  const sum = f.reduce((a, v) => a + v, 0);
  let left = kwh;
  return f.map((v, i) => {
    const k = i === n - 1 ? left : Math.round((kwh * v) / sum);
    left -= k;
    return { date: `${month}-${String(i + 1).padStart(2, '0')}`, kwh: k };
  });
}

/** 설비별 일 발전량 — 금일까지 */
export interface ReductionDay {
  date: string;
  facility: Facility;
  kwh: number;
  tco2: number;
}
export function reductionDays(fx: GhgFactors, facilities: Facility[]): ReductionDay[] {
  return facilityMonths(facilities).flatMap(({ facility, month, kwh }) =>
    splitDays(facility.companyId, month, kwh)
      .filter((d) => d.date <= GHG_TODAY)
      .map((d) => ({ date: d.date, facility, kwh: d.kwh, tco2: r3((d.kwh / 1000) * fx.co2) })),
  );
}

/** 설비별 월 발전량 — 금월은 금일까지 날을 더한 값 */
function facilityGeneration(facilities: Facility[]) {
  return facilityMonths(facilities).map((g) =>
    g.month === TODAY_MONTH
      ? {
          ...g,
          kwh: splitDays(g.facility.companyId, g.month, g.kwh)
            .filter((d) => d.date <= GHG_TODAY)
            .reduce((a, d) => a + d.kwh, 0),
        }
      : g,
  );
}

export function reductionRows(fx: GhgFactors, facilities: Facility[]): ReductionRow[] {
  return facilityGeneration(facilities).map(({ facility, month, hours, kwh }) => {
    const mwh = kwh / 1000;
    const tco2 = mwh * fx.co2;
    return {
      key: `${facility.id}-${month}`,
      month,
      facility,
      hours,
      kwh,
      mwh: r3(mwh),
      tco2: r3(tco2),
      toe: r3(mwh * fx.toe),
      pine: r1(tco2 * fx.pine),
    };
  });
}

/** 합계 */
export interface Totals {
  kwh: number;
  mwh: number;
  tco2: number;
  toe: number;
  pine: number;
}
export function totalsOf(rows: ReductionRow[]): Totals {
  const t = rows.reduce(
    (a, r) => ({
      kwh: a.kwh + r.kwh,
      tco2: a.tco2 + r.tco2,
      toe: a.toe + r.toe,
      pine: a.pine + r.pine,
    }),
    { kwh: 0, tco2: 0, toe: 0, pine: 0 },
  );
  return {
    kwh: t.kwh,
    mwh: r3(t.kwh / 1000),
    tco2: r3(t.tco2),
    toe: r3(t.toe),
    pine: Math.round(t.pine),
  };
}

/** 고른 범위 — 시작 달 ~ 종료 달(양 끝 포함), 기업(없으면 전체) */
export function pick(
  rows: ReductionRow[],
  from: string,
  to: string,
  companyId?: number | null,
): ReductionRow[] {
  return rows.filter(
    (r) =>
      r.month >= from && r.month <= to && (companyId == null || r.facility.companyId === companyId),
  );
}

/** 시작 ~ 종료 사이 달 목록 */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y = 2025, m = 1] = from.split('-').map(Number);
  for (;;) {
    const p = `${y}-${String(m).padStart(2, '0')}`;
    if (p > to) break;
    out.push(p);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** 데이터가 있는 연도 */
export const YEARS = [
  ...new Set(monthsBetween(FIRST_MONTH, LAST_MONTH).map((m) => m.slice(0, 4))),
].reverse();
/** 그 해에 데이터가 있는 첫 달 · 마지막 달 */
export const yearRange = (y: string): [string, string] => {
  const ms = monthsBetween(FIRST_MONTH, LAST_MONTH).filter((m) => m.startsWith(y));
  return [ms[0] ?? `${y}-01`, ms[ms.length - 1] ?? `${y}-12`];
};

/* ── 표시 ── */
export const fmt = (v: number, d = 0) =>
  v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtT = (v: number) => fmt(v, 2);
