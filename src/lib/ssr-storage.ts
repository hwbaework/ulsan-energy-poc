import type { StateStorage } from 'zustand/middleware';

export const ssrSafeStorage: StateStorage = {
  getItem: (name) => (typeof window !== 'undefined' ? localStorage.getItem(name) : null),
  setItem: (name, value) => {
    if (typeof window !== 'undefined') localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') localStorage.removeItem(name);
  },
};
