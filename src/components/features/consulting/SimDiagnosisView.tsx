'use client';

import { useDiagnosis } from '@/hooks/consulting/useConsultations';
import { SimReport, type ReviewRecord } from './SimReport';
import { reviewNo } from '@/lib/solar-sim';

/** 사업 검토서 기록 — 저장된 진단에서 번호·일시 */
export const recordOf = (d: { id: number; createdAt: string }): ReviewRecord => ({ no: reviewNo(d.id, d.createdAt), at: d.createdAt.slice(0, 16).replace('T', ' ') });

/** 저장된 검토서를 불러와 보여 준다 (무료진단 검토 기록·컨설팅 홈·문서관리) */
export function SimDiagnosisById({ diagnosisId }: { diagnosisId: number }) {
  const { data: d, isLoading } = useDiagnosis(diagnosisId);
  if (isLoading) return <div className="py-16 text-center text-sm text-slate-400">검토서를 불러오는 중...</div>;
  if (!d?.sim) return <div className="rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-8 text-center text-sm text-slate-400">검토서 없음</div>;
  return <SimReport input={d.sim} companyName={d.companyName} record={recordOf(d)} />;
}
