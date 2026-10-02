/**
 * 울산미포산단 태양광 사업성 시뮬레이터 v1.1 (RMS 분산에너지, 정건호) 계산 이식.
 * 무료진단 = 왼쪽 값 입력 → 오른쪽 사업 검토. 산식·단가·계수는 원본 HTML 그대로.
 *  - 자가소비용: 소비자가 설치비 + 추가 시공비를 전액 부담(국비 지원 없음) → J-curve 로 회수 시점
 *  - OnSite PPA: 사업자 투자 · 20년 2구간 단가(한전 연동 / 고정)
 */

/* ── 기상·요금 데이터 (원본 하드코딩) ── */
// 기상청 울산관측소 기후평년값(1991~2020) 월합계 일조시간 [h] — 월별 배분 비중
export const SUN = [192.8, 184.4, 200.9, 213.1, 221.4, 171.9, 155.7, 175.8, 159.0, 196.4, 183.6, 194.5];
const SUNTOT = SUN.reduce((a, b) => a + b, 0); // 2249.5
export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MNAME = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
export const SEASON = [2, 2, 1, 1, 1, 0, 0, 0, 1, 1, 2, 2]; // 0 여름(6~8), 1 봄가을(3~5,9~10), 2 겨울(11~2)
export const SEASON_NAME = ['여름 (6~8월)', '봄·가을 (3~5, 9~10월)', '겨울 (11~2월)'];

export type Plan = '1' | '2';
export type TariffVer = 'old' | 'new';
// 한전 산업용(을) 고압A 전력량요금 [원/kWh] — [여름, 봄가을, 겨울]
export const TARIFF: Record<TariffVer, Record<Plan, { base: number; light: number[]; mid: number[]; peak: number[] }>> = {
  old: {
    '1': { base: 7220, light: [116.4, 116.4, 123.4], mid: [169.3, 138.9, 169.5], peak: [251.4, 169.6, 227.0] },
    '2': { base: 8320, light: [110.9, 110.9, 117.9], mid: [163.8, 133.4, 164.0], peak: [245.9, 164.1, 221.5] },
  },
  new: {
    '1': { base: 7220, light: [121.5, 121.5, 128.5], mid: [169.3, 138.9, 169.5], peak: [234.5, 156.4, 210.1] },
    '2': { base: 8320, light: [116.0, 116.0, 123.0], mid: [163.8, 133.4, 164.0], peak: [229.0, 150.9, 204.6] },
  },
};
const PVSHARE: Record<TariffVer, { mid: number; peak: number }[]> = {
  new: [{ mid: 0.7, peak: 0.3 }, { mid: 0.7, peak: 0.3 }, { mid: 0.7, peak: 0.3 }],
  old: [{ mid: 0.48, peak: 0.52 }, { mid: 0.48, peak: 0.52 }, { mid: 0.55, peak: 0.45 }],
};
const CLIMATE_CHG = 9.0;
const FUEL_ADJ = 5.0;
const FUND = 0.037;
export const SELF_REMAIN = 320; // 자가소비 배정 잔여용량 kW
// 자가소비 사업비 기본값 — 원본 시뮬레이터 기본값(입력에서 바꿀 수 있음). 국비 지원은 없다 — 소비자가 전액 부담
export const SELF_CAPEX_UNIT = 1_350_000;
export const SELF_EXTRA_COST = 20_000_000;
export const SELF_OM = 1.0; // %/년, 총사업비 대비
export const PPA_REMAIN = 2670; // OnSite PPA 배정 잔여용량 kW
export const CAGR = 0.093; // 산업용 판매단가 실적 CAGR ('19~'25)
export const PLAN_LABEL: Record<Plan, string> = { '1': '고압A 선택Ⅰ', '2': '고압A 선택Ⅱ' };
export const VER_LABEL: Record<TariffVer, string> = { old: '2025-04 확정단가 (고시)', new: '2026-04 개편 (참고·계산값)' };

/** 기존 태양광 설비 — 이미 설치한 설비(기록용, 계산에는 안 들어감) */
export interface Facility {
  source: string;
  kw: number;
  genKwh: number; // 연간 발전량
  useKwh: number; // 연간 사용량
}

export interface PpaSegInput {
  linked: boolean; // 한전 대체단가 연동
  price: number; // 원/kWh
}

export interface SimInput {
  mode: 'self' | 'ppa';
  site: string;
  address: string;
  facilities: Facility[];
  // 공통
  roof: number; // 지붕 가용면적 ㎡
  areaPerKw: number;
  avgH: number; // 일평균 발전시간 h/일
  deg: number; // 모듈 효율감소율 %/yr
  kau: number; // 원/t
  kauEsc: number; // %/yr
  co2f: number; // t/MWh
  ets: boolean; // 배출권 할당대상업체
  // 자가소비
  // capexUnit·extraCost·om: 예전 기록에는 없을 수 있다 → 기본값
  self: { cap: number; ctr: number; usage: number; plan: Plan; ver: TariffVer; esc: number; peakR: number; capexUnit?: number; extraCost?: number; om?: number };
  // OnSite PPA
  ppa: { cap: number; plan: Plan; ver: TariffVer; esc: number; peakR: number; b1: number; b2: number; segs: [PpaSegInput, PpaSegInput, PpaSegInput]; ppaEsc: number };
}

export function defaultSimInput(site = '', address = ''): SimInput {
  return {
    mode: 'self',
    site,
    address,
    facilities: [],
    roof: 0,
    areaPerKw: 10,
    avgH: 3.82,
    deg: 0.5,
    kau: 30000,
    kauEsc: 0,
    co2f: 0.4173,
    ets: false,
    self: { cap: 320, ctr: 10000, usage: 3_000_000, plan: '2', ver: 'old', esc: 2.5, peakR: 30, capexUnit: SELF_CAPEX_UNIT, extraCost: SELF_EXTRA_COST, om: SELF_OM },
    ppa: {
      cap: 1000,
      plan: '2',
      ver: 'old',
      esc: 2.5,
      peakR: 30,
      b1: 5,
      b2: 20,
      segs: [
        { linked: true, price: 150 },
        { linked: false, price: 150 },
        { linked: false, price: 150 },
      ],
      ppaEsc: 0,
    },
  };
}

/* ── 계산 ── */
/** 계절별 태양광 대체단가(원/kWh) */
export function saveUnit(season: number, plan: Plan, ver: TariffVer) {
  const t = TARIFF[ver][plan];
  const s = PVSHARE[ver][season]!;
  return (t.mid[season]! * s.mid + t.peak[season]! * s.peak + CLIMATE_CHG + FUEL_ADJ) * (1 + FUND);
}
/** 1차년 한전 태양광 대체단가(원/kWh) — 월별 일조시간 가중 평균. PPA 연동 구간의 기준 단가 */
export function avgSaveUnit(plan: Plan, ver: TariffVer) {
  return SUN.reduce((a, h, m) => a + h * saveUnit(SEASON[m]!, plan, ver), 0) / SUNTOT;
}
/** 사업 검토서 번호 — SR-연도-일련번호 */
export const reviewNo = (id: number, createdAt: string) => `SR-${createdAt.slice(0, 4)}-${String(id).padStart(4, '0')}`;
/** 월별 1차년 발전량 [kWh] — 연간 = cap×avgH×365, 월별은 일조시간 비중 배분 */
/** 자가소비 사업비 — 국비 지원 없음. 소비자 부담 = 설치용량 × 설치단가 + 추가 시공비 */
export function selfCost(i: SimInput) {
  const install = i.self.cap * (i.self.capexUnit ?? SELF_CAPEX_UNIT);
  const extra = i.self.extraCost ?? SELF_EXTRA_COST;
  return { install, extra, consumer: install + extra };
}
const monthlyGen = (cap: number, avgH: number) => SUN.map((h) => (cap * avgH * 365 * h) / SUNTOT);

export interface PpaSeg extends PpaSegInput {
  idx: number;
  start: number;
  end: number;
}
export function ppaSegs(i: SimInput): PpaSeg[] {
  // 구간은 둘 — 1구간(1~b1년차) · 2구간(b1+1~20년차). 3구간은 쓰지 않는다
  const b1 = i.ppa.b1;
  const b2 = 20;
  return (
    [
      [1, b1],
      [b1 + 1, b2],
      [b2 + 1, 20],
    ] as const
  ).map((r, k) => ({ idx: k + 1, start: r[0], end: r[1], ...i.ppa.segs[k]! }));
}
const segOf = (segs: PpaSeg[], y: number) => segs.find((x) => y >= x.start && y <= x.end) ?? segs[segs.length - 1]!;
// 고정단가 구간: 구간 시작연차 기준 상승률 누적. 연동 구간: null (월별 한전 대체단가 적용)
const ppaUnitForYear = (seg: PpaSeg, y: number, esc: number) => (seg.linked ? null : seg.price * Math.pow(1 + esc, y - seg.start));
export const segLabel = (sg: { start: number; end: number }) =>
  sg.end < sg.start ? '미사용' : sg.start === sg.end ? `${sg.start}년차` : `${sg.start}~${sg.end}년차`;

export interface SelfYear {
  y: number; gen: number; eSave: number; bSave: number; save: number; om: number; net: number; cum: number; co2: number; cumCo2: number; carbon: number; cumCarbon: number;
}
export interface PpaYear {
  y: number; seg: number; linked: boolean; ku: number; pu: number; gen: number; kep: number; ppaAmt: number; bSave: number; saveD: number; cumD: number; co2: number; cumCo2: number; carbon: number; cumCarbon: number; saveT: number; cumT: number;
}
export interface SelfResult {
  mode: 'self'; cap: number; plan: Plan; ver: TariffVer; esc: number; degR: number; usage: number; baseSaveM: number; mg: number[];
  mrows: { su: number; self: number; surplus: number }[]; annualGen1: number; selfRatio: number;
  install: number; extra: number; consumer: number; // 설치비 · 추가 시공비 · 소비자 부담(합)
  ets: boolean; kau: number; co2f: number; cumCarbon: number; years: SelfYear[]; cumSave: number; cumGen: number; cumCo2: number; payback: number | null;
  save1: number; eSave1: number; bSave1: number; carbon1: number;
}
export interface PpaResult {
  mode: 'ppa'; cap: number; plan: Plan; ver: TariffVer; esc: number; degR: number; baseSaveM: number; segs: PpaSeg[]; ppaEsc: number; ets: boolean; kau: number; co2f: number;
  mg: number[]; mrows: { su: number; kepco: number; ppaCost: number }[]; annualGen1: number; years: PpaYear[]; cumSaveD: number; cumGen: number; cumCo2: number; cumCarbon: number; cumT: number;
  saveD1: number; avgSu: number; avgPu: number; avgKu: number; firstFixed: PpaYear | null; sumKep: number; sumPpa: number;
}
export type SimResult = SelfResult | PpaResult;

/** escOv: 한전요금 상승률 덮어쓰기(시나리오), 없으면 입력값 */
export function calc(i: SimInput, escOv?: number): SimResult {
  const avgH = i.avgH;
  const degR = i.deg / 100;
  const co2f = i.co2f || 0.4173;
  const kau = i.kau;
  const kauEsc = i.kauEsc / 100;
  const ets = i.ets;
  if (i.mode === 'self') {
    const { cap, usage, plan, ver } = i.self;
    const esc = escOv !== undefined ? escOv : i.self.esc / 100;
    const peakR = i.self.peakR / 100;
    const base = TARIFF[ver][plan].base;
    const mg = monthlyGen(cap, avgH);
    const annualGen1 = mg.reduce((a, b) => a + b, 0);
    const baseSaveM = base * cap * peakR * (1 + FUND); // 월 기본요금 절감
    const mrows = mg.map((g, m) => {
      const su = saveUnit(SEASON[m]!, plan, ver);
      return { su, self: Math.min(g, usage), surplus: Math.max(0, g - usage) };
    });
    const selfRatio = annualGen1 > 0 ? mrows.reduce((a, r) => a + r.self, 0) / annualGen1 : 0;
    const years: SelfYear[] = [];
    const omR = (i.self.om ?? SELF_OM) / 100;
    const { install, extra, consumer } = selfCost(i);
    // J-curve — 소비자 부담에서 마이너스로 시작해 매년 순절감(절감 - O&M)을 쌓는다
    let cum = -consumer, cumSave = 0, cumGen = 0, cumCo2 = 0, cumCarbon = 0;
    let payback: number | null = null;
    for (let y = 1; y <= 20; y++) {
      const df = Math.max(0, 1 - degR * (y - 1));
      const ef = Math.pow(1 + esc, y - 1);
      let gen = 0, eSave = 0;
      mrows.forEach((r, m) => {
        const g = mg[m]! * df;
        gen += g;
        eSave += Math.min(g, usage) * r.su * ef;
      });
      const bSave = baseSaveM * 12 * ef;
      const co2 = (gen / 1000) * co2f;
      const carbon = co2 * kau * Math.pow(1 + kauEsc, y - 1);
      const save = eSave + bSave + (ets ? carbon : 0);
      const om = consumer * omR; // O&M 은 사업비(소비자 부담) 대비
      const net = save - om;
      cum += net; cumSave += save; cumGen += gen; cumCo2 += co2; cumCarbon += carbon;
      if (payback === null && cum >= 0) payback = y;
      years.push({ y, gen, eSave, bSave, save, om, net, cum, co2, cumCo2, carbon, cumCarbon });
    }
    return {
      mode: 'self', cap, plan, ver, esc, degR, usage, baseSaveM, mg, mrows, annualGen1, selfRatio, install, extra, consumer, ets, kau, co2f, cumCarbon,
      years, cumSave, cumGen, cumCo2, payback, save1: years[0]!.save, eSave1: years[0]!.eSave, bSave1: years[0]!.bSave, carbon1: years[0]!.carbon,
    };
  }
  const { cap, plan, ver } = i.ppa;
  const ppaEsc = i.ppa.ppaEsc / 100;
  const segs = ppaSegs(i);
  const esc = escOv !== undefined ? escOv : i.ppa.esc / 100;
  const peakR = i.ppa.peakR / 100;
  const base = TARIFF[ver][plan].base;
  const mg = monthlyGen(cap, avgH);
  const annualGen1 = mg.reduce((a, b) => a + b, 0);
  const baseSaveM = base * cap * peakR * (1 + FUND);
  const u1 = ppaUnitForYear(segOf(segs, 1), 1, ppaEsc);
  const mrows = mg.map((g, m) => {
    const su = saveUnit(SEASON[m]!, plan, ver);
    const pu = u1 === null ? su : u1;
    return { su, kepco: g * su, ppaCost: g * pu };
  });
  const years: PpaYear[] = [];
  let cumSaveD = 0, cumGen = 0, cumCo2 = 0, cumCarbon = 0, cumT = 0, sumKep = 0, sumPpa = 0;
  for (let y = 1; y <= 20; y++) {
    const df = Math.max(0, 1 - degR * (y - 1));
    const kf = Math.pow(1 + esc, y - 1);
    const seg = segOf(segs, y);
    const pu = ppaUnitForYear(seg, y, ppaEsc);
    let gen = 0, kep = 0, ppaAmt = 0;
    mrows.forEach((r, m) => {
      const g = mg[m]! * df;
      gen += g;
      const k = g * r.su * kf;
      kep += k;
      ppaAmt += pu === null ? k : g * pu;
    });
    const bSave = baseSaveM * 12 * kf;
    const saveD = kep - ppaAmt + bSave; // 전기요금 절감 (전력량 + 기본요금)
    const co2 = (gen / 1000) * co2f;
    const carbon = co2 * kau * Math.pow(1 + kauEsc, y - 1);
    const saveT = saveD + (ets ? carbon : 0); // 배출권 합산 절감 (할당업체일 때)
    cumSaveD += saveD; cumGen += gen; cumCo2 += co2; cumCarbon += carbon; cumT += saveT; sumKep += kep; sumPpa += ppaAmt;
    years.push({ y, seg: seg.idx, linked: seg.linked, ku: gen ? kep / gen : 0, pu: gen ? ppaAmt / gen : 0, gen, kep, ppaAmt, bSave, saveD, cumD: cumSaveD, co2, cumCo2, carbon, cumCarbon, saveT, cumT });
  }
  const avgSu = annualGen1 ? mrows.reduce((a, r) => a + r.kepco, 0) / annualGen1 : 0;
  return {
    mode: 'ppa', cap, plan, ver, esc, degR, baseSaveM, segs, ppaEsc, ets, kau, co2f, mg, mrows, annualGen1, years, cumSaveD, cumGen, cumCo2, cumCarbon, cumT,
    saveD1: years[0]!.saveD, avgSu, avgPu: cumGen ? sumPpa / cumGen : 0, avgKu: cumGen ? sumKep / cumGen : 0, firstFixed: years.find((r) => !r.linked) ?? null, sumKep, sumPpa,
  };
}

export const escInput = (i: SimInput) => (i.mode === 'self' ? i.self.esc : i.ppa.esc) / 100;
export const SCEN_COLOR = ['#94a3b8', '#3b82f6', '#10b981'];
/** 한전요금 시나리오 — 동결 0% / 입력값 / 실적 CAGR 9.3% */
export function scenarios(i: SimInput) {
  const e = escInput(i);
  return [
    { e: 0, name: '한전요금 동결 (0%)', R: calc(i, 0) },
    { e, name: `상승분 반영 · 입력값 (${(e * 100).toFixed(1)}%)`, R: calc(i, e) },
    { e: CAGR, name: '실적 CAGR (9.3%)', R: calc(i, CAGR) },
  ];
}

/** 선택 연차의 월별 상세 */
export function monthlyFor(R: SimResult, y: number) {
  const df = Math.max(0, 1 - R.degR * (y - 1));
  const ef = Math.pow(1 + R.esc, y - 1);
  if (R.mode === 'self') {
    return R.mrows.map((r, m) => {
      const g = R.mg[m]! * df;
      const self = Math.min(g, R.usage);
      const eSave = self * r.su * ef;
      const bSave = R.baseSaveM * ef;
      return { g, self, su: r.su * ef, pu: 0, kepco: 0, ppaCost: 0, eSave, bSave, save: eSave + bSave };
    });
  }
  const seg = segOf(R.segs, y);
  const pu = ppaUnitForYear(seg, y, R.ppaEsc);
  return R.mrows.map((r, m) => {
    const g = R.mg[m]! * df;
    const kepco = g * r.su * ef;
    const ppaCost = pu === null ? kepco : g * pu;
    const bSave = R.baseSaveM * ef;
    return { g, self: g, su: r.su * ef, pu: g ? ppaCost / g : 0, kepco, ppaCost, eSave: 0, bSave, save: kepco - ppaCost + bSave };
  });
}
export const segOfYear = (R: PpaResult, y: number) => segOf(R.segs, y);

/* ── 표기 ── */
export const F = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const F1 = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const F2 = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const EOK = (n: number) => (n / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
