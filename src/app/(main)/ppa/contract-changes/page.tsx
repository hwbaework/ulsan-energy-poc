'use client';

import { ContractChangeManagement } from '@/components/features/contracts/ContractChangeManagement';

// 변경·해지 처리 — 공유 컴포넌트 (페르소나 자동 판별: 수용가 추적 / 발전사 동의 / SPC 승인)
export default function ContractChangesPage() {
  return <ContractChangeManagement />;
}
