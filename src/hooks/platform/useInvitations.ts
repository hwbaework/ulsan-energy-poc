import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as invitationApi from '@/api/platform/invitations';
import { invitationKeys } from '@/api/queryKeys';
import type { CreateInvitationRequest } from '@/types';

export const useInvitations = (params?: object) => {
  return useQuery({
    queryKey: invitationKeys.list(params ?? {}),
    queryFn: () => invitationApi.getInvitations(params),
    staleTime: 30_000,
  });
};

export const useCreateInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, invitedById }: { data: CreateInvitationRequest; invitedById: number }) =>
      invitationApi.createInvitation(data, invitedById),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
    },
  });
};

export const useResendInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invitationApi.resendInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
    },
  });
};

export const useCancelInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invitationApi.cancelInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
    },
  });
};
