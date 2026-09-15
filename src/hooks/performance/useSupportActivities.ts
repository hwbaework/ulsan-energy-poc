'use client';

// 성과확산 활동(지표9 SoR) — energy-backend /api/v1/re100/support-activities 배선 (F-A outreach, B3 계약).
// /outreach 화면 전용. 원장 count = 지표9 실적(approved). 증빙 ownerType='support_activity'.
// F-B의 hooks/re100/* 와 파일 충돌 방지 위해 F-A 소유 디렉터리(hooks/performance)에 둔다.
// 경로 상수는 본 파일 로컬(공유 endpoints.ts 미수정 정책).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import type { ActualStatus } from './usePerformance';

const api = () => getApiClient();

const SUPPORT = {
  base: '/re100/support-activities',
} as const;

export type SupportCategory = 'consulting' | 'promotion' | 'sandbox' | 'model' | 'network';

export interface SupportActivity {
  id: number;
  category: SupportCategory | string;
  title: string;
  activityDate: string;
  description: string | null;
  reporter: string | null;
  status: ActualStatus;
  evidenceIds: string[];
}

export interface CreateSupportActivityInput {
  category: SupportCategory | string;
  title: string;
  activityDate: string;
  description?: string;
  reporter?: string;
}

/** GET /re100/support-activities?category=&year= */
export function useSupportActivities(year?: number, category?: string) {
  return useQuery({
    queryKey: ['support-activities', year, category],
    queryFn: async () => await api().get<SupportActivity[]>(SUPPORT.base, { year, category }),
    enabled: !!year,
    retry: false,
  });
}

/** POST /re100/support-activities — 활동 등록(등록 후 목록·지표9 카운트 갱신) */
export function useCreateSupportActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportActivityInput) =>
      api().post<SupportActivity>(SUPPORT.base, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-activities'] });
      qc.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}
