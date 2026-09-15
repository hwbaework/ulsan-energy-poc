import { getApiClient } from '@/api/client';

export interface PlantPerformance {
  plantId: number;
  name: string;
  capacityKw: number;
  period: string;
  totalGenerationKwh: number;
  capacityFactorPct: number;
  performanceRatioPct: number;
  operatingHours: number;
  peakOutputKw: number;
  avgOutputKw: number;
}

export async function getPlantPerformance(
  laseeId: number,
  from: string,
  to: string,
): Promise<PlantPerformance> {
  return getApiClient().get(`/monitoring/plants/${laseeId}/performance`, { from, to });
}

export async function comparePlants(from: string, to: string): Promise<PlantPerformance[]> {
  return getApiClient().get('/monitoring/plants/compare', { from, to });
}
