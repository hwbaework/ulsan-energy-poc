'use client';

// VPP 편입 — energy-backend /api/v1/vpp 배선. 설계문서 17.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/types/common';

const api = () => getApiClient();

export interface VppResource {
  id: number;
  resource: string;
  capacity: string;
  linked: boolean;
}

export function useVppResources(companyId?: number) {
  return useQuery({
    queryKey: ['vpp', 'resources', companyId],
    queryFn: () => api().get<VppResource[]>(ENDPOINTS.vpp.resources, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

export function useEnrollVpp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<ApiResponse<VppResource>>(ENDPOINTS.vpp.enroll(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vpp'] }),
  });
}

// 발전소 선택 VPP 편입 (설계문서 22 §4.1) — 기존 useEnrollVpp(id) 보존, 별도 추가.
export function useEnrollVppStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { companyId: number; powerStationId: number }) =>
      api().post<ApiResponse<VppResource>>(ENDPOINTS.vpp.enrollStation, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vpp'] }),
  });
}

// ── VPP 운영 read-model (VppReadController, 문서 21 런타임 검증) ──

export interface VppDashboard {
  totalResources: number;
  enrolledResources: number;
  resources: { id: number; resource: string; capacity: string; enrolled: boolean }[];
}

export interface VppForecast {
  id: number;
  plantId: number;
  modelName: string;
  forecastType: string;
  targetDate: string;
  targetHour: number | null;
  predictedKwh: string | null;
  actualKwh: string | null;
  errorRatePct: string | null;
}

export interface VppSettlement {
  id: number;
  contractId: number;
  contractNumber: string;
  plantId: number;
  plantName: string;
  period: string;
  status: string;
  generationKwh: string | null;
  smpUnitPrice: string | null;
  supplyAmount: number | null;
  total: number | null;
  ppaKind: string | null;
}

export interface VppDistribution {
  id: number;
  settlementId: number;
  spcFeeRate: string | null;
  spcFee: number | null;
  generatorPayout: number | null;
  status: string;
}

export interface VppGroup {
  id: number;
  companyId: number;
  assetType: string;
  name: string;
  status: string;
  scaleValue: string | null;
  scaleUnit: string | null;
  monthlyRevenue: number | null;
}

export interface VppMarketPrice {
  id: number;
  priceDate: string;
  priceType: string;
  region: string;
  price: string;
  unit: string;
}
export interface VppRec {
  id: number;
  source: string;
  weight: string;
  amount: string;
  price: string;
}
export interface VppReports {
  settlementCount: number;
  totalGenerationKwh: string;
  totalSupplyAmount: number;
  recHoldingCount: number;
  estimatedCo2ReductionTons: string;
}
export interface VppBid {
  id: number;
  marketRound: string;
  capacityMw: string;
  bidPrice: string | null;
  status: string;
}

export function useVppDashboard(companyId?: number) {
  return useQuery({
    queryKey: ['vpp', 'dashboard', companyId],
    queryFn: () => api().get<VppDashboard>(ENDPOINTS.vpp.dashboard, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

export function useVppForecast(plantId?: number, from?: string, to?: string) {
  return useQuery({
    queryKey: ['vpp', 'forecast', plantId, from, to],
    queryFn: () => api().get<VppForecast[]>(ENDPOINTS.vpp.forecast, { plantId, from, to }),
    enabled: !!plantId && !!from && !!to,
    retry: false,
  });
}

export function useVppGroups(companyId?: number) {
  return useQuery({
    queryKey: ['vpp', 'groups', companyId],
    queryFn: () => api().get<VppGroup[]>(ENDPOINTS.vpp.groups, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

export function useVppMarketPrices() {
  return useQuery({
    queryKey: ['vpp', 'market-price'],
    queryFn: () => api().get<VppMarketPrice[]>(ENDPOINTS.vpp.marketPrice),
    retry: false,
  });
}

export function useVppRec(companyId?: number) {
  return useQuery({
    queryKey: ['vpp', 'rec', companyId],
    queryFn: () => api().get<VppRec[]>(ENDPOINTS.vpp.rec, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

export function useVppReports(companyId?: number, year?: number) {
  return useQuery({
    queryKey: ['vpp', 'reports', companyId, year],
    queryFn: async () =>
      api().get<VppReports>(ENDPOINTS.vpp.reports, { companyId, ...(year ? { year } : {}) }),
    enabled: !!companyId,
    retry: false,
  });
}

// ── P2-1 미커버 3기능(설계문서 15) — DR 원격제어 · 수요예측 · ADMS 골격 ──

// (1) 수요(부하) 예측 — 발전량 예측(useVppForecast)과 대칭. 예측=platform/forecast 재사용, 실측=monitoring 재사용.
export interface VppDemandForecast {
  id: number;
  targetType: string;
  targetRefId: number;
  targetDate: string;
  targetHour: number | null;
  horizon: string;
  predictedLoadKw: string | null;
  actualLoadKw: string | null;
  errorRatePct: string | null;
  modelName: string | null;
}
export interface VppDemandForecastSummary {
  mape: string | null;
  peakLoadKw: string | null;
  loadFactorPct: string | null;
}

export function useVppDemandForecast(
  targetId?: number,
  from?: string,
  to?: string,
  horizon?: string,
) {
  return useQuery({
    queryKey: ['vpp', 'demand-forecast', targetId, from, to, horizon],
    queryFn: async () =>
      api().get<VppDemandForecast[]>(ENDPOINTS.vpp.demandForecast, {
        targetId,
        from,
        to,
        ...(horizon ? { horizon } : {}),
      }),
    enabled: !!targetId && !!from && !!to,
    retry: false,
  });
}

export function useVppDemandForecastSummary(targetId?: number, from?: string, to?: string) {
  return useQuery({
    queryKey: ['vpp', 'demand-forecast', 'summary', targetId, from, to],
    queryFn: async () =>
      api().get<VppDemandForecastSummary>(ENDPOINTS.vpp.demandForecastSummary, {
        targetId,
        from,
        to,
      }),
    enabled: !!targetId && !!from && !!to,
    retry: false,
  });
}

// (2) DR(수요반응) 원격제어 — 발령·이행검증·DR 자원. 감시 계측은 monitoring 재사용(신설 없음).
export interface DrResource {
  id: number;
  resourceId: number;
  companyId: number;
  powerStationId: number | null;
  reductionCapacityKw: string;
  baselineKwh: string | null;
  measurementLinked: boolean;
  status: string;
}
export interface DrEvent {
  id: number;
  companyId: number;
  roundLabel: string;
  targetType: string;
  targetRefId: number;
  targetReductionKw: string;
  actualReductionKw: string | null;
  fulfillmentPct: string | null;
  reason: string | null;
  status: string;
  settlementId: number | null;
  dispatchedAt: string;
  verifiedAt: string | null;
}

export function useDrResources(companyId?: number) {
  return useQuery({
    queryKey: ['vpp', 'dr', 'resources', companyId],
    queryFn: () => api().get<DrResource[]>(ENDPOINTS.vpp.drResources, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

export function useRegisterDrResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      resourceId: number;
      companyId: number;
      powerStationId?: number;
      reductionCapacityKw: number;
      baselineKwh?: number;
    }) => api().post<ApiResponse<DrResource>>(ENDPOINTS.vpp.drResources, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vpp', 'dr', 'resources'] }),
  });
}

export function useDrEvents(companyId?: number, status?: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ['vpp', 'dr', 'events', companyId, status, page, size],
    queryFn: async () =>
      api().get<{ content: DrEvent[]; totalElements: number }>(ENDPOINTS.vpp.drEvents, {
        companyId,
        page,
        size,
        ...(status ? { status } : {}),
      }),
    enabled: !!companyId,
    retry: false,
  });
}

export function useDrDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      companyId: number;
      roundLabel: string;
      targetType: string;
      targetRefId: number;
      targetReductionKw: number;
      reason?: string;
    }) => api().post<ApiResponse<DrEvent>>(ENDPOINTS.vpp.drDispatch, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vpp', 'dr', 'events'] }),
  });
}

export function useDrVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualReductionKw }: { id: number; actualReductionKw: number }) =>
      api().post<ApiResponse<DrEvent>>(ENDPOINTS.vpp.drVerify(id), { actualReductionKw }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vpp', 'dr', 'events'] }),
  });
}

// (3) ADMS 골격 — 데이터 소스 확정 전 정직 라벨. 실 조류계산·역조류는 외부 소스 확보 후.
export interface AdmsFeeder {
  id: number;
  feederCode: string;
  name: string | null;
  voltageLevel: string | null;
  source: string;
  status: string;
}
export interface AdmsTopology {
  feeders: AdmsFeeder[];
  lines: unknown[];
  dataSourceReady: boolean;
  label: string;
}
export interface AdmsMeasurements {
  measurements: unknown[];
  dataSourceReady: boolean;
  label: string;
}

export function useAdmsTopology() {
  return useQuery({
    queryKey: ['vpp', 'adms', 'topology'],
    queryFn: () => api().get<AdmsTopology>(ENDPOINTS.vpp.admsTopology),
    retry: false,
  });
}

export function useAdmsMeasurements(feederId?: number) {
  return useQuery({
    queryKey: ['vpp', 'adms', 'measurements', feederId],
    queryFn: () =>
      api().get<AdmsMeasurements>(
        ENDPOINTS.vpp.admsMeasurements,
        feederId ? { feederId } : undefined,
      ),
    retry: false,
  });
}
