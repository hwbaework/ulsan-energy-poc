import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

export interface ContractSignatureData {
  id: number;
  contractType: string;
  contractId: number;
  signerName: string;
  signerRole: string;
  signMethod: string;
  signedAt: string;
}

export const useContractSignatures = (contractType: string, contractId: number) => {
  return useQuery({
    queryKey: ['signatures', contractType, contractId],
    queryFn: () =>
      getApiClient().get<ContractSignatureData[]>(ENDPOINTS.signatures.list, {
        contractType,
        contractId,
      }),
    enabled: !!contractType && contractId > 0,
  });
};

export const useSignContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      contractType: string;
      contractId: number;
      signerRole: string;
      signMethod: string;
      signatureImage?: string;
      typedName?: string;
    }) => getApiClient().post(ENDPOINTS.signatures.sign, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatures'] });
    },
  });
};

export const useSignatureStatus = (contractType: string, contractId: number) => {
  return useQuery({
    queryKey: ['signatures', 'status', contractType, contractId],
    queryFn: () =>
      getApiClient().get<{ fullySigned: boolean; signatures: ContractSignatureData[] }>(
        ENDPOINTS.signatures.status,
        { contractType, contractId },
      ),
    enabled: !!contractType && contractId > 0,
  });
};
