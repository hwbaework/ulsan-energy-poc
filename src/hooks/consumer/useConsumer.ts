import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as consumerApi from '@/api/consumer/consumer';
import { consumerKeys } from '@/api/queryKeys';

export const useConsumerSites = (params?: Record<string, unknown>) => {
  const hasCompanyId = !!params && 'companyId' in params && !!params.companyId;
  return useQuery({
    queryKey: consumerKeys.sites(params ?? {}),
    queryFn: () => consumerApi.getConsumerSites(params),
    staleTime: 30_000,
    enabled: hasCompanyId,
  });
};

export const useConsumerSite = (id: number) => {
  return useQuery({
    queryKey: consumerKeys.site(id),
    queryFn: () => consumerApi.getConsumerSite(id),
    enabled: !!id,
  });
};

export const useCreateConsumerSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof consumerApi.createConsumerSite>[0]) =>
      consumerApi.createConsumerSite(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consumerKeys.all });
    },
  });
};

export const useUpdateConsumerSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof consumerApi.updateConsumerSite>[0]) =>
      consumerApi.updateConsumerSite(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consumerKeys.all });
    },
  });
};

export const useDeleteConsumerSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => consumerApi.deleteConsumerSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consumerKeys.all });
    },
  });
};

export const useSiteUsage = (siteId: number) => {
  return useQuery({
    queryKey: consumerKeys.siteUsage(siteId),
    queryFn: () => consumerApi.getSiteUsage(siteId),
    enabled: !!siteId,
  });
};

export const useConsumerBilling = (companyId: number) => {
  return useQuery({
    queryKey: consumerKeys.billing(companyId),
    queryFn: () => consumerApi.getBilling(companyId),
    enabled: !!companyId,
  });
};

export const useConsumerContracts = (companyId: number) => {
  return useQuery({
    queryKey: consumerKeys.contracts(companyId),
    queryFn: () => consumerApi.getContracts(companyId),
    enabled: !!companyId,
  });
};
