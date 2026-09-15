'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const DtWorld = dynamic(() => import('./DtWorld'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#060a14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-slate-400">DT 세계 로딩 중...</span>
      </div>
    </div>
  ),
});

export default function DtNextPage() {
  return (
    <Suspense>
      <DtWorld />
    </Suspense>
  );
}
