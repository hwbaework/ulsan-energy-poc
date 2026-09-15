import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Onboarding } from '@/types';

export async function getOnboardings(companyId: number): Promise<Onboarding[]> {
  return getApiClient().get(ENDPOINTS.onboarding.list, { companyId });
}

// 운영자 심사 큐 — 전체 업체 온보딩
export async function getOnboardingReviewQueue(): Promise<Onboarding[]> {
  return getApiClient().get(ENDPOINTS.onboarding.reviewQueue);
}

export async function getOnboarding(id: number): Promise<Onboarding> {
  return getApiClient().get(ENDPOINTS.onboarding.detail(id));
}

export async function startOnboarding(
  companyId: number,
  businessType: string,
): Promise<Onboarding> {
  return getApiClient().post(
    `${ENDPOINTS.onboarding.start}?companyId=${companyId}&businessType=${encodeURIComponent(businessType)}`,
  );
}

export async function submitStep(stepId: number, data?: string): Promise<void> {
  return getApiClient().post(ENDPOINTS.onboarding.submitStep(stepId), data);
}

export async function approveStep(stepId: number, reviewedBy: number): Promise<void> {
  return getApiClient().patch(
    `${ENDPOINTS.onboarding.approveStep(stepId)}?reviewedBy=${reviewedBy}`,
  );
}

export async function rejectStep(
  stepId: number,
  reviewedBy: number,
  reason: string,
): Promise<void> {
  return getApiClient().patch(
    `${ENDPOINTS.onboarding.rejectStep(stepId)}?reviewedBy=${reviewedBy}&reason=${encodeURIComponent(reason)}`,
  );
}

export async function completeOnboarding(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.onboarding.complete(id));
}

/**
 * 온보딩 마스터(업종·규모·할당대상)를 회사 마스터로 서버 저장.
 * 설계문서 19 §2·부록B(P0 온보딩 서버동기). 모든 필드 optional — 수집분만 반영.
 */
export interface OnboardingMasterPayload {
  industryCode?: string;
  ksicCode?: string;
  employeeCount?: number;
  annualRevenue?: number;
  allocationTarget?: boolean;
}

export async function saveOnboardingMaster(
  companyId: number,
  payload: OnboardingMasterPayload,
): Promise<void> {
  return getApiClient().put(ENDPOINTS.companies.onboardingMaster(companyId), payload);
}
