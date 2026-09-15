'use client';

// 성과 실적 배관 — energy-backend /api/v1/performance 배선 (F-A, 스펙 09 §3.1~3.2 / B2 계약).
// A유형 자동연동(지표3·4·5·6·8) + B유형 수기(지표1·2·7·9·10) 승인 흐름.
// edmEndpoints.ts/endpoints.ts 수정 금지(F-A 소유권) → 경로 상수는 본 파일 로컬에 둔다(게이트에서 병합).
// FE 산식 재계산 금지 — 서버 집계/승인값만 표시(doc00 §4·§6).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';

const api = () => getApiClient();

// 로컬 경로 상수 (공유 endpoints.ts 미수정 정책)
const PERF = {
  summary: '/performance/summary',
  tenantUsage: '/performance/tenant-usage',
  finance: '/performance/finance',
  indicatorActuals: (no: number) => `/performance/indicators/${no}/actuals`,
  putActual: (no: number) => `/performance/indicators/${no}/actual`,
  submit: (no: number) => `/performance/indicators/${no}/submit`,
  approve: (no: number) => `/performance/indicators/${no}/approve`,
  reject: (no: number) => `/performance/indicators/${no}/reject`,
  aggregate: '/performance/aggregate',
} as const;

export type IndicatorSource = 'auto' | 'manual';
export type ActualStatus = 'draft' | 'submitted' | 'approved';

/** GET /performance/summary?year= — 지표 10종 요약 (실적 null이면 미연동/정직 표시) */
export interface PerformanceIndicator {
  no: number;
  target: number | string | null;
  actual: number | string | null; // null → 미연동
  source: IndicatorSource;
  progressPct: number | null;
  formula: string | null;
  trend: 'up' | 'flat' | 'down' | null;
  evidenceCount: number;
  status?: ActualStatus | null; // 수기 지표 상태
  lastAggregatedAt?: string | null; // auto
  approvedAt?: string | null; // manual approved
}

export function usePerformanceSummary(year?: number) {
  return useQuery({
    queryKey: ['performance', 'summary', year],
    queryFn: async () => await api().get<PerformanceIndicator[]>(PERF.summary, { year }),
    enabled: !!year,
    retry: false,
  });
}

/** 지표6 자동 이용률 — GET /performance/tenant-usage?year= */
export interface TenantUsageRow {
  name: string;
  registeredAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  active: boolean;
}
export interface TenantUsage {
  recruited: number | null;
  registered: number | null;
  active1plus: number | null;
  utilPct: number | null;
  source: IndicatorSource;
  lastAggregatedAt?: string | null;
  tenants: TenantUsageRow[];
}

export function useTenantUsage(year?: number) {
  return useQuery({
    queryKey: ['performance', 'tenant-usage', year],
    queryFn: async () => await api().get<TenantUsage>(PERF.tenantUsage, { year }),
    enabled: !!year,
    retry: false,
  });
}

/** 재무 집계 — GET /performance/finance?year= (미연동 시 null → 정직 표시) */
export interface FinanceFacility {
  name: string;
  revenue: number | null;
  basis: string | null;
}
export interface FinanceSpcSchedule {
  period: string;
  principal: number;
  interest: number;
  balance: number;
}
export interface FinanceSpc {
  name: string;
  repaidPct: number | null;
  dividend: string | null;
  schedule: FinanceSpcSchedule[];
}
export interface FinanceData {
  facilities: FinanceFacility[];
  spc: FinanceSpc[];
}

export function useFinance(year?: number) {
  return useQuery({
    queryKey: ['performance', 'finance', year],
    queryFn: async () => await api().get<FinanceData>(PERF.finance, { year }),
    enabled: !!year,
    retry: false,
  });
}

/** 지표별 수기 실적 이력 — GET /performance/indicators/{no}/actuals?year= */
export interface IndicatorActual {
  id: number;
  indicatorNo: number;
  year: number;
  quarter: number | null;
  actualValue: number | null;
  source: IndicatorSource;
  status: ActualStatus;
  evidenceIds: string[];
  updatedBy: string | null;
  updatedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export function useIndicatorActuals(no?: number, year?: number) {
  return useQuery({
    queryKey: ['performance', 'actuals', no, year],
    queryFn: async () => await api().get<IndicatorActual[]>(PERF.indicatorActuals(no!), { year }),
    enabled: no != null && !!year,
    retry: false,
  });
}

// ── 수기 실적 뮤테이션 (draft → submitted → approved / reject → draft) ──

export interface PutActualInput {
  no: number;
  year: number;
  quarter?: number | null;
  actualValue: number;
  evidenceIds?: string[];
}

function invalidatePerformance(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['performance'] });
}

/** 수기 실적 저장 → draft */
export function useSaveActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, ...body }: PutActualInput) =>
      api().put<IndicatorActual>(PERF.putActual(no), body),
    onSuccess: () => invalidatePerformance(qc),
  });
}

/** 제출 → submitted */
export function useSubmitActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, year }: { no: number; year: number }) =>
      api().post<IndicatorActual>(PERF.submit(no), { year }),
    onSuccess: () => invalidatePerformance(qc),
  });
}

/** 승인 → approved */
export function useApproveActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, year }: { no: number; year: number }) =>
      api().post<IndicatorActual>(PERF.approve(no), { year }),
    onSuccess: () => invalidatePerformance(qc),
  });
}

/** 반려(사유) → draft */
export function useRejectActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, year, reason }: { no: number; year: number; reason: string }) =>
      api().post<IndicatorActual>(PERF.reject(no), { year, reason }),
    onSuccess: () => invalidatePerformance(qc),
  });
}

/** 자동 지표 재집계 트리거 — POST /performance/aggregate?indicatorNo=&year= */
export function useAggregateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ indicatorNo, year }: { indicatorNo: number; year: number }) =>
      api().post<PerformanceIndicator>(PERF.aggregate, { indicatorNo, year }),
    onSuccess: () => invalidatePerformance(qc),
  });
}
