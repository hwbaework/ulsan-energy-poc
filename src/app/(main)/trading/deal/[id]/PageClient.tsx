'use client';

import { useParams } from 'next/navigation';
import { DealDetailScreen } from '@/components/features/trading-poc/DealDetailScreen';

/** 거래 상세 — 신청 id. 정적 export 는 POC_STATIC_IDS 범위만 미리 만든다 */
export default function PageClient() {
  const params = useParams<{ id: string }>();
  return <DealDetailScreen id={Number(params?.id)} />;
}
