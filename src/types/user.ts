import type { BaseEntity, Status } from './common';

export interface User extends BaseEntity {
  email: string;
  name: string;
  phone?: string;
  status: Status;
  companyId: number | null;
  companyName?: string;
  businessNumber?: string;
  representative?: string;
  companyPhone?: string;
  companyAddress?: string;
  // 회사 마스터(업종·규모·할당대상) — /me 단일 소스 일원화(프리필·서비스 분기·유도 배너 공용)
  companyIndustryCode?: string | null;
  companyKsicCode?: string | null;
  companyEmployeeCount?: number | null;
  companyAnnualRevenue?: number | null;
  companyAllocationTarget?: boolean | null;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string | null;
  agencyId?: number | null;
  position?: string;
  department?: string;
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
  phone?: string;
  position?: string;
  department?: string;
}

export interface UserListParams {
  page?: number;
  size?: number;
  keyword?: string;
  status?: Status;
  companyId?: number;
}
