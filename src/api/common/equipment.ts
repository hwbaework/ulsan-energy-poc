import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Equipment, PageResponse, ListQueryParams } from '@/types';

export async function getEquipmentList(params?: ListQueryParams): Promise<PageResponse<Equipment>> {
  return getApiClient().get(ENDPOINTS.equipment.list, params);
}

export async function getEquipment(id: number): Promise<Equipment> {
  return getApiClient().get(ENDPOINTS.equipment.detail(id));
}

export async function createEquipment(data: object): Promise<Equipment> {
  return getApiClient().post(ENDPOINTS.equipment.list, data);
}

export async function updateEquipment(id: number, data: object): Promise<Equipment> {
  return getApiClient().put(ENDPOINTS.equipment.detail(id), data);
}

export async function deleteEquipment(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.equipment.detail(id));
}

export async function activateEquipment(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.equipment.activate(id));
}

export async function deactivateEquipment(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.equipment.deactivate(id));
}

export async function getMaintenances(equipmentId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.equipment.maintenances(equipmentId));
}

export async function createMaintenance(equipmentId: number, data: object): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.equipment.maintenances(equipmentId), data);
}

export async function getMetrics(): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.equipment.metrics);
}
