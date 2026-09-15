import { useQuery } from '@tanstack/react-query';
import * as dashboardApi from '@/api/monitoring/dashboard';
import { dashboardKeys } from '@/api/queryKeys';

export const useDashboardSummary = () => {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => dashboardApi.getDashboardSummary(),
    staleTime: 30_000,
  });
};
