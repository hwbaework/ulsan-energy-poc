import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as roleApi from '@/api/platform/roles';
import { roleKeys, userKeys } from '@/api/queryKeys';
import type { AssignRoleRequest, AssignMenuRequest } from '@/types';

export const useRoles = () => {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: () => roleApi.getRoles(),
    staleTime: 60_000,
  });
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: roleApi.CreateRoleData) => roleApi.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: roleApi.UpdateRoleData }) =>
      roleApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => roleApi.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
};

export const useAssignRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignRoleRequest) => roleApi.assignRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useAssignRoleByCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleCode }: { userId: number; roleCode: string }) =>
      roleApi.assignRoleByCode(userId, roleCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useRevokeRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      roleApi.revokeRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useRoleMenus = (roleId: number) => {
  return useQuery({
    queryKey: roleKeys.menus(roleId),
    queryFn: () => roleApi.getRoleMenus(roleId),
    enabled: !!roleId,
  });
};

export const useAssignMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: number; data: AssignMenuRequest }) =>
      roleApi.assignMenu(roleId, data),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.menus(roleId) });
    },
  });
};

export const useRevokeMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, menuId }: { roleId: number; menuId: number }) =>
      roleApi.revokeMenu(roleId, menuId),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.menus(roleId) });
    },
  });
};

export const useMenus = () => {
  return useQuery({
    queryKey: ['menus'],
    queryFn: () => roleApi.getMenus(),
    staleTime: 300_000,
  });
};
