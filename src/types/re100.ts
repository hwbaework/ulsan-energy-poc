export interface Re100Roadmap {
  id: number;
  companyId: number;
  companyName: string;
  targetYear: number;
  targetPct: number;
  actualPct: number;
  status: string;
}

export interface EnergySourceMix {
  id: number;
  companyId: number;
  period: string;
  sourceName: string;
  usageKwh: number;
}

export interface CreateRoadmapRequest {
  companyId: number;
  targetYear: number;
  targetPct: number;
}

export interface UpdateRoadmapRequest {
  targetPct?: number;
  actualPct?: number;
  status?: string;
}
