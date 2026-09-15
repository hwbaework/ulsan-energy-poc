'use client';

// DT 입지 스카우팅 — 컨설턴트·관리자용 (docs/울산dt/02-스카우팅-설계)
import dynamic from 'next/dynamic';

const ScoutWorld = dynamic(() => import('./ScoutWorld'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#060a14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-slate-400">스카우팅 로딩 중...</span>
      </div>
    </div>
  ),
});

export default function DtScoutPage() {
  return <ScoutWorld />;
}
