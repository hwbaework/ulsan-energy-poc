import type { BaseEntity, Status } from './common';

export interface User extends BaseEntity {
  email: string;
  name: string;
  status: Status;
  companyId: number | null;
  companyName?: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string | null;
  agencyId?: number | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  companyId?: number;
  roleIds?: number[];
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  companyId?: number | null;
  roleIds?: number[];
}

export interface UserListParams {
  page?: number;
  size?: number;
  keyword?: string;
  status?: Status;
  companyId?: number;
}
