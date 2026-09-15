import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Terms } from '@/types';

export async function getTerms(params?: { businessType?: string }): Promise<Terms[]> {
  return getApiClient().get(ENDPOINTS.terms.list, params);
}

export async function getAcceptedTerms(userId: number): Promise<number[]> {
  return getApiClient().get(ENDPOINTS.terms.accepted, { userId });
}

export async function acceptTerms(
  termsId: number,
  userId: number,
  ipAddress?: string,
): Promise<void> {
  const qs = ipAddress
    ? `userId=${userId}&ipAddress=${encodeURIComponent(ipAddress)}`
    : `userId=${userId}`;
  return getApiClient().post(`${ENDPOINTS.terms.accept(termsId)}?${qs}`);
}

export async function withdrawTerms(termsId: number, userId: number): Promise<void> {
  return getApiClient().post(`${ENDPOINTS.terms.withdraw(termsId)}?userId=${userId}`);
}
