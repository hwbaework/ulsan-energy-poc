import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authKeys } from '@/api/queryKeys';
import { useAuthStore, roleFromEmail } from '@/stores/useAuthStore';
import type { LoginRequest, User } from '@/types';

/** POC: 서버 호출 없이 이메일 → 역할 매핑으로 로그인 */
export const useSignIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      useAuthStore.getState().loginAs(roleFromEmail(data.email));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      useAuthStore.getState().logout();
      queryClient.clear();
    },
  });
};

export const useMe = () => {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => user as User,
    enabled: !!user,
    staleTime: Infinity,
  });
};

/** 메뉴 권한: 빈 배열 = 전체 허용 */
export const useMyMenus = () => {
  return useQuery({
    queryKey: [...authKeys.all, 'menus'],
    queryFn: async () => [] as string[],
    staleTime: Infinity,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<User>) => {
      const current = useAuthStore.getState().user;
      const next = { ...(current as User), ...data } as User;
      useAuthStore.getState().setUser(next);
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (_data: { currentPassword: string; newPassword: string }) => undefined,
  });
};
