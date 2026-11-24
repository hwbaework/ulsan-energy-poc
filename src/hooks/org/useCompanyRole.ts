import { useAuthStore } from '@/stores/useAuthStore';
import { useUsers } from '@/hooks/platform/useUsers';
import { ACCOUNT_ICON } from '@/lib/account-icon';
import { User as UserIcon, type LucideIcon } from 'lucide-react';
/**
 * 지금 로그인한 사람이 자기 기업의 기업 관리자인지 — 회원 목록의 계정 유형(COMPANY_ADMIN / COMPANY_MEMBER).
 * 기업 정보의 PPA 운전 일정 · 결제 수단은 기업 관리자만 고치고, 소속 멤버는 본다.
 */
export function useIsCompanyAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  const { data } = useUsers({});
  // 번호가 아니라 이메일로 찾는다 — 로그인 계정과 회원 목록의 번호가 서로 다르다(이수용 · 박발전)
  const me = (data?.content ?? []).find((u) => u.email === user?.email) as { accountType?: string } | undefined;
  return me?.accountType === 'COMPANY_ADMIN';
}

/**
 * 오른쪽 위 내 계정의 아이콘(로그인 버튼과 같은 것)과 이름 아랫줄 — 계정 유형 하나만: 최고 관리자 / 관리자 / 기업 관리자 / 기업 회원.
 * 역할 이름(전기사용자 등)은 같이 쓰지 않는다 — 두 가지가 나란히 있으면 헷갈린다(2026-11-24 사용자)
 */
export function useMyAccount(): { line: string; Icon: LucideIcon } {
  const user = useAuthStore((s) => s.user);
  const { data } = useUsers({});
  const me = (data?.content ?? []).find((u) => u.email === user?.email) as { accountType?: string; roles?: string[] } | undefined;
  const codes = me?.roles ?? (user as { roles?: string[] } | null)?.roles ?? [];
  if (codes.includes('SYSTEM_ADMIN')) return { line: '최고 관리자', Icon: ACCOUNT_ICON.superAdmin };
  if (codes.includes('PLATFORM_ADMIN')) return { line: '관리자', Icon: ACCOUNT_ICON.admin };
  if (me?.accountType === 'COMPANY_ADMIN') return { line: '기업 관리자', Icon: ACCOUNT_ICON.companyAdmin };
  if (me?.accountType === 'COMPANY_MEMBER') return { line: '기업 회원', Icon: ACCOUNT_ICON.companyMember };
  return { line: '', Icon: UserIcon };
}
