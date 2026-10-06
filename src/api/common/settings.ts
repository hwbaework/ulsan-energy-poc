import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { SystemSetting } from '@/types';
import type { TariffYear } from '@/lib/solar-sim';

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

/** 산업용 평균판매단가 연도별 실적 — 무료진단 실적 CAGR 시나리오 근거 */
export async function getIndustrialTariff(): Promise<TariffYear[]> {
  return getApiClient().get(ENDPOINTS.systemSettings.industrialTariff);
}

export async function saveIndustrialTariff(rows: TariffYear[]): Promise<TariffYear[]> {
  return getApiClient().put(ENDPOINTS.systemSettings.industrialTariff, rows);
}
