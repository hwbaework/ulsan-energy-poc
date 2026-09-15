import { useQuery } from '@tanstack/react-query';
import * as monitoringApi from '@/api/monitoring/monitoring';
import { monitoringKeys } from '@/api/queryKeys';

export const useMonitoringPlantDailySummary = (laseeId: number, date: string) => {
  return useQuery({
    queryKey: monitoringKeys.plantDailySummary(laseeId, date),
    queryFn: () => monitoringApi.getPlantDailySummary(laseeId, date),
    staleTime: 60_000,
    enabled: laseeId > 0 && !!date,
  });
};

export const useMonitoringPlants = (ownedOnly = false) => {
  return useQuery({
    queryKey: monitoringKeys.plants(ownedOnly),
    queryFn: () => monitoringApi.getMonitoringPlants(ownedOnly),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
};

export const useMonitoringPlantHistory = (laseeId: number, from: string, to: string) => {
  return useQuery({
    queryKey: monitoringKeys.plantHistory(laseeId, from, to),
    queryFn: () => monitoringApi.getPlantHistory(laseeId, from, to),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: laseeId > 0 && !!from && !!to,
  });
};

export const useMonitoringPlantDetail = (laseeId: number) => {
  return useQuery({
    queryKey: monitoringKeys.plant(laseeId),
    queryFn: () => monitoringApi.getMonitoringPlantDetail(laseeId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    enabled: laseeId > 0,
  });
};

export const useMonitoringDashboard = () => {
  return useQuery({
    queryKey: monitoringKeys.dashboard(),
    queryFn: () => monitoringApi.getMonitoringDashboard(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
};

export const useMonitoringConsumers = () => {
  return useQuery({
    queryKey: monitoringKeys.consumers(),
    queryFn: () => monitoringApi.getMonitoringConsumers(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
};

export const useMonitoringConsumerDetail = (id: number) => {
  return useQuery({
    queryKey: monitoringKeys.consumer(id),
    queryFn: () => monitoringApi.getMonitoringConsumerDetail(id),
    enabled: id > 0,
  });
};

export const useMonitoringContracts = () => {
  return useQuery({
    queryKey: monitoringKeys.contracts(),
    queryFn: () => monitoringApi.getMonitoringContracts(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
};

export const useConsumerSupplyImpact = (companyId: number) => {
  return useQuery({
    queryKey: monitoringKeys.consumerSupplyImpact(companyId),
    queryFn: () => monitoringApi.getConsumerSupplyImpact(companyId),
    enabled: companyId > 0,
    staleTime: 30_000,
  });
};

export const useConsumerSupplyDemand = (companyId: number) => {
  return useQuery({
    queryKey: monitoringKeys.consumerSupplyDemand(companyId),
    queryFn: () => monitoringApi.getConsumerSupplyDemand(companyId),
    enabled: companyId > 0,
    staleTime: 30_000,
  });
};

export const useAnomalyImpact = (id: number) => {
  return useQuery({
    queryKey: monitoringKeys.anomalyImpact(id),
    queryFn: () => monitoringApi.getAnomalyImpact(id),
    enabled: id > 0,
  });
};
