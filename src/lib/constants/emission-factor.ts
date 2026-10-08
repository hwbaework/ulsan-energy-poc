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
