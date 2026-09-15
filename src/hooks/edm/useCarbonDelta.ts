'use client';

// 탄소 델타테이블 활성화 배선 — /api/v1/carbon/{bulletins,vcm-credits,koc-methodologies,ets-params,kcu-ledger}.
// 기획 14 §4·§7. 백엔드 미가동/빈결과 시 폴백(골든 템플릿 useCarbonExt.ts 규약).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { carbonKeys } from '@/api/edmQueryKeys';

const api = () => getApiClient();

// ── §4.1 협의매매 호가판 ──
export interface Bulletin {
  id: number;
  companyId: number;
  company: string;
  side: 'BUY' | 'SELL';
  unitType: 'KAU' | 'KOC' | 'KCU';
  amount: number;
  price: number;
  note: string | null;
  status: 'OPEN' | 'MATCHED' | 'CLOSED';
}
export interface BulletinThread {
  id: number;
  bulletinId: number;
  fromCompany: string;
  message: string;
  createdAt: string | null;
}

export function useBulletins(unitType?: string, side?: string, status = 'OPEN') {
  const q = useQuery({
    queryKey: carbonKeys.bulletins(unitType, side, status),
    queryFn: async () =>
      await api().get<Bulletin[]>(ENDPOINTS.carbon.bulletins, { unitType, side, status }),
    retry: false,
  });
  const live = q.isSuccess && (q.data?.length ?? 0) > 0;
  return { data: live ? (q.data as Bulletin[]) : [], isLive: live };
}

export function useCreateBulletin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      companyId: number;
      company: string;
      side: string;
      unitType: string;
      amount: number;
      price: number;
      note?: string;
    }) => api().post<Bulletin>(ENDPOINTS.carbon.bulletins, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

export function useUpdateBulletinStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api().patch<Bulletin>(ENDPOINTS.carbon.bulletinStatus(id), { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

export function useBulletinThreads(bulletinId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.bulletinThreads(bulletinId),
    queryFn: async () =>
      await api().get<BulletinThread[]>(ENDPOINTS.carbon.bulletinThreads(bulletinId!)),
    enabled: !!bulletinId,
    retry: false,
  });
  const live = q.isSuccess && (q.data?.length ?? 0) > 0;
  return { data: live ? (q.data as BulletinThread[]) : [], isLive: live };
}

export function usePostThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      fromCompany,
      message,
    }: {
      id: number;
      fromCompany: string;
      message: string;
    }) =>
      api().post<BulletinThread>(ENDPOINTS.carbon.bulletinThreads(id), { fromCompany, message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

// ── §4.2 자발적시장 보유 크레딧 ──
export interface VcmCredit {
  id: number;
  companyId: number;
  standard: 'VCS' | 'GS' | 'KVER';
  project: string;
  tco2: number;
  status: 'HELD' | 'RETIRED' | 'SOLD';
}

export function useVcmCredits(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.vcmCredits(companyId),
    queryFn: async () => await api().get<VcmCredit[]>(ENDPOINTS.carbon.vcmCredits, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  const live = q.isSuccess && (q.data?.length ?? 0) > 0;
  return { data: live ? (q.data as VcmCredit[]) : [], isLive: live };
}

export function useCreateVcm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { companyId: number; standard: string; project: string; tco2: number }) =>
      api().post<VcmCredit>(ENDPOINTS.carbon.vcmCredits, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

export function useRetireVcm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<VcmCredit>(ENDPOINTS.carbon.retireVcm(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

export function useSellVcm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<VcmCredit>(ENDPOINTS.carbon.sellVcm(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: carbonKeys.all }),
  });
}

// ── §4.3 KOC 방법론 참조 ──
export interface Methodology {
  id: number;
  code: string;
  name: string;
  docUrl: string | null;
  approved: boolean;
}

export function useMethodologies(approvedOnly = false) {
  const q = useQuery({
    queryKey: carbonKeys.methodologies(approvedOnly),
    queryFn: async () =>
      await api().get<Methodology[]>(ENDPOINTS.carbon.kocMethodologies, { approvedOnly }),
    retry: false,
  });
  const live = q.isSuccess && (q.data?.length ?? 0) > 0;
  return { data: live ? (q.data as Methodology[]) : [], isLive: live };
}

// ── §4.4 제4차 계획기간 파라미터 ──
export interface EtsPlanParam {
  id: number;
  period: string;
  sector: string;
  freeAllocRatio: number;
  msrReserve: number | null;
}

export function useEtsParams(period?: string) {
  const q = useQuery({
    queryKey: carbonKeys.etsParams(period),
    queryFn: async () => await api().get<EtsPlanParam[]>(ENDPOINTS.carbon.etsParams, { period }),
    enabled: !!period,
    retry: false,
  });
  const live = q.isSuccess && (q.data?.length ?? 0) > 0;
  return { data: live ? (q.data as EtsPlanParam[]) : [], isLive: live };
}

// ── §7 KCU 원장 ──
export interface KcuLedgerEntry {
  id: number;
  companyId: number;
  entryType: 'CONVERT_IN' | 'SELL' | 'RETIRE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUST';
  amount: number;
  balanceAfter: number;
  refType: string | null;
  refId: number | null;
  note: string | null;
  createdAt: string | null;
}

export function useKcuLedger(companyId?: number) {
  const q = useQuery({
    queryKey: carbonKeys.kcuLedger(companyId),
    queryFn: async () =>
      await api().get<KcuLedgerEntry[]>(ENDPOINTS.carbon.kcuLedger, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  const live = q.isSuccess && (q.data?.length ?? 0) > 0;
  return { data: live ? (q.data as KcuLedgerEntry[]) : [], isLive: live };
}
