'use client';

// RE100 › 문서 관리 › 문서 보기 — 관리자(SPC)
import { Suspense } from 'react';
import { DocumentViewScreen } from '@/components/features/trading-poc/DocumentViewScreen';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentViewScreen />
    </Suspense>
  );
}
