'use client';

// 데이터마켓 주문 내역 — 07 §9.1.2 SPEC-P0-COMMERCE.
// 정본 경로 = GET /api/v1/datamarket/orders (DmController 실동작).
// trading.orders 정의는 소비 금지(이중정의 혼선 — 검증 FIX-1).
// trading 화면의 인라인 MOCK_ORDERS를 이 훅으로 치환.
// 설계 22: 프로덕션 mock 폴백 제거 — {data, isLive(성공), isError(호출실패)}로 상태를 정확히 노출.

import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { dmKeys } from '@/api/edmQueryKeys';
import type { Order, OrderStatus, OrderType } from '@/types/edm';

const api = () => getApiClient();

interface ApiOrderRow {
  id: number;
  orderNumber: string;
  consumerId?: number;
  datasetId: number;
  datasetTitle: string;
  providerName: string;
  type: string;
  status: string;
  amount: number;
  commission?: number;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  timeline?: { id: number; type: string; description: string; createdAt: string }[];
  createdAt?: string;
  updatedAt?: string;
}

function mapOrder(r: ApiOrderRow): Order {
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    consumerId: r.consumerId ?? 0,
    datasetId: r.datasetId,
    datasetTitle: r.datasetTitle,
    providerName: r.providerName,
    type: (r.type as OrderType) ?? 'ONETIME',
    status: (r.status as OrderStatus) ?? 'ACTIVE',
    amount: Number(r.amount ?? 0),
    commission: Number(r.commission ?? 0),
    startDate: r.startDate ?? r.createdAt ?? '',
    endDate: r.endDate,
    autoRenew: r.autoRenew ?? false,
    timeline: (r.timeline ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
    })),
    createdAt: r.createdAt ?? '',
    updatedAt: r.updatedAt ?? r.createdAt ?? '',
  };
}

// 데이터셋 주문 목록 조회. 설계 22: mock 폴백 제거 — 실데이터/빈/오류 정확 노출.
export function useOrders(companyId?: number) {
  const q = useQuery({
    queryKey: [...dmKeys.all, 'orders', companyId] as const,
    queryFn: async () =>
      (await api().get<ApiOrderRow[]>(ENDPOINTS.datamarket.orders, { companyId })).map(mapOrder),
    retry: false,
  });
  return {
    data: (q.data ?? []) as Order[],
    isLive: q.isSuccess,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}
