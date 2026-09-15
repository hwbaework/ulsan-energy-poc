import { useQuery } from '@tanstack/react-query';
import * as performanceApi from '@/api/monitoring/performance';

export const usePlantPerformance = (laseeId: number, from: string, to: string) => {
  return useQuery({
    queryKey: ['plant-performance', laseeId, from, to],
    queryFn: () => performanceApi.getPlantPerformance(laseeId, from, to),
    enabled: laseeId > 0 && !!from && !!to,
  });
};

export const usePlantComparison = (from: string, to: string) => {
  return useQuery({
    queryKey: ['plant-comparison', from, to],
    queryFn: () => performanceApi.comparePlants(from, to),
    enabled: !!from && !!to,
  });
};
