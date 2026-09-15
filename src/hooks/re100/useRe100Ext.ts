'use client';

// RE100 신규(REC·녹색프리미엄·상생연금·인증) — energy-backend /api/v1/re100 배선. 설계문서 17.
// 정직 상태(설계 22 정합): mock 폴백 없음. 훅은 raw useQuery(data/isError/isSuccess) 노출 —
//   호출부가 회사 미귀속(companyId==null)·오류(isError)·성공+빈(data 빈배열)을 정확히 구분 표시한다.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

const api = () => getApiClient();

export interface RecHolding {
  id: number;
  source: string;
  weight: number;
  amount: number;
  price: number;
}
export interface GreenPremium {
  id: number;
  year: number;
  amount: number;
  status: string;
}
export interface PensionMember {
  id: number;
  role: string;
  name: string;
  fund: number;
}
export interface PensionPayout {
  id: number;
  quarter: string;
  amount: number;
  members: number;
  status: string;
}
export interface Re100Cert {
  id: number;
  type: string;
  year: number;
  amount: number;
}
export interface EducationCourse {
  id: number;
  title: string;
  progress: number;
  certified: boolean;
}

function useList<T>(key: string, endpoint: string, companyId?: number) {
  return useQuery({
    queryKey: ['re100ext', key, companyId],
    queryFn: async () => await api().get<T[]>(endpoint, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

export const useRecHoldings = (companyId?: number) =>
  useList<RecHolding>('rec', ENDPOINTS.re100.rec, companyId);
export const useGreenPremiums = (companyId?: number) =>
  useList<GreenPremium>('green', ENDPOINTS.re100.greenPremium, companyId);
export const usePensionMembers = (companyId?: number) =>
  useList<PensionMember>('members', ENDPOINTS.re100.pensionMembers, companyId);
export const usePensionPayouts = (companyId?: number) =>
  useList<PensionPayout>('payouts', ENDPOINTS.re100.pensionPayouts, companyId);
export const useRe100Certs = (companyId?: number) =>
  useList<Re100Cert>('certs', ENDPOINTS.re100.certifications, companyId);
export const useEducationCourses = (companyId?: number) =>
  useList<EducationCourse>('courses', ENDPOINTS.re100.educationCourses, companyId);

export function usePayPension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().patch<PensionPayout>(ENDPOINTS.re100.payPension(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['re100ext'] }),
  });
}

// V108: RE100 분기 이행 실적 (집계 입력 대기 — 비면 []). 가짜 실적 없음.
export interface Re100Quarterly {
  id: number;
  companyId: number;
  year: number;
  quarter: number;
  measureType: string;
  achievedMwh: number | null;
  targetMwh: number | null;
}

export const useRe100Quarterly = (companyId?: number, year?: number) =>
  useQuery({
    queryKey: ['re100ext', 'quarterly', companyId, year ?? null],
    queryFn: async () =>
      await api().get<Re100Quarterly[]>(ENDPOINTS.re100.quarterly, {
        companyId,
        ...(year != null ? { year } : {}),
      }),
    enabled: !!companyId,
    retry: false,
  });
