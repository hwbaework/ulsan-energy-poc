import { useQuery } from '@tanstack/react-query';
import * as codeApi from '@/api/common/codes';
import { codeKeys } from '@/api/queryKeys';

export const useCodeGroups = () => {
  return useQuery({
    queryKey: codeKeys.groups(),
    queryFn: () => codeApi.getCodeGroups(),
    staleTime: 60_000,
  });
};

export const useCodesByGroup = (groupCode: string) => {
  return useQuery({
    queryKey: codeKeys.byGroup(groupCode),
    queryFn: () => codeApi.getCodesByGroup(groupCode),
    enabled: !!groupCode,
    staleTime: 60_000,
  });
};
