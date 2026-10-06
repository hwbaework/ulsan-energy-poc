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

export const useIndustrialTariff = () => {
  return useQuery({
    queryKey: settingsKeys.industrialTariff(),
    queryFn: () => settingsApi.getIndustrialTariff(),
    staleTime: 5 * 60_000,
  });
};

export const useSaveIndustrialTariff = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.saveIndustrialTariff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.industrialTariff() }),
  });
};

export const useSaveEnergySettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.saveEnergySettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.energy() }),
  });
};

/** 에너지 설정을 숫자로 — 값이 없거나 깨졌으면 fb */
export const energyNum = (es: Record<string, string> | undefined, key: string, fb: number) => {
  const n = Number(es?.[key]);
  return es?.[key] !== undefined && Number.isFinite(n) ? n : fb;
};
