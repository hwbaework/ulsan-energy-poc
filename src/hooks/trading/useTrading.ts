import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tradingApi from '@/api/trading/trading';
import { tradingKeys } from '@/api/queryKeys';
import type { CreateTradingRequest, CreateTradingMatch } from '@/types';

export const useTradingRequests = (params?: object, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: tradingKeys.requests(params ?? {}),
    queryFn: () => tradingApi.getTradingRequests(params),
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
};

export const useTradingRequest = (id: number) => {
  return useQuery({
    queryKey: tradingKeys.request(id),
    queryFn: () => tradingApi.getTradingRequest(id),
    enabled: !!id,
  });
};

export const useCreateTradingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTradingRequest) => tradingApi.createTradingRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useUpdateTradingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateTradingRequest> }) =>
      tradingApi.updateTradingRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useDeleteTradingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tradingApi.deleteTradingRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useUpdateRequestStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      tradingApi.updateRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

// ─── 직접 PPA 제안서 ───
export const useLeaseProposal = (requestId: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: tradingKeys.leaseProposal(requestId),
    queryFn: () => tradingApi.getLeaseProposal(requestId),
    enabled: (options?.enabled ?? true) && !!requestId,
  });
};

export const useLeaseProposalsByGenerator = (
  generatorCompanyId: number,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: [...tradingKeys.all, 'lease-proposals-by-generator', generatorCompanyId],
    queryFn: () => tradingApi.getLeaseProposalsByGenerator(generatorCompanyId),
    enabled: (options?.enabled ?? true) && !!generatorCompanyId,
  });
};

export const useCreateLeaseProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      data,
    }: {
      requestId: number;
      data: tradingApi.CreateLeaseProposal;
    }) => tradingApi.createLeaseProposal(requestId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tradingKeys.all }),
  });
};

export const useAgreeLeaseProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, party }: { requestId: number; party: 'generator' | 'consumer' }) =>
      tradingApi.agreeLeaseProposal(requestId, party),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tradingKeys.all }),
  });
};

export const useTradingMatches = (requestId: number) => {
  return useQuery({
    queryKey: tradingKeys.matches(requestId),
    queryFn: () => tradingApi.getMatches(requestId),
    enabled: !!requestId,
  });
};

export const useCreateMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTradingMatch) => tradingApi.createMatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useGeneratorAcceptMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tradingApi.generatorAcceptMatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useAcceptMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tradingApi.acceptMatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useCounterMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, proposedPriceKrw }: { id: number; proposedPriceKrw: number }) =>
      tradingApi.counterMatch(id, proposedPriceKrw),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useDeclineMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      declinedBy,
      declineReason,
    }: {
      id: number;
      declinedBy?: string;
      declineReason?: string;
    }) => tradingApi.declineMatch(id, { declinedBy, declineReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.all });
    },
  });
};

export const useAllTradingMatches = (params?: object) => {
  return useQuery({
    queryKey: tradingKeys.allMatches(params ?? {}),
    queryFn: () => tradingApi.getAllMatches(params),
    staleTime: 30_000,
  });
};

export const useMarketPrices = (params: { from: string; to: string }) => {
  return useQuery({
    queryKey: tradingKeys.marketPrices(params),
    queryFn: () => tradingApi.getMarketPrices(params),
    enabled: !!params.from && !!params.to,
    staleTime: 60_000,
  });
};

export const useRecTransactions = (params: { plantId: number; period: string }) => {
  return useQuery({
    queryKey: tradingKeys.recTransactions(params),
    queryFn: () => tradingApi.getRecTransactions(params),
    enabled: !!params.plantId && !!params.period,
    staleTime: 30_000,
  });
};
