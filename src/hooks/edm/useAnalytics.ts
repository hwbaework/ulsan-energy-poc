'use client';

// 데이터마켓 애널리틱스 배선 — /api/v1/analytics/{overview,usage,api-usage}. 기획 14 §6.
// 실 원천: dm_order·dm_dataset·dm_api_key 집계. 일별 시계열·히트맵은 원천 로그 부재로 스코프 제외("수집 예정").
// 설계 22: 프로덕션 mock 폴백 제거 — 조회 훅은 {data, isLive(성공), isError(호출실패)}로 상태를 정확히 노출.
//   가짜 수치를 실데이터로 위장하지 않는다. 오류/빈 시 0·빈배열·빈기본값.

import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { analyticsKeys } from '@/api/edmQueryKeys';

const api = () => getApiClient();

// ── 개요 ──
export interface OverviewData {
  revenueTotal: number;
  ordersTotal: number;
  datasetsPublished: number;
  apiKeysActive: number;
}
interface ApiOverview {
  revenueTotal: number;
  ordersTotal: number;
  datasetsPublished: number;
  apiKeysActive: number;
}

const EMPTY_OVERVIEW: OverviewData = {
  revenueTotal: 0,
  ordersTotal: 0,
  datasetsPublished: 0,
  apiKeysActive: 0,
};

export function useAnalyticsOverview(companyId?: number) {
  const q = useQuery({
    queryKey: analyticsKeys.overview(companyId),
    queryFn: async () => await api().get<ApiOverview>(ENDPOINTS.analytics.overview, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: {
        revenueTotal: Number(q.data.revenueTotal),
        ordersTotal: Number(q.data.ordersTotal),
        datasetsPublished: Number(q.data.datasetsPublished),
        apiKeysActive: Number(q.data.apiKeysActive),
      } as OverviewData,
      isLive: true,
      isError: false,
    };
  }
  // 설계 22: 오류 시 mock 대신 0 — 가짜 수치 노출 금지.
  return { data: EMPTY_OVERVIEW, isLive: false, isError: q.isError };
}

// ── 사용 순위 (인기 데이터셋 top N) ──
export interface TopDatasetRow {
  datasetId: number;
  title: string;
  orders: number;
  revenue: number;
}
interface ApiTopDataset {
  datasetId: number;
  title: string;
  orders: number;
  revenue: number;
}
interface ApiUsage {
  topDatasets: ApiTopDataset[];
}

export function useAnalyticsUsage(companyId?: number) {
  const q = useQuery({
    queryKey: analyticsKeys.usage(companyId),
    queryFn: async () => await api().get<ApiUsage>(ENDPOINTS.analytics.usage, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: (q.data.topDatasets ?? []).map(
        (d): TopDatasetRow => ({
          datasetId: d.datasetId,
          title: d.title,
          orders: Number(d.orders),
          revenue: Number(d.revenue),
        }),
      ),
      isLive: true,
      isError: false,
    };
  }
  // 설계 22: mock 폴백 제거 — 실데이터/빈/오류 정확 노출.
  return { data: [] as TopDatasetRow[], isLive: false, isError: q.isError };
}

// ── API 사용량 (키별 쿼터/사용 누적) ──
export interface KeyUsageRow {
  keyId: number;
  prefix: string;
  quota: number | null;
  used: number;
}
export interface ApiUsageData {
  quotaLimitSum: number;
  quotaUsedSum: number;
  perKey: KeyUsageRow[];
}
interface ApiKeyUsage {
  keyId: number;
  prefix: string;
  quota: number | null;
  used: number;
}
interface ApiApiUsage {
  quotaLimitSum: number;
  quotaUsedSum: number;
  perKey: ApiKeyUsage[];
}

const EMPTY_API_USAGE: ApiUsageData = { quotaLimitSum: 0, quotaUsedSum: 0, perKey: [] };

export function useAnalyticsApiUsage(companyId?: number) {
  const q = useQuery({
    queryKey: analyticsKeys.apiUsage(companyId),
    queryFn: async () => await api().get<ApiApiUsage>(ENDPOINTS.analytics.apiUsage, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: {
        quotaLimitSum: Number(q.data.quotaLimitSum),
        quotaUsedSum: Number(q.data.quotaUsedSum),
        perKey: (q.data.perKey ?? []).map(
          (k): KeyUsageRow => ({
            keyId: k.keyId,
            prefix: k.prefix,
            quota: k.quota != null ? Number(k.quota) : null,
            used: Number(k.used),
          }),
        ),
      } as ApiUsageData,
      isLive: true,
      isError: false,
    };
  }
  // 설계 22: 오류 시 mock 대신 빈 기본값 — 가짜 수치 노출 금지.
  return { data: EMPTY_API_USAGE, isLive: false, isError: q.isError };
}
