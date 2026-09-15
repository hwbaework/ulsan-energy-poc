'use client';

// 에너지 Mix 시뮬레이션 — energy-backend /api/v1/der/mix-simulation 배선. 설계문서 21 §3.2.
import { useMutation } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

const api = () => getApiClient();

export type DerSource = 'PV' | 'FC' | 'ORC' | 'ESS' | 'V2G';

export interface MixCandidate {
  source: DerSource;
  capacityKw: number;
  capexKrw?: number;
}

export interface MixSimulationRequest {
  companyId: number;
  annualEnergyUsageKwh: number;
  currentElecCostKrw: number;
  annualGhgTon: number;
  candidates: MixCandidate[];
}

export interface MixShare {
  source: string;
  sharePct: number;
}

export interface MixCurrent {
  mixShare: MixShare[];
  annualCostKrw: number;
  ghgTon: number;
}

export interface MixScenario {
  name: string;
  mix: MixShare[];
  annualCostKrw: number;
  costSavingKrw: number;
  ghgTon: number;
  ghgReductionTon: number;
  selfSufficiencyPct: number;
  paybackYears: number | null; // 절감 없음·회수 불가 시 null
}

export interface MixSimulationResponse {
  current: MixCurrent;
  scenarios: MixScenario[];
  recommended: string | null;
}

export function useMixSimulation() {
  return useMutation({
    mutationFn: (body: MixSimulationRequest) =>
      api().post<MixSimulationResponse>(ENDPOINTS.der.mixSimulation, body),
  });
}
