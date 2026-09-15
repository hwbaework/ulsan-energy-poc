import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operatorApi from '@/api/monitoring/operator';
import { operatorKeys, anomalyKeys } from '@/api/queryKeys';

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

export const useAcknowledgeOperatorAnomaly = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => operatorApi.acknowledgeOperatorAnomaly(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
    },
  });
};

export const useCreateAnomalyAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        actionType: string;
        content?: string;
        assignee?: string;
        expectedResolution?: string;
      };
    }) => operatorApi.createAnomalyAction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
      queryClient.invalidateQueries({ queryKey: anomalyKeys.all });
    },
  });
};
