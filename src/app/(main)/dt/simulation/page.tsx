'use client';

// DT 설치 시뮬레이션 — 한일튜브 트윈을 원하는 위치에 설치 (먼지 이펙트)
import dynamic from 'next/dynamic';

const SimWorld = dynamic(() => import('./SimWorld'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#060a14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-slate-400">시뮬레이션 로딩 중...</span>
      </div>
    </div>
  ),
});

export default function DtSimulationPage() {
  return <SimWorld />;
}
