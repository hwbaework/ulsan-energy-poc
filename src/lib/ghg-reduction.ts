// 온실가스 인벤토리 — 태양광으로 줄인 탄소(감축량)만 다룬다.
// · 발전량: 데이터 마켓과 같은 출처(useDataMarketStore.generationOf). 기업이 쓰는 전기 = 발전량 전부(자가소비)
// · 감축량 = 발전량(MWh) × 전력 배출계수 / 화석에너지 대체 = MWh × TOE 계수 / 소나무 식재 = tCO₂ × 그루 계수
// · 계수는 관리 › 에너지 설정 한 곳에서 읽는다(없으면 고시 기본값)
// · 회사 전체 전력 사용량 · 배출량은 다루지 않는다(매월 다르고 파워플래너로만 알 수 있어 임의 값으로 만들지 않음)
import { ELEC_FACTOR } from '@/lib/constants/emission-factor';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { energyNum, useEnergySettings } from '@/hooks/common/useSettings';
import { DM_SELLERS, generationOf } from '@/stores/useDataMarketStore';

/** 설비 구분 — 자가소비(기업이 설치) · onsite(EPC 설치, 기업이 쓴 만큼 사용료) */
export type FacilityKind = '자가소비' | 'onsite';

export interface Facility {
  /** 기업 id × 10 + 순번 */
  id: number;
  companyId: number;
  company: string;
  address: string;
  kind: FacilityKind;
  kw: number;
}

/** 대상 기업 주소 — 회원가입 기업 주소 */
const ADDRESS: Record<number, string> = {
  2: '울산 남구 용연동 490-11',
  4: '울산 남구 부곡동 273-6',
  5: '울산 남구 여천동 887-18',
  6: '울산 남구 여천동 358-8',
  7: '울산 남구 부곡동 22-5',
};

/** 설비 — 실제 체결 6건(자가소비 5 · onsite 1). 한일튜브 429.44 = 자가소비 99.84 + onsite 329.6 */
export const FACILITIES: Facility[] = DM_SELLERS.flatMap((c) => {
  const base = { companyId: c.id, company: c.name, address: ADDRESS[c.id] ?? '' };
  if (c.id === 4)
    return [
      { ...base, id: c.id * 10 + 1, kind: '자가소비' as const, kw: 99.84 },
      { ...base, id: c.id * 10 + 2, kind: 'onsite' as const, kw: 329.6 },
    ];
  return [{ ...base, id: c.id * 10 + 1, kind: '자가소비' as const, kw: c.solarKw }];
}).sort((a, b) => a.company.localeCompare(b.company, 'ko') || a.id - b.id);

export const COMPANIES = [...new Map(FACILITIES.map((f) => [f.companyId, f])).values()]
  .map((f) => ({ id: f.companyId, name: f.company, address: f.address }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

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

/** 설비별 월 발전량 — 기업 발전량을 용량 비율로 나누고, 끝수는 마지막 설비에 */
function facilityGeneration(): { facility: Facility; month: string; hours: number; kwh: number }[] {
  return DM_SELLERS.flatMap((c) => {
    const fs = FACILITIES.filter((f) => f.companyId === c.id);
    return generationOf(c).flatMap((g) => {
      let left = g.kwh;
      return fs.map((f, i) => {
        const kwh = i === fs.length - 1 ? left : Math.round((g.kwh * f.kw) / c.solarKw);
        left -= kwh;
        return { facility: f, month: g.month, hours: g.hours, kwh };
      });
    });
  });
}

export function reductionRows(fx: GhgFactors): ReductionRow[] {
  return facilityGeneration().map(({ facility, month, hours, kwh }) => {
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
    (a, r) => ({ kwh: a.kwh + r.kwh, tco2: a.tco2 + r.tco2, toe: a.toe + r.toe, pine: a.pine + r.pine }),
    { kwh: 0, tco2: 0, toe: 0, pine: 0 },
  );
  return { kwh: t.kwh, mwh: r3(t.kwh / 1000), tco2: r3(t.tco2), toe: r3(t.toe), pine: Math.round(t.pine) };
}

/** 고른 범위 — 시작 달 ~ 종료 달(양 끝 포함), 기업(없으면 전체) */
export function pick(rows: ReductionRow[], from: string, to: string, companyId?: number | null): ReductionRow[] {
  return rows.filter(
    (r) => r.month >= from && r.month <= to && (companyId == null || r.facility.companyId === companyId),
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
export const YEARS = [...new Set(monthsBetween(FIRST_MONTH, LAST_MONTH).map((m) => m.slice(0, 4)))].reverse();
/** 그 해에 데이터가 있는 첫 달 · 마지막 달 */
export const yearRange = (y: string): [string, string] => {
  const ms = monthsBetween(FIRST_MONTH, LAST_MONTH).filter((m) => m.startsWith(y));
  return [ms[0] ?? `${y}-01`, ms[ms.length - 1] ?? `${y}-12`];
};

/* ── 표시 ── */
export const fmt = (v: number, d = 0) =>
  v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtT = (v: number) => fmt(v, 2);
