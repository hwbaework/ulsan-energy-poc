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
  category: GhgCategory;
  fuel: string;
  /** 사용량 입력 단위 */
  unit: string;
  /** 순발열량 MJ/단위 (전기는 9.6 MJ/kWh 소비기준) */
  ncv: number;
  /** 연료: kg/TJ · 전기: CO₂ tCO₂/MWh, CH₄·N₂O kg/MWh · 스팀: kg/TJ */
  co2: number;
  ch4: number;
  n2o: number;
  basis: string;
}

const FUEL_BASIS = '지침 별표 12 연료별 국가 고유 발열량 · 별표 10 IPCC 기본 배출계수';
const MOBILE_BASIS = '지침 별표 6 이동연소(도로) 기본 배출계수 · 별표 12 발열량';

export const GHG_FACTORS: GhgFactor[] = [
  // Scope 1 — 고정연소
  {
    id: 'lng',
    category: '고정연소',
    fuel: '도시가스(LNG)',
    unit: 'N㎥',
    ncv: 38.5,
    co2: 55865.3,
    ch4: 1,
    n2o: 0.1,
    basis: FUEL_BASIS,
  },
  {
    id: 'propane',
    category: '고정연소',
    fuel: '프로판(LPG 1호)',
    unit: 'kg',
    ncv: 46.2,
    co2: 64643.3,
    ch4: 1,
    n2o: 0.1,
    basis: FUEL_BASIS,
  },
  {
    id: 'butane',
    category: '고정연소',
    fuel: '부탄(LPG 3호)',
    unit: 'kg',
    ncv: 45.5,
    co2: 66344.7,
    ch4: 1,
    n2o: 0.1,
    basis: FUEL_BASIS,
  },
  {
    id: 'diesel-s',
    category: '고정연소',
    fuel: '경유',
    unit: 'L',
    ncv: 35.3,
    co2: 73663.3,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
  },
  {
    id: 'kerosene',
    category: '고정연소',
    fuel: '등유',
    unit: 'L',
    ncv: 34.1,
    co2: 73062,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
  },
  {
    id: 'ba',
    category: '고정연소',
    fuel: 'B-A유',
    unit: 'L',
    ncv: 36.5,
    co2: 74946.7,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
  },
  {
    id: 'bc',
    category: '고정연소',
    fuel: 'B-C유',
    unit: 'L',
    ncv: 39.3,
    co2: 77913,
    ch4: 3,
    n2o: 0.6,
    basis: FUEL_BASIS,
  },
  // Scope 1 — 이동연소
  {
    id: 'gasoline-m',
    category: '이동연소',
    fuel: '휘발유',
    unit: 'L',
    ncv: 30.1,
    co2: 69300,
    ch4: 25,
    n2o: 8,
    basis: MOBILE_BASIS,
  },
  {
    id: 'diesel-m',
    category: '이동연소',
    fuel: '경유',
    unit: 'L',
    ncv: 35.3,
    co2: 74100,
    ch4: 3.9,
    n2o: 3.9,
    basis: MOBILE_BASIS,
  },
  {
    id: 'lpg-m',
    category: '이동연소',
    fuel: 'LPG',
    unit: 'kg',
    ncv: 45.5,
    co2: 63100,
    ch4: 62,
    n2o: 0.2,
    basis: MOBILE_BASIS,
  },
  {
    id: 'cng-m',
    category: '이동연소',
    fuel: 'CNG',
    unit: 'N㎥',
    ncv: 38.9,
    co2: 56100,
    ch4: 92,
    n2o: 3,
    basis: MOBILE_BASIS,
  },
  // Scope 2 — 외부 전기 · 열
  {
    id: 'elec',
    category: '외부 전기',
    fuel: '전기(한전 수전)',
    unit: 'kWh',
    ncv: 9.6,
    co2: 0.4149,
    ch4: 0.0075,
    n2o: 0.0081,
    basis: '국가 전력 배출계수 2023년 소비단(2025-12 공표) · 에너지열량 환산기준 9.6 MJ/kWh',
  },
  {
    id: 'steam',
    category: '외부 열(스팀)',
    fuel: '스팀(일반)',
    unit: 'GJ',
    ncv: 1000,
    co2: 73882,
    ch4: 0.9452,
    n2o: 0.1214,
    basis: '지침 별표 6 외부에서 공급된 열(스팀)',
  },
];
export const factorOf = (id: string) => GHG_FACTORS.find((f) => f.id === id);
export const scopeOfFactor = (f: GhgFactor) => CATEGORY_SCOPE[f.category];

/**
 * 사용량 1단위당 tCO₂eq.
 * 전기는 국가 전력 배출계수(가스별 합산값, 에너지 설정 값)를 그대로 쓴다 — elecFactor 를 넘긴다.
 */
export function tco2PerUnit(f: GhgFactor, elecFactor?: number): number {
  if (f.category === '외부 전기') {
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
