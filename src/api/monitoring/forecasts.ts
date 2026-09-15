import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Forecast, ForecastPenalty } from '@/types';

export async function getForecasts(plantId: number, from: string, to: string): Promise<Forecast[]> {
  return getApiClient().get(ENDPOINTS.forecasts.byPlant(plantId), { from, to });
}

export async function getForecastPenalties(plantId: number): Promise<ForecastPenalty[]> {
  return getApiClient().get(ENDPOINTS.forecasts.penalties(plantId));
}
