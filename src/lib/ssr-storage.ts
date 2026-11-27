import type { StateStorage } from 'zustand/middleware';

export const ssrSafeStorage: StateStorage = {
  getItem: (name) => (typeof window !== 'undefined' ? localStorage.getItem(name) : null),
  // 저장 공간(약 5MB)을 넘으면 브라우저가 예외를 던진다 — 업로드한 PDF(최대 3MB)를 담으면 넘을 수 있다.
  // 예외가 화면까지 올라가 문서 관리가 깨지던 문제(2026-11-25) — 저장만 건너뛰고 이번 화면에서는 그대로 쓴다
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn(`[storage] ${name} 저장 건너뜀 — 브라우저 저장 공간 초과`, e);
    }
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') localStorage.removeItem(name);
  },
};
