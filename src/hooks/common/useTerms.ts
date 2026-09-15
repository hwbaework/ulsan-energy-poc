import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as termsApi from '@/api/common/terms';
import { termsKeys } from '@/api/queryKeys';

export const useTerms = (businessType?: string) => {
  return useQuery({
    queryKey: termsKeys.list({ businessType }),
    queryFn: () => termsApi.getTerms({ businessType }),
    staleTime: 60_000,
  });
};

export const useAcceptedTerms = (userId: number) => {
  return useQuery({
    queryKey: termsKeys.accepted(userId),
    queryFn: () => termsApi.getAcceptedTerms(userId),
    enabled: !!userId,
  });
};

export const useAcceptTerms = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      termsId,
      userId,
      ipAddress,
    }: {
      termsId: number;
      userId: number;
      ipAddress?: string;
    }) => termsApi.acceptTerms(termsId, userId, ipAddress),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: termsKeys.accepted(userId) });
    },
  });
};
