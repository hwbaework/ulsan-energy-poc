'use client';

// E-데이터마켓 › 온실가스 인벤토리 › 보고서 (3.1.6) — ?company= 로 기업 하나
import { Suspense } from 'react';
import { GhgReportScreen } from '@/components/features/ghg/GhgScreens';

export default function Page() {
  return (
    <Suspense>
      <GhgReportScreen />
    </Suspense>
  );
}
