import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import { getPowerStationsByCompany } from '@/api/common/power-stations';
import { powerStationKeys, monitoringKeys } from '@/api/queryKeys';
import * as monitoringApi from '@/api/monitoring';
import type { PlantHistoryPoint } from '@/api/monitoring/monitoring';
import type { MonitoringPlant } from '@/types/monitoring';
import { useMonitoringPlants } from './useMonitoring';

/**
 * 역할별 대시보드 범위의 발전소 목록.
 * - 관리자: 전체 발전소
 * - 발전사업자·전기사용자: 자사(companyId) 계약 발전소만 (power-stations/by-company → externalPlantId 매칭)
 */
export function useScopedPlants(): { plants: MonitoringPlant[]; isLoading: boolean } {
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const companyId = user?.companyId ?? 0;
  const isAdmin = persona === 'admin';

  const plantsQ = useMonitoringPlants();
  const stationsQ = useQuery({
    queryKey: powerStationKeys.list({ ownerCompanyId: companyId }),
    queryFn: () => getPowerStationsByCompany(companyId),
    enabled: !isAdmin && companyId > 0,
    staleTime: 60_000,
  });

  const plants = useMemo(() => {
    const all = plantsQ.data ?? [];
    if (isAdmin) return all;
    const ids = new Set((stationsQ.data ?? []).map((s) => String(s.externalPlantId ?? '')));
    return all.filter((p) => ids.has(String(p.plantId)));
  }, [plantsQ.data, stationsQ.data, isAdmin]);

  return { plants, isLoading: plantsQ.isLoading || (!isAdmin && stationsQ.isLoading) };
}

export interface PlantsHistory {
  /** 발전소별 원본 시계열 */
  byPlant: Record<number, PlantHistoryPoint[]>;
  /** 같은 시각끼리 합산한 시계열 (acPower·dcPower·dailyEnergy 합) */
  merged: PlantHistoryPoint[];
  isLoading: boolean;
}

/** 여러 발전소의 발전 이력을 한 번에 조회하고 합산본도 함께 돌려준다 */
export function usePlantsHistory(plantIds: number[], from: string, to: string): PlantsHistory {
  const results = useQueries({
    queries: plantIds.map((id) => ({
      queryKey: monitoringKeys.plantHistory(id, from, to),
      queryFn: () => monitoringApi.getPlantHistory(id, from, to),
      staleTime: 30_000,
      enabled: id > 0 && !!from && !!to,
    })),
  });

  const dataKey = results.map((r) => (r.data ? r.data.length : -1)).join(',');
  return useMemo(() => {
    const byPlant: Record<number, PlantHistoryPoint[]> = {};
    const acc = new Map<string, PlantHistoryPoint>();
    plantIds.forEach((id, i) => {
      const rows = results[i]?.data ?? [];
      byPlant[id] = rows;
      for (const r of rows) {
        const cur = acc.get(r.time);
        if (cur) {
          cur.acPower += r.acPower ?? 0;
          cur.dcPower += r.dcPower ?? 0;
          cur.dailyEnergy += r.dailyEnergy ?? 0;
        } else {
          acc.set(r.time, { time: r.time, acPower: r.acPower ?? 0, dcPower: r.dcPower ?? 0, dailyEnergy: r.dailyEnergy ?? 0 });
        }
      }
    });
    const merged = [...acc.values()].sort((a, b) => a.time.localeCompare(b.time));
    return { byPlant, merged, isLoading: results.some((r) => r.isLoading) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, from, to, plantIds.join(',')]);
}
