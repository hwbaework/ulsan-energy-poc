import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

interface BillingRates {
  KEPCO_AVG_PRICE?: string;
}

export const useBillingRates = () => {
  return useQuery<BillingRates>({
    queryKey: ['billing-rates'],
    queryFn: () => getApiClient().get(ENDPOINTS.systemSettings.billingRates),
    staleTime: 5 * 60_000,
  });
};

export const useKepcoAvgPrice = (fallback = 119.6): number => {
  const { data } = useBillingRates();
  return data?.KEPCO_AVG_PRICE ? parseFloat(data.KEPCO_AVG_PRICE) : fallback;
};
