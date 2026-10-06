import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { SystemSetting } from '@/types';
import type { TariffTable, TariffYear } from '@/lib/solar-sim';

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

/** 에너지 설정 저장 — 바꾼 키만 보내면 나머지는 그대로 */
export async function saveEnergySettings(patch: Record<string, string>): Promise<Record<string, string>> {
  return getApiClient().put(ENDPOINTS.systemSettings.energy, patch);
}

/** 산업용 평균판매단가 연도별 실적 — 무료진단 실적 CAGR 시나리오 근거 */
export async function getIndustrialTariff(): Promise<TariffYear[]> {
  return getApiClient().get(ENDPOINTS.systemSettings.industrialTariff);
}

export async function saveIndustrialTariff(rows: TariffYear[]): Promise<TariffYear[]> {
  return getApiClient().put(ENDPOINTS.systemSettings.industrialTariff, rows);
}

/** 한전 요금표 — 무료진단 태양광 대체단가 · 기본요금 절감 */
export async function getKepcoTariff(): Promise<TariffTable> {
  return getApiClient().get(ENDPOINTS.systemSettings.kepcoTariff);
}

export async function saveKepcoTariff(table: TariffTable): Promise<TariffTable> {
  return getApiClient().put(ENDPOINTS.systemSettings.kepcoTariff, table);
}
