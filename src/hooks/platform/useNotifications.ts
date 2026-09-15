import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notificationApi from '@/api/platform/notifications';
import { notificationKeys } from '@/api/queryKeys';

export const useNotifications = (params?: object) => {
  return useQuery({
    queryKey: notificationKeys.list(params ?? {}),
    queryFn: () => notificationApi.getNotifications(params),
    staleTime: 15_000,
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    staleTime: 15_000,
    refetchInterval: (query) => (query.state.status === 'error' ? false : 30_000),
    retry: 1,
  });
};

export const useMarkRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });
      const prev = queryClient.getQueryData<number>(notificationKeys.unreadCount());
      if (prev != null && prev > 0) {
        queryClient.setQueryData(notificationKeys.unreadCount(), prev - 1);
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev != null) queryClient.setQueryData(notificationKeys.unreadCount(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

export const useMarkAllRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });
      const prev = queryClient.getQueryData<number>(notificationKeys.unreadCount());
      queryClient.setQueryData(notificationKeys.unreadCount(), 0);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev != null) queryClient.setQueryData(notificationKeys.unreadCount(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};
