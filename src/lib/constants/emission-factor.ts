// 국가 전력 배출계수 (tCO₂eq/MWh) — 산정 연도에 맞는 고시값을 쓴다.
// 2025-12부터 매년 12월 갱신 → 새 값은 맨 앞에 한 줄 추가.

export interface ElecEmissionFactor {
  factor: number;
  /** 적용 산정 연도 (포함) */
  fromYear: number | null;
  toYear: number | null;
  source: string;
}

export const ELEC_EMISSION_FACTORS: ElecEmissionFactor[] = [
  { factor: 0.4173, fromYear: 2023, toYear: null, source: '국가 전력배출계수 (2025 공표)' },
  { factor: 0.4541, fromYear: 2020, toYear: 2022, source: '국가 전력배출계수' },
  { factor: 0.4781, fromYear: null, toYear: 2019, source: '국가 전력배출계수 (2021 승인)' },
];

/** 산정 연도의 전력 배출계수 */
export function elecFactorFor(year: number): number {
  const hit = ELEC_EMISSION_FACTORS.find(
    (f) => (f.fromYear == null || year >= f.fromYear) && (f.toYear == null || year <= f.toYear),
  );
  return (hit ?? ELEC_EMISSION_FACTORS[0]!).factor;
}

/** 최신 전력 배출계수 — 연도 구분 없는 화면 기본값 */
export const ELEC_FACTOR = ELEC_EMISSION_FACTORS[0]!.factor;

/* ── 적용년도별 전력배출계수 — 관리 › 에너지 설정에서 관리자가 연도마다 등록 ── */

/** 에너지 설정 키 — JSON {"2025":0.4173,"2026":0.4173} (적용년도 → tCO₂eq/MWh) */
export const CO2_BY_YEAR_KEY = 'CO2_FACTOR_BY_YEAR';
export type FactorByYear = Record<string, number>;

/** 저장값 읽기 — 없거나 깨졌으면 데이터가 있는 연도마다 current(전에 저장한 값) 또는 고시값(elecFactorFor) */
export function parseFactorByYear(raw: string | undefined, years: string[], current?: number): FactorByYear {
  if (raw) {
    try {
      const v = JSON.parse(raw) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const out: FactorByYear = {};
        for (const [y, n] of Object.entries(v as Record<string, unknown>)) {
          if (/^\d{4}$/.test(y) && Number.isFinite(Number(n))) out[y] = Number(n);
        }
        return out;
      }
    } catch {
      /* 아래 기본값 */
    }
  }
  return Object.fromEntries(years.map((y) => [y, current != null && Number.isFinite(current) ? current : elecFactorFor(Number(y))]));
}

/** 등록된 연도 — 최근 연도가 위 */
export const yearsOf = (m: FactorByYear) => Object.keys(m).sort((a, b) => b.localeCompare(a));

/** 그 해 계수 — 그 해가 없으면 그 앞 가장 가까운 해, 그것도 없으면 가장 이른 해, 아무것도 없으면 fallback */
export function factorOfYear(m: FactorByYear, year: string, fallback: number): number {
  if (m[year] != null) return m[year]!;
  const ys = yearsOf(m);
  const prev = ys.find((y) => y < year);
  if (prev) return m[prev]!;
  const first = ys[ys.length - 1];
  return first ? m[first]! : fallback;
}
