import { create } from 'zustand';
import type { Persona } from '@/lib/persona';

const STORAGE_KEY = 'asset_registered_';

interface AssetStoreState {
  hydrated: boolean;
  registered: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  isRegistered: (persona: Persona) => boolean;
  isDismissed: (persona: Persona) => boolean;
  register: (persona: Persona) => void;
  dismiss: (persona: Persona) => void;
  hydrate: () => void;
}

export const useAssetStore = create<AssetStoreState>()((set, get) => ({
  hydrated: false,
  registered: {},
  dismissed: {},

  isRegistered: (persona) => {
    if (!get().hydrated) return true;
    return get().registered[persona] ?? false;
  },

  isDismissed: (persona) => {
    if (!get().hydrated) return true;
    return get().dismissed[persona] ?? false;
  },

  register: (persona) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY}${persona}`, 'done');
    }
    set((state) => ({ registered: { ...state.registered, [persona]: true } }));
  },

  dismiss: (persona) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`${STORAGE_KEY}dismiss_${persona}`, 'true');
    }
    set((state) => ({ dismissed: { ...state.dismissed, [persona]: true } }));
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    if (get().hydrated) return;
    const personas: Persona[] = ['generator', 'consumer', 'consultant', 'spc', 'admin'];
    const registered: Record<string, boolean> = {};
    const dismissed: Record<string, boolean> = {};
    for (const p of personas) {
      registered[p] = localStorage.getItem(`${STORAGE_KEY}${p}`) === 'done';
      dismissed[p] = sessionStorage.getItem(`${STORAGE_KEY}dismiss_${p}`) === 'true';
    }
    set({ registered, dismissed, hydrated: true });
  },
}));
