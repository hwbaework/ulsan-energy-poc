import { Suspense } from 'react';
import ReportsClient from './ReportsClient';

// 보고서 — 발전소를 고르는 목록 화면 없이 바로 보고서 목록(전체). 기업은 화면 오른쪽 셀렉트로 바꾼다(2026-11-25 사용자).
// 기업을 고르면 /monitoring/reports/{발전소} 로 간다(같은 화면)
export default function Page() {
  return (
    <Suspense>
      <ReportsClient />
    </Suspense>
  );
}
