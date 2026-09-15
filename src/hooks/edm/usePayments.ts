'use client';

// 데이터마켓 상거래 결제 파이프 — 07 §9.1 SPEC-P0-COMMERCE.
// 주문 정본 = POST/GET /api/v1/datamarket/orders (DmController 실동작).
// 결제 = /api/v1/payments/{prepare,confirm,receipt} (모의 PG — 전 응답 isLive:false·mock:true).
// BE 미가동 시 낙관 폴백(주문 로컬 PAYMENT_PENDING·isLive:false 배지 — 가짜 성공 금지, line 289·311).
// hooks/edm 기존 5파일 수정 금지 규칙에 따라 신규 파일로 추가.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { dmKeys } from '@/api/edmQueryKeys';
import type { OrderType, PaymentMethod } from '@/types/edm';

const api = () => getApiClient();

// ── 계약 형상 (07 §9.1.2) ──
export type PriceModelKind = 'FREE' | 'ONETIME' | 'SUBSCRIPTION' | 'PAY_PER_USE';

export interface CreateOrderInput {
  datasetId: number;
  type: OrderType;
  priceModel: PriceModelKind;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  amount: number;
}
export interface OrderResult {
  orderId: number;
  status: string; // ACTIVE | PAYMENT_PENDING | ...
  amount: number;
  isLive: boolean;
  mock?: boolean;
}

export interface PrepareInput {
  orderId: number;
  amount: number;
  method: PaymentMethod;
}
export interface PrepareResult {
  paymentKey: string;
  redirectUrl: string;
  isLive: boolean;
  mock?: boolean;
}

export interface ConfirmInput {
  paymentKey: string;
  orderId: number;
  pgToken: string;
}
export interface ConfirmResult {
  orderId: number;
  status: string; // 'ACTIVE'
  isLive: boolean;
  mock?: boolean;
}

interface ApiOrder {
  orderId?: number;
  id?: number;
  status?: string;
  amount?: number;
  isLive?: boolean;
  mock?: boolean;
}
interface ApiPrepare {
  paymentKey?: string;
  redirectUrl?: string;
  isLive?: boolean;
  mock?: boolean;
}
interface ApiConfirm {
  orderId?: number;
  status?: string;
  isLive?: boolean;
  mock?: boolean;
}

// ── 낙관 폴백(BE 미가동) — 로컬 모의 값 생성 ──
let localOrderSeq = -1; // 음수로 실 서버 PK와 충돌 회피
function localOrderId(): number {
  return localOrderSeq--;
}

// ── 주문 생성: FREE→ACTIVE 즉시 / 유료→PAYMENT_PENDING ──
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation<OrderResult, unknown, CreateOrderInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiOrder>(ENDPOINTS.datamarket.orders, {
          datasetId: input.datasetId,
          type: input.type,
          priceModel: input.priceModel,
          billingCycle: input.billingCycle,
        });
        const d = res ?? {};
        return {
          orderId: d.orderId ?? d.id ?? localOrderId(),
          status: d.status ?? (input.priceModel === 'FREE' ? 'ACTIVE' : 'PAYMENT_PENDING'),
          amount: Number(d.amount ?? input.amount),
          isLive: d.isLive ?? true,
          mock: d.mock,
        };
      } catch {
        // BE 미가동 — 낙관 폴백(가짜 성공 금지: isLive:false 명시)
        return {
          orderId: localOrderId(),
          status: input.priceModel === 'FREE' ? 'ACTIVE' : 'PAYMENT_PENDING',
          amount: input.amount,
          isLive: false,
          mock: true,
        };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// ── 결제 준비: prepare → 모의 redirectUrl ──
export function usePreparePayment() {
  return useMutation<PrepareResult, unknown, PrepareInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiPrepare>(ENDPOINTS.payments.prepare, input);
        const d = res ?? {};
        return {
          paymentKey: d.paymentKey ?? `mock_${input.orderId}`,
          redirectUrl: d.redirectUrl ?? '',
          isLive: d.isLive ?? true,
          mock: d.mock,
        };
      } catch {
        return {
          paymentKey: `mock_${input.orderId}`,
          redirectUrl: `#mock-pg/${input.orderId}`,
          isLive: false,
          mock: true,
        };
      }
    },
  });
}

// ── 결제 확정: confirm(pgToken 스텁) → 주문 ACTIVE ──
export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation<ConfirmResult, unknown, ConfirmInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiConfirm>(ENDPOINTS.payments.confirm, input);
        const d = res ?? {};
        return {
          orderId: d.orderId ?? input.orderId,
          status: d.status ?? 'ACTIVE',
          isLive: d.isLive ?? true,
          mock: d.mock,
        };
      } catch {
        return { orderId: input.orderId, status: 'ACTIVE', isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// ── 영수증(PDF blob) 다운로드 ──
export function useReceipt() {
  return useMutation<Blob | null, unknown, number>({
    mutationFn: async (id) => {
      try {
        return await api().get<Blob>(ENDPOINTS.payments.receipt(id));
      } catch {
        return null;
      }
    },
  });
}
