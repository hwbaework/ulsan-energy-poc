'use client';

// 카본 마켓 — energy-backend /api/v1/carbon 배선. 설계문서 17.
// 설계 22: 프로덕션 mock 폴백 제거 — 조회 훅은 {data, isLive(성공), isError(호출실패)}로 상태를 정확히 노출.
//   회사 미귀속은 페이지가 companyId로 판정. 가짜 수치를 실데이터로 위장하지 않는다.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { carbonKeys } from '@/api/edmQueryKeys';
import type { KrxQuote, OtcOrder, OffsetProject, VoluntaryMarket } from '@/mocks/edm/carbon';

interface ApiQuote {
  name: string;
  last: number;
  change: number;
  bid: number;
  ask: number;
}
interface ApiHolding {
  kau: number;
  koc: number;
  kcu: number;
}
interface ApiOtc {
  id: number;
  company: string;
  side: 'BUY' | 'SELL';
  type: 'KAU' | 'KOC';
  amount: number;
  price: number;
  etrs: 'PENDING' | 'FILED' | 'NONE';
}
interface ApiOffset {
  id: number;
  name: string;
  methodology: string;
  status: 'PLAN' | 'APPROVED' | 'MONITORING' | 'ISSUED';
  kocIssued: number;
  recDuplicate: boolean;
}

const api = () => getApiClient();

const EMPTY_HOLDING = { kau: 0, koc: 0, kcu: 0 };

export function useCarbonQuotes() {
  const q = useQuery({
    queryKey: carbonKeys.quotes(),
    queryFn: async () =>
      (await api().get<ApiQuote[]>(ENDPOINTS.carbon.quotes)).map(
        (x): KrxQuote => ({
          name: x.name,
          last: Number(x.last),
          change: Number(x.change),
          bid: Number(x.bid),
          ask: Number(x.ask),
        }),
      ),
    retry: false,
  });
  // 설계 22: mock(KRX_QUOTES) 폴백 제거 — 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as KrxQuote[], isLive: q.isSuccess, isError: q.isError };
}

export function useCarbonHolding(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.holding(companyId),
    queryFn: async () => await api().get<ApiHolding>(ENDPOINTS.carbon.holding, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: { kau: Number(q.data.kau), koc: Number(q.data.koc), kcu: Number(q.data.kcu) },
      isLive: true,
      isError: false,
    };
  }
  // 설계 22: mock(CARBON_HOLDINGS) 폴백 제거 — 오류/빈 시 0.
  return { data: EMPTY_HOLDING, isLive: false, isError: q.isError };
}

export function useCarbonOtc(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.otc(companyId),
    queryFn: async () =>
      (await api().get<ApiOtc[]>(ENDPOINTS.carbon.otc, { companyId })).map(
        (o): OtcOrder => ({
          id: String(o.id),
          company: o.company,
          side: o.side,
          type: o.type,
          amount: Number(o.amount),
          price: Number(o.price),
          etrs: o.etrs,
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: mock(OTC_ORDERS) 폴백 제거.
  return { data: (q.data ?? []) as OtcOrder[], isLive: q.isSuccess, isError: q.isError };
}

export function useCarbonOffsets(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.offsets(companyId),
    queryFn: async () =>
      (await api().get<ApiOffset[]>(ENDPOINTS.carbon.offsetProjects, { companyId })).map(
        (p): OffsetProject => ({
          id: String(p.id),
          name: p.name,
          methodology: p.methodology,
          status: p.status,
          kocIssued: Number(p.kocIssued),
          recDuplicate: p.recDuplicate,
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: mock(OFFSET_PROJECTS) 폴백 제거.
  return { data: (q.data ?? []) as OffsetProject[], isLive: q.isSuccess, isError: q.isError };
}

export function useCarbonVoluntary() {
  const q = useQuery({
    queryKey: [...carbonKeys.all, 'voluntary'],
    queryFn: async () => await api().get<VoluntaryMarket[]>(ENDPOINTS.carbon.voluntaryMarkets),
    retry: false,
  });
  // 설계 22: mock(VOLUNTARY_MARKETS) 폴백 제거.
  return { data: (q.data ?? []) as VoluntaryMarket[], isLive: q.isSuccess, isError: q.isError };
}

export function useCreateOtc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      companyId: number;
      company: string;
      side: string;
      type: string;
      amount: number;
      price: number;
    }) => api().post<ApiOtc>(ENDPOINTS.carbon.otc, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

export function useFileEtrs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<ApiOtc>(ENDPOINTS.carbon.fileEtrs(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}
