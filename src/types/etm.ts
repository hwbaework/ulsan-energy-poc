export interface EtmAvailablePlant {
  id: number;
  name: string;
  generationType: string;
  capacityKw: number;
  address: string;
  ownerCompanyName: string;
  status: string;
}

export interface EtmContract {
  id: number;
  contractNumber: string;
  contractType: string;
  generatorName: string;
  consumerName: string;
  capacityKw: number;
  pricePerKwh: number;
  startDate: string;
  endDate: string;
  status: string;
}

export interface EtmSettlement {
  id: number;
  contractId: number;
  plantId: number;
  plantName: string;
  period: string;
  generationKwh: number;
  smpUnitPrice: number;
  supplyAmount: number;
  vat: number;
  total: number;
  status: string;
}

export interface EtmInvoice {
  id: number;
  settlementId: number;
  invoiceNumber: string;
  direction: string;
  invoiceStatus: string;
  paymentStatus: string;
  amount: number;
  vat: number;
  total: number;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
}
