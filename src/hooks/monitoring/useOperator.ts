import { useQuery } from '@tanstack/react-query';
import * as operatorApi from '@/api/monitoring/operator';
import { operatorKeys } from '@/api/queryKeys';

export const useOperatorAnomalies = (params?: {
  status?: string;
  severity?: string;
  page?: number;
  size?: number;
}) => {
  return useQuery({
    queryKey: operatorKeys.anomalies(params ?? {}),
    queryFn: () => operatorApi.getOperatorAnomalies(params),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
};
