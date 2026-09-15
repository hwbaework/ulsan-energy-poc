import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPowerStationsByCompany } from '@/api/common/power-stations';
import { powerStationKeys } from '@/api/queryKeys';
import { getPersona } from '@/lib/persona';

interface MyPlantMatcher {
  ids: Set<string>;
  names: Set<string>;
}

export function useMyPlantMatcher(): MyPlantMatcher | null {
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const companyId = user?.companyId ?? 0;
  const isGenerator = persona === 'generator';

  const { data: stations } = useQuery({
    queryKey: powerStationKeys.list({ ownerCompanyId: companyId }),
    queryFn: () => getPowerStationsByCompany(companyId),
    enabled: isGenerator && companyId > 0,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!isGenerator) return null;
    const list = Array.isArray(stations) ? stations : [];

    const ids = new Set<string>();
    const names = new Set<string>();
    for (const s of list) {
      if (s.externalPlantId) ids.add(String(s.externalPlantId));
      if (s.name) names.add(s.name);
    }
    return { ids, names };
  }, [isGenerator, stations]);
}

export function useMyPlantIds(): {
  plantIds: number[];
  hasPlants: boolean;
  isLoading: boolean;
  isGenerator: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const companyId = user?.companyId ?? 0;
  const isGenerator = persona === 'generator';

  const { data: stations, isLoading } = useQuery({
    queryKey: powerStationKeys.list({ ownerCompanyId: companyId }),
    queryFn: () => getPowerStationsByCompany(companyId),
    enabled: isGenerator && companyId > 0,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!isGenerator)
      return { plantIds: [], hasPlants: true, isLoading: false, isGenerator: false };
    const list = Array.isArray(stations) ? stations : [];
    const ids = list
      .map((s) => (s.externalPlantId ? Number(s.externalPlantId) : 0))
      .filter((id) => id > 0);
    return { plantIds: ids, hasPlants: ids.length > 0, isLoading, isGenerator: true };
  }, [isGenerator, stations, isLoading]);
}

function extractCoreName(name: string): string {
  return name
    .replace(/^울산\s*/, '')
    .replace(/\s*(옥상)?태양광$/, '')
    .replace(/\s*발전\d*$/, '')
    .replace(/\s*\d+호$/, '')
    .trim();
}

export function filterPlantsByOwnership<T extends { plantId?: number; id?: number; name?: string }>(
  plants: T[],
  matcher: MyPlantMatcher | null,
): T[] {
  if (!matcher) return plants;
  if (matcher.ids.size === 0 && matcher.names.size === 0) return [];

  const myCoreNames = [...matcher.names].map(extractCoreName);

  return plants.filter((p) => {
    const pid = String(p.plantId ?? p.id);
    if (matcher.ids.has(pid)) return true;
    if (p.name) {
      if (matcher.names.has(p.name)) return true;
      const pCore = extractCoreName(p.name);
      for (const myCore of myCoreNames) {
        if (pCore === myCore) return true;
        if (pCore.includes(myCore) || myCore.includes(pCore)) return true;
      }
    }
    return false;
  });
}
