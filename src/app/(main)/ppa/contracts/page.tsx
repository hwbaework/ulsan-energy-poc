'use client';

import { ContractWorkspace } from '@/components/features/contracts/ContractWorkspace';

// 계약관리 — 공유 ContractWorkspace (페르소나는 로그인 사용자로 자동 판별: 전기사용자/SPC)
export default function PpaContractsPage() {
  return <ContractWorkspace />;
}
