import type { PageResponse } from './common';

export interface ConsumerSite {
  id: number;
  companyId: number;
  name: string;
  siteType: string;
  siteCode?: string;
  address?: string;
  contractPowerKw?: number;
  peakDemandKw?: number;
  rePercent?: number;
  status?: string;
}

export interface ConsumerFacility {
  id: number;
  siteId: number;
  facilityCode?: string;
  name: string;
  facilityType: string;
  capacity?: string;
  status?: string;
}

export interface ConsumerUsage {
  id: number;
  siteId: number;
  period: string;
  totalUsageKwh: number;
  ppaSupplyKwh: number;
  kepcoUsageKwh: number;
  selfGenKwh: number;
  peakDemandKw?: number;
  rePercent?: number;
}

export interface ConsumerBilling {
  id: number;
  companyId: number;
  period: string;
  ppaAmount: number;
  kepcoAmount: number;
  leaseAmount: number;
  totalAmount: number;
  savedAmount: number;
  status: string;
  dueDate?: string;
}

export interface ConsumerContract {
  id: number;
  powerStationId: number;
  powerStationName: string;
  consumerCompanyId: number;
  consumerCompanyName: string;
  contractType: string;
  contractNumber?: string;
  contractStart: string;
  contractEnd?: string;
  contractCapacityKw?: number;
  unitPriceKrw?: number;
  status: string;
}

export type ConsumerSitePage = PageResponse<ConsumerSite>;
