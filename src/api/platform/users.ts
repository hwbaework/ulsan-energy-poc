import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserListParams,
  PageResponse,
} from '@/types';

export async function getUsers(params?: UserListParams): Promise<PageResponse<User>> {
  return getApiClient().get(ENDPOINTS.users.list, params);
}

export async function getUser(id: number): Promise<User> {
  return getApiClient().get(ENDPOINTS.users.detail(id));
}

export async function createUser(data: CreateUserRequest): Promise<User> {
  return getApiClient().post(ENDPOINTS.users.list, data);
}

export async function updateUser(id: number, data: UpdateUserRequest): Promise<User> {
  return getApiClient().put(ENDPOINTS.users.detail(id), data);
}

export async function deleteUser(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.users.detail(id));
}

export async function activateUser(id: number): Promise<User> {
  return getApiClient().patch(ENDPOINTS.users.activate(id));
}

export async function suspendUser(id: number): Promise<User> {
  return getApiClient().patch(ENDPOINTS.users.suspend(id));
}

export async function resetPassword(id: number, newPassword: string): Promise<void> {
  return getApiClient().patch(ENDPOINTS.users.resetPassword(id), { newPassword });
}
