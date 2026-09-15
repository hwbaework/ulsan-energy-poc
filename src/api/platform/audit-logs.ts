import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { AuditLog, PageResponse, ListQueryParams } from '@/types';

export async function getAuditLogs(params?: ListQueryParams): Promise<PageResponse<AuditLog>> {
  return getApiClient().get(ENDPOINTS.auditLogs.list, params);
}
