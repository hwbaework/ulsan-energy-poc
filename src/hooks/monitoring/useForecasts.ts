import { useQuery } from '@tanstack/react-query';
import * as forecastApi from '@/api/monitoring/forecasts';
import { forecastKeys } from '@/api/queryKeys';

export const useForecasts = (plantId: number, from: string, to: string) => {
  return useQuery({
    queryKey: forecastKeys.byPlant(plantId, { from, to }),
    queryFn: () => forecastApi.getForecasts(plantId, from, to),
    enabled: !!plantId && !!from && !!to,
  });
};

export const useForecastPenalties = (plantId: number) => {
  return useQuery({
    queryKey: forecastKeys.penalties(plantId),
    queryFn: () => forecastApi.getForecastPenalties(plantId),
    enabled: !!plantId,
  });
};
