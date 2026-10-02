import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { getPowerStationsByCompany } from '@/api/common/power-stations';
import { powerStationKeys } from '@/api/queryKeys';
import { CONSULTING_DOCS } from '@/lib/consulting-docs';

/**
 * 볼 수 있는 컨설팅 결과보고서 — 관리자는 전체, 그 밖에는 보고서 회사이거나
 * 보고서 발전소가 내 계정에 연결된 발전소(대시보드와 같은 power-stations/by-company)일 때.
 * 예) 한일튜브 보고서 → 한일튜브 발전소를 가진 발전사업자(울산 발전)도 본다.
 */
export function useConsultingDocs() {
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const isAdmin = (override ?? getPersona(user)) === 'admin';
  const companyId = user?.companyId ?? 0;
  const { data: stations, isLoading } = useQuery({
    queryKey: powerStationKeys.list({ ownerCompanyId: companyId }),
    queryFn: () => getPowerStationsByCompany(companyId),
    enabled: !isAdmin && companyId > 0,
    staleTime: 60_000,
  });
  const docs = useMemo(() => {
    if (isAdmin) return CONSULTING_DOCS;
    const myPlants = new Set((Array.isArray(stations) ? stations : []).map((s) => Number(s.externalPlantId)));
    return CONSULTING_DOCS.filter((d) => d.companyId === companyId || d.plantIds.some((p) => myPlants.has(p)));
  }, [isAdmin, companyId, stations]);
  return { docs, isAdmin, isLoading: !isAdmin && isLoading };
}
