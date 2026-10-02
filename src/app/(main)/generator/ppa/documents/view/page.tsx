'use client';

// RE100 › 문서 관리 › 문서 보기 — 발전사업자
import { Suspense } from 'react';
import { DocumentViewScreen } from '@/components/features/trading-poc/DocumentViewScreen';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentViewScreen />
    </Suspense>
  );
}
