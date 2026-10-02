/**
 * 컨설팅 목업 — 전기사용자(이수용 · 한길, companyId 2) 기준 예시.
 * 내 컨설팅: 진행 중 1 · 신청(미배정) 1 · 완료 1 — 홈·목록·상세가 세 상태를 다 보여 준다.
 * 무료진단: 최근 진단 1건 + 새로 제출하면 메모리에 쌓인다(새로고침 시 초기화).
 */
import { registerMock } from './registry';
import type { Consultation, Diagnosis } from '@/types/consultation';
import { calc, defaultSimInput, type SimInput } from '@/lib/solar-sim';

const CONSUMER_COMPANY_ID = 2;
const CONSUMER_COMPANY_NAME = '한길';

const CONSULTATIONS: Consultation[] = [
  {
    id: 1,
    status: 'SURVEYING',
    origin: 'marketplace',
    domain: 'RE100',
    clientCompanyId: CONSUMER_COMPANY_ID,
    clientCompanyName: CONSUMER_COMPANY_NAME,
    industry: '제조업',
    maturityGrade: 'C',
    companySize: '중견기업',
    currentRePercent: 18.4,
    targetTimeline: '2030',
    annualEnergyUsage: 2208, // MWh
    siteCount: 2,
    siteRegions: '울산 남구',
    contactName: '이수용',
    contactEmail: 'consumer@test.com',
    diagnosisId: 1,
    appliedAt: '2026-08-20T10:00:00',
    assignedAt: '2026-08-25T14:00:00',
    createdAt: '2026-08-20T10:00:00',
    updatedAt: '2026-09-15T09:00:00',
  } as Consultation,
  {
    id: 2,
    status: 'APPLIED',
    origin: 'marketplace',
    domain: 'RE100',
    clientCompanyId: CONSUMER_COMPANY_ID,
    clientCompanyName: CONSUMER_COMPANY_NAME,
    industry: '제조업',
    companySize: '중견기업',
    annualGhgEmission: 1240,
    contactName: '이수용',
    contactEmail: 'consumer@test.com',
    appliedAt: '2026-09-28T16:30:00',
    createdAt: '2026-09-28T16:30:00',
    updatedAt: '2026-09-28T16:30:00',
  } as Consultation,
  {
    id: 3,
    status: 'COMPLETED',
    origin: 'marketplace',
    domain: 'RE100',
    clientCompanyId: CONSUMER_COMPANY_ID,
    clientCompanyName: CONSUMER_COMPANY_NAME,
    industry: '제조업',
    maturityGrade: 'D',
    companySize: '중견기업',
    currentRePercent: 9.7,
    targetTimeline: '2030',
    contactName: '이수용',
    contactEmail: 'consumer@test.com',
    appliedAt: '2026-02-10T09:00:00',
    assignedAt: '2026-02-14T11:00:00',
    completedAt: '2026-05-30T17:00:00',
    createdAt: '2026-02-10T09:00:00',
    updatedAt: '2026-05-30T17:00:00',
  } as Consultation,
];

// 접수(ASSIGNED) · 검토 중(REVIEWING) 샘플
CONSULTATIONS.push(
  {
    id: 4,
    status: 'ASSIGNED',
    origin: 'marketplace',
    domain: 'RE100',
    clientCompanyId: CONSUMER_COMPANY_ID,
    clientCompanyName: CONSUMER_COMPANY_NAME,
    industry: '제조업',
    companySize: '중견기업',
    contactName: '이수용',
    contactEmail: 'consumer@test.com',
    appliedAt: '2026-09-15T11:00:00',
    assignedAt: '2026-09-18T09:30:00',
    createdAt: '2026-09-15T11:00:00',
    updatedAt: '2026-09-18T09:30:00',
  } as Consultation,
  {
    id: 5,
    status: 'REVIEWING',
    origin: 'marketplace',
    domain: 'RE100',
    clientCompanyId: CONSUMER_COMPANY_ID,
    clientCompanyName: CONSUMER_COMPANY_NAME,
    industry: '제조업',
    maturityGrade: 'C',
    companySize: '중견기업',
    currentRePercent: 18.4,
    targetTimeline: '2030',
    contactName: '이수용',
    contactEmail: 'consumer@test.com',
    appliedAt: '2026-06-03T10:00:00',
    assignedAt: '2026-06-08T14:00:00',
    createdAt: '2026-06-03T10:00:00',
    updatedAt: '2026-09-25T16:00:00',
  } as Consultation,
);

/* 무료진단 — 태양광 사업성 검토 입력값(solar-sim). 자가소비 · OnSite PPA · 설비 있음/없음이 다 보이게 3건 */
const contact = { contactName: '이수용', contactEmail: 'consumer@test.com', contactPhone: '010-3000-0003' };
const SIM_HQ_PPA: SimInput = (() => {
  const x = defaultSimInput('한길', '울산 남구 용연동 490-11');
  x.mode = 'ppa';
  x.roof = 9000;
  x.facilities = [{ source: '태양광', kw: 90.88, genKwh: 121_400, useKwh: 121_400 }];
  x.ppa = { ...x.ppa, cap: 820, b1: 3, b2: 20, segs: [{ linked: true, price: 150 }, { linked: false, price: 148 }, { linked: false, price: 150 }] };
  return x;
})();
const SIM_SITE2_SELF: SimInput = (() => {
  const x = defaultSimInput('한길', '울산 남구 용연동 490-11');
  x.mode = 'self';
  x.self = { ...x.self, cap: 250, ctr: 800, usage: 71_800 };
  return x;
})();
const SIM_HQ_SELF_OLD: SimInput = (() => {
  const x = defaultSimInput('한길', '울산 남구 용연동 490-11');
  x.mode = 'self';
  x.facilities = [{ source: '태양광', kw: 90.88, genKwh: 121_400, useKwh: 121_400 }];
  x.self = { ...x.self, cap: 400, ctr: 1200, usage: 184_000 };
  return x;
})();
const diag = (id: number, sim: SimInput, createdAt: string): Diagnosis => {
  const R = calc(sim);
  return {
    id, companyId: CONSUMER_COMPANY_ID, companyName: CONSUMER_COMPANY_NAME, domain: 'RE100',
    annualEnergyUsage: Math.round(R.annualGen1 / 1000), ...contact, sim, createdAt,
  };
};

const DIAGNOSES: Diagnosis[] = [diag(1, SIM_HQ_PPA, '2026-08-18T15:20:00'), diag(2, SIM_SITE2_SELF, '2026-06-11T10:40:00'), diag(3, SIM_HQ_SELF_OLD, '2026-02-05T14:00:00')];

/* 새로고침해도 신청·진단이 남게 — 브라우저에 저장 (POC) */
const STORE_KEY = 'ulsan-consulting-poc-v6';
if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && Array.isArray(saved.c) && Array.isArray(saved.d)) {
      CONSULTATIONS.splice(0, CONSULTATIONS.length, ...saved.c);
      DIAGNOSES.splice(0, DIAGNOSES.length, ...saved.d);
    }
  } catch {
    /* 저장본이 깨졌으면 시드로 시작 */
  }
}
function persist() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ c: CONSULTATIONS, d: DIAGNOSES }));
  } catch {
    /* 저장 실패는 무시 — 메모리에는 남는다 */
  }
}

const nextId = (xs: { id: number }[]) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
// 로컬 시각(한국) 기준 — toISOString 은 UTC 라 9시간 어긋난다
const nowIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };

/* 내 컨설팅 — 회사별 목록 · 상세 */
registerMock(/^\/consultations\/by-company\/(\d+)$/, ({ match, query }) => {
  const companyId = Number(match[1]);
  const domain = query.get('domain');
  return CONSULTATIONS.filter((c) => c.clientCompanyId === companyId && (!domain || c.domain === domain));
});
registerMock(/^\/consultations\/(\d+)$/, ({ match }) => CONSULTATIONS.find((c) => c.id === Number(match[1])) ?? null);
/* 무료진단 결과에서 컨설팅 신청 — 신청(APPLIED)으로 쌓인다 */
registerMock(
  /^\/consultations$/,
  ({ body }) => {
    const b = (body ?? {}) as Partial<Consultation> & { origin?: string };
    const c = {
      ...b,
      id: nextId(CONSULTATIONS),
      status: 'APPLIED',
      origin: String(b.origin ?? 'marketplace').toLowerCase(),
      domain: b.domain ?? 'RE100',
      clientCompanyId: b.clientCompanyId ?? CONSUMER_COMPANY_ID,
      clientCompanyName: b.clientCompanyName ?? CONSUMER_COMPANY_NAME,
      appliedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as Consultation;
    CONSULTATIONS.unshift(c);
    persist();
    return c;
  },
  'POST',
);

/* 무료진단 — 회사별 목록 · 상세 · 제출 */
/* 전체 목록 — 관리자가 신규 기업(번호 없음)의 진단을 업체명으로 찾을 때 */
registerMock(/^\/consultations\/diagnoses$/, () => [...DIAGNOSES].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), 'GET');
registerMock(/^\/consultations\/diagnoses\/by-company\/(\d+)$/, ({ match, query }) => {
  const companyId = Number(match[1]);
  const domain = query.get('domain');
  return DIAGNOSES.filter((d) => d.companyId === companyId && (!domain || d.domain === domain)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
});
registerMock(/^\/consultations\/diagnoses\/recent\/(\d+)$/, ({ match }) => DIAGNOSES.filter((d) => d.companyId === Number(match[1])));
registerMock(/^\/consultations\/diagnoses\/(\d+)$/, ({ match }) => DIAGNOSES.find((d) => d.id === Number(match[1])) ?? null, 'GET');
/* 내 컨설팅 › 검토 기록 삭제 (수정은 없다) */
registerMock(
  /^\/consultations\/diagnoses\/(\d+)$/,
  ({ match }) => {
    const k = DIAGNOSES.findIndex((d) => d.id === Number(match[1]));
    if (k >= 0) DIAGNOSES.splice(k, 1);
    persist();
    return null;
  },
  'DELETE',
);
registerMock(
  /^\/consultations\/diagnoses$/,
  ({ body }) => {
    const b = (body ?? {}) as Partial<Diagnosis>;
    const d: Diagnosis = {
      ...b,
      id: nextId(DIAGNOSES),
      companyId: b.companyId ?? CONSUMER_COMPANY_ID,
      companyName: b.companyName ?? CONSUMER_COMPANY_NAME,
      domain: b.domain ?? 'RE100',
      createdAt: nowIso(),
    };
    DIAGNOSES.unshift(d);
    persist();
    return d;
  },
  'POST',
);

