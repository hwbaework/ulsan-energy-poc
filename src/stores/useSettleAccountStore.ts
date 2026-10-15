import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

/**
 * 정산 계좌 — E-데이터마켓에서 내 데이터를 쓴 금액이 매달 15일에 들어오는 기업 계좌.
 * 기업관리자만 등록 · 수정, 소속 멤버는 보기만. POC 는 브라우저에 저장(실서비스는 서버 DB · 예금주 확인)
 */
export interface SettleAccount {
  bank: string;
  number: string;
  holder: string;
  updatedAt: string;
  updatedBy: string;
}

interface State {
  version: number;
  accounts: Record<number, SettleAccount>;
  save: (companyId: number, a: SettleAccount) => void;
}

export const BANKS = ['KB국민', '신한', '우리', '하나', 'IBK기업', 'NH농협', 'BNK경남', 'BNK부산', 'SC제일', '카카오뱅크', '토스뱅크'];

const SEED_VERSION = 1; // 1 — 데이터를 파는 기업(한길 · 한일튜브 · 용인금속 · 태성산업 · 건호이엔씨) 계좌
const SEED: Record<number, SettleAccount> = {
  2: { bank: 'BNK경남', number: '207-0123-4567-01', holder: '한길', updatedAt: '2025-05-02T10:00:00', updatedBy: '이수용' },
  4: { bank: 'IBK기업', number: '301-045218-01-012', holder: '한일튜브', updatedAt: '2026-06-01T09:30:00', updatedBy: '박발전' },
  5: { bank: 'KB국민', number: '612301-04-118204', holder: '용인금속', updatedAt: '2026-06-03T14:10:00', updatedBy: '용인금속 관리자' },
  6: { bank: 'BNK부산', number: '101-2045-6610-07', holder: '태성산업', updatedAt: '2026-06-05T11:00:00', updatedBy: '태성산업 관리자' },
  7: { bank: 'NH농협', number: '351-1182-4409-23', holder: '건호이엔씨', updatedAt: '2026-06-08T16:20:00', updatedBy: '건호이엔씨 관리자' },
};

export const useSettleAccountStore = create<State>()(
  persist(
    (set) => ({
      version: SEED_VERSION,
      accounts: SEED,
      save: (companyId, a) => set((s) => ({ accounts: { ...s.accounts, [companyId]: a } })),
    }),
    {
      name: 'ulsan-settle-account-v1',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, accounts: s.accounts }),
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        if (!p || p.version !== SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

export function useHydrateSettleAccount() {
  useEffect(() => {
    void useSettleAccountStore.persist.rehydrate();
  }, []);
}

/** 'IBK기업 301-045218-01-012 · 한일튜브' */
export const accountText = (a?: SettleAccount) => (a ? `${a.bank} ${a.number} · ${a.holder}` : '');
