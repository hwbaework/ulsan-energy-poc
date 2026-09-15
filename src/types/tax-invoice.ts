export interface TaxInvoiceParty {
  bizRegistrationNo: string;
  name: string;
  representative: string;
  address: string;
  bizType: string;
  bizCategory: string;
}

export const AMENDMENT_REASONS = {
  ERROR_CORRECTION: {
    code: '01',
    label: '기재사항의 착오·정정',
    method: 'negative-positive' as const,
  },
  PRICE_CHANGE: { code: '02', label: '공급가액 변동', method: 'delta' as const },
  RETURN: { code: '03', label: '환입', method: 'negative' as const },
  CONTRACT_CANCEL: { code: '04', label: '계약의 해제', method: 'negative' as const },
  CREDIT_POST: {
    code: '05',
    label: '내국신용장 등 사후개설',
    method: 'negative-positive' as const,
  },
  DUPLICATE: { code: '06', label: '착오에 의한 이중발급', method: 'negative' as const },
} as const;

export type AmendmentReasonCode = keyof typeof AMENDMENT_REASONS;

export interface TaxInvoiceItem {
  date: string;
  description: string;
  specification?: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  vat: number;
  remark?: string;
}
