export interface TradingRequest {
  id: number;
  requesterType: string;
  companyId: number;
  companyName: string;
  dealType: string;
  status: string;
  capacityKw: number;
  durationYears: number;
  desiredUnitPrice: number;
  region: string;
  siteName?: string;
  plantName?: string;
  expectedAnnualKwh?: number;
  recEligible?: boolean;
  notes?: string;
  currentStep: number;
  meetingScheduledAt?: string;
  submittedAt?: string;
  createdAt: string;
}

export interface TradingMatch {
  id: number;
  requestId: number;
  generatorCompanyId: number;
  generatorCompanyName: string;
  plantName: string;
  resourceType: string;
  capacityKw: number;
  proposedPriceKrw: number;
  status: string;
  requestStatus?: string;
  consumerCompanyName?: string;
  dealType?: string;
  ppaSubType?: string;
  createdAt: string;
}

export interface MarketPrice {
  id: number;
  priceDate: string;
  priceType: string;
  region: string;
  price: number;
  unit: string;
}

export interface RecTransaction {
  id: number;
  plantId: number;
  contractId?: number;
  transactionType: string;
  quantity: number;
  period: string;
  totalAmount: number;
  transactedAt: string;
}

export interface CreateTradingRequest {
  requesterType: string;
  companyId: number;
  dealType: string;
  capacityKw: number;
  durationYears: number;
  desiredUnitPrice?: number;
  region?: string;
  siteName?: string;
  matching247Target?: number;
  plantName?: string;
  expectedAnnualKwh?: number;
  recEligible?: boolean;
  notes?: string;
  consultationId?: number;
  powerStationId?: number; // 설계문서 22 §4.2 — 선택식 편입(발전소 참조). optional, 기존 호출 무파괴.
}

export interface CreateTradingMatch {
  requestId: number;
  generatorCompanyId: number;
  plantName?: string;
  resourceType?: string;
  capacityKw?: number;
  proposedPriceKrw?: number;
  cfeContribution?: number;
  recEligible?: boolean;
}
