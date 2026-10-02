/**
 * E-데이터마켓 목업 — 온실가스 인벤토리(/ghg/*)·카본 마켓플레이스(/carbon/*).
 * 훅(src/hooks/edm/useGhg·useGhgExt·useCarbon·useCarbonExt·useCarbonDelta)이 기대하는 Api* 모양 그대로 돌려준다.
 *
 * - 인벤토리는 전기사용자 한길(울산 남구 용연동 490-11, 자가소비 태양광 90.88kW) 기준 — companyId 와 무관하게 같은 데이터
 * - 카본 거래 상대·외부사업은 실제 대상 기업 5곳(한길·태성산업·건호이엔씨·한일튜브·용인금속)만 쓴다
 * - 등록·전이 버튼은 메모리 상태를 바꾼다(새로고침 시 초기화)
 */
import { registerMock } from './registry';
import { useAuthStore } from '@/stores/useAuthStore';
import { ELEC_FACTOR } from '@/mocks/edm/ghg';
import { VOLUNTARY_MARKETS } from '@/mocks/edm/carbon';
import type {
  Bulletin,
  BulletinThread,
  VcmCredit,
  Methodology,
  EtsPlanParam,
  KcuLedgerEntry,
} from '@/hooks/edm/useCarbonDelta';
import type { ApiConversion } from '@/hooks/edm/useCarbonExt';

/* ── 공통 ─────────────────────────────────────────────── */
const pad = (n: number) => String(n).padStart(2, '0');
/** 오늘 날짜 2026-10-02 */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 지금 시각 2026-10-02T10:00:00 */
function nowIso(): string {
  const d = new Date();
  return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const asObj = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : fallback;
};
/** 백엔드 오류 응답 모양(response.data.error.message) — 화면이 메시지를 그대로 띄운다 */
function apiError(message: string): Error {
  return Object.assign(new Error(message), { response: { data: { error: { message } } } });
}
const loginCompanyName = (): string => useAuthStore.getState().user?.companyName ?? '';

/* 실제 대상 기업 5곳 — 자가소비 태양광 용량(kW) */
const COMPANIES = [
  { name: '한길', capacityKw: 90.88, address: '울산 남구 용연동 490-11' },
  { name: '태성산업', capacityKw: 46.08, address: '울산 남구 여천동 358-8' },
  { name: '건호이엔씨', capacityKw: 33.92, address: '울산 남구 부곡동 22-5' },
  { name: '한일튜브', capacityKw: 429.44, address: '울산 남구 부곡동 273-6' }, // 자가소비 99.84 + onsite 329.6
  { name: '용인금속', capacityKw: 152.32, address: '울산 남구 여천동 887-18' },
] as const;
const capacityOf = (name: string) => COMPANIES.find((c) => c.name === name)?.capacityKw ?? 0;
/** 태양광 감축량(tCO₂eq) — 일 3.4시간 이용 × 일수 × 전력계수 */
const solarReduction = (capacityKw: number, days: number) => round1(((capacityKw * 3.4 * days) / 1000) * ELEC_FACTOR);

/* ══════════════════════════════════════════════════════════
 * 온실가스 인벤토리 (/ghg/*)
 * ══════════════════════════════════════════════════════════ */
const GHG_SITE = '한길'; // 사업장 마스터(/consumer/sites) 이름과 같게

/* ── 배출계수 ── (검증 체크리스트 "validFrom ≥ 2021" 통과하도록 전부 2021 이후) */
interface ApiFactor {
  id: number;
  code: string;
  name: string;
  factor: number;
  unit: string;
  tier: number;
  source: string;
  validFrom: string;
  version: string;
}
const FACTORS: ApiFactor[] = [
  { id: 1, code: 'GHG_ELEC', name: '구매전력 (Scope 2)', factor: ELEC_FACTOR, unit: 'tCO₂eq/MWh', tier: 1, source: 'NATIONAL', validFrom: '2021-01-01', version: 'v2021.1' },
  { id: 2, code: 'FUEL_LNG', name: '고정연소 LNG', factor: 56.1, unit: 'tCO₂/TJ', tier: 2, source: 'IPCC', validFrom: '2021-01-01', version: 'v2021.1' },
  { id: 3, code: 'FUEL_DIESEL', name: '이동연소 경유', factor: 2.582, unit: 'tCO₂/kL', tier: 1, source: 'IPCC', validFrom: '2021-01-01', version: 'v2021.1' },
  { id: 4, code: 'FUEL_HEAVYOIL', name: '고정연소 중유(B-C유)', factor: 3.1, unit: 'tCO₂/kL', tier: 1, source: 'IPCC', validFrom: '2021-01-01', version: 'v2021.1' },
  { id: 5, code: 'FUEL_LPG', name: '고정연소 LPG', factor: 3.0, unit: 'tCO₂/t', tier: 1, source: 'IPCC', validFrom: '2021-01-01', version: 'v2021.1' },
  { id: 6, code: 'STEAM', name: '외부 스팀 (Scope 2)', factor: 0.0752, unit: 'tCO₂/GJ', tier: 2, source: 'NATIONAL', validFrom: '2021-01-01', version: 'v2021.1' },
];
/** 같은 코드는 최신 validFrom 계수 */
function factorByCode(code: string): number {
  const list = FACTORS.filter((f) => f.code === code).sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  return list[0]?.factor ?? 0;
}

/* ── 배출원 ── */
interface ApiSource {
  id: number;
  site: string;
  facility: string;
  scope: number;
  category: string;
  tier: number;
  fuelFactor: number | null;
}
const SOURCES: ApiSource[] = [
  { id: 1, site: GHG_SITE, facility: '수전설비(한전)', scope: 2, category: '구매전력', tier: 1, fuelFactor: null },
  { id: 2, site: GHG_SITE, facility: '보일러(LNG)', scope: 1, category: '고정연소', tier: 2, fuelFactor: null },
  { id: 3, site: GHG_SITE, facility: '지게차(경유)', scope: 1, category: '이동연소', tier: 1, fuelFactor: null },
];
let sourceSeq = SOURCES.length;

/* ── 활동자료 ── (2026 · 증빙 전부 첨부 — 검증 체크리스트 통과) */
interface ApiActivity {
  id: number;
  sourceId: number;
  year: number;
  type: string;
  amount: number;
  unit: string;
  isAuto: boolean;
  evidence: string | null;
}
const ACTIVITIES: ApiActivity[] = [
  { id: 1, sourceId: 1, year: 2026, type: 'ELEC', amount: 2180, unit: 'MWh', isAuto: true, evidence: '한전 전기요금 청구서_2026.pdf' },
  { id: 2, sourceId: 2, year: 2026, type: 'FUEL', amount: 2.6, unit: 'TJ', isAuto: false, evidence: '도시가스 요금고지서_2026.pdf' },
  { id: 3, sourceId: 3, year: 2026, type: 'FUEL', amount: 20.1, unit: 'kL', isAuto: false, evidence: '경유 구매내역_2026.xlsx' },
];
let activitySeq = ACTIVITIES.length;

/** 활동 1건의 계수 — 전력·스팀은 국가계수, 연료는 배출원 실측계수 → 단위·분류별 기본계수 */
function factorOf(src: ApiSource | undefined, a: ApiActivity): number {
  if (a.type === 'ELEC') return factorByCode('GHG_ELEC');
  if (a.type === 'STEAM') return factorByCode('STEAM');
  if (src?.fuelFactor != null) return src.fuelFactor;
  if (a.unit === 'kL') return factorByCode(src?.category === '이동연소' ? 'FUEL_DIESEL' : 'FUEL_HEAVYOIL');
  if (a.unit === 't') return factorByCode('FUEL_LPG');
  return factorByCode('FUEL_LNG');
}

/* ── 산정 ── */
function calculation(year: number) {
  const rows = ACTIVITIES.filter((a) => a.year === year).map((a) => {
    const src = SOURCES.find((s) => s.id === a.sourceId);
    const factor = factorOf(src, a);
    return {
      sourceId: a.sourceId,
      facility: src?.facility ?? '',
      scope: src?.scope ?? (a.type === 'FUEL' ? 1 : 2),
      activity: a.amount,
      unit: a.unit,
      factor,
      tCO2eq: round1(a.amount * factor),
    };
  });
  const scope1 = round1(rows.filter((r) => r.scope === 1).reduce((s, r) => s + r.tCO2eq, 0));
  const scope2 = round1(rows.filter((r) => r.scope === 2).reduce((s, r) => s + r.tCO2eq, 0));
  return { rows, scope1, scope2, total: round1(scope1 + scope2) };
}

/* ── 명세서 ── (2024·2025 검증완료, 2026 작성중) */
interface ApiStatement {
  id: number;
  year: number;
  status: string;
  scope1: number;
  scope2: number;
  total: number;
  submittedAt: string | null;
}
const STATEMENTS: ApiStatement[] = (() => {
  const t26 = calculation(2026);
  return [
    { id: 1, year: 2024, status: 'VERIFIED', scope1: 214.6, scope2: 1150.8, total: 1365.4, submittedAt: '2025-03-28' },
    { id: 2, year: 2025, status: 'VERIFIED', scope1: 205.3, scope2: 1104.9, total: 1310.2, submittedAt: '2026-03-27' },
    { id: 3, year: 2026, status: 'DRAFT', scope1: t26.scope1, scope2: t26.scope2, total: t26.total, submittedAt: null },
  ];
})();
let statementSeq = STATEMENTS.length;

/* ── 제3자 검증 ── */
interface ApiVerification {
  id: number;
  statementId: number;
  verifierOrg: string;
  isoStd: string;
  sharedAt: string | null;
  decision: string;
  note: string | null;
  uncertainty: number | null;
}
const VERIFICATIONS: ApiVerification[] = [
  { id: 1, statementId: 1, verifierOrg: '한국품질재단(KFQ)', isoStd: 'ISO 14064-3', sharedAt: '2025-03-10T10:00:00', decision: 'ISSUED', note: '한국품질재단(KFQ) 의견서 발급', uncertainty: 6.4 },
  { id: 2, statementId: 2, verifierOrg: '한국품질재단(KFQ)', isoStd: 'ISO 14064-3', sharedAt: '2026-03-09T10:00:00', decision: 'ISSUED', note: '한국품질재단(KFQ) 의견서 발급', uncertainty: 6.3 },
];
let verificationSeq = VERIFICATIONS.length;

/* ── Scope 3 ── (2026 · 미입력 카테고리는 빈 값) */
interface ApiScope3 {
  id: number;
  year: number;
  category: number;
  tco2: number;
  method: string;
  material: boolean;
  evidence: string | null;
}
const SCOPE3: ApiScope3[] = [
  { id: 1, year: 2026, category: 1, tco2: 820, method: 'PRIMARY', material: true, evidence: '원자재 구매내역_2026.xlsx' },
  { id: 2, year: 2026, category: 3, tco2: 95, method: 'SPEND', material: false, evidence: null },
  { id: 3, year: 2026, category: 4, tco2: 140, method: 'PRIMARY', material: true, evidence: '운송 위탁 실적_2026.xlsx' },
  { id: 4, year: 2026, category: 5, tco2: 18, method: 'SPEND', material: false, evidence: null },
  { id: 5, year: 2026, category: 6, tco2: 6, method: 'SPEND', material: false, evidence: null },
  { id: 6, year: 2026, category: 7, tco2: 22, method: 'SPEND', material: false, evidence: null },
];
let scope3Seq = SCOPE3.length;
const scope3Total = (year: number) => round1(SCOPE3.filter((s) => s.year === year).reduce((acc, s) => acc + s.tco2, 0));

/* ── 감축목표 ── (currentTco2·progressPct 는 서버 계산 — 2026 산정 총량 기준) */
const TARGET = { id: 1, baseYear: 2021, baseTco2: 1420, targetYear: 2030, targetTco2: 852 };
function targetRes() {
  const currentTco2 = calculation(2026).total;
  const span = TARGET.baseTco2 - TARGET.targetTco2;
  return {
    ...TARGET,
    currentTco2,
    progressPct: span > 0 ? Math.round(((TARGET.baseTco2 - currentTco2) / span) * 100) : null,
  };
}

/* ── CBAM ── (한길 제품 정보가 없어 등록 전 상태로 시작 — 화면에서 등록하면 쌓인다) */
interface ApiCbam {
  id: number;
  name: string;
  hsCode: string;
  outputT: number;
  embeddedTco2: number;
  method: string;
  euStatus: string;
}
const CBAM: ApiCbam[] = [];
let cbamSeq = 0;
/** 기본값 산정 — (직접배출 + 전력 × 국가계수) ÷ 생산량 = 제품 톤당 내재배출 */
function cbamEstimate(outputT: number, direct: number, elecMwh: number) {
  const elecFactorUsed = factorByCode('GHG_ELEC');
  const embeddedTco2 = outputT > 0 ? Math.round(((direct + elecMwh * elecFactorUsed) / outputT) * 1000) / 1000 : 0;
  return {
    embeddedTco2,
    elecFactorUsed,
    basis: `(직접배출 ${direct} + 전력 ${elecMwh} MWh × ${elecFactorUsed}) ÷ 생산량 ${outputT} t`,
  };
}

/* ── 공시 서술 ── (미입력이면 null) */
interface ApiNarrative {
  companyId: number;
  year: number;
  framework: string;
  governance: string | null;
  strategy: string | null;
  riskMgmt: string | null;
}
const NARRATIVES: ApiNarrative[] = [];

/* ── 감축실적 원장 ── (한길 태양광 KOC 모니터링 연계) */
interface ApiReductionActual {
  id: number;
  period: string;
  sourceType: string;
  sourceRefId: number | null;
  reducedTco2: number;
  note: string | null;
}
const REDUCTION_ACTUALS: ApiReductionActual[] = [
  { id: 1, period: '2025-H2', sourceType: 'KOC_MONITORING', sourceRefId: 1, reducedTco2: solarReduction(90.88, 184), note: '한길 태양광 90.88kW 자가소비' },
];
let reductionSeq = REDUCTION_ACTUALS.length;

/* ── 라우트: 인벤토리 ── */
registerMock(/^\/ghg\/factors$/, () => FACTORS, 'GET');
registerMock(
  /^\/ghg\/factors$/,
  ({ body }) => {
    const b = asObj(body);
    const f: ApiFactor = {
      id: FACTORS.length + 1,
      code: str(b.code),
      name: str(b.name),
      factor: num(b.factor),
      unit: str(b.unit),
      tier: num(b.tier, 1),
      source: str(b.source, 'NATIONAL'),
      validFrom: str(b.validFrom, today()),
      version: str(b.version),
    };
    FACTORS.push(f);
    return f;
  },
  'POST',
);

registerMock(/^\/ghg\/sources$/, () => SOURCES, 'GET');
registerMock(
  /^\/ghg\/sources$/,
  ({ body }) => {
    const b = asObj(body);
    const s: ApiSource = {
      id: ++sourceSeq,
      site: str(b.site, GHG_SITE),
      facility: str(b.facility),
      scope: num(b.scope, 1),
      category: str(b.category),
      tier: num(b.tier, 1),
      fuelFactor: b.fuelFactor == null ? null : num(b.fuelFactor),
    };
    SOURCES.push(s);
    return s;
  },
  'POST',
);
registerMock(
  /^\/ghg\/sources\/(\d+)$/,
  ({ match, body }) => {
    const s = SOURCES.find((x) => x.id === Number(match[1]));
    if (!s) throw apiError('배출원을 찾을 수 없습니다.');
    const b = asObj(body);
    s.site = str(b.site, s.site);
    s.facility = str(b.facility, s.facility);
    s.scope = num(b.scope, s.scope);
    s.category = str(b.category, s.category);
    s.tier = num(b.tier, s.tier);
    s.fuelFactor = b.fuelFactor == null ? null : num(b.fuelFactor);
    return s;
  },
  'PUT',
);
registerMock(
  /^\/ghg\/sources\/(\d+)$/,
  ({ match }) => {
    const id = Number(match[1]);
    // BE GH001 — 활동자료가 있는 배출원은 삭제 차단
    if (ACTIVITIES.some((a) => a.sourceId === id)) throw apiError('활동자료가 등록된 배출원은 삭제할 수 없습니다. (GH001)');
    const idx = SOURCES.findIndex((s) => s.id === id);
    if (idx >= 0) SOURCES.splice(idx, 1);
    return null;
  },
  'DELETE',
);

registerMock(
  /^\/ghg\/activities$/,
  ({ query }) => {
    const year = query.get('year');
    return ACTIVITIES.filter((a) => !year || a.year === Number(year));
  },
  'GET',
);
registerMock(
  /^\/ghg\/activities$/,
  ({ body }) => {
    const b = asObj(body);
    const a: ApiActivity = {
      id: ++activitySeq,
      sourceId: num(b.sourceId),
      year: num(b.year, 2026),
      type: str(b.type, 'FUEL'),
      amount: num(b.amount),
      unit: str(b.unit),
      isAuto: b.isAuto === true,
      evidence: typeof b.evidence === 'string' && b.evidence ? b.evidence : null,
    };
    ACTIVITIES.push(a);
    return a;
  },
  'POST',
);

registerMock(/^\/ghg\/calculation$/, ({ query }) => calculation(num(query.get('year'), 2026)), 'GET');

registerMock(/^\/ghg\/statements$/, () => [...STATEMENTS].sort((a, b) => b.year - a.year), 'GET');
registerMock(
  /^\/ghg\/statements\/generate$/,
  ({ query }) => {
    const year = num(query.get('year'), 2026);
    const t = calculation(year);
    const cur = STATEMENTS.find((s) => s.year === year);
    if (cur) {
      if (cur.status !== 'DRAFT') throw apiError('이미 제출된 명세서입니다.');
      Object.assign(cur, { scope1: t.scope1, scope2: t.scope2, total: t.total });
      return cur;
    }
    const s: ApiStatement = { id: ++statementSeq, year, status: 'DRAFT', scope1: t.scope1, scope2: t.scope2, total: t.total, submittedAt: null };
    STATEMENTS.push(s);
    return s;
  },
  'POST',
);
registerMock(
  /^\/ghg\/statements\/(\d+)\/submit$/,
  ({ match }) => {
    const s = STATEMENTS.find((x) => x.id === Number(match[1]));
    if (!s) throw apiError('명세서를 찾을 수 없습니다.');
    s.status = 'SUBMITTED';
    s.submittedAt = today();
    return s;
  },
  'PATCH',
);
registerMock(
  /^\/ghg\/statements\/(\d+)\/verify$/,
  ({ match }) => {
    const s = STATEMENTS.find((x) => x.id === Number(match[1]));
    if (!s) throw apiError('명세서를 찾을 수 없습니다.');
    s.status = 'VERIFIED';
    return s;
  },
  'PATCH',
);

registerMock(
  /^\/ghg\/verifications$/,
  ({ query }) => {
    const statementId = query.get('statementId');
    return VERIFICATIONS.filter((v) => !statementId || v.statementId === Number(statementId)).sort((a, b) => b.id - a.id);
  },
  'GET',
);
registerMock(
  /^\/ghg\/verifications$/,
  ({ body }) => {
    const b = asObj(body);
    const v: ApiVerification = {
      id: ++verificationSeq,
      statementId: num(b.statementId),
      verifierOrg: str(b.verifierOrg),
      isoStd: str(b.isoStd, 'ISO 14064-3'),
      sharedAt: nowIso(),
      decision: 'PENDING',
      note: null,
      uncertainty: b.uncertainty == null ? null : round1(num(b.uncertainty)),
    };
    VERIFICATIONS.push(v);
    return v;
  },
  'POST',
);
registerMock(
  /^\/ghg\/verifications\/(\d+)$/,
  ({ match, body }) => {
    const v = VERIFICATIONS.find((x) => x.id === Number(match[1]));
    if (!v) throw apiError('검증 요청을 찾을 수 없습니다.');
    const b = asObj(body);
    v.decision = str(b.decision, v.decision);
    v.note = typeof b.note === 'string' && b.note ? b.note : v.note;
    return v;
  },
  'PATCH',
);

registerMock(
  /^\/ghg\/scope3$/,
  ({ query }) => {
    const year = num(query.get('year'), 2026);
    return SCOPE3.filter((s) => s.year === year);
  },
  'GET',
);
registerMock(
  /^\/ghg\/scope3$/,
  ({ body }) => {
    const b = asObj(body);
    const year = num(b.year, 2026);
    const category = num(b.category);
    const next = {
      tco2: num(b.tco2),
      method: str(b.method, 'PRIMARY'),
      material: b.material === true,
      evidence: typeof b.evidence === 'string' && b.evidence ? b.evidence : null,
    };
    // (company, year, category) UNIQUE upsert
    const cur = SCOPE3.find((s) => s.year === year && s.category === category);
    if (cur) return Object.assign(cur, next);
    const s: ApiScope3 = { id: ++scope3Seq, year, category, ...next };
    SCOPE3.push(s);
    return s;
  },
  'POST',
);

registerMock(/^\/ghg\/target$/, () => targetRes(), 'GET');
registerMock(
  /^\/ghg\/target$/,
  ({ body }) => {
    const b = asObj(body);
    TARGET.baseYear = num(b.baseYear, TARGET.baseYear);
    TARGET.baseTco2 = num(b.baseTco2, TARGET.baseTco2);
    TARGET.targetYear = num(b.targetYear, TARGET.targetYear);
    TARGET.targetTco2 = num(b.targetTco2, TARGET.targetTco2);
    return targetRes();
  },
  'PUT',
);

registerMock(/^\/ghg\/cbam$/, () => CBAM, 'GET');
registerMock(
  /^\/ghg\/cbam$/,
  ({ body }) => {
    const b = asObj(body);
    const outputT = num(b.outputT);
    const method = str(b.method, 'MEASURED');
    // 기본값(DEFAULT) + 원천 입력이 있으면 서버가 내재배출을 재산정·대체
    const embeddedTco2 =
      method === 'DEFAULT' && (b.attributedDirectTco2 != null || b.elecMwh != null)
        ? cbamEstimate(outputT, num(b.attributedDirectTco2), num(b.elecMwh)).embeddedTco2
        : num(b.embeddedTco2);
    const p: ApiCbam = {
      id: ++cbamSeq,
      name: str(b.name),
      hsCode: str(b.hsCode),
      outputT,
      embeddedTco2,
      method,
      euStatus: str(b.euStatus, 'NA'),
    };
    CBAM.push(p);
    return p;
  },
  'POST',
);
registerMock(
  /^\/ghg\/cbam\/estimate$/,
  ({ body }) => {
    const b = asObj(body);
    return cbamEstimate(num(b.outputT), num(b.attributedDirectTco2), num(b.elecMwh));
  },
  'POST',
);

registerMock(
  /^\/ghg\/disclosure$/,
  ({ query }) => {
    const year = num(query.get('year'), 2026);
    const t = calculation(year);
    const scope3 = scope3Total(year);
    return {
      framework: query.get('framework') ?? 'ISSB',
      year,
      scope1: t.scope1,
      scope2: t.scope2,
      scope3,
      total: round1(t.total + scope3),
    };
  },
  'GET',
);
registerMock(
  /^\/ghg\/disclosure\/narrative$/,
  ({ query }) => {
    const year = num(query.get('year'), 2026);
    const framework = query.get('framework') ?? 'ISSB';
    const companyId = num(query.get('companyId'));
    return (
      NARRATIVES.find((n) => n.year === year && n.framework === framework) ?? {
        companyId,
        year,
        framework,
        governance: null,
        strategy: null,
        riskMgmt: null,
      }
    );
  },
  'GET',
);
registerMock(
  /^\/ghg\/disclosure\/narrative$/,
  ({ body }) => {
    const b = asObj(body);
    const year = num(b.year, 2026);
    const framework = str(b.framework, 'ISSB');
    const next = {
      governance: str(b.governance) || null,
      strategy: str(b.strategy) || null,
      riskMgmt: str(b.riskMgmt) || null,
    };
    const cur = NARRATIVES.find((n) => n.year === year && n.framework === framework);
    if (cur) return Object.assign(cur, next);
    const n: ApiNarrative = { companyId: num(b.companyId), year, framework, ...next };
    NARRATIVES.push(n);
    return n;
  },
  'PUT',
);

registerMock(/^\/ghg\/reduction-actuals$/, () => [...REDUCTION_ACTUALS].sort((a, b) => b.period.localeCompare(a.period)), 'GET');
registerMock(
  /^\/ghg\/reduction-actuals$/,
  ({ body }) => {
    const b = asObj(body);
    const r: ApiReductionActual = {
      id: ++reductionSeq,
      period: str(b.period),
      sourceType: 'MANUAL',
      sourceRefId: null,
      reducedTco2: num(b.reducedTco2),
      note: typeof b.note === 'string' && b.note ? b.note : null,
    };
    REDUCTION_ACTUALS.push(r);
    return r;
  },
  'POST',
);
registerMock(
  /^\/ghg\/reduction-actuals\/sync-koc$/,
  ({ body }) => {
    const b = asObj(body);
    const monitoringId = num(b.monitoringId);
    const project = OFFSETS.find((p) => MONITORINGS.some((m) => m.id === monitoringId && m.offsetProjectId === p.id));
    const next = {
      period: str(b.period),
      sourceType: 'KOC_MONITORING',
      sourceRefId: monitoringId,
      reducedTco2: num(b.monitoredTco2),
      note: project ? project.name : null,
    };
    // 모니터링 1건당 1행(멱등 UPSERT)
    const cur = REDUCTION_ACTUALS.find((r) => r.sourceType === 'KOC_MONITORING' && r.sourceRefId === monitoringId);
    if (cur) return Object.assign(cur, next);
    const r: ApiReductionActual = { id: ++reductionSeq, ...next };
    REDUCTION_ACTUALS.push(r);
    return r;
  },
  'POST',
);

/* ══════════════════════════════════════════════════════════
 * 카본 마켓플레이스 (/carbon/*)
 * ══════════════════════════════════════════════════════════ */

/* ── KRX 시세 ── */
const QUOTES = [
  { name: 'KAU25', last: 9120, change: -1.3, bid: 9100, ask: 9150 },
  { name: 'KAU26', last: 8850, change: 0.8, bid: 8830, ask: 8880 },
  { name: 'KCU26', last: 8400, change: -0.5, bid: 8380, ask: 8420 },
];

/* ── 외부사업(KOC) ── 대상 기업 5곳 자가소비 태양광 — 이중계상(REC) 대사 대상 */
interface ApiOffset {
  id: number;
  name: string;
  methodology: string;
  status: 'PLAN' | 'APPROVED' | 'MONITORING' | 'ISSUED';
  kocIssued: number;
  recDuplicate: boolean;
  company: string;
}
const SOLAR_METHOD = '재생에너지(태양광) 전력 대체';
const OFFSETS: ApiOffset[] = [
  { id: 1, company: '한길', name: '한길 태양광 90.88kW 자가소비', methodology: SOLAR_METHOD, status: 'MONITORING', kocIssued: 0, recDuplicate: false },
  { id: 2, company: '한일튜브', name: '한일튜브 태양광 429.44kW (자가소비 99.84 + onsite 329.6)', methodology: SOLAR_METHOD, status: 'ISSUED', kocIssued: solarReduction(429.44, 365), recDuplicate: true },
  { id: 3, company: '용인금속', name: '용인금속 태양광 152.32kW 자가소비', methodology: SOLAR_METHOD, status: 'ISSUED', kocIssued: solarReduction(152.32, 365), recDuplicate: false },
  { id: 4, company: '태성산업', name: '태성산업 태양광 46.08kW 자가소비', methodology: SOLAR_METHOD, status: 'APPROVED', kocIssued: 0, recDuplicate: false },
  { id: 5, company: '건호이엔씨', name: '건호이엔씨 태양광 33.92kW 자가소비', methodology: SOLAR_METHOD, status: 'PLAN', kocIssued: 0, recDuplicate: false },
];
const offsetRes = (p: ApiOffset) => ({
  id: p.id,
  name: p.name,
  methodology: p.methodology,
  status: p.status,
  kocIssued: p.kocIssued,
  recDuplicate: p.recDuplicate,
});

/* ── 모니터링 보고서 ── */
interface ApiMonitoring {
  id: number;
  offsetProjectId: number;
  period: string;
  monitoredTco2: number;
  reportUrl: string | null;
  status: string;
  issued: boolean;
}
const MONITORINGS: ApiMonitoring[] = [
  { id: 1, offsetProjectId: 1, period: '2025-H2', monitoredTco2: solarReduction(90.88, 184), reportUrl: null, status: 'SUBMITTED', issued: false },
];
let monitoringSeq = MONITORINGS.length;
const monitoringRes = (m: ApiMonitoring) => ({
  id: m.id,
  offsetProjectId: m.offsetProjectId,
  period: m.period,
  monitoredTco2: m.monitoredTco2,
  reportUrl: m.reportUrl,
  status: m.status,
});

/* ── KOC→KCU 전환 ── (용인금속분 전환 완료 · 한일튜브분 REC 중복으로 차단) */
const CONVERSIONS: ApiConversion[] = [
  { id: 1, companyId: 2, offsetProjectId: 3, amount: solarReduction(152.32, 365), status: 'CONVERTED', recDuplicate: false, blockedReason: null, convertedAt: '2026-04-15T10:00:00' },
  { id: 2, companyId: 2, offsetProjectId: 2, amount: solarReduction(429.44, 365), status: 'CROSSCHECK_FAILED', recDuplicate: true, blockedReason: 'REC 발급 이력과 중복 (이중계상 차단)', convertedAt: null },
];
let conversionSeq = CONVERSIONS.length;
const convertedOf = (projectId: number) =>
  CONVERSIONS.filter((c) => c.offsetProjectId === projectId && c.status === 'CONVERTED').reduce((s, c) => s + c.amount, 0);

/* ── KCU 원장 ── (불변식: SUM(amount) = 보유 KCU) */
const KCU_LEDGER: KcuLedgerEntry[] = [
  { id: 1, companyId: 2, entryType: 'CONVERT_IN', amount: solarReduction(152.32, 365), balanceAfter: solarReduction(152.32, 365), refType: 'CONVERSION', refId: 1, note: '용인금속 태양광 152.32kW 자가소비 KOC 전환', createdAt: '2026-04-15T10:00:00' },
  { id: 2, companyId: 2, entryType: 'RETIRE', amount: -30, balanceAfter: round1(solarReduction(152.32, 365) - 30), refType: null, refId: null, note: '2025년 배출량 상쇄', createdAt: '2026-05-20T14:00:00' },
];
const kcuBalance = () => round1(KCU_LEDGER.reduce((s, e) => s + e.amount, 0));

/* ── 보유 ── KOC = 발급 − 전환, KCU = 원장 합계 */
const KAU_HOLDING = 1500;
function holding() {
  const koc = round1(OFFSETS.filter((p) => p.status === 'ISSUED').reduce((s, p) => s + p.kocIssued - convertedOf(p.id), 0));
  return { kau: KAU_HOLDING, koc, kcu: kcuBalance() };
}

/* ── 장외거래(협의매매) 호가 ── */
interface ApiOtc {
  id: number;
  company: string;
  side: 'BUY' | 'SELL';
  type: 'KAU' | 'KOC';
  amount: number;
  price: number;
  etrs: 'PENDING' | 'FILED' | 'NONE';
}
const OTC: ApiOtc[] = [
  { id: 1, company: '용인금속', side: 'SELL', type: 'KAU', amount: 1000, price: 9000, etrs: 'PENDING' },
  { id: 2, company: '한길', side: 'BUY', type: 'KAU', amount: 1000, price: 9050, etrs: 'PENDING' },
  { id: 3, company: '한일튜브', side: 'SELL', type: 'KAU', amount: 2000, price: 8950, etrs: 'NONE' },
  { id: 4, company: '태성산업', side: 'BUY', type: 'KAU', amount: 1000, price: 9000, etrs: 'NONE' },
];
let otcSeq = OTC.length;

/* ── 체결 ── (수수료 매수·매도 각 0.1%) */
interface ApiMatch {
  id: number;
  buyCompany: string;
  sellCompany: string;
  certType: string;
  amount: number;
  price: number;
  feeBuy: number;
  feeSell: number;
  status: string;
  matchedAt: string;
}
const FEE_RATE = 0.001;
const MATCHES: ApiMatch[] = [
  { id: 1, buyCompany: '한길', sellCompany: '용인금속', certType: 'KAU', amount: 1000, price: 9000, feeBuy: 9000, feeSell: 9000, status: 'MATCHED', matchedAt: '2026-09-24T14:30:00' },
];
let matchSeq = MATCHES.length;
const MATCHED_ORDER_IDS = new Set<number>([1, 2]);

/* ── ETRS 신고 ── */
interface ApiEtrs {
  id: number;
  counterparty: string;
  certType: string;
  amount: number;
  deadline: string;
  status: string;
  filingNo: string | null;
  filedAt: string | null;
}
const ETRS: ApiEtrs[] = [
  { id: 1, counterparty: '용인금속', certType: 'KAU', amount: 1000, deadline: '2026-10-08', status: 'PENDING', filingNo: null, filedAt: null },
  { id: 2, counterparty: '한일튜브', certType: 'KAU', amount: 1000, deadline: '2026-08-29', status: 'FILED', filingNo: 'ETRS-2026-08-27-002', filedAt: '2026-08-27T11:20:00' },
];
let etrsSeq = ETRS.length;

/** 체결일 + 7일 = ETRS 신고기한 */
function deadlineAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 매칭 — 같은 종류의 미체결 매수·매도 중 매수가 ≥ 매도가 인 첫 쌍을 매도가로 체결 */
function runMatching(): ApiMatch[] {
  const created: ApiMatch[] = [];
  const open = () => OTC.filter((o) => !MATCHED_ORDER_IDS.has(o.id));
  for (;;) {
    const sells = open().filter((o) => o.side === 'SELL').sort((a, b) => a.price - b.price);
    const pair = sells
      .map((s) => ({ s, b: open().find((o) => o.side === 'BUY' && o.type === s.type && o.price >= s.price) }))
      .find((x) => x.b);
    if (!pair?.b) break;
    const { s, b } = pair;
    const amount = Math.min(s.amount, b.amount);
    const fee = Math.round(amount * s.price * FEE_RATE);
    const m: ApiMatch = {
      id: ++matchSeq,
      buyCompany: b.company,
      sellCompany: s.company,
      certType: s.type,
      amount,
      price: s.price,
      feeBuy: fee,
      feeSell: fee,
      status: 'MATCHED',
      matchedAt: nowIso(),
    };
    MATCHES.push(m);
    created.push(m);
    MATCHED_ORDER_IDS.add(s.id);
    MATCHED_ORDER_IDS.add(b.id);
    s.etrs = 'PENDING';
    b.etrs = 'PENDING';
    const me = loginCompanyName();
    ETRS.push({
      id: ++etrsSeq,
      counterparty: me === b.company ? s.company : b.company,
      certType: s.type,
      amount,
      deadline: deadlineAfter(7),
      status: 'PENDING',
      filingNo: null,
      filedAt: null,
    });
  }
  return created;
}

/* ── 협의매매 호가판 ── (companyId 0 = 로그인 계정이 없는 기업 — 화면에는 기업명만 표시) */
const BULLETINS: Bulletin[] = [
  { id: 1, companyId: 0, company: '한일튜브', side: 'SELL', unitType: 'KOC', amount: 200, price: 8700, note: '외부사업 발급분', status: 'OPEN' },
  { id: 2, companyId: 0, company: '건호이엔씨', side: 'BUY', unitType: 'KAU', amount: 500, price: 9000, note: null, status: 'OPEN' },
  { id: 3, companyId: 0, company: '태성산업', side: 'SELL', unitType: 'KAU', amount: 800, price: 9100, note: null, status: 'MATCHED' },
];
let bulletinSeq = BULLETINS.length;
const THREADS: BulletinThread[] = [
  { id: 1, bulletinId: 1, fromCompany: '한길', message: '200톤 전량 8,600원에 가능할까요?', createdAt: '2026-09-29T10:12:00' },
  { id: 2, bulletinId: 1, fromCompany: '한일튜브', message: '8,650원이면 진행하겠습니다.', createdAt: '2026-09-29T13:40:00' },
];
let threadSeq = THREADS.length;

/* ── 자발적시장 보유 크레딧 ── */
const VCM: VcmCredit[] = [
  { id: 1, companyId: 2, standard: 'KVER', project: '한길 태양광 90.88kW 자가소비 (2025)', tco2: solarReduction(90.88, 365), status: 'HELD' },
  { id: 2, companyId: 2, standard: 'KVER', project: '한길 태양광 90.88kW 자가소비 (2024)', tco2: solarReduction(90.88, 366), status: 'RETIRED' },
];
let vcmSeq = VCM.length;

/* ── KOC 방법론 · 제4차 계획기간 파라미터 ── (MSR 미정은 빈 값) */
const METHODOLOGIES: Methodology[] = [
  { id: 1, code: 'KOC-RE-001', name: SOLAR_METHOD, docUrl: null, approved: true },
  { id: 2, code: 'KOC-EE-002', name: '폐열 회수 발전(ORC)', docUrl: null, approved: true },
  { id: 3, code: 'KOC-FC-003', name: '연료전지 발전', docUrl: null, approved: false },
];
const ETS_PARAMS: EtsPlanParam[] = [
  { id: 1, period: '2026-2030', sector: '발전', freeAllocRatio: 50, msrReserve: null },
  { id: 2, period: '2026-2030', sector: '산업 (무역집약)', freeAllocRatio: 100, msrReserve: null },
  { id: 3, period: '2026-2030', sector: '산업 (일반)', freeAllocRatio: 85, msrReserve: null },
  { id: 4, period: '2026-2030', sector: '건물', freeAllocRatio: 85, msrReserve: null },
];

/* ── 라우트: 카본 ── */
registerMock(/^\/carbon\/quotes$/, () => QUOTES, 'GET');
registerMock(/^\/carbon\/holding$/, () => holding(), 'GET');
registerMock(/^\/carbon\/voluntary-markets$/, () => VOLUNTARY_MARKETS, 'GET');

registerMock(/^\/carbon\/otc$/, () => OTC, 'GET');
registerMock(
  /^\/carbon\/otc$/,
  ({ body }) => {
    const b = asObj(body);
    const o: ApiOtc = {
      id: ++otcSeq,
      company: str(b.company, loginCompanyName()),
      side: b.side === 'BUY' ? 'BUY' : 'SELL',
      type: str(b.type, 'KAU') as ApiOtc['type'],
      amount: num(b.amount),
      price: num(b.price),
      etrs: 'NONE',
    };
    OTC.push(o);
    return o;
  },
  'POST',
);
registerMock(
  /^\/carbon\/otc\/(\d+)\/file$/,
  ({ match }) => {
    const o = OTC.find((x) => x.id === Number(match[1]));
    if (!o) throw apiError('호가를 찾을 수 없습니다.');
    o.etrs = 'FILED';
    return o;
  },
  'PATCH',
);

registerMock(/^\/carbon\/matches$/, () => [...MATCHES].sort((a, b) => b.id - a.id), 'GET');
registerMock(/^\/carbon\/matches\/run$/, () => runMatching(), 'POST');

registerMock(/^\/carbon\/etrs$/, () => [...ETRS].sort((a, b) => a.deadline.localeCompare(b.deadline)), 'GET');
registerMock(
  /^\/carbon\/etrs\/(\d+)\/file$/,
  ({ match }) => {
    const t = ETRS.find((x) => x.id === Number(match[1]));
    if (!t) throw apiError('신고 건을 찾을 수 없습니다.');
    t.status = 'FILED';
    t.filedAt = nowIso();
    t.filingNo = `ETRS-${today()}-${String(t.id).padStart(3, '0')}`;
    return t;
  },
  'PATCH',
);

registerMock(/^\/carbon\/offset-projects$/, () => OFFSETS.map(offsetRes), 'GET');
registerMock(
  /^\/carbon\/offset-projects\/(\d+)\/monitoring$/,
  ({ match, body }) => {
    const p = OFFSETS.find((x) => x.id === Number(match[1]));
    if (!p) throw apiError('외부사업을 찾을 수 없습니다.');
    const b = asObj(body);
    const period = str(b.period);
    // 화면은 발급량(모니터링 단계는 0)을 넘긴다 — 0 이면 설비 용량으로 반기 감축량 산정
    const given = num(b.monitoredTco2);
    const monitoredTco2 = given > 0 ? given : solarReduction(capacityOf(p.company), 182);
    const cur = MONITORINGS.find((m) => m.offsetProjectId === p.id && m.period === period && !m.issued);
    if (cur) {
      cur.monitoredTco2 = monitoredTco2;
      return monitoringRes(cur);
    }
    const m: ApiMonitoring = { id: ++monitoringSeq, offsetProjectId: p.id, period, monitoredTco2, reportUrl: null, status: 'SUBMITTED', issued: false };
    MONITORINGS.push(m);
    return monitoringRes(m);
  },
  'POST',
);
registerMock(
  /^\/carbon\/offset-projects\/(\d+)\/issue$/,
  ({ match }) => {
    const p = OFFSETS.find((x) => x.id === Number(match[1]));
    if (!p) throw apiError('외부사업을 찾을 수 없습니다.');
    const pending = MONITORINGS.filter((m) => m.offsetProjectId === p.id && !m.issued);
    if (pending.length === 0) throw apiError('제출된 모니터링 보고서가 없습니다.');
    p.kocIssued = round1(p.kocIssued + pending.reduce((s, m) => s + m.monitoredTco2, 0));
    p.status = 'ISSUED';
    pending.forEach((m) => {
      m.issued = true;
      m.status = 'ISSUED';
    });
    return offsetRes(p);
  },
  'POST',
);

registerMock(/^\/carbon\/conversions$/, () => [...CONVERSIONS].sort((a, b) => b.id - a.id), 'GET');
registerMock(
  /^\/carbon\/convert$/,
  ({ body }) => {
    const b = asObj(body);
    const p = OFFSETS.find((x) => x.id === num(b.offsetProjectId));
    if (!p || p.status !== 'ISSUED') throw apiError('KOC 발급이 끝난 사업만 전환할 수 있습니다.');
    const amount = num(b.amount);
    const remain = round1(p.kocIssued - convertedOf(p.id));
    if (!(amount > 0) || amount > remain) throw apiError(`전환 가능 수량은 ${remain.toLocaleString()} tCO₂eq 입니다.`);
    // 이중계상 게이트 — REC 발급 이력과 겹치면 전환 차단
    const c: ApiConversion = {
      id: ++conversionSeq,
      companyId: num(b.companyId),
      offsetProjectId: p.id,
      amount,
      status: p.recDuplicate ? 'CROSSCHECK_FAILED' : 'CONVERTED',
      recDuplicate: p.recDuplicate,
      blockedReason: p.recDuplicate ? 'REC 발급 이력과 중복 (이중계상 차단)' : null,
      convertedAt: p.recDuplicate ? null : nowIso(),
    };
    CONVERSIONS.push(c);
    if (c.status === 'CONVERTED') {
      KCU_LEDGER.push({
        id: KCU_LEDGER.length + 1,
        companyId: c.companyId,
        entryType: 'CONVERT_IN',
        amount,
        balanceAfter: round1(kcuBalance() + amount),
        refType: 'CONVERSION',
        refId: c.id,
        note: `${p.name} KOC 전환`,
        createdAt: nowIso(),
      });
    }
    return c;
  },
  'POST',
);
registerMock(/^\/carbon\/kcu-ledger$/, () => KCU_LEDGER, 'GET');

registerMock(
  /^\/carbon\/bulletins$/,
  ({ query }) => {
    const status = query.get('status');
    const unitType = query.get('unitType');
    const side = query.get('side');
    return BULLETINS.filter(
      (b) => (!status || b.status === status) && (!unitType || b.unitType === unitType) && (!side || b.side === side),
    );
  },
  'GET',
);
registerMock(
  /^\/carbon\/bulletins$/,
  ({ body }) => {
    const b = asObj(body);
    const item: Bulletin = {
      id: ++bulletinSeq,
      companyId: num(b.companyId),
      company: str(b.company, loginCompanyName()),
      side: b.side === 'BUY' ? 'BUY' : 'SELL',
      unitType: (['KAU', 'KOC', 'KCU'].includes(str(b.unitType)) ? str(b.unitType) : 'KAU') as Bulletin['unitType'],
      amount: num(b.amount),
      price: num(b.price),
      note: str(b.note) || null,
      status: 'OPEN',
    };
    BULLETINS.push(item);
    return item;
  },
  'POST',
);
registerMock(
  /^\/carbon\/bulletins\/(\d+)\/status$/,
  ({ match, body }) => {
    const item = BULLETINS.find((x) => x.id === Number(match[1]));
    if (!item) throw apiError('호가를 찾을 수 없습니다.');
    const next = str(asObj(body).status);
    if (next === 'OPEN' || next === 'MATCHED' || next === 'CLOSED') item.status = next;
    return item;
  },
  'PATCH',
);
registerMock(/^\/carbon\/bulletins\/(\d+)\/threads$/, ({ match }) => THREADS.filter((t) => t.bulletinId === Number(match[1])), 'GET');
registerMock(
  /^\/carbon\/bulletins\/(\d+)\/threads$/,
  ({ match, body }) => {
    const b = asObj(body);
    const t: BulletinThread = {
      id: ++threadSeq,
      bulletinId: Number(match[1]),
      fromCompany: str(b.fromCompany, loginCompanyName()),
      message: str(b.message),
      createdAt: nowIso(),
    };
    THREADS.push(t);
    return t;
  },
  'POST',
);

registerMock(/^\/carbon\/vcm-credits$/, () => VCM, 'GET');
registerMock(
  /^\/carbon\/vcm-credits$/,
  ({ body }) => {
    const b = asObj(body);
    const c: VcmCredit = {
      id: ++vcmSeq,
      companyId: num(b.companyId),
      standard: (['VCS', 'GS', 'KVER'].includes(str(b.standard)) ? str(b.standard) : 'VCS') as VcmCredit['standard'],
      project: str(b.project),
      tco2: num(b.tco2),
      status: 'HELD',
    };
    VCM.push(c);
    return c;
  },
  'POST',
);
function setVcmStatus(id: number, status: VcmCredit['status']): VcmCredit {
  const c = VCM.find((x) => x.id === id);
  if (!c) throw apiError('크레딧을 찾을 수 없습니다.');
  if (c.status !== 'HELD') throw apiError('보유 중인 크레딧만 처리할 수 있습니다.');
  c.status = status;
  return c;
}
registerMock(/^\/carbon\/vcm-credits\/(\d+)\/retire$/, ({ match }) => setVcmStatus(Number(match[1]), 'RETIRED'), 'PATCH');
registerMock(/^\/carbon\/vcm-credits\/(\d+)\/sell$/, ({ match }) => setVcmStatus(Number(match[1]), 'SOLD'), 'PATCH');

registerMock(
  /^\/carbon\/koc-methodologies$/,
  ({ query }) => (query.get('approvedOnly') === 'true' ? METHODOLOGIES.filter((m) => m.approved) : METHODOLOGIES),
  'GET',
);
registerMock(
  /^\/carbon\/ets-params$/,
  ({ query }) => {
    const period = query.get('period');
    return ETS_PARAMS.filter((p) => !period || p.period === period);
  },
  'GET',
);
