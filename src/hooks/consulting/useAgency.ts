import { useQuery } from '@tanstack/react-query';
import * as agencyApi from '@/api/consulting/agency';
import { agencyKeys } from '@/api/queryKeys';

export const useAgencies = (params?: object) => {
  return useQuery({
    queryKey: agencyKeys.list(params ?? {}),
    queryFn: () => agencyApi.getAgencies(params),
    staleTime: 30_000,
  });
};

export const useAgency = (id: number) => {
  return useQuery({
    queryKey: agencyKeys.detail(id),
    queryFn: () => agencyApi.getAgency(id),
    enabled: !!id,
  });
};

export const useAgencyByCompany = (companyId: number) => {
  return useQuery({
    queryKey: agencyKeys.byCompany(companyId),
    queryFn: () => agencyApi.getAgencyByCompany(companyId),
    enabled: !!companyId,
  });
};
