import { redirect } from 'next/navigation';

/** 관리 › 거래 승인은 RE100 › 거래 승인과 같은 화면이라 2026-11-09 없앰 */
export default function Page() {
  redirect('/platform/trading/approvals');
}
