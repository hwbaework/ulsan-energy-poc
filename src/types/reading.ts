export interface Reading {
  id: number;
  equipmentId: number;
  metricId: number;
  readAt: string;
  value: number;
  unit: string;
  quality: string;
}

export interface DailyGenerationSummary {
  id: number;
  powerStationId: number;
  summaryDate: string;
  totalGenerationKwh: number;
  peakPowerKw: number;
  avgPowerKw: number;
  capacityFactor: number;
  operatingHours: number;
}
