import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as leaseApi from '@/api/lease/lease';
import { leaseKeys } from '@/api/queryKeys';

export const useVolumeContracts = (params?: object) => {
  return useQuery({
    queryKey: leaseKeys.volume(params ?? {}),
    queryFn: () => leaseApi.getVolumeContracts(params),
    staleTime: 30_000,
  });
};

export const useVolumeContract = (id: number) => {
  return useQuery({
    queryKey: leaseKeys.volumeDetail(id),
    queryFn: () => leaseApi.getVolumeContract(id),
    enabled: !!id,
  });
};

export const useTerminateVolume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaseApi.terminateVolumeContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useSavingsContracts = (params?: object) => {
  return useQuery({
    queryKey: leaseKeys.savings(params ?? {}),
    queryFn: () => leaseApi.getSavingsContracts(params),
    staleTime: 30_000,
  });
};

export const useSavingsContract = (id: number) => {
  return useQuery({
    queryKey: leaseKeys.savingsDetail(id),
    queryFn: () => leaseApi.getSavingsContract(id),
    enabled: !!id,
  });
};

export const useMonthlyRecords = (params: { leaseType: string; contractId: number }) => {
  return useQuery({
    queryKey: leaseKeys.monthlyRecords(params),
    queryFn: () => leaseApi.getMonthlyRecords(params),
    enabled: !!params.contractId,
    staleTime: 30_000,
  });
};

export const useLeaseInvoices = (params: { leaseType: string; contractId: number }) => {
  return useQuery({
    queryKey: leaseKeys.invoices(params),
    queryFn: () => leaseApi.getLeaseInvoices(params),
    enabled: !!params.contractId,
    staleTime: 30_000,
  });
};

export const useAllMonthlyRecords = (params?: { year?: number }) => {
  return useQuery({
    queryKey: leaseKeys.allMonthlyRecords(params ?? {}),
    queryFn: () => leaseApi.getAllMonthlyRecords(params),
    staleTime: 30_000,
  });
};

export const useAllLeaseInvoices = (params?: { year?: number }) => {
  return useQuery({
    queryKey: leaseKeys.allInvoices(params ?? {}),
    queryFn: () => leaseApi.getAllLeaseInvoices(params),
    staleTime: 30_000,
  });
};

export const useIssueLeaseInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaseApi.issueLeaseInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const usePayLeaseInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaseApi.payLeaseInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useTerminateSavings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaseApi.terminateSavingsContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useRequestTerminationVolume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      leaseApi.requestTerminationVolume(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useRequestTerminationSavings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      leaseApi.requestTerminationSavings(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useDisputeLeaseInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      leaseApi.disputeLeaseInvoice(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useCalculateSavings = (params: {
  usageKwh: number;
  sharePct: number;
  voltageLevel?: string;
}) => {
  return useQuery({
    queryKey: leaseKeys.calculateSavings(params),
    queryFn: () => leaseApi.calculateSavings(params),
    enabled: params.usageKwh > 0 && params.sharePct > 0,
  });
};

export const useLeaseRequests = (status?: string) => {
  return useQuery({
    queryKey: leaseKeys.requests({ status }),
    queryFn: () => leaseApi.getLeaseRequests(status),
    staleTime: 30_000,
  });
};

export const useCreateLeaseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof leaseApi.createLeaseRequest>[0]) =>
      leaseApi.createLeaseRequest(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useAcceptLeaseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaseApi.acceptLeaseRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useAvailableEquipments = () => {
  return useQuery({
    queryKey: leaseKeys.equipments(),
    queryFn: () => leaseApi.getAvailableEquipments(),
    staleTime: 30_000,
  });
};

export const useMyEquipments = (generatorCompanyId: number) => {
  return useQuery({
    queryKey: leaseKeys.myEquipments(generatorCompanyId),
    queryFn: () => leaseApi.getMyEquipments(generatorCompanyId),
    enabled: !!generatorCompanyId,
    staleTime: 30_000,
  });
};

export const useRegisterEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof leaseApi.registerEquipment>[0]) =>
      leaseApi.registerEquipment(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useRecoveries = (status?: string) => {
  return useQuery({
    queryKey: leaseKeys.recoveries({ status }),
    queryFn: () => leaseApi.getRecoveries(status),
    staleTime: 30_000,
  });
};

export const useScheduleRecovery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledDate }: { id: number; scheduledDate: string }) =>
      leaseApi.scheduleRecovery(id, scheduledDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useCompleteRecovery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaseApi.completeRecovery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    },
  });
};

export const useLeaseActivities = (params?: object) => {
  return useQuery({
    queryKey: leaseKeys.activities(params ?? {}),
    queryFn: () => leaseApi.getLeaseActivities(params),
    staleTime: 30_000,
  });
};
