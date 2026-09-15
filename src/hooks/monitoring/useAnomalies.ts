import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as anomalyApi from '@/api/monitoring/anomalies';
import { anomalyKeys } from '@/api/queryKeys';
import type { ListQueryParams } from '@/types';

export const useAnomalies = (params?: ListQueryParams) => {
  return useQuery({
    queryKey: anomalyKeys.list(params ?? {}),
    queryFn: () => anomalyApi.getAnomalies(params),
    staleTime: 10_000,
  });
};

export const useAnomaly = (id: number) => {
  return useQuery({
    queryKey: anomalyKeys.detail(id),
    queryFn: () => anomalyApi.getAnomaly(id),
    enabled: !!id,
  });
};

export const useAcknowledgeAnomaly = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => anomalyApi.acknowledgeAnomaly(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: anomalyKeys.all }),
  });
};

export const useStartWorkAnomaly = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => anomalyApi.startWorkAnomaly(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: anomalyKeys.all }),
  });
};

export const useResolveAnomaly = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => anomalyApi.resolveAnomaly(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: anomalyKeys.all }),
  });
};

export const useMarkFalseAlarm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => anomalyApi.markFalseAlarm(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: anomalyKeys.all }),
  });
};

export const useDetections = (params?: ListQueryParams & { equipmentId?: number }) => {
  return useQuery({
    queryKey: anomalyKeys.detections(params ?? {}),
    queryFn: () => anomalyApi.getDetections(params),
    staleTime: 10_000,
  });
};

export const useUnresolvedDetections = (params?: ListQueryParams) => {
  return useQuery({
    queryKey: anomalyKeys.detectionsUnresolved(params ?? {}),
    queryFn: () => anomalyApi.getUnresolvedDetections(params),
    staleTime: 10_000,
  });
};

export const useResolveDetection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, note }: { id: number; userId: number; note?: string }) =>
      anomalyApi.resolveDetection(id, userId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: anomalyKeys.all }),
  });
};
