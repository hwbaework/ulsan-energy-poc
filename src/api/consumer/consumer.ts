import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  ConsumerSite,
  ConsumerFacility,
  ConsumerUsage,
  ConsumerBilling,
  ConsumerContract,
  PageResponse,
} from '@/types';

export async function getConsumerSites(params?: object): Promise<PageResponse<ConsumerSite>> {
  return getApiClient().get(ENDPOINTS.consumer.sites, params);
}

export async function getConsumerSite(id: number): Promise<ConsumerSite> {
  return getApiClient().get(ENDPOINTS.consumer.siteDetail(id));
}

export async function createConsumerSite(params: {
  companyId: number;
  name: string;
  siteType: string;
  address?: string;
  contractPowerKw?: number;
}): Promise<ConsumerSite> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return getApiClient().post(`${ENDPOINTS.consumer.sites}?${qs}`);
}

export async function updateConsumerSite(params: {
  id: number;
  name?: string;
  siteType?: string;
  address?: string;
  contractPowerKw?: number;
}): Promise<ConsumerSite> {
  const { id, ...rest } = params;
  const qs = new URLSearchParams(
    Object.entries(rest)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return getApiClient().patch(`${ENDPOINTS.consumer.updateSite(id)}?${qs}`);
}

export async function deleteConsumerSite(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.consumer.deleteSite(id));
}

// 배출시설 마스터 — 온보딩 5스텝 위저드 스텝4(설계문서 19 §2·부록B). facility_code 서버 채번.
export async function getSiteFacilities(siteId: number): Promise<ConsumerFacility[]> {
  return getApiClient().get(ENDPOINTS.consumer.siteFacilities(siteId));
}

export async function createSiteFacility(params: {
  siteId: number;
  name: string;
  facilityType: string;
  capacity?: string;
}): Promise<ConsumerFacility> {
  const { siteId, ...rest } = params;
  const qs = new URLSearchParams(
    Object.entries(rest)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return getApiClient().post(`${ENDPOINTS.consumer.siteFacilities(siteId)}?${qs}`);
}

export async function deleteSiteFacility(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.consumer.deleteFacility(id));
}

export async function getSiteUsage(siteId: number): Promise<ConsumerUsage[]> {
  return getApiClient().get(ENDPOINTS.consumer.siteUsage(siteId));
}

export async function getBilling(companyId: number): Promise<ConsumerBilling[]> {
  return getApiClient().get(ENDPOINTS.consumer.billing, { companyId });
}

export async function getContracts(companyId: number): Promise<ConsumerContract[]> {
  return getApiClient().get(ENDPOINTS.consumer.contracts, { companyId });
}

export async function getContractsByStation(powerStationId: number): Promise<ConsumerContract[]> {
  return getApiClient().get(ENDPOINTS.consumer.contractsByStation(powerStationId));
}
