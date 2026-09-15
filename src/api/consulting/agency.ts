import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ConsultingAgency, PageResponse } from '@/types';

export async function getAgencies(params?: object): Promise<PageResponse<ConsultingAgency>> {
  return getApiClient().get(ENDPOINTS.agencies.list, params);
}

export async function getAgency(id: number): Promise<ConsultingAgency> {
  return getApiClient().get(ENDPOINTS.agencies.detail(id));
}

export async function getAgencyByCompany(companyId: number): Promise<ConsultingAgency> {
  return getApiClient().get(ENDPOINTS.agencies.byCompany(companyId));
}
