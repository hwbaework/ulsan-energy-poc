'use client';

// DX 스마트센서 조회 훅 — 아이티공간 UMEI 연계 v1.1. 권장 호출: 최신 측정 1분, 안전지수 5분.
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { DX_SAFETY_MODEL, dxCodesOf, type DxFeature, type DxForecast, type DxLatest, type DxSafety } from '@/lib/dx';

const api = () => getApiClient();
type Items<T> = { items?: T[] };

/** API-003 — 그 발전소(회사)의 센서별 최신 측정 + Health Index */
export function useDxLatest(plantId: number | undefined) {
  return useQuery({
    queryKey: ['dx', 'latest', plantId],
    queryFn: async () =>
      (await api().get<Items<DxLatest>>(ENDPOINTS.control.dxLatest, { plantCode: dxCodesOf(plantId!).join(',') })).items ?? [],
    enabled: plantId != null && dxCodesOf(plantId).length > 0,
    refetchInterval: 60_000,
  });
}
/** API-005 — 선택 센서 5분 특징값 이력(최근 hours 시간) — 측정값 추이 */
export function useDxFeatureHistory(mac: string | undefined, hours = 24) {
  return useQuery({
    queryKey: ['dx', 'featureHistory', mac, hours],
    queryFn: async () => (await api().get<Items<DxFeature>>(ENDPOINTS.control.dxFeatureHistory, { macAddress: mac, hours })).items ?? [],
    enabled: !!mac,
    refetchInterval: 300_000,
  });
}
/** API-006 — 센서별 최신 전기안전지수(종합 모델만) */
export function useDxSafety(plantId: number | undefined) {
  return useQuery({
    queryKey: ['dx', 'safety', plantId],
    queryFn: async () =>
      ((await api().get<Items<DxSafety>>(ENDPOINTS.control.dxSafety, { plantCode: dxCodesOf(plantId!).join(',') })).items ?? []).filter(
        (x) => x.modelName === DX_SAFETY_MODEL,
      ),
    enabled: plantId != null && dxCodesOf(plantId).length > 0,
    refetchInterval: 300_000,
  });
}
/** API-007 — 선택 센서 전기안전지수 이력(최근 hours 시간) */
export function useDxSafetyHistory(mac: string | undefined, hours = 24) {
  return useQuery({
    queryKey: ['dx', 'safetyHistory', mac, hours],
    queryFn: async () =>
      ((await api().get<Items<DxSafety>>(ENDPOINTS.control.dxSafetyHistory, { macAddress: mac, hours })).items ?? []).filter(
        (x) => x.modelName === DX_SAFETY_MODEL,
      ),
    enabled: !!mac,
    refetchInterval: 300_000,
  });
}
/** 발전량 예측 — 다음 정시부터 36시간(문서 6.3) */
export function useDxForecast(plantId: number | undefined) {
  return useQuery({
    queryKey: ['dx', 'forecast', plantId],
    queryFn: async () => (await api().get<Items<DxForecast>>(ENDPOINTS.control.dxForecast, { plantId })).items ?? [],
    enabled: plantId != null,
    refetchInterval: 900_000,
  });
}

/** 전체 센서 최신 측정(API-003, 조건 없음 = 대상 전체) — 목록용 */
export function useDxLatestAll() {
  return useQuery({
    queryKey: ['dx', 'latest', 'all'],
    queryFn: async () => (await api().get<Items<DxLatest>>(ENDPOINTS.control.dxLatest)).items ?? [],
    refetchInterval: 60_000,
  });
}
/** 전체 센서 최신 전기안전지수(API-006) — 목록용 */
export function useDxSafetyAll() {
  return useQuery({
    queryKey: ['dx', 'safety', 'all'],
    queryFn: async () =>
      ((await api().get<Items<DxSafety>>(ENDPOINTS.control.dxSafety)).items ?? []).filter((x) => x.modelName === DX_SAFETY_MODEL),
    refetchInterval: 300_000,
  });
}
