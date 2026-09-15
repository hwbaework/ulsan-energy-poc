import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { SpcAsset } from '@/types';

export async function getSpcAssets(params?: {
  companyId: number;
  assetType?: string;
}): Promise<SpcAsset[]> {
  return getApiClient().get(ENDPOINTS.spc.assets, params);
}

export async function getSpcAsset(id: number): Promise<SpcAsset> {
  return getApiClient().get(ENDPOINTS.spc.assetDetail(id));
}

export interface SpcTradingMonthly {
  month: string;
  count: number;
  totalCapacityKw: number;
  estimatedAmount: number;
}

export interface SpcGenerationDaily {
  date: string;
  totalKwh: number;
  stationCount: number;
}

export interface SpcSupplierGroup {
  businessType: string;
  companyCount: number;
}

export async function getSpcTradingMonthly(year?: number): Promise<SpcTradingMonthly[]> {
  return getApiClient().get(ENDPOINTS.spc.tradingMonthly, year != null ? { year } : undefined);
}

export async function getSpcGenerationDaily(days = 30): Promise<SpcGenerationDaily[]> {
  return getApiClient().get(ENDPOINTS.spc.generationDaily, { days });
}

export async function getSpcSuppliers(): Promise<SpcSupplierGroup[]> {
  return getApiClient().get(ENDPOINTS.spc.suppliers);
}

// V106: SPC 재무 실적 (입력 대기 — 비면 []). 가짜 수치 없음.
export interface SpcFinance {
  id: number;
  companyId: number;
  spcEntity: string;
  equityPct: number | null;
  dividend: number | null;
  repayment: number | null;
  period: string | null;
}

export async function getSpcFinance(companyId?: number): Promise<SpcFinance[]> {
  return getApiClient().get(ENDPOINTS.spc.finance, companyId != null ? { companyId } : undefined);
}
