import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { DashboardSummary } from '@/types';

export interface MonthlySettlement {
  month: string;
  ppaTotal: number;
  leaseTotal: number;
  consultingTotal: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return getApiClient().get(ENDPOINTS.dashboard.summary);
}

export async function getMonthlySettlements(year?: number): Promise<MonthlySettlement[]> {
  const params = year ? `?year=${year}` : '';
  return getApiClient().get(`${ENDPOINTS.dashboard.monthlySettlements}${params}`);
}
