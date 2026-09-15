import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as noticeApi from '@/api/platform/notices';
import { noticeKeys } from '@/api/queryKeys';
import type { CreateNoticeRequest } from '@/types';

export const useNotices = (params?: object) => {
  return useQuery({
    queryKey: noticeKeys.list(params ?? {}),
    queryFn: () => noticeApi.getNotices(params),
    staleTime: 30_000,
  });
};

export const useNotice = (id: number) => {
  return useQuery({
    queryKey: noticeKeys.detail(id),
    queryFn: () => noticeApi.getNotice(id),
    enabled: !!id,
  });
};

export const useCreateNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, authorId }: { data: CreateNoticeRequest; authorId: number }) =>
      noticeApi.createNotice(data, authorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
};

export const useUpdateNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateNoticeRequest }) =>
      noticeApi.updateNotice(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
};

export const useDeleteNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => noticeApi.deleteNotice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
};
