import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as re100Api from '@/api/trading/re100';
import { re100Keys } from '@/api/queryKeys';
import type { CreateRoadmapRequest, UpdateRoadmapRequest } from '@/types';

export const useRoadmap = (companyId: number) => {
  return useQuery({
    queryKey: re100Keys.roadmap(companyId),
    queryFn: () => re100Api.getRoadmap(companyId),
    enabled: !!companyId,
  });
};

export const useSourceMix = (companyId: number, period: string) => {
  return useQuery({
    queryKey: re100Keys.sourceMix(companyId, period),
    queryFn: () => re100Api.getSourceMix(companyId, period),
    enabled: !!companyId && !!period,
  });
};

export const useMonthlyProgress = (companyId: number, year: number) => {
  return useQuery({
    queryKey: [...re100Keys.all, 'monthly-progress', companyId, year],
    queryFn: () => re100Api.getMonthlyProgress(companyId, year),
    enabled: !!companyId && !!year,
  });
};

export const useCreateRoadmap = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRoadmapRequest) => re100Api.createRoadmap(data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: re100Keys.roadmap(companyId) });
    },
  });
};

export const useUpdateRoadmap = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRoadmapRequest }) =>
      re100Api.updateRoadmap(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: re100Keys.all });
    },
  });
};

export const useDeleteRoadmap = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => re100Api.deleteRoadmap(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: re100Keys.all });
    },
  });
};
