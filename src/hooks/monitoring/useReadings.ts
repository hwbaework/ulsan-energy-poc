import { useQuery } from '@tanstack/react-query';
import * as readingApi from '@/api/monitoring/readings';
import { readingKeys } from '@/api/queryKeys';
import type { ListQueryParams } from '@/types';

export const useReadings = (equipmentId: number, params?: ListQueryParams) => {
  return useQuery({
    queryKey: readingKeys.byEquipment(equipmentId, params),
    queryFn: () => readingApi.getReadings(equipmentId, params),
    enabled: !!equipmentId,
    staleTime: 10_000,
  });
};

export const useDailySummary = (powerStationId: number, params?: ListQueryParams) => {
  return useQuery({
    queryKey: readingKeys.daily(powerStationId, params),
    queryFn: () => readingApi.getDailySummary(powerStationId, params),
    enabled: !!powerStationId,
    staleTime: 60_000,
  });
};

export const useReportSummary = (params: { from: string; to: string; powerStationId?: number }) => {
  return useQuery({
    queryKey: ['readings', 'report-summary', params],
    queryFn: () => readingApi.getReportSummary(params),
    enabled: !!params.from && !!params.to,
    staleTime: 60_000,
  });
};
