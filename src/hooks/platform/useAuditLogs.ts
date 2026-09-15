import { useQuery } from '@tanstack/react-query';
import * as auditLogApi from '@/api/platform/audit-logs';
import { auditLogKeys } from '@/api/queryKeys';
import type { ListQueryParams } from '@/types';

export const useAuditLogs = (params?: ListQueryParams) => {
  return useQuery({
    queryKey: auditLogKeys.list(params ?? {}),
    queryFn: () => auditLogApi.getAuditLogs(params),
    staleTime: 30_000,
  });
};
