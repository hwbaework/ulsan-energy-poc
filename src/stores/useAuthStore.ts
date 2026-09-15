import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types';
import type { Persona } from '@/lib/persona';
import { ssrSafeStorage } from '@/lib/ssr-storage';

/**
 * POC 인증 스토어 — 서버·쿠키 없이 역할 선택만으로 로그인 처리.
 * 선택된 역할의 목업 사용자(User)를 localStorage 에 보관한다.
 */
export type PocRole = Extract<Persona, 'admin' | 'consumer' | 'generator'>;

export const POC_USERS: Record<PocRole, User> = {
  admin: {
    id: 1,
    email: 'admin@test.com',
    name: '관리자',
    status: 'ACTIVE',
    companyId: 1,
    companyName: '울산 에너지 플랫폼',
    roles: ['SYSTEM_ADMIN'],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as User,
  consumer: {
    id: 2,
    email: 'consumer@test.com',
    name: '전기사용자',
    status: 'ACTIVE',
    companyId: 2,
    companyName: '울산 수용가(주)',
    roles: ['CONSUMER_MANAGER'],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as User,
  generator: {
    id: 3,
    email: 'operator@test.com',
    name: '발전사업자',
    status: 'ACTIVE',
    companyId: 3,
    companyName: '울산 발전(주)',
    roles: ['POWER_OPERATOR'],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as User,
};

/** 로그인 폼에 입력한 이메일을 역할로 해석 (모르는 이메일은 전기사용자) */
export function roleFromEmail(email: string): PocRole {
  const e = email.trim().toLowerCase();
  if (e.startsWith('admin')) return 'admin';
  if (e.startsWith('operator') || e.startsWith('generator')) return 'generator';
  return 'consumer';
}

interface AuthState {
  user: User | null;
  role: PocRole | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  loginAs: (role: PocRole) => void;
  setUser: (user: User) => void;
  markAuthenticated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      hydrated: false,
      loginAs: (role) => set({ role, user: POC_USERS[role], isAuthenticated: true }),
      setUser: (user) => set({ user }),
      markAuthenticated: () => set({ isAuthenticated: true }),
      logout: () => set({ user: null, role: null, isAuthenticated: false }),
    }),
    {
      name: 'ulsan-poc-auth',
      storage: createJSONStorage(() => ssrSafeStorage),
      partialize: (s) => ({ user: s.user, role: s.role, isAuthenticated: s.isAuthenticated }),
    },
  ),
);

// localStorage 복원이 끝나면 hydrated 플래그를 올린다 (레이아웃 가드가 이 값을 기다림).
useAuthStore.persist.onFinishHydration(() => useAuthStore.setState({ hydrated: true }));
if (typeof window !== 'undefined' && useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ hydrated: true });
}
