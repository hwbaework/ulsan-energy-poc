import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { SystemSetting } from '@/types';

export async function getSettings(): Promise<SystemSetting[]> {
  return getApiClient().get(ENDPOINTS.systemSettings.list);
}

export async function getSetting(key: string): Promise<SystemSetting> {
  return getApiClient().get(ENDPOINTS.systemSettings.byKey(key));
}

export async function updateSetting(key: string, value: string): Promise<SystemSetting> {
  return getApiClient().put(ENDPOINTS.systemSettings.byKey(key), { value });
}

export async function getEnergySettings(): Promise<Record<string, string>> {
  return getApiClient().get(ENDPOINTS.systemSettings.energy);
}
