import { redirect } from 'next/navigation';

// 구 라우트 보존 — VPP 대시보드는 /vpp로 통합(사업계획서 기반 재구축, doc 04 §4)
export default function VppDashboardRedirect() {
  redirect('/vpp');
}
