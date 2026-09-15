import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

/* ─────────────────────────── Types (백엔드 DTO 정합) ───────────────────────────
 * SpcResponse / PayoutAccountResponse / PpaDistributionResponse (com.energy.ppa.dto)
 * ※ client.ts 응답 interceptor가 { success, data } 를 이미 언랩한다 —
 *   getApiClient().get<T>() 는 내부 데이터를 직접 반환한다. 절대 .data 를 붙이지 않는다.
 *   (선례: src/api/common/power-stations.ts) */

export interface SpcRes {
  id: number;
  spcCompanyId: number;
  energyDomain: string;
  name: string;
  feeRate: number;
  status: string;
}

export interface PayoutAccountRes {
  id: number;
  companyId: number;
  bankCode: string;
  // 백엔드가 마스킹하여 내려주는 계좌번호 (필드명은 accountNo)
  accountNo: string;
  holderName: string;
  isPrimary: boolean;
}

export interface DistributionRes {
  id: number;
  settlementId: number;
  period?: string;
  plantId?: number;
  plantName?: string;
  spcId?: number;
  recipientCompanyId?: number;
  recipientCompanyName?: string;
  payoutAccountId?: number;
  payoutAccountNo?: string;
  baseAmount?: number;
  platformFeeRate?: number;
  platformFee?: number;
  generatorPayout?: number;
  payStatus: string;
}

export interface CreateSpcInput {
  spcCompanyId: number;
  energyDomain: string;
  feeRate?: number;
  name?: string;
}

export interface CreatePayoutAccountInput {
  companyId: number;
  bankCode: string;
  accountNo: string;
  holderName: string;
}

/* ─────────────────────────── Query Keys ─────────────────────────── */

const distKeys = {
  all: ['ppa-distribution'] as const,
  spc: () => [...distKeys.all, 'spc'] as const,
  payoutAccounts: (companyId?: number) =>
    [...distKeys.all, 'payout-accounts', companyId ?? null] as const,
  distribution: (companyId?: number) =>
    [...distKeys.all, 'distribution', companyId ?? null] as const,
};

/* ─────────────────────────── SPC ─────────────────────────── */

export const useSpcList = () => {
  return useQuery({
    queryKey: distKeys.spc(),
    queryFn: () => getApiClient().get<SpcRes[]>(ENDPOINTS.ppa.spcList),
    staleTime: 30_000,
  });
};

export const useCreateSpc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSpcInput) =>
      getApiClient().post<SpcRes>(ENDPOINTS.ppa.spcCreate, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distKeys.spc() });
    },
  });
};

/* ─────────────────────────── 수령 계좌 ─────────────────────────── */

export const usePayoutAccounts = (companyId?: number) => {
  return useQuery({
    queryKey: distKeys.payoutAccounts(companyId),
    queryFn: () =>
      getApiClient().get<PayoutAccountRes[]>(
        ENDPOINTS.ppa.payoutAccounts,
        companyId ? { companyId } : undefined,
      ),
    staleTime: 30_000,
  });
};

export const useCreatePayoutAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePayoutAccountInput) =>
      getApiClient().post<PayoutAccountRes>(ENDPOINTS.ppa.payoutAccounts, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distKeys.all });
    },
  });
};

/* ─────────────────────────── 배분 내역 ─────────────────────────── */

export const useDistribution = (companyId?: number) => {
  return useQuery({
    queryKey: distKeys.distribution(companyId),
    queryFn: () =>
      getApiClient().get<DistributionRes[]>(
        ENDPOINTS.ppa.distribution,
        companyId ? { companyId } : undefined,
      ),
    staleTime: 15_000,
  });
};

export const useAllocate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) =>
      getApiClient().post<DistributionRes>(ENDPOINTS.ppa.allocate(settlementId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distKeys.all });
    },
  });
};

export const usePayDistribution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ settlementId, paidAt }: { settlementId: number; paidAt?: string }) =>
      getApiClient().patch<DistributionRes>(
        ENDPOINTS.ppa.payDistribution(settlementId),
        paidAt ? { paidAt } : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distKeys.all });
    },
  });
};
