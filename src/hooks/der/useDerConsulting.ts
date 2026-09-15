'use client';

// 분산에너지 효율화 컨설팅 — 기존 consultation/diagnosis API 재사용(domain=DISTRIBUTED_ENERGY). 설계문서 21 §3.1.
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Consultation, Diagnosis } from '@/types/consultation';

const api = () => getApiClient();

// 분산에너지 도메인 값 — 기존 CHECK 제약·FE ConsultationDomain 유니온과 일치.
export const DER_DOMAIN = 'DISTRIBUTED_ENERGY';

export function useDerDiagnoses(companyId?: number) {
  return useQuery({
    queryKey: ['der', 'diagnoses', companyId],
    queryFn: () =>
      api().get<Diagnosis[]>(
        ENDPOINTS.consultations.diagnosesByCompanyDomain(companyId as number, DER_DOMAIN),
      ),
    enabled: !!companyId,
    retry: false,
  });
}

export function useDerConsultations(companyId?: number) {
  return useQuery({
    queryKey: ['der', 'consultations', companyId],
    queryFn: () =>
      api().get<Consultation[]>(
        ENDPOINTS.consultations.byCompanyDomain(companyId as number, DER_DOMAIN),
      ),
    enabled: !!companyId,
    retry: false,
  });
}
