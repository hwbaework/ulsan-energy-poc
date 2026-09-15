import { useQuery } from '@tanstack/react-query';
import * as spcApi from '@/api/spc/spc';
import { spcKeys } from '@/api/queryKeys';

export const useSpcAssets = (companyId: number, assetType?: string) => {
  return useQuery({
    queryKey: spcKeys.assets({ companyId, assetType }),
    queryFn: () => spcApi.getSpcAssets({ companyId, assetType }),
    enabled: !!companyId,
  });
};

export const useSpcAsset = (id: number) => {
  return useQuery({
    queryKey: spcKeys.asset(id),
    queryFn: () => spcApi.getSpcAsset(id),
    enabled: !!id,
  });
};

export const useSpcTradingMonthly = (year?: number) => {
  return useQuery({
    queryKey: spcKeys.tradingMonthly(year),
    queryFn: () => spcApi.getSpcTradingMonthly(year),
    staleTime: 30_000,
  });
};

export const useSpcGenerationDaily = (days = 30) => {
  return useQuery({
    queryKey: spcKeys.generationDaily(days),
    queryFn: () => spcApi.getSpcGenerationDaily(days),
    staleTime: 30_000,
  });
};

export const useSpcSuppliers = () => {
  return useQuery({
    queryKey: spcKeys.suppliers(),
    queryFn: () => spcApi.getSpcSuppliers(),
    staleTime: 30_000,
  });
};

// V106: SPC 재무 실적 (입력 대기 — 비면 []). 가짜 수치 없음.
export const useSpcFinance = (companyId?: number) => {
  return useQuery({
    queryKey: spcKeys.finance(companyId),
    queryFn: () => spcApi.getSpcFinance(companyId),
    staleTime: 30_000,
  });
};
