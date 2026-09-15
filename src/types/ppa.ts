export interface PpaContract {
  id: number;
  contractNumber: string;
  contractType: string;
  ppaSubType?: 'onsite' | 'offsite' | 'lease' | string;
  status: string;
  generatorCompanyId: number;
  generatorCompanyName: string;
  consumerCompanyId: number;
  consumerCompanyName: string;
  consumerSiteName?: string;
  totalCapacityKw: number;
  unitPriceKrw: number;
  matching247Target?: number;
  startDate: string;
  endDate: string;
  settlementDay?: number;
  createdAt: string;
}

export interface PpaSettlement {
  id: number;
  contractId: number;
  contractNumber: string;
  plantId: number;
  plantName: string;
  period: string;
  status: string;
  generationKwh: number;
  smpUnitPrice: number;
  supplyAmount: number;
  vat: number;
  total: number;
  tradeFee: number;
  supplyFee: number;
  manageFee: number;
  adjustAmount: number;
  networkFee: number;
  fundAmount: number;
  transmissionLoss: number;
  welfareCost: number;
  vatBase: number;
  ppaKind: 'offsite' | 'onsite' | 'lease';
  matchingRate: number;
  createdAt: string;
}

export interface PpaInvoice {
  id: number;
  settlementId: number;
  invoiceNumber: string;
  direction: 'purchase' | 'sale';
  invoiceStatus: string;
  paymentStatus: string;
  amount: number;
  vat: number;
  total: number;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  supplierBizNo?: string;
  supplierName?: string;
  supplierRepresentative?: string;
  supplierAddress?: string;
  supplierBizType?: string;
  supplierBizCategory?: string;
  receiverBizNo?: string;
  receiverName?: string;
  receiverRepresentative?: string;
  receiverAddress?: string;
  receiverBizType?: string;
  receiverBizCategory?: string;
  isAmendment?: boolean;
  amendmentReasonCode?: string;
  eseroStatus?: string;
}

export interface PpaContractChange {
  id: number;
  contractId: number;
  contractNumber?: string;
  ppaSubType?: string;
  generatorCompanyName?: string;
  consumerCompanyName?: string;
  changeType: string;
  requestedByRole?: 'CONSUMER' | 'GENERATOR' | string;
  status: string;
  currentStep: number;
  totalSteps: number;
  generatorApprovalStatus: string;
  terminationFee?: number;
  description?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PpaUsageDeviation {
  id: number;
  contractId: number;
  period: string;
  eventDate: string;
  cause: string;
  deviationKwh: number;
  resolution: string;
  resolutionDetail?: string;
}
