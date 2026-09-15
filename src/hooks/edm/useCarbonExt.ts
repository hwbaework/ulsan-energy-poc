'use client';

// 탄소 rev.2 배선 — /api/v1/carbon/{etrs,matches}. 기획 02 rev.2 §5.2.
// 설계 22: 프로덕션 mock 폴백 제거 — 조회 훅은 {data, isLive(성공), isError(호출실패)}로 상태를 정확히 노출.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { carbonKeys } from '@/api/edmQueryKeys';

const api = () => getApiClient();

export interface EtrsRow {
  id: string;
  counterparty: string;
  type: 'KAU' | 'KCU';
  amount: number;
  status: 'FILED' | 'PENDING';
  deadline: string;
  dDay?: number;
}
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

const dDayOf = (deadline: string): number | undefined => {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  return d >= 0 && d <= 14 ? d : undefined;
};

export function useCarbonEtrs(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.etrs(companyId),
    queryFn: async () =>
      (await api().get<ApiEtrs[]>(ENDPOINTS.carbon.etrs, { companyId })).map(
        (t): EtrsRow => ({
          id: String(t.id),
          counterparty: t.counterparty,
          type: t.certType as 'KAU' | 'KCU',
          amount: Number(t.amount),
          status: t.status as 'FILED' | 'PENDING',
          deadline: t.deadline,
          dDay: t.status === 'PENDING' ? dDayOf(t.deadline) : undefined,
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: mock(FALLBACK_ETRS) 폴백 제거 — 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as EtrsRow[], isLive: q.isSuccess, isError: q.isError };
}

export function useFileEtrs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<ApiEtrs>(ENDPOINTS.carbon.fileEtrsTransfer(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

// ── OTC 협의매매 매칭 (기획 10 §3.3) ──
export interface MatchRow {
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

export function useCarbonMatches(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.matches(companyId),
    queryFn: async () =>
      (await api().get<ApiMatch[]>(ENDPOINTS.carbon.matches, { companyId })).map(
        (m): MatchRow => ({
          id: m.id,
          buyCompany: m.buyCompany,
          sellCompany: m.sellCompany,
          certType: m.certType,
          amount: Number(m.amount),
          price: Number(m.price),
          feeBuy: Number(m.feeBuy),
          feeSell: Number(m.feeSell),
          status: m.status,
          matchedAt: m.matchedAt,
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as MatchRow[], isLive: q.isSuccess, isError: q.isError };
}

export function useRunMatching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: number) =>
      api().post<ApiMatch[]>(`${ENDPOINTS.carbon.runMatching}?companyId=${companyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

// ── KOC↔KCU 전환 (기획 10 §1) ──
export interface ApiConversion {
  id: number;
  companyId: number;
  offsetProjectId: number;
  amount: number;
  status: 'REQUESTED' | 'CROSSCHECK_FAILED' | 'CONVERTED';
  recDuplicate: boolean;
  blockedReason: string | null;
  convertedAt: string | null;
}

export function useCarbonConversions(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.conversions(companyId),
    queryFn: async () =>
      await api().get<ApiConversion[]>(ENDPOINTS.carbon.conversions, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as ApiConversion[], isLive: q.isSuccess, isError: q.isError };
}

export function useConvertKoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { companyId: number; offsetProjectId: number; amount: number }) =>
      api().post<ApiConversion>(ENDPOINTS.carbon.convert, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

// ── offset 생명주기 (기획 10 §4) ──
interface ApiMonitoring {
  id: number;
  offsetProjectId: number;
  period: string;
  monitoredTco2: number;
  reportUrl: string | null;
  status: string;
}
interface ApiOffset {
  id: number;
  name: string;
  methodology: string;
  status: string;
  kocIssued: number;
  recDuplicate: boolean;
}

export function useCreateMonitoring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      period,
      monitoredTco2,
    }: {
      id: number;
      period: string;
      monitoredTco2: number;
    }) => api().post<ApiMonitoring>(ENDPOINTS.carbon.monitoring(id), { period, monitoredTco2 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

export function useIssueKoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().post<ApiOffset>(ENDPOINTS.carbon.issueKoc(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}
