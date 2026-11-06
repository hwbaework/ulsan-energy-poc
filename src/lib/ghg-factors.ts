/**
 * 배출계수 — 회사가 등록하는 배출원(Scope 1 연료 연소 · Scope 2 외부 전기·열)에 쓰는 값.
 * 근거: 온실가스 배출권거래제의 배출량 보고 및 인증에 관한 지침 [별표 6 · 10 · 12],
 *       에너지법 시행규칙 [별표] 에너지열량 환산기준 (제조혁신바우처 산정 Tool v1.3 Reference 시트 정리값)
 * 산식: 배출량(tCO₂eq) = 사용량 × 순발열량(MJ/단위) × 10⁻⁶(TJ) × (CO₂ + CH₄×GWP + N₂O×GWP)(kg/TJ) × 10⁻³
 * 전기: 배출량 = 사용량(MWh) × 국가 전력 배출계수(tCO₂eq/MWh) — 가스별 값은 EG-TIPS 2023년 소비단
 * GWP 는 국가 인벤토리(IPCC 5차 평가보고서) 기준. 툴의 옛 값(CH₄ 21 · N₂O 310)은 쓰지 않는다.
 */

export const GWP = { co2: 1, ch4: 28, n2o: 265 } as const;
export const GWP_BASIS = 'IPCC 5차 평가보고서(AR5) — 2025 국가 온실가스 인벤토리 보고서 표 1-9';

export type GhgScope = 1 | 2;
export type GhgCategory = '고정연소' | '이동연소' | '외부 전기' | '외부 열(스팀)';
export const CATEGORY_SCOPE: Record<GhgCategory, GhgScope> = {
  고정연소: 1,
  이동연소: 1,
  '외부 전기': 2,
  '외부 열(스팀)': 2,
};
/** 배출활동 이름(지침 별표 6) */
export const CATEGORY_ACTIVITY: Record<GhgCategory, string> = {
  고정연소: '고체·액체·기체 연료 연소(고정연소)',
  이동연소: '이동연소(도로)',
  '외부 전기': '외부에서 공급된 전기 사용',
  '외부 열(스팀)': '외부에서 공급된 열(스팀) 사용',
};
/** 배출시설(예) */
export const CATEGORY_FACILITY: Record<GhgCategory, string> = {
  고정연소: '보일러 · 가열로 · 건조로',
  이동연소: '차량 · 지게차',
  '외부 전기': '사업장 단위 전력 사용 시설',
  '외부 열(스팀)': '사업장 단위 스팀 사용 시설',
};

export interface GhgFactor {
  id: string;
  /** Scope — 따로 둔다(배출활동과 묶지 않아 Scope 가 늘어나도 그대로) */
  scope: number;
  /** 배출활동 — 고정연소 · 이동연소 · 외부 전기 등. 관리자가 직접 입력 */
  category: string;
  fuel: string;
  /** 사용량 입력 단위 */
  unit: string;
  /** 순발열량 MJ/단위 (전기는 9.6 MJ/kWh 소비기준) */
  ncv: number;
  /** 배출계수 tC/TJ — 고정연소만(TIPS 연료연소 부문 공표값). CO₂ 는 따로 직접 입력 */
  cef?: number;
  /** 연료: kg/TJ · 전기: CO₂ tCO₂/MWh, CH₄·N₂O kg/MWh · 스팀: kg/TJ */
  co2: number;
  ch4: number;
  n2o: number;
  /** 출처 — 배출계수 출처 · 공표 시점(필수, 표에는 숨김) */
  basis: string;
  /** 기준 — 언제 공표된 값인지(연도 YYYY). 위 값 · 출처는 가장 최근 기준 것 */
  asOf?: string;
  /** 기준별 기록 — 연도마다가 아니라 값이 바뀐 기준만(최근 기준이 위 값) */
  versions?: GhgVersion[];
}
/** 기준 하나의 값 — 기준 연도 · 출처 · 값 */
export type GhgVersion = GhgValues & { asOf: string; basis: string; category?: string; fuel?: string; unit?: string };
export interface GhgValues {
  ncv: number;
  cef?: number;
  co2: number;
  ch4: number;
  n2o: number;
}
/** 출처 — 그 줄 배출계수의 출처와 공표 시점(값이 바뀌면 출처도 같이 고친다) */
const FUEL_BASIS = 'TIPS 연료연소 부문 배출계수';
export const OLD_BASIS = ['TIPS 연료연소 부문 배출계수 (2022.1)', 'TIPS 전력 배출계수 (2025.12)', '지침 별표 12 연료별 국가 고유 발열량 · 별표 10 IPCC 기본 배출계수', '국가 전력 배출계수 2023년 소비단(2025-12 공표) · 에너지열량 환산기준 9.6 MJ/kWh', '국가 전력 배출계수 2023년 발전단(2025-12 공표) · 에너지열량 환산기준 8.9 MJ/kWh', '지침 별표 6 외부에서 공급된 열(스팀)'];

/** 기준별 기록 — 없으면 지금 값 하나. 최근 기준이 앞 */
export function versionsOf(f: GhgFactor): GhgVersion[] {
  const list: GhgVersion[] = f.versions?.length
    ? f.versions
    : [{ asOf: f.asOf ?? '', basis: f.basis, category: f.category, fuel: f.fuel, unit: f.unit, ncv: f.ncv, ...(f.cef != null ? { cef: f.cef } : {}), co2: f.co2, ch4: f.ch4, n2o: f.n2o }];
  return [...list].sort((a, b) => b.asOf.localeCompare(a.asOf));
}
/** 기준별 기록을 넣고, 위 값 · 출처 · 기준은 가장 최근 기준 것으로 */
export function withVersions(f: GhgFactor, versions: GhgVersion[]): GhgFactor {
  const sorted = [...versions].sort((a, b) => b.asOf.localeCompare(a.asOf));
  const latest = sorted[0];
  if (!latest) return f;
  const { asOf, basis, category, fuel, unit, ...values } = latest;
  // 최근 기록에 배출계수(tC/TJ)가 없으면(이동연소 등) 예전 값을 남기지 않는다
  const base: GhgFactor = { ...f };
  if (values.cef == null) delete base.cef;
  return { ...base, ...values, asOf, basis, ...(category ? { category } : {}), ...(fuel ? { fuel } : {}), ...(unit ? { unit } : {}), versions: sorted };
}


/** 기본값 — POC 샘플: 고정연소 5종 · 이동연소 2종 · 전기 소비기준 · 발전기준(스팀은 관리하지 않음) — Scope 는 배출활동에서 채운다 */
const BASE_FACTORS: (Omit<GhgFactor, 'scope' | 'category'> & { category: GhgCategory })[] = [
  // Scope 1 — 고정연소. POC 샘플 5종(TIPS 연료연소 부문 중 휘발유 · 등유 · 경유 · 프로판 · 도시가스(LNG)), 나머지는 [계수 추가]로. 순서는 TIPS — 순발열량 에너지열량 환산기준(2022.11), 배출계수 tC/TJ(2022.1), CH₄ · N₂O 지침 별표 10(제조업 · 건설업)
  {
    id: 'gasoline-s',
    category: '고정연소',
    fuel: '휘발유',
    unit: 'L',
    ncv: 30.1,
    cef: 19.731,
    co2: 72347,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
    asOf: '2022',
  },
  {
    id: 'kerosene',
    category: '고정연소',
    fuel: '등유',
    unit: 'L',
    ncv: 34.1,
    cef: 19.926,
    co2: 73062,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
    asOf: '2022',
  },
  {
    id: 'diesel-s',
    category: '고정연소',
    fuel: '경유',
    unit: 'L',
    ncv: 35.3,
    cef: 20.09,
    co2: 73663.3,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
    asOf: '2022',
  },
  {
    id: 'propane',
    category: '고정연소',
    fuel: '프로판(LPG 1호)',
    unit: 'kg',
    ncv: 46.2,
    cef: 17.63,
    co2: 64643.3,
    ch4: 1,
    n2o: 0.1,
    basis: FUEL_BASIS,
    asOf: '2022',
  },
  {
    id: 'lng',
    category: '고정연소',
    fuel: '도시가스(LNG)',
    unit: 'N㎥',
    ncv: 38.5,
    cef: 15.236,
    co2: 55865.3,
    ch4: 1,
    n2o: 0.1,
    basis: FUEL_BASIS,
    asOf: '2022',
  },
  // Scope 1 — 이동연소(도로). 지침 별표 6 〈표-4〉 IPCC 도로 기본값 — 배출계수(tC/TJ) 없음
  {
    id: 'diesel-mobile',
    category: '이동연소',
    fuel: '경유',
    unit: 'L',
    ncv: 35.3,
    co2: 74100,
    ch4: 3.9,
    n2o: 3.9,
    basis: '지침 별표 6 이동연소(도로)',
    asOf: '2025',
  },
  {
    id: 'gasoline-mobile',
    category: '이동연소',
    fuel: '휘발유',
    unit: 'L',
    ncv: 30.1,
    co2: 69300,
    ch4: 25,
    n2o: 8,
    basis: '지침 별표 6 이동연소(도로)',
    asOf: '2025',
  },
  // Scope 2 — 외부 전기 · 열
  {
    id: 'elec',
    category: '외부 전기',
    fuel: '전기(소비기준)',
    unit: 'kWh',
    ncv: 9.6,
    co2: 0.4149,
    ch4: 0.0075,
    n2o: 0.0081,
    basis: 'TIPS 전력 배출계수',
    asOf: '2025',
  },
  // TIPS 처럼 발전기준도 — 발전단 계수(송배전 손실 전). 감축량 계산은 소비단(전력배출계수 카드)을 쓴다
  {
    id: 'elec-gen',
    category: '외부 전기',
    fuel: '전기(발전기준)',
    unit: 'kWh',
    ncv: 8.9,
    co2: 0.3822,
    ch4: 0.0069,
    n2o: 0.0075,
    basis: 'TIPS 전력 배출계수',
    asOf: '2025',
  },
];
export const GHG_FACTORS: GhgFactor[] = BASE_FACTORS.map((f) => ({ ...f, scope: CATEGORY_SCOPE[f.category] }));
/** 저장된 옛 값(scope 없음)은 배출활동으로 채운다 */
export const scopeOf = (f: { scope?: number; category: string }) =>
  f.scope ?? CATEGORY_SCOPE[f.category as GhgCategory] ?? 1;
export const factorOf = (id: string) => GHG_FACTORS.find((f) => f.id === id);
export const scopeOfFactor = (f: GhgFactor) => f.scope;

/**
 * 사용량 1단위당 tCO₂eq.
 * 전기는 국가 전력 배출계수(가스별 합산값, 에너지 설정 값)를 그대로 쓴다 — elecFactor 를 넘긴다.
 */
export function tco2PerUnit(f: GhgFactor, elecFactor?: number): number {
  // 소비기준 전기만 에너지 설정의 전력배출계수(적용년도별)를 쓰고, 발전기준 등은 가스별 값 합산
  if (f.category === '외부 전기' && f.id === 'elec') {
    const perMwh = elecFactor ?? f.co2 + (f.ch4 * GWP.ch4 + f.n2o * GWP.n2o) / 1000;
    return perMwh / 1000; // kWh
  }
  const tj = f.ncv / 1_000_000;
  return (tj * (f.co2 + f.ch4 * GWP.ch4 + f.n2o * GWP.n2o)) / 1000;
}
/** 가스별 합산 — 연료 kgCO₂eq/TJ, 전기 tCO₂eq/MWh */
export function combined(f: GhgFactor): number {
  return f.category === '외부 전기'
    ? f.co2 + (f.ch4 * GWP.ch4 + f.n2o * GWP.n2o) / 1000
    : f.co2 + f.ch4 * GWP.ch4 + f.n2o * GWP.n2o;
}
