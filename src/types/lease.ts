export interface VolumeLeaseContract {
  id: number;
  consumerCompanyId: number;
  consumerCompanyName: string;
  generatorCompanyId: number;
  generatorCompanyName: string;
  siteName: string;
  capacityKw: number;
  contractYears: number;
  monthlyRent: number;
  warrantyHours: number;
  startDate: string;
  status: string;
  insuranceStatus: string;
  createdAt: string;
}

export interface SavingsShareContract {
  id: number;
  consumerCompanyId: number;
  consumerCompanyName: string;
  generatorCompanyId: number;
  generatorCompanyName: string;
  siteName: string;
  capacityKw: number;
  contractYears: number;
  sharePct: number;
  status: string;
  createdAt: string;
}

export interface LeaseMonthlyRecord {
  id: number;
  leaseType: string;
  leaseContractId: number;
  period: string;
  baselineBill: number;
  reducedBill: number;
  generatedKwh: number;
  unitPriceKrw: number;
  savedAmount: number;
  shareToGenerator: number;
  netSavings: number;
  rent: number;
}

export interface LeaseInvoice {
  id: number;
  leaseType: string;
  leaseContractId: number;
  invoiceNumber: string;
  period: string;
  direction: string;
  invoiceStatus: string;
  paymentStatus: string;
  leaseFee: number;
  maintenanceFee: number;
  supplyAmount: number;
  vat: number;
  total: number;
  lessorName: string;
  equipmentName?: string;
  siteName?: string;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  supplierBizNo?: string;
  supplierName?: string;
  supplierName2?: string;
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
}

export interface LeaseRequest {
  id: number;
  consumerCompanyId: number;
  leaseType: string;
  siteName: string;
  desiredCapacityKw: number;
  desiredYears?: number;
  notes?: string;
  status: string;
  createdAt: string;
}

export interface LeaseEquipment {
  id: number;
  generatorCompanyId: number;
  equipmentName: string;
  equipmentType: string;
  capacityKw: number;
  location?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface EquipmentRecovery {
  id: number;
  leaseType: string;
  leaseContractId: number;
  siteName: string;
  status: string;
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
  createdAt: string;
}

export interface SavingsCalculation {
  baselineBill: number;
  reducedBill: number;
  savedAmount: number;
  shareToGenerator: number;
  netSavings: number;
}
