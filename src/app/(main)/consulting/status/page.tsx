'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDeleteDiagnosis, useDiagnoses, useDiagnosesByCompany } from '@/hooks/consulting/useConsultations';
import { getPersona } from '@/lib/persona';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToastStore } from '@/stores/useToastStore';
import { SimDiagnosisById, recordOf } from '@/components/features/consulting/SimDiagnosisView';
import { ReviewHistoryList } from '@/components/features/consulting/ReviewHistoryList';
import type { Diagnosis } from '@/types/consultation';

/**
 * 내 컨설팅 — 내가 무료진단으로 남긴 사업 검토서. 왼쪽에 고른 검토서(A4), 오른쪽에 검토 기록.
 * 컨설팅 홈 '진단 결과'에서 행을 누르면 ?review=ID 로 들어와 그 검토서를 연다.
 */
export default function MyConsultingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;
  // 관리자는 전체 기업 기록, 그 외는 내 기업 기록
  const isAdmin = ['admin', 'spc'].includes(getPersona(user));
  const mineQ = useDiagnosesByCompany(isAdmin ? 0 : companyId);
  const allQ = useDiagnoses();
  const { data, isLoading } = isAdmin ? allQ : mineQ;
  const history = useMemo(() => ((data ?? []) as Diagnosis[]).filter((d) => d.sim), [data]);
  const [picked, setPicked] = useState<number | null>(null);
  // 삭제 — 확인 받고 지운다(수정은 없다)
  const del = useDeleteDiagnosis();
  const toast = useToastStore((s) => s.add);
  const [deleting, setDeleting] = useState<Diagnosis | null>(null);
  const confirmDelete = async () => {
    if (!deleting) return;
    const no = recordOf(deleting).no;
    await del.mutateAsync(deleting.id);
    if (picked === deleting.id) {
      setPicked(null);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setDeleting(null);
    toast('success', `${no} 검토서를 삭제했습니다`);
  };

  // ?review=ID — 컨설팅 홈에서 고른 검토서
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('review'));
    if (id) setPicked(id);
  }, []);
  const current = history.find((d) => d.id === picked) ?? history[0];

  const pick = (d: Diagnosis) => {
    setPicked(d.id);
    window.history.replaceState(null, '', `?review=${d.id}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '내 컨설팅' }]} />
      <h1 className="text-2xl font-bold text-white">내 컨설팅</h1>

      {!isLoading && history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-12 text-center">
          <p className="text-base font-semibold text-white">무료진단 기록 없음</p>
          <Button onClick={() => router.push('/consulting/diagnosis')}>무료진단 시작하기</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">{current && <SimDiagnosisById key={current.id} diagnosisId={current.id} />}</div>
          <ReviewHistoryList history={history} selectedId={current?.id} onPick={pick} onDelete={setDeleting} />
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="검토서 삭제"
        message={deleting ? `${recordOf(deleting).no} (${recordOf(deleting).at.slice(0, 10)}) 검토서를 삭제합니다. 삭제하면 되돌릴 수 없습니다.` : ''}
        confirmLabel="삭제"
        variant="danger"
        loading={del.isPending}
      />
    </div>
  );
}
