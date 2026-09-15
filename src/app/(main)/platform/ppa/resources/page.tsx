'use client';

import PlatformTradingPage from '../../trading/page';

// 자원 관리(발전사업자) — 거래관리에서 분리된 SPC 전용 화면.
// 동일 컴포넌트를 재사용하며 경로(/platform/ppa/resources)로 'resources' 모드 렌더한다.
export default function PlatformResourcesPage() {
  return <PlatformTradingPage />;
}
