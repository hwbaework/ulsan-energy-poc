import { useQuery } from '@tanstack/react-query';
import * as etmApi from '@/api/etm/etm';
import { etmKeys } from '@/api/queryKeys';

export const useEtmAvailablePlants = () => {
  return useQuery({
    queryKey: etmKeys.availablePlants(),
    queryFn: () => etmApi.getAvailablePlants(),
    staleTime: 60_000,
  });
};

export const useEtmContracts = (params?: object) => {
  return useQuery({
    queryKey: etmKeys.contracts(params),
    queryFn: () => etmApi.getContracts(params),
    staleTime: 30_000,
  });
};

export const useEtmContract = (id: number) => {
  return useQuery({
    queryKey: etmKeys.contract(id),
    queryFn: () => etmApi.getContract(id),
    enabled: !!id,
  });
};

export const useEtmMarketPrice = () => {
  return useQuery({
    queryKey: etmKeys.marketPrice(),
    queryFn: () => etmApi.getMarketPrice(),
    staleTime: 60_000,
  });
};

export const useEtmSettlements = (params?: object) => {
  return useQuery({
    queryKey: etmKeys.settlements(params),
    queryFn: () => etmApi.getSettlements(params),
    staleTime: 30_000,
  });
};

export const useEtmInvoices = (params?: object) => {
  return useQuery({
    queryKey: etmKeys.invoices(params),
    queryFn: () => etmApi.getInvoices(params),
    staleTime: 30_000,
  });
};

export const useEtmInvoice = (id: number) => {
  return useQuery({
    queryKey: etmKeys.invoice(id),
    queryFn: () => etmApi.getInvoice(id),
    enabled: !!id,
  });
};

export const useEtmRecSummary = () => {
  return useQuery({
    queryKey: etmKeys.rec(),
    queryFn: () => etmApi.getRecSummary(),
    staleTime: 30_000,
  });
};

export const useEtmRecTransactions = () => {
  return useQuery({
    queryKey: etmKeys.recTransactions(),
    queryFn: () => etmApi.getRecTransactions(),
    staleTime: 30_000,
  });
};

export const useEtmTransactions = (params?: object) => {
  return useQuery({
    queryKey: etmKeys.transactions(params),
    queryFn: () => etmApi.getTransactions(params),
    staleTime: 30_000,
  });
};
