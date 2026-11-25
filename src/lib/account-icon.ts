import { Building2, ShieldCheck, User, type LucideIcon } from 'lucide-react';

/**
 * 계정 아이콘 — 로그인 화면의 계정 버튼과 오른쪽 위 내 계정이 같은 아이콘을 쓴다(2026-11-24 사용자).
 * 계정 유형 셋(관리자 · 기업 관리자 · 기업 회원)에 하나씩 — 최고 관리자는 따로 두지 않는다(2026-11-24 사용자: 관리자 하나로, 나눠 달라고 하면 그때), 전기사용자 · 발전사업자로 나누지 않는다(같은 기업 관리자면 같은 아이콘, 2026-11-24 사용자).
 * 여기서 바꾸면 두 곳이 같이 바뀐다
 */
export type AccountKind = 'admin' | 'companyAdmin' | 'companyMember';

export const ACCOUNT_ICON: Record<AccountKind, LucideIcon> = {
  admin: ShieldCheck,
  companyAdmin: Building2,
  companyMember: User,
};
