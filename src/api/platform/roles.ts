import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Role, RoleMenu, AssignRoleRequest, AssignMenuRequest } from '@/types';

export interface MenuResponse {
  id: number;
  parentId: number | null;
  menuCode: string;
  name: string;
  path: string | null;
  icon: string | null;
  depth: number;
  sortOrder: number;
  isVisible: boolean;
}

export interface CreateRoleData {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateRoleData {
  name: string;
  description?: string;
}

export async function getRoles(): Promise<Role[]> {
  return getApiClient().get(ENDPOINTS.roles.list);
}

export async function createRole(data: CreateRoleData): Promise<Role> {
  return getApiClient().post(ENDPOINTS.roles.list, data);
}

export async function updateRole(id: number, data: UpdateRoleData): Promise<Role> {
  return getApiClient().put(ENDPOINTS.roles.detail(id), data);
}

export async function deleteRole(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.roles.detail(id));
}

export async function assignRole(data: AssignRoleRequest): Promise<void> {
  return getApiClient().post(ENDPOINTS.roles.assign, data);
}

export async function revokeRole(userId: number, roleId: number): Promise<void> {
  const qs = new URLSearchParams({ userId: String(userId), roleId: String(roleId) }).toString();
  return getApiClient().delete(`${ENDPOINTS.roles.revoke}?${qs}`);
}

export async function assignRoleByCode(userId: number, roleCode: string): Promise<void> {
  return getApiClient().post(ENDPOINTS.roles.assignByCode, { userId, roleCode });
}

export async function getRoleMenus(roleId: number): Promise<RoleMenu[]> {
  return getApiClient().get(ENDPOINTS.roles.menus(roleId));
}

export async function assignMenu(roleId: number, data: AssignMenuRequest): Promise<void> {
  return getApiClient().post(ENDPOINTS.roles.menus(roleId), data);
}

export async function revokeMenu(roleId: number, menuId: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.roles.revokeMenu(roleId, menuId));
}

export async function getMenus(): Promise<MenuResponse[]> {
  return getApiClient().get(ENDPOINTS.menus.list);
}
