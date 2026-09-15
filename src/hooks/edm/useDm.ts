'use client';

// 데이터마켓 배선 — /api/v1/datamarket/{consents,settlement}. 기획 03 rev.2 §5.
// 설계 22: 프로덕션 mock 폴백 제거 — 조회 훅은 {data, isLive(성공), isError(호출실패)}로 상태를 정확히 노출.
//   판매자 여정 뮤테이션의 try-catch 낙관 폴백(가짜 성공 금지·isLive:false·mock:true)은 유지(데이터-표시 목이 아님).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { dmKeys } from '@/api/edmQueryKeys';
import type { DatasetListItem, DatasetFormat, UpdateFrequency, PriceModelType } from '@/types/edm';

const api = () => getApiClient();

// ── 동의 ──
export interface ConsentRow {
  dataset: string;
  scope: string;
  status: '동의완료' | '서명대기';
}
interface ApiConsent {
  id: number;
  datasetId: number;
  datasetTitle: string;
  scope: string;
  methods: string | null;
  status: string;
  grantedAt: string | null;
}

export function useDmConsents(companyId?: number) {
  const q = useQuery({
    queryKey: dmKeys.consents(companyId),
    queryFn: async () =>
      (await api().get<ApiConsent[]>(ENDPOINTS.datamarket.consents, { companyId })).map(
        (c): ConsentRow => ({
          dataset: c.datasetTitle,
          scope: c.scope === 'AGGREGATED' ? '비식별 집계' : '원천·지정구매자',
          status: c.status === 'GRANTED' ? '동의완료' : '서명대기',
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: mock(FALLBACK_CONSENTS) 폴백 제거 — 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as ConsentRow[], isLive: q.isSuccess, isError: q.isError };
}

// ── 정산 ──
export interface SettlementRow {
  order: string;
  dataset: string;
  type: '구독' | '일회';
  gross: number;
  status: '완료' | '결제대기' | '무료';
}
interface ApiSettleRow {
  orderNumber: string;
  datasetTitle: string;
  orderType: string;
  gross: number;
  fee: number;
  net: number;
  status: string;
}
interface ApiSettlement {
  gross: number;
  fee: number;
  net: number;
  rows: ApiSettleRow[];
}

const settleStatus = (s: string, gross: number): SettlementRow['status'] =>
  gross === 0 ? '무료' : s === 'ACTIVE' || s === 'COMPLETED' || s === 'PAID' ? '완료' : '결제대기';

export function useDmSettlement(companyId?: number) {
  const q = useQuery({
    queryKey: dmKeys.settlement(companyId),
    queryFn: async () =>
      await api().get<ApiSettlement>(ENDPOINTS.datamarket.settlement, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  if (q.isSuccess && q.data) {
    return {
      data: (q.data.rows ?? []).map(
        (r): SettlementRow => ({
          order: r.orderNumber,
          dataset: r.datasetTitle,
          type: r.orderType === 'SUBSCRIPTION' ? '구독' : '일회',
          gross: Number(r.gross),
          status: settleStatus(r.status, Number(r.gross)),
        }),
      ),
      isLive: true,
      isError: false,
    };
  }
  // 설계 22: mock(FALLBACK_SETTLEMENT) 폴백 제거 — 오류/빈 시 빈배열.
  return { data: [] as SettlementRow[], isLive: false, isError: q.isError };
}

// ── 판매자 여정 뮤테이션·조회 (설계 12 §1~6) ──
// 골든 템플릿: usePayments.ts·useOrders.ts의 try-catch 낙관 폴백(가짜 성공 금지·isLive 명시)
// + onSuccess invalidate 패턴 복제. BE 미가동 시 mock:true·isLive:false 반환.
//   (설계 22 예외: 이 낙관 폴백은 "가짜 성공 금지" 정직 플래그로 데이터-표시 목이 아니라 유지)

export type PriceModelKind = 'FREE' | 'ONETIME' | 'SUBSCRIPTION' | 'PAY_PER_USE';

// §1 등록 위저드 — POST datamarket.datasets (DRAFT 생성)
export interface CreateDatasetInput {
  providerCompanyId?: number;
  providerName: string;
  title: string;
  description: string;
  categoryId?: number;
  format: string; // API | FILE | TABLE
  updateFrequency: string; // REALTIME | HOURLY | DAILY | ...
  priceType: PriceModelKind;
  basePrice: number;
}
export interface CreateDatasetResult {
  id: number;
  status: string;
  isLive: boolean;
  mock?: boolean;
}
interface ApiDataset {
  id?: number;
  status?: string;
}

export function useCreateDataset() {
  const qc = useQueryClient();
  return useMutation<CreateDatasetResult, unknown, CreateDatasetInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiDataset>(ENDPOINTS.datamarket.datasets, {
          providerCompanyId: input.providerCompanyId,
          providerName: input.providerName,
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          format: input.format,
          updateFrequency: input.updateFrequency,
          priceType: input.priceType,
          basePrice: input.basePrice,
        });
        const d = res ?? {};
        return { id: d.id ?? -1, status: d.status ?? 'DRAFT', isLive: true };
      } catch {
        // BE 미가동 — 낙관 폴백(가짜 성공 금지: isLive:false 명시)
        return { id: -1, status: 'DRAFT', isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §5 동의 서명 — POST datamarket.consents (서명대기→동의완료)
export interface CreateConsentInput {
  datasetId: number;
  companyId?: number;
  scope: 'AGGREGATED' | 'RAW_DESIGNATED';
  methods: string; // 비식별 5기법 CSV
}
export interface CreateConsentResult {
  id: number;
  status: string;
  isLive: boolean;
  mock?: boolean;
}
interface ApiConsentRes {
  id?: number;
  status?: string;
}

export function useCreateConsent() {
  const qc = useQueryClient();
  return useMutation<CreateConsentResult, unknown, CreateConsentInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiConsentRes>(ENDPOINTS.datamarket.consents, {
          datasetId: input.datasetId,
          companyId: input.companyId,
          scope: input.scope,
          methods: input.methods,
        });
        const d = res ?? {};
        return { id: d.id ?? -1, status: d.status ?? 'GRANTED', isLive: true };
      } catch {
        return { id: -1, status: 'GRANTED', isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §2 심사 요청 — PATCH datamarket.submitReview (DRAFT→REVIEW)
export interface ReviewSubmitResult {
  status: string;
  isLive: boolean;
  mock?: boolean;
}

export function useReviewDataset() {
  const qc = useQueryClient();
  return useMutation<ReviewSubmitResult, unknown, number>({
    mutationFn: async (id) => {
      try {
        const res = await api().patch<ApiDataset>(ENDPOINTS.datamarket.submitReview(id), {});
        return { status: res?.status ?? 'REVIEW', isLive: true };
      } catch {
        return { status: 'REVIEW', isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §2 심사 판정 — PATCH datamarket.publishDataset (승인 PUBLISHED / 반려 REJECTED)
export interface PublishDecideInput {
  id: number;
  approve: boolean;
  rejectReason?: string;
  qualityScore?: number;
}
export interface PublishDecideResult {
  status: string;
  isLive: boolean;
  consentRequired?: boolean; // 409 DM_CONSENT_REQUIRED
  mock?: boolean;
}

export function usePublishDataset() {
  const qc = useQueryClient();
  return useMutation<PublishDecideResult, unknown, PublishDecideInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().patch<ApiDataset>(ENDPOINTS.datamarket.publishDataset(input.id), {
          approve: input.approve,
          rejectReason: input.rejectReason,
          qualityScore: input.qualityScore,
        });
        return { status: res?.status ?? (input.approve ? 'PUBLISHED' : 'REJECTED'), isLive: true };
      } catch (e) {
        // 409 동의 필요 게이트를 구분해 UI에 전달 (BE: ApiResponse.error='DM_CONSENT_REQUIRED')
        const err = e as { response?: { status?: number; data?: { error?: string | null } } };
        const errCode = err?.response?.data?.error ?? '';
        if (err?.response?.status === 409 || errCode.includes('DM_CONSENT_REQUIRED')) {
          return { status: 'REVIEW', isLive: true, consentRequired: true };
        }
        return { status: input.approve ? 'PUBLISHED' : 'REJECTED', isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §3 API 키 폐기 — DELETE datamarket.apiKey(id)
export interface RevokeApiKeyResult {
  status: string;
  isLive: boolean;
  mock?: boolean;
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation<RevokeApiKeyResult, unknown, number>({
    mutationFn: async (id) => {
      try {
        const res = await api().delete<{ status?: string }>(ENDPOINTS.datamarket.apiKey(id));
        return { status: res?.status ?? 'REVOKED', isLive: true };
      } catch {
        return { status: 'REVOKED', isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §3 API 키 발급 — POST datamarket.apiKeys (원문 키 1회 노출)
export interface CreateApiKeyInput {
  consumerCompanyId?: number;
  datasetId: number;
  quota?: number;
}
export interface ApiKeyRow {
  id: number;
  datasetId: number;
  datasetTitle: string;
  keyPrefix: string;
  quota: number | null;
  used: number;
  status: string;
}
export interface CreateApiKeyResult {
  key: ApiKeyRow;
  isLive: boolean;
  mock?: boolean;
}
interface ApiKeyResBody {
  id?: number;
  datasetId?: number;
  datasetTitle?: string;
  keyPrefix?: string;
  quota?: number | null;
  used?: number;
  status?: string;
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation<CreateApiKeyResult, unknown, CreateApiKeyInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiKeyResBody>(ENDPOINTS.datamarket.apiKeys, {
          consumerCompanyId: input.consumerCompanyId,
          datasetId: input.datasetId,
          quota: input.quota,
        });
        const d = res ?? {};
        return {
          key: {
            id: d.id ?? -1,
            datasetId: d.datasetId ?? input.datasetId,
            datasetTitle: d.datasetTitle ?? '',
            keyPrefix: d.keyPrefix ?? 'edm_live_????',
            quota: d.quota ?? input.quota ?? null,
            used: d.used ?? 0,
            status: d.status ?? 'ACTIVE',
          },
          isLive: true,
        };
      } catch {
        return {
          key: {
            id: -1,
            datasetId: input.datasetId,
            datasetTitle: '',
            keyPrefix: 'edm_live_demo',
            quota: input.quota ?? null,
            used: 0,
            status: 'ACTIVE',
          },
          isLive: false,
          mock: true,
        };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §3 API 키 목록 — GET datamarket.apiKeys?companyId
export function useApiKeys(companyId?: number) {
  const q = useQuery({
    queryKey: dmKeys.apiKeys(companyId),
    queryFn: async () =>
      (await api().get<ApiKeyResBody[]>(ENDPOINTS.datamarket.apiKeys, { companyId })).map(
        (k): ApiKeyRow => ({
          id: k.id ?? 0,
          datasetId: k.datasetId ?? 0,
          datasetTitle: k.datasetTitle ?? '',
          keyPrefix: k.keyPrefix ?? '',
          quota: k.quota ?? null,
          used: k.used ?? 0,
          status: k.status ?? 'ACTIVE',
        }),
      ),
    enabled: !!companyId,
    retry: false,
  });
  // 설계 22: 실데이터/빈/오류 정확 노출.
  return { data: (q.data ?? []) as ApiKeyRow[], isLive: q.isSuccess, isError: q.isError };
}

// §4 정산 지급(payout) — POST datamarket.payout (멱등·서버 재계산)
export interface PayoutInput {
  companyId?: number;
  settlementIds?: string[];
}
export interface PayoutResult {
  paidCount: number;
  isLive: boolean;
  mock?: boolean;
}
interface ApiPayout {
  paidCount?: number;
}

export function usePayout() {
  const qc = useQueryClient();
  return useMutation<PayoutResult, unknown, PayoutInput>({
    mutationFn: async (input) => {
      try {
        const res = await api().post<ApiPayout>(ENDPOINTS.datamarket.payout, {
          companyId: input.companyId,
          settlementIds: input.settlementIds ?? [],
        });
        return { paidCount: res?.paidCount ?? 0, isLive: true };
      } catch {
        return { paidCount: 0, isLive: false, mock: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// §6 샘플 미리보기 — GET datamarket.preview(id) (부분 스키마·대표 20행·비식별)
export interface PreviewColumn {
  name: string;
  type: string;
  description: string;
  masked: boolean;
}
export interface PreviewData {
  columns: PreviewColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  rowCountTotal: number;
}

export function useDatasetPreview(id?: number, enabled = true) {
  const q = useQuery({
    queryKey: dmKeys.preview(id),
    queryFn: async () => await api().get<PreviewData>(ENDPOINTS.datamarket.preview(id!)),
    enabled: !!id && enabled,
    retry: false,
  });
  const live = q.isSuccess && !!q.data && (q.data.columns?.length ?? 0) > 0;
  return { data: q.data, isLive: live, isLoading: q.isLoading, isError: q.isError };
}

// §5 전용 샘플 — GET datamarket.sample(id) (서버 생성 비식별, 미존재 시 preview 폴백=generated:false). 기획 14 §5.
export interface SampleData {
  columns: PreviewColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows: number;
  generatedAt: string | null;
  generated: boolean;
}

export function useDatasetSample(id?: number, enabled = true) {
  const q = useQuery({
    queryKey: dmKeys.sample(id),
    queryFn: async () => await api().get<SampleData>(ENDPOINTS.datamarket.sample(id!)),
    enabled: !!id && enabled,
    retry: false,
  });
  const live = q.isSuccess && !!q.data && (q.data.columns?.length ?? 0) > 0;
  return { data: q.data, isLive: live, isLoading: q.isLoading, isError: q.isError };
}

// §5 샘플 생성 — POST datamarket.generateSample(id) (판매자/관리자). 최신 파일에서 비식별 표본 파생·저장.
export interface GenerateSampleResult {
  generated: boolean;
  isLive: boolean;
  mock?: boolean;
}
export function useGenerateSample() {
  const qc = useQueryClient();
  return useMutation<GenerateSampleResult, unknown, number>({
    mutationFn: async (id) => {
      try {
        const res = await api().post<SampleData>(ENDPOINTS.datamarket.generateSample(id));
        return { generated: res?.generated ?? true, isLive: true };
      } catch {
        return { generated: false, isLive: false, mock: true };
      }
    },
    onSuccess: (_res, id) => qc.invalidateQueries({ queryKey: dmKeys.sample(id) }),
  });
}

// ── 카탈로그 데이터셋 목록 (설계 16 §3.2) ────────────────────────────────
// GET datamarket.datasets?status=PUBLISHED → ApiDataset[] → 카탈로그 Dataset(DatasetListItem) 매핑.
// 설계 22: mock(MOCK_DATASETS) 폴백 제거 — 실데이터/빈/오류 정확 노출.

// BE DatasetRes (com.energy.datamarket.DmDto.DatasetRes) 계약.
interface ApiDatasetRes {
  id: number;
  providerName: string;
  title: string;
  description: string | null;
  categoryId: number | null;
  format: string; // API | FILE | TABLE
  updateFrequency: string; // REALTIME | HOURLY | DAILY | WEEKLY | MONTHLY | ONCE
  priceType: string; // SUBSCRIPTION | ONE_TIME | FREE
  basePrice: number | string;
  qualityScore: number;
  status: string; // DRAFT | REVIEW | PUBLISHED
  rejectReason?: string | null;
}
// BE CategoryRes 계약 — categoryId → slug/name 해소용.
interface ApiCategoryRes {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  sort: number;
}

const FREQ_SET: readonly UpdateFrequency[] = [
  'REALTIME',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'ONCE',
];

// BE format(API|FILE|TABLE) → FE DatasetFormat(FILE|API|STREAMING). TABLE 은 파일형으로 표기.
function mapFormat(f: string): DatasetFormat {
  return f === 'API' ? 'API' : 'FILE';
}
// BE priceType(SUBSCRIPTION|ONE_TIME|FREE) → FE PriceModelType(FREE|SUBSCRIPTION|ONETIME|...).
function mapPriceType(p: string): PriceModelType {
  if (p === 'FREE') return 'FREE';
  if (p === 'ONE_TIME') return 'ONETIME';
  return 'SUBSCRIPTION';
}
function mapFrequency(f: string): UpdateFrequency {
  return (FREQ_SET as readonly string[]).includes(f) ? (f as UpdateFrequency) : 'DAILY';
}

// ApiDatasetRes → 카탈로그 필터가 쓰는 필드(category.slug·priceModel.type·qualityScore·format) 매핑.
function toDatasetListItem(d: ApiDatasetRes, cat?: ApiCategoryRes): DatasetListItem {
  const base = Number(d.basePrice) || 0;
  const type = mapPriceType(d.priceType);
  const priceModel = type === 'FREE' ? { type } : { type, basePrice: base };
  return {
    id: d.id,
    title: d.title,
    description: d.description ?? '',
    provider: { id: 0, name: d.providerName },
    category: { id: cat?.id ?? d.categoryId ?? 0, name: cat?.name ?? '', slug: cat?.slug ?? '' },
    tags: [],
    format: mapFormat(d.format),
    updateFrequency: mapFrequency(d.updateFrequency),
    priceModel,
    qualityScore: d.qualityScore ?? 0,
    avgRating: 0,
    reviewCount: 0,
    viewCount: 0,
    downloadCount: 0,
    createdAt: '',
    status: d.status as DatasetListItem['status'],
    collectingSoon: d.status === 'DRAFT',
  };
}

// providerCompanyId를 넘기면 판매자 소유분(등록 데이터·전 상태) 조회 모드 — 유효 companyId일 때만 조회.
// status로 호출하면(기본 'PUBLISHED') 카탈로그 조회. 두 모드는 params·queryKey·enabled로 분기.
export function useDatasets(status: string = 'PUBLISHED', providerCompanyId?: number) {
  const providerMode = providerCompanyId !== undefined;
  const catQ = useQuery({
    queryKey: [...dmKeys.all, 'categories'],
    queryFn: async () => await api().get<ApiCategoryRes[]>(ENDPOINTS.datamarket.categories),
    retry: false,
  });
  // 판매자 소유분 조회 시 providerCompanyId로 전 상태 조회, 아니면 status 분기.
  const params = providerMode ? { providerCompanyId } : { status };
  const q = useQuery({
    queryKey: dmKeys.datasets(providerMode ? undefined : status, providerCompanyId),
    queryFn: async () => await api().get<ApiDatasetRes[]>(ENDPOINTS.datamarket.datasets, params),
    enabled: providerMode ? !!providerCompanyId : true,
    retry: false,
  });

  if (q.isSuccess && q.data) {
    const catById = new Map<number, ApiCategoryRes>((catQ.data ?? []).map((c) => [c.id, c]));
    return {
      data: q.data.map((d) =>
        toDatasetListItem(d, d.categoryId != null ? catById.get(d.categoryId) : undefined),
      ),
      isLive: true,
      isError: false,
      isLoading: q.isLoading,
    };
  }
  // 설계 22: mock(MOCK_DATASETS) 폴백 제거 — 오류/빈 시 빈배열.
  return {
    data: [] as DatasetListItem[],
    isLive: false,
    isError: q.isError,
    isLoading: q.isLoading,
  };
}
