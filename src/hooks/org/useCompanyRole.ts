import { useAuthStore } from '@/stores/useAuthStore';
import { useUsers } from '@/hooks/platform/useUsers';

/**
 * 지금 로그인한 사람이 자기 기업의 기업관리자인지 — 회원 목록의 계정 유형(COMPANY_ADMIN / COMPANY_MEMBER).
 * 기업 정보의 PPA 운전 일정 · 결제 수단은 기업관리자만 고치고, 소속 멤버는 본다.
 */
export function useIsCompanyAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  const { data } = useUsers({});
  const me = (data?.content ?? []).find((u) => u.id === user?.id) as { accountType?: string } | undefined;
  return me?.accountType === 'COMPANY_ADMIN';
}
