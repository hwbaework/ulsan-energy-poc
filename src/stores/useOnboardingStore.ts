import { create } from 'zustand';
import type { Persona } from '@/lib/persona';

const STORAGE_PREFIX = 'onboarding_';

// 서버 연동 활성화 — 온보딩 마스터를 회사 레코드로 저장(설계문서 19 §2·부록B, P0).
// 서버에서 firstLoginAt === null 체크하여 자동 트리거.
const ENABLE_SERVER_SYNC = true;

interface OnboardingState {
  hydrated: boolean;
  completed: Record<string, boolean>;
  isCompleted: (persona: Persona) => boolean;
  complete: (persona: Persona) => void;
  reset: (persona: Persona) => void;
  hydrate: () => void;
  syncFromServer: (completedPersonas: Persona[]) => void;
}

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  hydrated: false,
  completed: {},

  isCompleted: (persona) => {
    if (!get().hydrated) return true;
    return get().completed[persona] ?? false;
  },

  complete: (persona) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${persona}`, 'done');
    }
    set((state) => ({ completed: { ...state.completed, [persona]: true } }));
  },

  reset: (persona) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${persona}`);
    }
    set((state) => ({ completed: { ...state.completed, [persona]: false } }));
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    if (get().hydrated) return;
    const personas: Persona[] = ['generator', 'consumer', 'consultant', 'admin', 'spc'];
    const completed: Record<string, boolean> = {};
    for (const p of personas) {
      completed[p] = localStorage.getItem(`${STORAGE_PREFIX}${p}`) === 'done';
    }
    set({ completed, hydrated: true });
  },

  syncFromServer: (completedPersonas) => {
    if (!ENABLE_SERVER_SYNC) return;
    if (typeof window === 'undefined') return;
    const completed: Record<string, boolean> = { ...get().completed };
    for (const p of completedPersonas) {
      completed[p] = true;
      localStorage.setItem(`${STORAGE_PREFIX}${p}`, 'done');
    }
    set({ completed });
  },
}));

export { ENABLE_SERVER_SYNC };
