import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { LoginRequest, User, UpdateUserRequest } from '@/types';

export async function signIn(data: LoginRequest): Promise<void> {
  await getApiClient().post(ENDPOINTS.auth.login, data);
}

export async function signOut(): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.logout);
}

export async function refreshToken(): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.refresh);
}

export async function signUp(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  department?: string;
  signupType?: string;
  companyName?: string;
  businessNumber?: string;
  representative?: string;
  companyPhone?: string;
  companyAddress?: string;
  existingCompanyId?: number;
  consultantRegion?: string;
  consultantExperience?: number;
  consultantBio?: string;
  specializations?: string[];
  agencyId?: number;
  enterpriseRole?: string;
  bizType?: string;
  bizCategory?: string;
}): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.signup, data);
}

export async function verifyEmail(token: string): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.verifyEmail, { token });
}

export async function forgotPassword(email: string): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.forgotPassword, { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.resetPassword, { token, newPassword });
}

export async function getMe(): Promise<User> {
  return getApiClient().get(ENDPOINTS.me.profile);
}

export async function updateProfile(data: UpdateUserRequest): Promise<User> {
  return getApiClient().put(ENDPOINTS.me.updateProfile, data);
}

export async function getMyMenus(): Promise<string[]> {
  return getApiClient().get(ENDPOINTS.me.menus);
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return getApiClient().post(ENDPOINTS.auth.changePassword, data);
}
