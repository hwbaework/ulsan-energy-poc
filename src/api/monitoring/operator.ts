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

export async function acknowledgeOperatorAnomaly(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.operator.acknowledgeAnomaly(id));
}

export async function createAnomalyAction(
  id: number,
  data: {
    actionType: string;
    content?: string;
    assignee?: string;
    expectedResolution?: string;
  },
): Promise<void> {
  return getApiClient().post(ENDPOINTS.operator.anomalyAction(id), data);
}
