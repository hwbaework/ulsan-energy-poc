import type { BaseEntity } from './common';

// 계약 정본 = BE DmOrder 4종 (설계 12 §7.2). 환불·분쟁(REFUNDED·DISPUTED) 등은
// BE 미구현 → FE에서 표시하지 않는다(가짜 상태 금지). 정산 지급 완료는 PAID(설계 12 §4).
export type OrderStatus = 'PAYMENT_PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PAID';

export type OrderType = 'ONETIME' | 'SUBSCRIPTION';
export type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'VIRTUAL_ACCOUNT' | 'CREDIT';

export interface OrderEvent {
  id: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface Order extends BaseEntity {
  orderNumber: string;
  consumerId: number;
  datasetId: number;
  datasetTitle: string;
  providerName: string;
  type: OrderType;
  status: OrderStatus;
  amount: number;
  commission: number;
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  timeline: OrderEvent[];
}

export interface TradingFilters {
  status?: OrderStatus;
  type?: OrderType;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
  page?: number;
  size?: number;
}

export interface TradingHistory {
  items: Order[];
  summary: {
    totalCount: number;
    totalAmount: number;
    byMonth: { month: string; count: number; amount: number }[];
  };
}
