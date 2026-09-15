import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TabItem } from '@/types';
import { ssrSafeStorage } from '@/lib/ssr-storage';

interface TabState {
  tabs: TabItem[];
  activeTabId: string | null;
  addTab: (tab: TabItem) => void;
  removeTab: (id: string) => void;
  setActive: (id: string) => void;
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      addTab: (tab) => {
        const exists = get().tabs.find((t) => t.id === tab.id);
        if (!exists) {
          set((s) => ({ tabs: [...s.tabs, tab] }));
        }
        set({ activeTabId: tab.id });
      },
      removeTab: (id) =>
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id);
          const activeTabId =
            s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId;
          return { tabs, activeTabId };
        }),
      setActive: (id) => set({ activeTabId: id }),
    }),
    { name: 'energy-tabs', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
