import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Anomaly, PageResponse, ListQueryParams } from '@/types';

export async function getAnomalies(params?: ListQueryParams): Promise<PageResponse<Anomaly>> {
  return getApiClient().get(ENDPOINTS.anomalies.list, params);
}

export async function getAnomaly(id: number): Promise<Anomaly> {
  return getApiClient().get(ENDPOINTS.anomalies.detail(id));
}

export async function acknowledgeAnomaly(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.anomalies.acknowledge(id));
}

export async function startWorkAnomaly(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.anomalies.startWork(id));
}

export async function resolveAnomaly(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.anomalies.resolve(id));
}

export async function markFalseAlarm(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.anomalies.falseAlarm(id));
}

export interface AnomalyDetection {
  id: number;
  equipmentId: number;
  metricId: number | null;
  anomalyType: string;
  severity: string;
  description: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedById: number | null;
}

export async function getDetections(
  params?: ListQueryParams & { equipmentId?: number },
): Promise<PageResponse<AnomalyDetection>> {
  return getApiClient().get(ENDPOINTS.anomalies.detections, params);
}

export async function getUnresolvedDetections(
  params?: ListQueryParams,
): Promise<PageResponse<AnomalyDetection>> {
  return getApiClient().get(ENDPOINTS.anomalies.detectionsUnresolved, params);
}

export async function resolveDetection(id: number, userId: number, note?: string): Promise<void> {
  const qs = new URLSearchParams({ userId: String(userId) });
  if (note) qs.set('note', note);
  return getApiClient().patch(`${ENDPOINTS.anomalies.resolveDetection(id)}?${qs}`);
}
