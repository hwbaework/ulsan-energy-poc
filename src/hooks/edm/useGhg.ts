'use client';

// 온실가스 인벤토리 — energy-backend /api/v1/ghg 배선. 설계문서 15.
// 백엔드 미가동 시 mocks/ghg.ts로 폴백(프로젝트 mock-first 컨벤션). 가동 시 실 API.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { ghgKeys } from '@/api/edmQueryKeys';
import {
  type EmissionSource,
  type ActivityRow,
  type StatementRow,
  type CalcRow,
  type Scope,
  type ActivityType,
  type StatementStatus,
} from '@/mocks/edm/ghg';

// ── API 응답 형상 (GhgDto) ──
interface ApiSource {
  id: number;
  site: string;
  facility: string;
  scope: number;
  category: string;
  tier: number;
  fuelFactor: number | null;
}
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
interface ApiCalcRow {
  sourceId: number;
  facility: string;
  scope: number;
  activity: number;
  unit: string;
  factor: number;
  tCO2eq: number;
}
interface ApiCalcResult {
  rows: ApiCalcRow[];
  scope1: number;
  scope2: number;
  total: number;
}
interface ApiStatement {
  id: number;
  year: number;
  status: string;
  scope1: number;
  scope2: number;
  total: number;
  submittedAt: string | null;
}

const api = () => getApiClient();

const mapSource = (s: ApiSource): EmissionSource => ({
  id: String(s.id),
  site: s.site,
  facility: s.facility,
  scope: s.scope as Scope,
  category: s.category,
  tier: s.tier as 1 | 2 | 3,
  fuelFactor: s.fuelFactor,
});
const mapActivity = (a: ApiActivity): ActivityRow => ({
  id: String(a.id),
  sourceId: String(a.sourceId),
  year: a.year,
  type: a.type as ActivityType,
  amount: Number(a.amount),
  unit: a.unit,
  isAuto: a.isAuto,
  evidence: a.evidence ?? undefined,
});
const mapCalcRow = (r: ApiCalcRow): CalcRow => ({
  sourceId: String(r.sourceId),
  facility: r.facility,
  scope: r.scope as Scope,
  activity: Number(r.activity),
  unit: r.unit,
  factor: Number(r.factor),
  tCO2eq: Number(r.tCO2eq),
});
const mapStatement = (s: ApiStatement): StatementRow => ({
  id: String(s.id),
  year: s.year,
  status: s.status as StatementStatus,
  scope1: Number(s.scope1),
  scope2: Number(s.scope2),
  total: Number(s.total),
  submittedAt: s.submittedAt ?? undefined,
});

// ── 조회 훅 (설계 22: 프로덕션 mock 폴백 제거 — 실데이터/빈/오류 상태를 정확히 노출) ──
// isLive = 실데이터 성공. isError = 호출 실패(인증만료·네트워크). 회사 미귀속은 페이지가 companyId로 판정.
export function useGhgSources(companyId?: number) {
  const q = useQuery({
    queryKey: ghgKeys.sources(companyId),
    queryFn: async () =>
      (await api().get<ApiSource[]>(ENDPOINTS.ghg.sources, { companyId })).map(mapSource),
    enabled: !!companyId,
    retry: false,
  });
  return { data: (q.data ?? []) as EmissionSource[], isLive: q.isSuccess, isError: q.isError };
}

export function useGhgActivities(companyId?: number, year = 2026) {
  const q = useQuery({
    queryKey: ghgKeys.activities(companyId, year),
    queryFn: async () =>
      (await api().get<ApiActivity[]>(ENDPOINTS.ghg.activities, { companyId, year })).map(
        mapActivity,
      ),
    enabled: !!companyId,
    retry: false,
  });
  return { data: (q.data ?? []) as ActivityRow[], isLive: q.isSuccess, isError: q.isError };
}

export function useGhgCalculation(companyId?: number, year = 2026) {
  const q = useQuery({
    queryKey: ghgKeys.calculation(companyId, year),
    queryFn: async () =>
      await api().get<ApiCalcResult>(ENDPOINTS.ghg.calculation, { companyId, year }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      rows: q.data.rows.map(mapCalcRow),
      scope1: Number(q.data.scope1),
      scope2: Number(q.data.scope2),
      total: Number(q.data.total),
      isLive: true,
      isError: false,
    };
  }
  return {
    rows: [] as CalcRow[],
    scope1: 0,
    scope2: 0,
    total: 0,
    isLive: false,
    isError: q.isError,
  };
}

export function useGhgStatements(companyId?: number) {
  const q = useQuery({
    queryKey: ghgKeys.statements(companyId),
    queryFn: async () =>
      (await api().get<ApiStatement[]>(ENDPOINTS.ghg.statements, { companyId })).map(mapStatement),
    enabled: !!companyId,
    retry: false,
  });
  return { data: (q.data ?? []) as StatementRow[], isLive: q.isSuccess, isError: q.isError };
}

// ── 명세서 상태전이 뮤테이션 ──
export function useGenerateStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, year }: { companyId: number; year: number }) =>
      api().post<ApiStatement>(
        `${ENDPOINTS.ghg.generateStatement}?companyId=${companyId}&year=${year}`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

export function useSubmitStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<ApiStatement>(ENDPOINTS.ghg.submitStatement(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

export function useVerifyStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<ApiStatement>(ENDPOINTS.ghg.verifyStatement(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// ── 마스터 입력 쓰기 뮤테이션 (설계 11 §2.1·§2.2) ──
// BE 계약: GhgDto.SourceReq / ActivityReq. companyId는 body 포함(@RequestBody).
export interface SourceReq {
  companyId: number;
  site: string;
  facility: string;
  scope: 1 | 2;
  category: string;
  tier: 1 | 2 | 3;
  fuelFactor?: number | null;
}
export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: SourceReq) => api().post<ApiSource>(ENDPOINTS.ghg.sources, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// 배출원 마스터 정정 (설계 22 §2) — company 경계는 BE에서 검증.
export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: number; req: SourceReq }) =>
      api().put<ApiSource>(ENDPOINTS.ghg.sourceById(id), req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

// 배출원 삭제 (설계 22 §2) — 참조 활동자료 존재 시 BE가 GH001로 차단.
export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, companyId }: { id: number; companyId: number }) =>
      // BE는 companyId를 @RequestParam(쿼리)로 받는다 — axios delete body 아님.
      api().delete<void>(`${ENDPOINTS.ghg.sourceById(id)}?companyId=${companyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}

export interface ActivityReq {
  sourceId: number;
  companyId: number;
  year: number;
  type: ActivityType;
  amount: number;
  unit: string;
  isAuto: boolean;
  evidence?: string | null;
}
export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ActivityReq) => api().post<ApiActivity>(ENDPOINTS.ghg.activities, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ghgKeys.all }),
  });
}
