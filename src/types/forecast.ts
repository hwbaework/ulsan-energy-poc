export interface Forecast {
  id: number;
  plantId: number;
  modelName: string;
  forecastType: string;
  targetDate: string;
  targetHour?: number;
  predictedKwh: number;
  actualKwh?: number;
  errorRatePct?: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  submittedToKpx?: boolean;
}

export interface ForecastPenalty {
  id: number;
  plantId: number;
  period: string;
  errorRatePct: number;
  penaltyAmount: number;
  thresholdPct: number;
  status: string;
}
