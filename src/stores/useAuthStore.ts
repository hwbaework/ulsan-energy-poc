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
    name: '김관리',
    phone: '010-1000-0001',
    department: '운영팀',
    status: 'ACTIVE',
    companyId: 1,
    companyName: '울산 에너지 플랫폼',
    companyAddress: '울산 남구 산업로 100',
    roles: ['SYSTEM_ADMIN'],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as User,
  consumer: {
    id: 2,
    email: 'consumer@test.com',
    name: '이수용',
    phone: '010-3000-0003',
    department: '시설관리팀',
    status: 'ACTIVE',
    companyId: 2,
    companyName: '한길',
    companyAddress: '울산 남구 용연동 490-11',
    roles: ['CONSUMER_MANAGER'],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as User,
  generator: {
    id: 3,
    email: 'operator@test.com',
    name: '박발전',
    phone: '010-2000-0002',
    department: '발전운영팀',
    status: 'ACTIVE',
    companyId: 4,
    companyName: '한일튜브', // 박발전 = 한일튜브 (전력거래 · 데이터 마켓 시드의 한일튜브 id 4)
    companyAddress: '울산 남구 부곡동 273-6',
    roles: ['POWER_OPERATOR'],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as User,
};

/**
 * 계정 유형이 다른 데모 계정 — 기업 회원(관리자는 하나라 따로 없음). 회원 목록(adminFixtures USERS)의 같은 이메일과 짝(2026-11-24)
 * 기업 회원 — 한길 최한길, 한일튜브 김한일
 * 테스트 기업 — 가입만 하고 계약이 없는 기업의 기업 관리자(김테스트). 새로 가입한 기업이 보는 화면 확인용
 */
export const POC_EXTRA_ACCOUNTS: { role: PocRole; user: User }[] = [
  {
    role: 'consumer',
    user: { ...POC_USERS.consumer, id: 8, email: 'choi@hangil.co.kr', name: '최한길', phone: '010-3000-0008' } as User,
  },
  {
    role: 'generator',
    user: { ...POC_USERS.generator, id: 4, email: 'kim@hanil.co.kr', name: '김한일', phone: '010-4000-0004', department: '설비팀' } as User,
  },
  {
    role: 'consumer',
    user: {
      ...POC_USERS.consumer,
      id: 9,
      email: 'test@test.com',
      name: '김테스트',
      phone: '010-8000-0009',
      department: '관리부',
      companyId: 8,
      companyName: '테스트 기업',
      companyAddress: '울산 남구 처용로 8',
    } as User,
  },
  // 미포테크 — PPA 계약만 있는 기업의 기업 관리자(오세진). 계약이 하나(PPA)뿐인 기업이 보는 화면 확인용(2026-11-24 사용자)
  {
    role: 'generator',
    user: {
      ...POC_USERS.generator,
      id: 10,
      email: 'ppa@test.com',
      name: '오세진',
      phone: '010-9000-0010',
      department: '설비팀',
      companyId: 9,
      companyName: '미포테크',
      companyAddress: '울산 남구 여천로 120',
    } as User,
  },
];

/** 이메일이 데모 계정과 정확히 같으면 그 계정, 아니면 역할의 기본 계정 */
export function accountFromEmail(email: string): { role: PocRole; user: User } {
  const e = email.trim().toLowerCase();
  const extra = POC_EXTRA_ACCOUNTS.find((a) => a.user.email === e);
  if (extra) return extra;
  const role = roleFromEmail(e);
  return { role, user: POC_USERS[role] };
}

/** 로그인 폼에 입력한 이메일을 역할로 해석 (모르는 이메일은 전기사용자) */
export function roleFromEmail(email: string): PocRole {
  const e = email.trim().toLowerCase();
  const extra = POC_EXTRA_ACCOUNTS.find((a) => a.user.email === e);
  if (extra) return extra.role;
  if (e.startsWith('admin')) return 'admin';
  if (e.startsWith('operator') || e.startsWith('generator')) return 'generator';
  return 'consumer';
}

interface AuthState {
  user: User | null;
  role: PocRole | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  loginAs: (role: PocRole, email?: string) => void;
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
      loginAs: (role, email) => set({ role, user: email ? accountFromEmail(email).user : POC_USERS[role], isAuthenticated: true }),
      setUser: (user) => set({ user }),
      markAuthenticated: () => set({ isAuthenticated: true }),
      logout: () => set({ user: null, role: null, isAuthenticated: false }),
    }),
    {
      name: 'ulsan-poc-auth',
      storage: createJSONStorage(() => ssrSafeStorage),
      partialize: (s) => ({ user: s.user, role: s.role, isAuthenticated: s.isAuthenticated }),
      // 데모 계정의 기업명·기업 주소는 코드 값으로 맞춘다 — 저장본이 예전 값(울산 전기사용자(주) 등)이어도 다시 로그인 없이 바뀐다
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState> | undefined;
        if (!p) return current;
        const fresh = POC_EXTRA_ACCOUNTS.find((a) => a.user.email === p.user?.email)?.user ?? (p.role ? POC_USERS[p.role] : undefined);
        const user = p.user && fresh ? { ...p.user, companyId: fresh.companyId, companyName: fresh.companyName, companyAddress: fresh.companyAddress } : (p.user ?? null);
        return { ...current, ...p, user };
      },
    },
  ),
);

// localStorage 복원이 끝나면 hydrated 플래그를 올린다 (레이아웃 가드가 이 값을 기다림).
useAuthStore.persist.onFinishHydration(() => useAuthStore.setState({ hydrated: true }));
if (typeof window !== 'undefined' && useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ hydrated: true });
}
