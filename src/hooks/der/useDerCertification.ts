'use client';

// 분산에너지 사업자인증 — 기존 onboarding API 재사용(businessType=DER_OPERATOR) + vpp_resource(D3). 설계문서 21 §3.3·§5.
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Onboarding } from '@/types/onboarding';

const api = () => getApiClient();

export const DER_BUSINESS_TYPE = 'DER_OPERATOR';

/** 고객사 온보딩 목록 중 DER_OPERATOR 온보딩을 반환(D1 자격상태 + D2 요건 스텝). */
export function useDerOnboarding(companyId?: number) {
  return useQuery({
    queryKey: ['der', 'onboarding', companyId],
    queryFn: async () => {
      const list = await api().get<Onboarding[]>(ENDPOINTS.onboarding.list, { companyId });
      return (list ?? []).filter((o) => o.businessType === DER_BUSINESS_TYPE);
    },
    enabled: !!companyId,
    retry: false,
  });
}
