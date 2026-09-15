import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { PowerStation, Equipment, PageResponse, ListQueryParams } from '@/types';

export interface PowerStationDocument {
  id: number;
  stationId: number;
  documentType: string;
  fileName: string;
  fileId: number;
  issuedAt?: string;
  expiresAt?: string;
}

export async function getPowerStations(
  params?: ListQueryParams,
): Promise<PageResponse<PowerStation>> {
  return getApiClient().get(ENDPOINTS.powerStations.list, params);
}

export async function getPowerStation(id: number): Promise<PowerStation> {
  return getApiClient().get(ENDPOINTS.powerStations.detail(id));
}

export async function createPowerStation(data: object): Promise<PowerStation> {
  return getApiClient().post(ENDPOINTS.powerStations.list, data);
}

export async function updatePowerStation(id: number, data: object): Promise<PowerStation> {
  return getApiClient().put(ENDPOINTS.powerStations.detail(id), data);
}

export async function deletePowerStation(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.powerStations.detail(id));
}

export async function activatePowerStation(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.powerStations.activate(id));
}

export async function deactivatePowerStation(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.powerStations.deactivate(id));
}

export async function getPowerStationsByCompany(companyId: number): Promise<PowerStation[]> {
  return getApiClient().get(ENDPOINTS.powerStations.byCompany(companyId));
}

export async function getPowerStationEquipment(id: number): Promise<Equipment[]> {
  return getApiClient().get(ENDPOINTS.powerStations.equipment(id));
}

export async function getDocuments(stationId: number): Promise<PowerStationDocument[]> {
  return getApiClient().get(ENDPOINTS.powerStations.documents(stationId));
}

export async function addDocument(
  stationId: number,
  params: object,
): Promise<PowerStationDocument> {
  return getApiClient().post(ENDPOINTS.powerStations.documents(stationId), params);
}

export async function deleteDocument(docId: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.powerStations.deleteDocument(docId));
}
