import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  Re100Roadmap,
  EnergySourceMix,
  CreateRoadmapRequest,
  UpdateRoadmapRequest,
} from '@/types';

export async function getRoadmap(companyId: number): Promise<Re100Roadmap[]> {
  return getApiClient().get(ENDPOINTS.re100.roadmap(companyId));
}

export async function getSourceMix(companyId: number, period: string): Promise<EnergySourceMix[]> {
  return getApiClient().get(ENDPOINTS.re100.sourceMix, { companyId, period });
}

export async function createRoadmap(data: CreateRoadmapRequest): Promise<Re100Roadmap> {
  return getApiClient().post(ENDPOINTS.re100.createRoadmap, data);
}

export async function updateRoadmap(id: number, data: UpdateRoadmapRequest): Promise<Re100Roadmap> {
  return getApiClient().put(ENDPOINTS.re100.updateRoadmap(id), data);
}

export async function deleteRoadmap(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.re100.updateRoadmap(id));
}

export async function getMonthlyProgress(companyId: number, year: number): Promise<any[]> {
  return getApiClient().get(ENDPOINTS.re100.monthlyProgress, { companyId, year });
}
