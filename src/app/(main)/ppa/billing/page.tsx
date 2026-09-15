import { redirect } from 'next/navigation';

// LNB는 /ppa/billing/settlement로 직접 이동하지만,
// 직접 URL 접근·옛 북마크·외부 링크 대비 안전망으로 redirect 유지.
export default function PpaBillingPage() {
  redirect('/ppa/billing/settlement');
}
