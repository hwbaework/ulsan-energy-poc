// 지붕형 태양광 수익 시뮬레이션 엔진 — 주민수익형 시뮬레이터 v0.1 산식 이식.
// 발전량 = 용량 × 일평균 일사량(위치 실측, NASA 격자) × 월별 계절계수 × 30.4일 × 효율 0.75
// 수익 = SMP 매출 + REC(가중치) 매출 · 20년 운영(연 0.5% 열화) · 환경 기여(TOE/tCO2/식재)

export interface SimParams {
  capacityKw: number;
  /** 일평균 일사량 kWh/m²/day — 설치 위치의 NASA POWER 격자 실값 */
  dailyIrr: number;
  smp: number; // 원/kWh
  recPrice: number; // 원/REC
  recWeight: number; // 지붕형 1.5
}

export interface SimYearRow {
  year: number;
  genMwh: number;
  revenue: number;
  accumulated: number;
}

export interface SimResult {
  monthlyKwh: number[];
  annualKwh: number;
  recPhysical: number;
  recWeighted: number;
  smpRevenue: number; // 1차년도
  recRevenue: number; // 1차년도
  year1Total: number;
  rows: SimYearRow[]; // 20년
  totalGenKwh: number;
  totalRevenue: number;
  env: { toe: number; tco2: number; trees: number };
}

// 월별 계절계수 — 참조 시뮬레이터의 일조시간 프로파일(수원)을 연평균 1.0으로 정규화
const SEASON = [0.767, 0.866, 1.04, 1.262, 1.312, 1.188, 0.965, 1.015, 0.99, 1.04, 0.817, 0.743];
const SYS_EFFICIENCY = 0.75;
const DEGRADE_PER_YEAR = 0.005; // 연 0.5% 열화
const YEARS = 20;

export function runProfitSim(p: SimParams): SimResult {
  const monthlyKwh = SEASON.map((c) => p.capacityKw * p.dailyIrr * c * 30.4 * SYS_EFFICIENCY);
  const annualKwh = monthlyKwh.reduce((a, b) => a + b, 0);

  const recPhysical = annualKwh / 1000;
  const recWeighted = recPhysical * p.recWeight;
  const smpRevenue = annualKwh * p.smp;
  const recRevenue = recWeighted * p.recPrice;

  const rows: SimYearRow[] = [];
  let totalGenKwh = 0;
  let totalRevenue = 0;
  let accumulated = 0;
  for (let year = 1; year <= YEARS; year++) {
    const eff = 1 - (year - 1) * DEGRADE_PER_YEAR;
    const gen = annualKwh * eff;
    const revenue = gen * p.smp + (gen / 1000) * p.recWeight * p.recPrice;
    accumulated += revenue;
    totalGenKwh += gen;
    totalRevenue += revenue;
    rows.push({ year, genMwh: gen / 1000, revenue, accumulated });
  }

  const toe = (totalGenKwh / 1000) * 0.229;
  const tco2 = toe * 2.37;
  const trees = tco2 * 151.5;

  return {
    monthlyKwh,
    annualKwh,
    recPhysical,
    recWeighted,
    smpRevenue,
    recRevenue,
    year1Total: smpRevenue + recRevenue,
    rows,
    totalGenKwh,
    totalRevenue,
    env: { toe, tco2, trees },
  };
}

/** 원 → 억/만원 축약 표기 */
export function won(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억원`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString('ko-KR')}만원`;
  return `${Math.round(v).toLocaleString('ko-KR')}원`;
}
