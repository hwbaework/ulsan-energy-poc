import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { SystemSetting } from '@/types';
import type { TariffYear, TariffYearTable } from '@/lib/solar-sim';
import type { Holiday } from '@/lib/op-calendar';

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

/** 연도별 한전 요금표 — 최근 해 = 무료진단 태양광 대체단가 · 기본요금 절감, 연도별 평균 = 실적 CAGR */
export async function getKepcoTariff(): Promise<TariffYearTable[]> {
  return getApiClient().get(ENDPOINTS.systemSettings.kepcoTariff);
}

export async function saveKepcoTariff(table: TariffYearTable[]): Promise<TariffYearTable[]> {
  return getApiClient().put(ENDPOINTS.systemSettings.kepcoTariff, table);
}

/** 공휴일 — 특일 정보(한국천문연구원) 그 해 목록 */
export async function getHolidays(year: number): Promise<Holiday[]> {
  return getApiClient().get(ENDPOINTS.systemSettings.holidays, { year });
}

/** 공휴일 저장 — API 로 받은 목록에 사람이 더하고 뺀 결과(임시공휴일 · 취소) */
export async function saveHolidays(year: number, list: Holiday[]): Promise<Holiday[]> {
  return getApiClient().put(`${ENDPOINTS.systemSettings.holidays}?year=${year}`, list);
}
