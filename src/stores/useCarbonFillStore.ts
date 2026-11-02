import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

// 카본 마켓 서식 작성 정보 — 서식마다 사용자가 넣은 이전 신청량. HWP 를 받을 때 칸에 넣는다(양수인은 직접 쓴다).
// POC — 브라우저(localStorage), 백엔드 구현 시 서버 저장으로 교체

export interface FillContext {
  amount?: string;
}

interface CarbonFillState {
  byForm: Record<string, FillContext>;
  set: (key: string, patch: FillContext) => void;
}

export const useCarbonFillStore = create<CarbonFillState>()(
  persist(
    (set) => ({
      byForm: {},
      set: (key, patch) => set((s) => ({ byForm: { ...s.byForm, [key]: { ...s.byForm[key], ...patch } } })),
    }),
    { name: 'carbon-fill', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
