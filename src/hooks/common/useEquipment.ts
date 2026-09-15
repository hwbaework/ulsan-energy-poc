import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as equipmentApi from '@/api/common/equipment';
import { equipmentKeys } from '@/api/queryKeys';
import type { ListQueryParams } from '@/types';

export const useEquipmentList = (params?: ListQueryParams) => {
  return useQuery({
    queryKey: equipmentKeys.list(params ?? {}),
    queryFn: () => equipmentApi.getEquipmentList(params),
    staleTime: 30_000,
  });
};

export const useEquipment = (id: number) => {
  return useQuery({
    queryKey: equipmentKeys.detail(id),
    queryFn: () => equipmentApi.getEquipment(id),
    enabled: !!id,
  });
};

export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => equipmentApi.createEquipment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
    },
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      equipmentApi.updateEquipment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
    },
  });
};

export const useEquipmentMaintenances = (equipmentId: number) => {
  return useQuery({
    queryKey: equipmentKeys.maintenances(equipmentId),
    queryFn: () => equipmentApi.getMaintenances(equipmentId),
    enabled: !!equipmentId,
  });
};

export const useMetrics = () => {
  return useQuery({
    queryKey: equipmentKeys.metrics(),
    queryFn: () => equipmentApi.getMetrics(),
    staleTime: 60_000,
  });
};
