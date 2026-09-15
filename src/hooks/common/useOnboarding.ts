import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as onboardingApi from '@/api/common/onboarding';
import { onboardingKeys } from '@/api/queryKeys';

export const useOnboardings = (companyId: number) => {
  return useQuery({
    queryKey: onboardingKeys.byCompany(companyId),
    queryFn: () => onboardingApi.getOnboardings(companyId),
    enabled: !!companyId,
  });
};

export const useOnboarding = (id: number) => {
  return useQuery({
    queryKey: onboardingKeys.detail(id),
    queryFn: () => onboardingApi.getOnboarding(id),
    enabled: !!id,
  });
};

// 운영자 심사 큐 — 전체 업체 온보딩(/platform/onboarding)
export const useOnboardingReviewQueue = () => {
  return useQuery({
    queryKey: [...onboardingKeys.all, 'review-queue'],
    queryFn: () => onboardingApi.getOnboardingReviewQueue(),
    staleTime: 15_000,
  });
};

export const useStartOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, businessType }: { companyId: number; businessType: string }) =>
      onboardingApi.startOnboarding(companyId, businessType),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.byCompany(companyId) });
    },
  });
};

export const useSubmitStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, data }: { stepId: number; data?: string }) =>
      onboardingApi.submitStep(stepId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
};

export const useApproveStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, reviewedBy }: { stepId: number; reviewedBy: number }) =>
      onboardingApi.approveStep(stepId, reviewedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
};

export const useRejectStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      stepId,
      reviewedBy,
      reason,
    }: {
      stepId: number;
      reviewedBy: number;
      reason: string;
    }) => onboardingApi.rejectStep(stepId, reviewedBy, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
};

export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => onboardingApi.completeOnboarding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
};
