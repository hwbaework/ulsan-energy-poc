import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Reading, DailyGenerationSummary, PageResponse, ListQueryParams } from '@/types';

export interface DailyReportRow {
  date: string;
  solar: number;
  orc: number;
  fuelCell: number;
  efficiency: number;
}

export async function getReadings(
  equipmentId: number,
  params?: ListQueryParams,
): Promise<PageResponse<Reading>> {
  return getApiClient().get(ENDPOINTS.readings.byEquipment(equipmentId), params);
}

export async function getDailySummary(
  powerStationId: number,
  params?: ListQueryParams,
): Promise<DailyGenerationSummary[]> {
  return getApiClient().get(ENDPOINTS.readings.dailySummary(powerStationId), params);
}

export async function getReportSummary(params: {
  from: string;
  to: string;
  powerStationId?: number;
}): Promise<DailyReportRow[]> {
  return getApiClient().get(ENDPOINTS.readings.reportSummary, params);
}
