import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { CodeGroup, Code } from '@/types';

export async function getCodeGroups(): Promise<CodeGroup[]> {
  return getApiClient().get(ENDPOINTS.codes.groups);
}

export async function getCodesByGroup(groupCode: string): Promise<Code[]> {
  return getApiClient().get(ENDPOINTS.codes.byGroup(groupCode));
}

export async function createCodeGroup(data: object): Promise<CodeGroup> {
  return getApiClient().post(ENDPOINTS.codes.groups, data);
}

export async function createCode(groupCode: string, data: object): Promise<Code> {
  return getApiClient().post(ENDPOINTS.codes.byGroup(groupCode), data);
}
