import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { AnomalyEvent } from '@/types/monitoring';

export async function getOperatorAnomalies(params?: {
  status?: string;
  severity?: string;
  page?: number;
  size?: number;
}): Promise<{ content: AnomalyEvent[]; totalElements: number }> {
  return getApiClient().get(ENDPOINTS.operator.anomalies, params);
}
