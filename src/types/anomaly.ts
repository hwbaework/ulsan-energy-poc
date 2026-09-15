import type { BaseEntity } from './common';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Anomaly extends BaseEntity {
  equipmentId: number;
  metricId: number;
  anomalyType: string;
  severity: AnomalySeverity;
  description?: string;
  detectedAt: string;
  resolvedAt?: string | null;
  acknowledgedBy?: number | null;
}
