/**
 * 연료전지 · ORC 모니터링 — 태그 정의 + 데모 값
 *
 * 태그 근거: 에자자 모니터링 data_연료전지_261029.xlsx · data_ORC_261029.xlsx (2026-10-29 수령)
 *  - 연료전지: #1 · #2 · #3 호기 × 11개 태그(온수 유량 · 온도 · 운전 대수 · 발전 · 열량 · 효율). DCS → WAGO PLC(ORC) 로 들어온다
 *  - ORC: 전력(MOF · ACB) + Group1 온수(Hot Loop) · 냉각(Cold Loop · 드라이쿨러 10대) + ORC#1~#12 모듈 태그
 * 용량 근거: 3차년도 사업계획서 — 연료전지 39.6MW(p.-6 · 28), ORC 180kW 모듈 2그룹 × 6대(p.45~46)
 *
 * 값은 데모 시드 — 실제 수집 전까지 아래 식으로 만든다(같은 시각이면 늘 같은 값).
 *  - 연료전지: 운전 대수 × 대당 출력(39.6MW ÷ 117대) × 부하율, 열량 = 발전 ÷ 전기효율 × 열효율, 유량 = 열량 ÷ ΔT
 *  - ORC: 외기 온도(울산 월평균 + 일교차) → 냉각수 온도 → 모듈 출력, 드라이쿨러 가동률 → 팬 전력(세제곱) + 펌프 = 소내 소비
 */

export const FC_CAPACITY_KW = 39_600;
export const ORC_MODULE_KW = 180;
export const ORC_MODULES = 12;
export const ORC_CAPACITY_KW = ORC_MODULE_KW * ORC_MODULES; // 2,160 kW

/* ── 결정적 잡음 ─────────────────────────────────────────── */
const noise = (n: number, salt: number) => {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
/** -1 ~ 1 사이, 10분 단위로 부드럽게 바뀜 */
const wobble = (t: Date, salt: number) => {
  const step = Math.floor(t.getTime() / 600_000);
  const f = (t.getTime() % 600_000) / 600_000;
  const a = noise(step, salt) * 2 - 1;
  const b = noise(step + 1, salt) * 2 - 1;
  return a + (b - a) * f;
};
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** 울산 월평균 기온(℃) — 기상청 평년값 근사, 데모 시드 */
const MONTH_TEMP = [3.2, 5.0, 9.2, 14.3, 18.6, 21.9, 25.6, 26.6, 22.6, 17.5, 11.3, 5.3];
export function ambientAt(t: Date): number {
  const h = t.getHours() + t.getMinutes() / 60;
  const mean = MONTH_TEMP[t.getMonth()] ?? 15;
  return mean + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + wobble(t, 91) * 0.6; // 15시 최고 · 3시 최저
}

/* ── 연료전지 ─────────────────────────────────────────────── */

export interface FuelCellUnit {
  no: 1 | 2 | 3;
  /** U1-ORC-FCRUN-TOTAL 등 — 운전 대수 / 설치 대수(태그 범위 0~36 · 0~45 · 0~36) */
  running: number;
  installed: number;
  powerKw: number; // KW-TOTAL
  heatGcalH: number; // EIT
  heatTotalGcal: number; // EQIT
  flowM3h: number; // FIT
  flowTotalM3: number; // FQIT
  supplyTemp: number; // TIT-x2001
  returnTemp: number; // TIT-x3001
  elecEff: number; // ELEC-EFFI
  heatEff: number; // HEAT-EFFI
  totalEff: number; // TOTAL-EFFI
}

const FC_SPEC = [
  { no: 1 as const, installed: 36, running: 36, elec: 42.1, heat: 36.0, dT: 20 },
  { no: 2 as const, installed: 45, running: 44, elec: 41.6, heat: 25.5, dT: 18 },
  { no: 3 as const, installed: 36, running: 36, elec: 42.4, heat: 30.5, dT: 19 },
];
const FC_PER_CELL_KW = FC_CAPACITY_KW / FC_SPEC.reduce((s, u) => s + u.installed, 0);
/** 누적 태그 기준일 — 데모 시드 */
const FC_TOTAL_FROM = new Date('2025-01-01T00:00:00').getTime();

export function fuelCellAt(t: Date): FuelCellUnit[] {
  const hours = Math.max(0, (t.getTime() - FC_TOTAL_FROM) / 3_600_000) * 0.95;
  return FC_SPEC.map((u) => {
    const load = 0.94 + wobble(t, u.no * 7) * 0.012;
    const powerKw = u.running * FC_PER_CELL_KW * load;
    const elecEff = u.elec + wobble(t, u.no * 11) * 0.15;
    const heatEff = u.heat + wobble(t, u.no * 13) * 0.3;
    const heatGcalH = ((powerKw / (elecEff / 100)) * (heatEff / 100)) / 1163;
    const supplyTemp = 87.5 + wobble(t, u.no * 17) * 0.6;
    const dT = u.dT + wobble(t, u.no * 19) * 0.4;
    const flowM3h = (heatGcalH * 1000) / dT;
    return {
      no: u.no,
      running: u.running,
      installed: u.installed,
      powerKw: r1(powerKw),
      heatGcalH: r2(heatGcalH),
      heatTotalGcal: Math.round(heatGcalH * hours),
      flowM3h: r1(flowM3h),
      flowTotalM3: Math.round(flowM3h * hours),
      supplyTemp: r1(supplyTemp),
      returnTemp: r1(supplyTemp - dT),
      elecEff: r1(elecEff),
      heatEff: r1(heatEff),
      totalEff: r1(elecEff + heatEff),
    };
  });
}

/* ── ORC ──────────────────────────────────────────────────── */

export interface OrcModule {
  no: number; // 1~12
  group: 1 | 2;
  powerKw: number; // ENO-ORCxx-xxx (ORC#n Power)
  hotIn: number; // TT-11
  hotOut: number; // TT-12
  coldIn: number; // TT-21
  coldOut: number; // TT-22
  /** 설명 없이 태그 · 단위만 받은 측정값 — 이름은 태그 그대로 보여준다 */
  tags: { tag: string; unit: string; value: number }[];
}

export interface OrcLoop {
  /** Group1 Hot Loop */
  hotReturnFlow: number; // ENO-H1-FI-01 m3/h
  hotReturnFlowTotal: number; // ENO-H1-FI-01-TOTAL m3
  hotReturnPress: number; // ENO-H1-PI-07 kg/cm2.g
  hotSupplyTemp: number; // ENO-H1-TI-01 ℃
  hotPumpPress: number; // ENO-H1-PT-01
  hotPumpCurrent: number; // ENO-H1-YI-01 A
  /** Group1 Cold Loop */
  coldPumpPress: number; // ENO-C1-PT-01
  coldPumpCurrent: number; // ENO-C1-YI-01 A
  dryCoolers: number[]; // ENO-C1-A-01~10 %
}

export interface OrcSnapshot {
  modules: OrcModule[];
  /** MOF Total Power Supply */
  supplyKw: number;
  /** ACB */
  grossKw: number;
  netKw: number;
  group1GrossKw: number;
  group1NetKw: number;
  loop: OrcLoop;
  /** 1그룹 회수 열량(Gcal/h) = 회수 유량 × (입구 − 출구 평균 온도) ÷ 1000 */
  group1HeatGcalH: number;
}

const ORC_TOTAL_FROM = new Date('2026-07-01T00:00:00').getTime(); // 1그룹 상업운전(사업계획서 p.46 '26.07~)

function orcModuleAt(t: Date, no: number): OrcModule {
  const group: 1 | 2 = no <= 6 ? 1 : 2;
  const amb = ambientAt(t);
  const coldIn = amb + 8 + wobble(t, no * 23) * 0.3; // 드라이쿨러 접근 온도
  const coldOut = coldIn + 7 + wobble(t, no * 29) * 0.3;
  const hotIn = 87 + wobble(t, no * 31) * 0.5;
  const hotOut = hotIn - (16 + (noise(no, 5) - 0.5) * 1.6 + wobble(t, no * 37) * 0.3);
  const ratio = 0.86 - (coldIn - 20) * 0.012 + (noise(no, 3) - 0.5) * 0.04 + wobble(t, no * 41) * 0.008;
  const powerKw = ORC_MODULE_KW * Math.min(0.95, Math.max(0.5, ratio));
  const p = `ENO-ORC${String(no).padStart(2, '0')}`;
  const rpm = 18_000 + (powerKw / ORC_MODULE_KW) * 6_000;
  const v = (salt: number, base: number, span: number) => r1(base + wobble(t, no * 100 + salt) * span);
  return {
    no,
    group,
    powerKw: r1(powerKw),
    hotIn: r1(hotIn),
    hotOut: r1(hotOut),
    coldIn: r1(coldIn),
    coldOut: r1(coldOut),
    tags: [
      { tag: `${p}-TT03A`, unit: '℃', value: v(1, hotIn - 6, 0.4) },
      { tag: `${p}-TT03B`, unit: '℃', value: v(2, hotIn - 6.3, 0.4) },
      { tag: `${p}-PT03`, unit: 'kg/cm2.g', value: v(3, 9.4, 0.15) },
      { tag: `${p}-PT04`, unit: 'kg/cm2.g', value: v(4, 2.1, 0.06) },
      { tag: `${p}-TT04`, unit: '℃', value: v(5, coldOut + 9, 0.4) },
      { tag: `${p}-TT01`, unit: '℃', value: v(6, coldIn + 3, 0.3) },
      { tag: `${p}-PO01`, unit: 'kg/cm2.g', value: v(7, 3.6, 0.08) },
      { tag: `${p}-TT51A`, unit: '℃', value: v(8, 54 + (noise(no, 8) - 0.5) * 4, 0.5) },
      { tag: `${p}-TT51B`, unit: '℃', value: v(9, 55 + (noise(no, 9) - 0.5) * 4, 0.5) },
      { tag: `${p}-TS-60A`, unit: 'RPM', value: Math.round(rpm + wobble(t, no * 100 + 10) * 40) },
      { tag: `${p}-TS-60A`, unit: 'RPM', value: Math.round(rpm + wobble(t, no * 100 + 11) * 40) }, // 원본 태그 이름 중복(60A 두 번)
      { tag: `${p}-VT-61A`, unit: 'mm/s', value: r2(1.4 + (noise(no, 12) - 0.5) * 0.6 + wobble(t, no * 100 + 12) * 0.1) },
      { tag: `${p}-VT-61B`, unit: 'mm/s', value: r2(1.3 + (noise(no, 13) - 0.5) * 0.6 + wobble(t, no * 100 + 13) * 0.1) },
      { tag: `${p}-CurrentA`, unit: 'A', value: v(14, (powerKw * 1000) / (1.732 * 400 * 0.95), 1.5) },
      { tag: `${p}-CurrentB`, unit: 'A', value: v(15, (powerKw * 1000) / (1.732 * 400 * 0.95), 1.5) },
      { tag: `${p}-TT30`, unit: '℃', value: v(16, coldIn + 14, 0.4) },
      { tag: `${p}-TT31`, unit: '℃', value: v(17, coldIn + 12, 0.4) },
      { tag: `${p}-PT40`, unit: 'kg/cm2.g', value: v(18, 2.8, 0.06) },
      { tag: `${p}-PO40`, unit: 'kg/cm2.g', value: v(19, 3.1, 0.06) },
    ],
  };
}

/** 그룹 하나의 소내 소비(kW) — 온수 · 냉각 펌프 + 드라이쿨러 10대(정격 15kW, 가동률 세제곱) */
function groupAux(dryCoolers: number[], hotPumpA: number, coldPumpA: number): number {
  const pumpKw = (a: number) => (1.732 * 380 * a * 0.85) / 1000;
  const fans = dryCoolers.reduce((s, pct) => s + 15 * (pct / 100) ** 3, 0);
  return pumpKw(hotPumpA) + pumpKw(coldPumpA) + fans;
}

function dryCoolersAt(t: Date, salt: number): number[] {
  const amb = ambientAt(t);
  const base = Math.min(100, Math.max(20, 30 + (amb - 5) * 2.6));
  return Array.from({ length: 10 }, (_, i) => Math.round(Math.min(100, Math.max(15, base + (noise(i, salt) - 0.5) * 8 + wobble(t, salt + i) * 2))));
}

export function orcAt(t: Date): OrcSnapshot {
  const modules = Array.from({ length: ORC_MODULES }, (_, i) => orcModuleAt(t, i + 1));
  const g1 = modules.filter((m) => m.group === 1);
  const g2 = modules.filter((m) => m.group === 2);
  const sum = (ms: OrcModule[]) => ms.reduce((s, m) => s + m.powerKw, 0);

  const dc1 = dryCoolersAt(t, 500);
  const dc2 = dryCoolersAt(t, 600);
  const hotPumpCurrent = 54 + wobble(t, 701) * 0.8;
  const coldPumpCurrent = 41 + wobble(t, 702) * 0.8;
  const aux1 = groupAux(dc1, hotPumpCurrent, coldPumpCurrent);
  const aux2 = groupAux(dc2, 54 + wobble(t, 703) * 0.8, 41 + wobble(t, 704) * 0.8);

  const group1GrossKw = sum(g1);
  const grossKw = group1GrossKw + sum(g2);
  const group1NetKw = group1GrossKw - aux1;
  const netKw = grossKw - aux1 - aux2;

  // 1그룹 회수 열량 — ORC 발전효율 약 10%(저온 ORC, 데모 시드)로 유량을 역산
  const dT = g1.reduce((s, m) => s + (m.hotIn - m.hotOut), 0) / g1.length;
  const heatGcalH = group1GrossKw / 0.1 / 1163;
  const hotReturnFlow = (heatGcalH * 1000) / dT;
  const hours = Math.max(0, (t.getTime() - ORC_TOTAL_FROM) / 3_600_000) * 0.97;

  return {
    modules,
    supplyKw: r1(netKw * 0.99), // 변압기 손실 1%
    grossKw: r1(grossKw),
    netKw: r1(netKw),
    group1GrossKw: r1(group1GrossKw),
    group1NetKw: r1(group1NetKw),
    group1HeatGcalH: r2(heatGcalH),
    loop: {
      hotReturnFlow: r1(hotReturnFlow),
      hotReturnFlowTotal: Math.round(hotReturnFlow * hours),
      hotReturnPress: r2(2.4 + wobble(t, 705) * 0.03),
      hotSupplyTemp: r1(g1.reduce((s, m) => s + m.hotIn, 0) / g1.length + 0.6),
      hotPumpPress: r2(4.2 + wobble(t, 706) * 0.04),
      hotPumpCurrent: r1(hotPumpCurrent),
      coldPumpPress: r2(3.6 + wobble(t, 707) * 0.04),
      coldPumpCurrent: r1(coldPumpCurrent),
      dryCoolers: dc1,
    },
  };
}

/* ── 금일 추이 · 금일 전력량 ────────────────────────────────── */

/** 금일 0시부터 t 까지 10분 간격 시각 */
export function todaySteps(t: Date): Date[] {
  const start = new Date(t);
  start.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  for (let ms = start.getTime(); ms <= t.getTime(); ms += 600_000) out.push(new Date(ms));
  return out;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function fuelCellToday(t: Date) {
  return todaySteps(t).map((d) => {
    const u = fuelCellAt(d);
    return {
      time: hhmm(d),
      p1: u[0]!.powerKw,
      p2: u[1]!.powerKw,
      p3: u[2]!.powerKw,
      h1: u[0]!.heatGcalH,
      h2: u[1]!.heatGcalH,
      h3: u[2]!.heatGcalH,
    };
  });
}

export function orcToday(t: Date) {
  return todaySteps(t).map((d) => {
    const s = orcAt(d);
    return { time: hhmm(d), gross: s.grossKw, net: s.netKw, supply: s.supplyKw };
  });
}

/** 금일 전력량(kWh) — 10분 간격 kW 의 합 ÷ 6 */
export function fuelCellTodayKwh(t: Date): number {
  return Math.round(todaySteps(t).reduce((s, d) => s + fuelCellAt(d).reduce((a, u) => a + u.powerKw, 0), 0) / 6);
}
export function orcTodayKwh(t: Date): { gross: number; supply: number } {
  let gross = 0;
  let supply = 0;
  for (const d of todaySteps(t)) {
    const s = orcAt(d);
    gross += s.grossKw;
    supply += s.supplyKw;
  }
  return { gross: Math.round(gross / 6), supply: Math.round(supply / 6) };
}
