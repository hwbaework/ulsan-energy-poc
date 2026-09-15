import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ppaApi from '@/api/ppa/ppa';
import { ppaKeys } from '@/api/queryKeys';

export const usePpaContracts = (params?: object) => {
  return useQuery({
    queryKey: ppaKeys.contracts(params ?? {}),
    queryFn: () => ppaApi.getPpaContracts(params),
    staleTime: 30_000,
  });
};

export const usePpaContract = (id: number) => {
  return useQuery({
    queryKey: ppaKeys.contract(id),
    queryFn: () => ppaApi.getPpaContract(id),
    enabled: !!id,
  });
};

export const useContractDocuments = (contractId: number) => {
  return useQuery({
    queryKey: ppaKeys.contractDocuments(contractId),
    queryFn: () => ppaApi.getContractDocuments(contractId),
    enabled: contractId > 0,
    // 다른 당사자(SPC)가 발행하면 열려있는 화면에 실시간 반영
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useAddContractDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contractId,
      fileId,
      documentType,
    }: {
      contractId: number;
      fileId: number;
      documentType?: string;
    }) => ppaApi.addContractDocument(contractId, fileId, documentType),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.contractDocuments(vars.contractId) });
    },
  });
};

export const useCreatePpaContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => ppaApi.createPpaContract(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useActivatePpaContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.activatePpaContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useTerminatePpaContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.terminatePpaContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useRequestContractChange = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contractId,
      ...input
    }: {
      contractId: number;
      changeType: string;
      description?: string;
      changeItem?: string;
      newUnitPriceKrw?: number;
      newCapacityKw?: number;
      newEndDate?: string;
    }) => ppaApi.requestContractChange(contractId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useContractChange = (changeId: number) => {
  return useQuery({
    queryKey: ppaKeys.contractChange(changeId),
    queryFn: () => ppaApi.getContractChange(changeId),
    enabled: !!changeId,
  });
};

export const useAllContractChanges = (params?: { status?: string }) => {
  return useQuery({
    queryKey: [...ppaKeys.all, 'changes', params ?? {}],
    queryFn: () => ppaApi.searchContractChanges(params),
    refetchInterval: 8000,
  });
};

export const useCancelContractChange = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeId: number) => ppaApi.cancelContractChange(changeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ppaKeys.all }),
  });
};

export const useApproveContractChange = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeId: number) => ppaApi.approveContractChange(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useRejectContractChange = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeId: number) => ppaApi.rejectContractChange(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useRequestGeneratorApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeId: number) => ppaApi.requestGeneratorApproval(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useGeneratorApproveChange = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeId: number) => ppaApi.generatorApproveChange(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useGeneratorRejectChange = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeId: number) => ppaApi.generatorRejectChange(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useContractChanges = (contractId: number) => {
  return useQuery({
    queryKey: ppaKeys.contractChanges(contractId),
    queryFn: () => ppaApi.getContractChanges(contractId),
    enabled: !!contractId,
  });
};

export const useContractDeviations = (contractId: number) => {
  return useQuery({
    queryKey: ppaKeys.contractDeviations(contractId),
    queryFn: () => ppaApi.getContractDeviations(contractId),
    enabled: !!contractId,
  });
};

export const usePpaSettlements = (params?: object) => {
  return useQuery({
    queryKey: ppaKeys.settlements(params ?? {}),
    queryFn: () => ppaApi.getPpaSettlements(params),
    staleTime: 30_000,
  });
};

export const usePpaSettlement = (id: number) => {
  return useQuery({
    queryKey: ppaKeys.settlement(id),
    queryFn: () => ppaApi.getPpaSettlement(id),
    enabled: !!id,
  });
};

export const useSettlementInvoices = (settlementId: number) => {
  return useQuery({
    queryKey: ppaKeys.invoices(settlementId),
    queryFn: () => ppaApi.getSettlementInvoices(settlementId),
    enabled: !!settlementId,
  });
};

export const useConfirmSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.confirmSettlement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useDisputeSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      ppaApi.disputeSettlement(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useStartReviewSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.startReviewSettlement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useAdjustSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      adjustedAmount,
      note,
    }: {
      id: number;
      adjustedAmount: number;
      note?: string;
    }) => ppaApi.adjustSettlement(id, adjustedAmount, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useReconfirmSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.reconfirmSettlement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const useIssuePpaInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.issuePpaInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};

export const usePayPpaInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ppaApi.payPpaInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ppaKeys.all });
    },
  });
};
