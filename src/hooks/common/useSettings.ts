import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from '@/api/common/settings';
import { settingsKeys } from '@/api/queryKeys';

export const useSettings = () => {
  return useQuery({
    queryKey: settingsKeys.lists(),
    queryFn: () => settingsApi.getSettings(),
    staleTime: 60_000,
  });
};

export const useSetting = (key: string) => {
  return useQuery({
    queryKey: settingsKeys.byKey(key),
    queryFn: () => settingsApi.getSetting(key),
    enabled: !!key,
  });
};

export const useEnergySettings = () => {
  return useQuery({
    queryKey: settingsKeys.energy(),
    queryFn: () => settingsApi.getEnergySettings(),
    staleTime: 5 * 60_000,
  });
};

export const useUpdateSetting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsApi.updateSetting(key, value),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.byKey(key) });
      queryClient.invalidateQueries({ queryKey: settingsKeys.lists() });
    },
  });
};
