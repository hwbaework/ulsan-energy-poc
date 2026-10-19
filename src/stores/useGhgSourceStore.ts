import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

/**
 * 배출원 정보 — 회사만 아는 칸. 배출원(설비)은 전력거래 계약에서 자동으로 생기고, 산정도 자동이다.
 * 이 칸들은 산정에 영향이 없는 설명용으로, 기업관리자가 설비마다 한 번 넣는다(선택). 비어 있으면 빈 값.
 * POC 는 브라우저에 저장(실서비스는 서버 DB)
 */
export type YesNo = '' | 'Y' | 'N';
export interface GhgSourceInfo {
  /** 자체 시설명 — 회사가 부르는 설비 이름 */
  name: string;
  /** 현장 담당자 */
  manager: string;
  /** 주관부서 */
  dept: string;
  /** 소량배출사업장 여부 */
  smallSite: YesNo;
  /** 할당여부 — 배출권 사전할당 대상 */
  allocated: YesNo;
  memo: string;
  updatedAt: string;
  updatedBy: string;
}
export const EMPTY_SOURCE_INFO: GhgSourceInfo = {
  name: '',
  manager: '',
  dept: '',
  smallSite: '',
  allocated: '',
  memo: '',
  updatedAt: '',
  updatedBy: '',
};

interface State {
  version: number;
  /** 키 = 배출원 id(계약 id) */
  infos: Record<number, GhgSourceInfo>;
  save: (id: number, info: GhgSourceInfo) => void;
}

const SEED_VERSION = 1; // 1 — 한일튜브(박발전 · 발전운영팀) 두 설비만 입력, 나머지는 빈 값
const SEED: Record<number, GhgSourceInfo> = {
  // 한일튜브 PPA(CT-2025-0001) · 자가소비(CT-2025-0002)
  1: {
    ...EMPTY_SOURCE_INFO,
    name: 'PPA 태양광',
    manager: '박발전',
    dept: '발전운영팀',
    updatedAt: '2025-03-05T10:00:00',
    updatedBy: '박발전',
  },
  2: {
    ...EMPTY_SOURCE_INFO,
    name: '자가소비 태양광',
    manager: '박발전',
    dept: '발전운영팀',
    updatedAt: '2025-03-05T10:00:00',
    updatedBy: '박발전',
  },
};

export const useGhgSourceStore = create<State>()(
  persist(
    (set) => ({
      version: SEED_VERSION,
      infos: SEED,
      save: (id, info) => set((s) => ({ infos: { ...s.infos, [id]: info } })),
    }),
    {
      name: 'ulsan-ghg-source-v1',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, infos: s.infos }),
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        if (!p || p.version !== SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

export function useHydrateGhgSource() {
  useEffect(() => {
    void useGhgSourceStore.persist.rehydrate();
  }, []);
}
