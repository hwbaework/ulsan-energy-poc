/**
 * 컨설팅 목업 — 전기사용자(이수용 · 울산 수용가(주), companyId 2) 기준 예시.
 * 내 컨설팅: 진행 중 1 · 신청(미배정) 1 · 완료 1 — 홈·목록·상세가 세 상태를 다 보여 준다.
 * 무료진단: 최근 진단 1건 + 새로 제출하면 메모리에 쌓인다(새로고침 시 초기화).
 */
import { registerMock } from './registry';
import type { Consultation, Diagnosis } from '@/types/consultation';

const CONSUMER_COMPANY_ID = 2;
const CONSUMER_COMPANY_NAME = '울산 수용가(주)';

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
    domain: 'CARBON_REDUCTION',
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
    domain: 'DISTRIBUTED_ENERGY',
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

const DIAGNOSES: Diagnosis[] = [
  {
    id: 1,
    companyId: CONSUMER_COMPANY_ID,
    companyName: CONSUMER_COMPANY_NAME,
    domain: 'RE100',
    industry: '제조업',
    companySize: '중견기업',
    currentRePercent: 18.4,
    targetTimeline: '2030',
    maturityGrade: 'C',
    annualEnergyUsage: 2208, // MWh
    currentElecCost: 152, // 원/kWh
    annualGhgEmission: 1240,
    currentReMethods: '자가소비 태양광',
    consultingDrivers: '고객사 RE100 요구',
    siteCount: 2,
    siteRegions: '울산 남구',
    annualRevenue: 42000000000,
    employeeCount: 58,
    contactName: '이수용',
    contactEmail: 'consumer@test.com',
    contactPhone: '010-3000-0003',
    createdAt: '2026-08-18T15:20:00',
  },
];

const nextId = (xs: { id: number }[]) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const nowIso = () => new Date().toISOString().slice(0, 19);

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
    return c;
  },
  'POST',
);

/* 무료진단 — 회사별 목록 · 상세 · 제출 */
registerMock(/^\/consultations\/diagnoses\/by-company\/(\d+)$/, ({ match, query }) => {
  const companyId = Number(match[1]);
  const domain = query.get('domain');
  return DIAGNOSES.filter((d) => d.companyId === companyId && (!domain || d.domain === domain)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
});
registerMock(/^\/consultations\/diagnoses\/recent\/(\d+)$/, ({ match }) => DIAGNOSES.filter((d) => d.companyId === Number(match[1])));
registerMock(/^\/consultations\/diagnoses\/(\d+)$/, ({ match }) => DIAGNOSES.find((d) => d.id === Number(match[1])) ?? null);
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
    return d;
  },
  'POST',
);

