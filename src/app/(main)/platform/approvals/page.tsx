import { redirect } from 'next/navigation';

/** 승인 관리는 2026-11-09 없앰 — 가입 · 기업 정보 변경 검토는 기업 관리(대기 기업 · 변경 요청) · 회원 관리(대기 회원)에서 */
export default function Page() {
  redirect('/platform/companies');
}
