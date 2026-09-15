import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types';
import { ssrSafeStorage } from '@/lib/ssr-storage';

export type Persona =
  | 'generator'
  | 'consumer'
  | 'consultant'
  | 'admin'
  | 'spc'
  | 'operator'
  | 'agency';

export const PERSONA_LABELS: Record<Persona, string> = {
  generator: '발전사업자',
  consumer: '전기사용자',
  consultant: '컨설턴트',
  admin: '관리자',
  spc: '전기 공급사업자',
  operator: '현장 운영자',
  agency: '용역사',
};

const ROLE_TO_PERSONA: Record<string, Persona> = {
  SYSTEM_ADMIN: 'admin',
  COMPANY_ADMIN: 'admin',
  POWER_OPERATOR: 'generator',
  CONSUMER_MANAGER: 'consumer',
  CONSULTANT: 'consultant',
  SPC_OPERATOR: 'spc',
  FIELD_OPERATOR: 'operator',
  AGENCY_ADMIN: 'agency',
};

interface PersonaOverrideState {
  override: Persona | null;
  setOverride: (p: Persona | null) => void;
}

export const usePersonaOverride = create<PersonaOverrideState>()(
  persist(
    (set) => ({
      override: null,
      setOverride: (override) => set({ override }),
    }),
    { name: 'energy-persona-override', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);

export function getPersona(user: User | null): Persona {
  const override = usePersonaOverride.getState().override;
  if (override) return override;
  if (!user) return 'generator'; // safe fallback — layout guards redirect to login when user is null
  for (const role of user.roles ?? []) {
    const p = ROLE_TO_PERSONA[role.toUpperCase()];
    if (p) return p;
  }
  // Derive from user roles array when no mapping found — fall back to generator
  // to prevent layout breakage. Auth guards handle actual null-user redirects.
  return 'generator';
}

export const PERSONA_HOME: Record<Persona, string> = {
  generator: '/dashboard',
  consumer: '/consumer',
  consultant: '/consultant',
  admin: '/monitoring', // 실시간 지도 관제 랜딩
  spc: '/spc',
  operator: '/monitoring/anomalies',
  agency: '/consulting/projects',
};
