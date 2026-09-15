'use client';

// 온실가스 rev.2 배선 — /api/v1/ghg/{factors,scope3,target,cbam,disclosure}. 기획 01 rev.2.
// 설계 22: 프로덕션 mock 폴백 제거 — 조회 훅은 {data, isLive(성공), isError(호출실패)}로 상태를 정확히 노출.
//   회사 미귀속은 페이지가 companyId로 판정. 가짜 수치를 실데이터로 위장하지 않는다.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { ghgKeys } from '@/api/edmQueryKeys';

const api = () => getApiClient();

// ── 배출계수 ──
export interface FactorRow {
  code: string;
  name: string;
  factor: number;
  unit: string;
  tier: 1 | 2 | 3;
  source: '국가고유' | 'IPCC 기본' | '사업장고유';
  validFrom: string;
  version: string;
  expiring?: boolean;
}
const SOURCE_LABEL: Record<string, FactorRow['source']> = {
  NATIONAL: '국가고유',
  IPCC: 'IPCC 기본',
  SITE: '사업장고유',
};
export const FALLBACK_FACTORS: FactorRow[] = [
  {
    code: 'GHG_ELEC',
    name: '구매전력 (Scope 2)',
    factor: 0.4781,
    unit: 'tCO₂eq/MWh',
    tier: 1,
    source: '국가고유',
    validFrom: '2021-01-01',
    version: 'v2021.1',
  },
  {
    code: 'FUEL_LNG',
    name: '고정연소 LNG',
    factor: 56.1,
    unit: 'tCO₂/TJ',
    tier: 2,
    source: 'IPCC 기본',
    validFrom: '2019-01-01',
    version: 'v2019.0',
  },
  {
    code: 'FUEL_DIESEL',
    name: '이동연소 경유',
    factor: 2.582,
    unit: 'tCO₂/kL',
    tier: 1,
    source: 'IPCC 기본',
    validFrom: '2019-01-01',
    version: 'v2019.0',
  },
  {
    code: 'STEAM',
    name: '외부 스팀 (Scope 2)',
    factor: 0.0752,
    unit: 'tCO₂/GJ',
    tier: 2,
    source: '국가고유',
    validFrom: '2021-01-01',
    version: 'v2021.1',
  },
  {
    code: 'PROC_SITE',
    name: '공정배출 (사업장 실측)',
    factor: 0.512,
    unit: 'tCO₂/t',
    tier: 3,
    source: '사업장고유',
    validFrom: '2025-01-01',
    version: 'v2025.2',
    expiring: true,
  },
];
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

export function useGhgFactors() {
  const q = useQuery({
    queryKey: ghgKeys.factors(),
    queryFn: async () =>
      (await api().get<ApiFactor[]>(ENDPOINTS.ghg.factors)).map(
        (f): FactorRow => ({
          code: f.code,
          name: f.name,
          factor: Number(f.factor),
          unit: f.unit,
          tier: f.tier as 1 | 2 | 3,
          source: SOURCE_LABEL[f.source] ?? '국가고유',
          validFrom: f.validFrom,
          version: f.version,
          expiring: f.source === 'SITE',
        }),
      ),
    retry: false,
  });
  // 설계 22: mock 폴백 제거 — 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as FactorRow[], isLive: q.isSuccess, isError: q.isError };
}

// 계수 등록 (설계 11 §2.3) — BE GhgExtDto.FactorReq. 기존 행 수정 금지·신규 version 추가.
export interface FactorReq {
  code: string;
  name: string;
  factor: number;
  unit: string;
  tier: 1 | 2 | 3;
  source: 'IPCC' | 'NATIONAL' | 'SITE';
  validFrom: string;
  version: string;
}
export function useCreateFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: FactorReq) => api().post<ApiFactor>(ENDPOINTS.ghg.factors, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// ── Scope 3 ──
export const SCOPE3_NAMES: Record<number, string> = {
  1: '구매한 제품·서비스',
  2: '자본재',
  3: '연료·에너지 관련 활동',
  4: '업스트림 운송·물류',
  5: '사업장 폐기물',
  6: '출장',
  7: '직원 통근',
  8: '업스트림 임차 자산',
  9: '다운스트림 운송·물류',
  10: '판매 제품 가공',
  11: '판매 제품 사용',
  12: '판매 제품 폐기(EOL)',
  13: '다운스트림 임차 자산',
  14: '프랜차이즈',
  15: '투자',
};
export interface Scope3Row {
  no: number;
  name: string;
  material: boolean;
  tco2?: number;
  method?: string;
}
const METHOD_LABEL: Record<string, string> = { PRIMARY: '1차 데이터', SPEND: 'spend-based' };
export const FALLBACK_SCOPE3: Scope3Row[] = Array.from({ length: 15 }, (_, i) => {
  const no = i + 1;
  const seed: Record<number, Partial<Scope3Row>> = {
    1: { material: true, tco2: 4820, method: '1차 데이터' },
    3: { material: true, tco2: 610, method: 'spend-based' },
    4: { material: true, tco2: 1240, method: '1차 데이터' },
    5: { tco2: 180, method: 'spend-based' },
    6: { material: true, tco2: 95, method: '1차 데이터' },
    11: { material: true },
  };
  return { no, name: SCOPE3_NAMES[no]!, material: false, ...seed[no] };
});
interface ApiScope3 {
  id: number;
  category: number;
  tco2: number;
  method: string;
  material: boolean;
  evidence: string | null;
}

export function useGhgScope3(companyId?: number, year = 2026) {
  const q = useQuery({
    queryKey: ghgKeys.scope3(companyId, year),
    queryFn: async () => await api().get<ApiScope3[]>(ENDPOINTS.ghg.scope3, { companyId, year }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    const byCat = new Map(q.data.map((a) => [a.category, a]));
    const rows: Scope3Row[] = Array.from({ length: 15 }, (_, i) => {
      const no = i + 1;
      const a = byCat.get(no);
      return {
        no,
        name: SCOPE3_NAMES[no]!,
        material: a?.material ?? false,
        tco2: a ? Number(a.tco2) : undefined,
        method: a ? (METHOD_LABEL[a.method] ?? a.method) : undefined,
      };
    });
    return { data: rows, isLive: true, isError: false };
  }
  return { data: [] as Scope3Row[], isLive: false, isError: q.isError };
}

// Scope3 등록/갱신 (설계 11 §2.4) — BE GhgExtDto.Scope3Req. (company_id,year,category) UNIQUE upsert.
export interface Scope3Req {
  companyId: number;
  year: number;
  category: number;
  tco2: number;
  method: 'PRIMARY' | 'SPEND';
  material: boolean;
  evidence?: string | null;
}
export function useUpsertScope3() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: Scope3Req) => api().post<ApiScope3>(ENDPOINTS.ghg.scope3, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// ── 감축목표 ──
export interface TargetData {
  baseYear: number;
  baseTco2: number;
  targetYear: number;
  targetTco2: number;
  currentTco2: number;
  progressPct: number | null;
}
export const FALLBACK_TARGET: TargetData = {
  baseYear: 2018,
  baseTco2: 10200,
  targetYear: 2030,
  targetTco2: 5100,
  currentTco2: 7842,
  progressPct: 46,
};
interface ApiTarget {
  id: number;
  baseYear: number;
  baseTco2: number;
  targetYear: number;
  targetTco2: number;
  currentTco2: number;
  progressPct: number | null;
}

export function useGhgTarget(companyId?: number) {
  const q = useQuery({
    queryKey: ghgKeys.target(companyId),
    queryFn: async () => await api().get<ApiTarget | null>(ENDPOINTS.ghg.target, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess) {
    const t = q.data;
    return {
      data: (t
        ? {
            baseYear: t.baseYear,
            baseTco2: Number(t.baseTco2),
            targetYear: t.targetYear,
            targetTco2: Number(t.targetTco2),
            currentTco2: Number(t.currentTco2) || 0,
            progressPct: t.progressPct,
          }
        : {
            baseYear: 2018,
            baseTco2: 0,
            targetYear: 2030,
            targetTco2: 0,
            currentTco2: 0,
            progressPct: 0,
          }) as TargetData,
      isLive: true,
      isError: false, // 목표 미설정(null)도 live — 신규 회사 첫 목표 저장 허용
    };
  }
  // 설계 22: 오류 시 mock(FALLBACK_TARGET) 대신 빈 기본값 — 가짜 수치 노출 금지.
  return {
    data: {
      baseYear: 2018,
      baseTco2: 0,
      targetYear: 2030,
      targetTco2: 0,
      currentTco2: 0,
      progressPct: null,
    } as TargetData,
    isLive: false,
    isError: q.isError,
  };
}

// 감축목표 설정/갱신 (설계 11 §2.5) — BE GhgExtDto.TargetReq (PUT). currentTco2·progressPct는 서버 계산.
export interface TargetReq {
  companyId: number;
  baseYear: number;
  baseTco2: number;
  targetYear: number;
  targetTco2: number;
}
export function useUpsertTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: TargetReq) => api().put<ApiTarget>(ENDPOINTS.ghg.target, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// ── CBAM ──
export interface CbamRow {
  name: string;
  hs: string;
  output: number;
  embedded: number;
  method: '실측' | '기본값';
  eu: '대상·준비' | '대상·미준비' | '미대상';
}
const EU_LABEL: Record<string, CbamRow['eu']> = {
  READY: '대상·준비',
  NOT_READY: '대상·미준비',
  NA: '미대상',
};
export const FALLBACK_CBAM: CbamRow[] = [
  { name: '열연강판', hs: '7208', output: 4200, embedded: 1.82, method: '실측', eu: '대상·준비' },
  {
    name: '합성수지 (PP)',
    hs: '3902',
    output: 1900,
    embedded: 2.31,
    method: '기본값',
    eu: '대상·미준비',
  },
  {
    name: '알루미늄 압출재',
    hs: '7604',
    output: 620,
    embedded: 6.7,
    method: '기본값',
    eu: '대상·미준비',
  },
  { name: '일반 부품', hs: '8481', output: 340, embedded: 0.9, method: '기본값', eu: '미대상' },
];
interface ApiCbam {
  id: number;
  name: string;
  hsCode: string;
  outputT: number;
  embeddedTco2: number;
  method: string;
  euStatus: string;
}

export function useGhgCbam(companyId?: number) {
  const q = useQuery({
    queryKey: ghgKeys.cbam(companyId),
    queryFn: async () =>
      (await api().get<ApiCbam[]>(ENDPOINTS.ghg.cbam, { companyId })).map(
        (p): CbamRow => ({
          name: p.name,
          hs: p.hsCode,
          output: Number(p.outputT),
          embedded: Number(p.embeddedTco2),
          method: p.method === 'MEASURED' ? '실측' : '기본값',
          eu: EU_LABEL[p.euStatus] ?? '미대상',
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: mock 폴백 제거.
  return { data: (q.data ?? []) as CbamRow[], isLive: q.isSuccess, isError: q.isError };
}

// CBAM 제품 등록 (설계 11 §2.6) — BE GhgExtDto.CbamReq.
// 기획 14 §1.3: method=DEFAULT 이고 attributedDirectTco2·elecMwh 포함 시 서버가 embeddedTco2 재산정·대체(조작 방지).
export interface CbamReq {
  companyId: number;
  name: string;
  hsCode: string;
  outputT: number;
  embeddedTco2: number;
  method: 'MEASURED' | 'DEFAULT';
  euStatus: 'READY' | 'NOT_READY' | 'NA';
  attributedDirectTco2?: number;
  elecMwh?: number;
}
export function useCreateCbam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CbamReq) => api().post<ApiCbam>(ENDPOINTS.ghg.cbam, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// CBAM 내재배출 서버 산정 (기획 14 §1) — POST ghg.cbamEstimate. method=DEFAULT 제안값(직접배출 + 전력 간접).
export interface CbamEstimateReq {
  companyId?: number;
  outputT: number;
  attributedDirectTco2: number;
  elecMwh: number;
}
export interface CbamEstimateRes {
  embeddedTco2: number;
  elecFactorUsed: number;
  basis: string;
}
interface ApiCbamEstimate {
  embeddedTco2: number;
  elecFactorUsed: number;
  basis: string;
}
export function useEstimateCbam() {
  return useMutation<CbamEstimateRes, unknown, CbamEstimateReq>({
    mutationFn: async (req) => {
      const res = await api().post<ApiCbamEstimate>(ENDPOINTS.ghg.cbamEstimate, req);
      const d = res;
      return {
        embeddedTco2: Number(d.embeddedTco2),
        elecFactorUsed: Number(d.elecFactorUsed),
        basis: d.basis,
      };
    },
  });
}

// ── 감축실적 원장 (기획 14 §2) — KOC 모니터링 자동 연계 + 수기. carbon 미수정(ghg 측 수집) ──
export interface ReductionActualRow {
  id: number;
  period: string;
  sourceType: 'KOC_MONITORING' | 'MANUAL';
  sourceRefId: number | null;
  reducedTco2: number;
  note: string | null;
}
interface ApiReductionActual {
  id: number;
  period: string;
  sourceType: string;
  sourceRefId: number | null;
  reducedTco2: number;
  note: string | null;
}
const mapReductionActual = (a: ApiReductionActual): ReductionActualRow => ({
  id: a.id,
  period: a.period,
  sourceType: a.sourceType === 'MANUAL' ? 'MANUAL' : 'KOC_MONITORING',
  sourceRefId: a.sourceRefId,
  reducedTco2: Number(a.reducedTco2),
  note: a.note,
});

// 감축실적 목록. companyId 없으면 비활성(폴백 없음 — 실적은 실데이터만).
export function useGhgReductionActuals(companyId?: number) {
  const q = useQuery({
    queryKey: ghgKeys.reductionActuals(companyId),
    queryFn: async () =>
      (await api().get<ApiReductionActual[]>(ENDPOINTS.ghg.reductionActuals, { companyId })).map(
        mapReductionActual,
      ),
    enabled: !!companyId,
    retry: false,
  });
  const live = q.isSuccess;
  return { data: (q.data ?? []) as ReductionActualRow[], isLive: live };
}

export interface ReductionActualReq {
  companyId: number;
  period: string;
  reducedTco2: number;
  note?: string | null;
}
export function useCreateReductionActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ReductionActualReq) =>
      api().post<ApiReductionActual>(ENDPOINTS.ghg.reductionActuals, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// KOC 모니터링 제출 후 트리거 — carbon 미수정. 모니터링 응답(id·period·monitoredTco2)으로 ghg UPSERT(멱등).
export interface ReductionActualSyncReq {
  companyId?: number;
  period: string;
  monitoringId: number;
  monitoredTco2: number;
}
export interface SyncKocResult {
  reflected: boolean;
  isLive: boolean;
  mock?: boolean;
}
export function useSyncKocReductionActual() {
  const qc = useQueryClient();
  return useMutation<SyncKocResult, unknown, ReductionActualSyncReq>({
    mutationFn: async (req) => {
      try {
        await api().post<ApiReductionActual>(ENDPOINTS.ghg.reductionActualSyncKoc, req);
        return { reflected: true, isLive: true };
      } catch {
        return { reflected: false, isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// ── 공시 (명세서·Scope3·목표 조립) ──
export interface DisclosureData {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}
export const FALLBACK_DISCLOSURE: DisclosureData = {
  scope1: 1914,
  scope2: 5928,
  scope3: 6945,
  total: 14787,
};
interface ApiDisclosure {
  framework: string;
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export function useGhgDisclosure(companyId?: number, year = 2026, framework = 'ISSB') {
  const q = useQuery({
    queryKey: ghgKeys.disclosure(companyId, year, framework),
    queryFn: async () =>
      await api().get<ApiDisclosure>(ENDPOINTS.ghg.disclosure, { companyId, year, framework }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: {
        scope1: Number(q.data.scope1),
        scope2: Number(q.data.scope2),
        scope3: Number(q.data.scope3),
        total: Number(q.data.total),
      } as DisclosureData,
      isLive: true,
      isError: false,
    };
  }
  // 설계 22: 오류 시 mock(FALLBACK_DISCLOSURE) 대신 0 — 가짜 수치 노출 금지.
  return {
    data: { scope1: 0, scope2: 0, scope3: 0, total: 0 } as DisclosureData,
    isLive: false,
    isError: q.isError,
  };
}

// ── 공시 서술 (거버넌스/전략/위험관리) V109 — GhgExtDto.NarrativeRes/Req ──
// 미입력이면 필드 null(빈 응답). (company,year,framework) upsert(PUT).
export interface NarrativeData {
  governance: string;
  strategy: string;
  riskMgmt: string;
}
interface ApiNarrative {
  companyId: number;
  year: number;
  framework: string;
  governance: string | null;
  strategy: string | null;
  riskMgmt: string | null;
}

export function useGhgDisclosureNarrative(companyId?: number, year = 2026, framework = 'ISSB') {
  const q = useQuery({
    queryKey: ghgKeys.disclosureNarrative(companyId, year, framework),
    queryFn: async () =>
      await api().get<ApiNarrative>(ENDPOINTS.ghg.disclosureNarrative, {
        companyId,
        year,
        framework,
      }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: {
        governance: q.data.governance ?? '',
        strategy: q.data.strategy ?? '',
        riskMgmt: q.data.riskMgmt ?? '',
      } as NarrativeData,
      isLive: true,
      isError: false,
    };
  }
  // BE V109 미배포 시 404/오류 — 빈 서술로 노출(편집 자체는 가능, 저장은 배포 후).
  return {
    data: { governance: '', strategy: '', riskMgmt: '' } as NarrativeData,
    isLive: false,
    isError: q.isError,
  };
}

export interface NarrativeReq {
  companyId: number;
  year: number;
  framework: string;
  governance: string;
  strategy: string;
  riskMgmt: string;
}
export function useUpsertDisclosureNarrative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: NarrativeReq) =>
      api().put<ApiNarrative>(ENDPOINTS.ghg.disclosureNarrative, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// ── 제3자 검증 워크플로 (설계 11 §3.2) — GhgExtDto.VerificationRes/Req/DecideReq ──
export type VerificationDecision = 'PENDING' | 'SUPPLEMENT' | 'ISSUED';
export interface VerificationRes {
  id: number;
  statementId: number;
  verifierOrg: string;
  isoStd: string;
  sharedAt: string | null;
  decision: VerificationDecision;
  note: string | null;
  uncertainty: number | null;
}
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
const mapVerification = (v: ApiVerification): VerificationRes => ({
  id: v.id,
  statementId: v.statementId,
  verifierOrg: v.verifierOrg,
  isoStd: v.isoStd,
  sharedAt: v.sharedAt,
  decision: v.decision as VerificationDecision,
  note: v.note,
  uncertainty: v.uncertainty != null ? Number(v.uncertainty) : null,
});

// 검증 이력 조회. statementId 없으면 비활성(폴백 없음 — 이력은 실데이터만).
export function useVerifications(statementId?: number) {
  const q = useQuery({
    queryKey: ghgKeys.verifications(statementId),
    queryFn: async () =>
      (await api().get<ApiVerification[]>(ENDPOINTS.ghg.verifications, { statementId })).map(
        mapVerification,
      ),
    enabled: !!statementId,
    retry: false,
  });
  const live = q.isSuccess;
  return { data: (q.data ?? []) as VerificationRes[], isLive: live };
}

export interface VerificationReq {
  statementId: number;
  verifierOrg: string;
  isoStd: string;
  uncertainty: number;
}
export function useRequestVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: VerificationReq) =>
      api().post<ApiVerification>(ENDPOINTS.ghg.verifications, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

export interface VerificationDecideReq {
  id: number;
  decision: VerificationDecision;
  note?: string;
}
export function useDecideVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: VerificationDecideReq) =>
      api().patch<ApiVerification>(ENDPOINTS.ghg.decideVerification(id), { decision, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}
