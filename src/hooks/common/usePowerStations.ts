import { useQuery } from '@tanstack/react-query';
import * as stationApi from '@/api/common/power-stations';
import { powerStationKeys } from '@/api/queryKeys';
import type { ListQueryParams } from '@/types';

export const usePowerStations = (params?: ListQueryParams) => {
  return useQuery({
    queryKey: powerStationKeys.list(params ?? {}),
    queryFn: () => stationApi.getPowerStations(params),
    staleTime: 30_000,
  });
};

export const usePowerStation = (id: number) => {
  return useQuery({
    queryKey: powerStationKeys.detail(id),
    queryFn: () => stationApi.getPowerStation(id),
    enabled: !!id,
  });
};

export const usePowerStationEquipment = (id: number) => {
  return useQuery({
    queryKey: powerStationKeys.equipment(id),
    queryFn: () => stationApi.getPowerStationEquipment(id),
    enabled: !!id,
  });
};

// 회사 소유 발전소 목록 — PPA/VPP 선택식 편입 드롭다운 소스 (설계문서 22 §5). GET /power-stations/by-company/{companyId}
export const usePowerStationsByCompany = (companyId?: number) => {
  return useQuery({
    queryKey: powerStationKeys.byCompany(companyId ?? 0),
    queryFn: () => stationApi.getPowerStationsByCompany(companyId as number),
    enabled: !!companyId,
    staleTime: 30_000,
  });
};
