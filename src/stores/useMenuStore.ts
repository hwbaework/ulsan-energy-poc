import { create } from 'zustand';
import type { MenuItem } from '@/types';

interface MenuState {
  items: MenuItem[];
  collapsed: boolean;
  activeId: string | null;
  expandedIds: Set<string>;
  setItems: (items: MenuItem[]) => void;
  toggleCollapse: () => void;
  setActive: (id: string) => void;
  toggleExpanded: (id: string) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  items: [],
  collapsed: false,
  activeId: null,
  expandedIds: new Set(),
  setItems: (items) => set({ items }),
  toggleCollapse: () => set((s) => ({ collapsed: !s.collapsed })),
  setActive: (id) => set({ activeId: id }),
  toggleExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedIds: next };
    }),
}));
