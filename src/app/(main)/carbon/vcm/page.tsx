'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useVcmCredits, useCreateVcm, useRetireVcm, useSellVcm, type VcmCredit } from '@/hooks/edm/useCarbonDelta';

// 자발적시장 보유 크레딧 원장 — 기획 14 §4.2. 시장 목록(carbon/voluntary)과 별개인 회사 보유 원장.
const STATUS_LABEL: Record<VcmCredit['status'], { label: string; variant: 'success' | 'default' | 'info' }> = {
  HELD: { label: '보유', variant: 'success' },
  RETIRED: { label: '상쇄사용', variant: 'default' },
  SOLD: { label: '매도완료', variant: 'info' },
};

export default function VcmPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const toast = useToastStore((s) => s.add);
  const { data: CREDITS } = useVcmCredits(companyId);
  const createVcm = useCreateVcm();
  const retireVcm = useRetireVcm();
  const sellVcm = useSellVcm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ standard: 'VCS', project: '', tco2: '' });

  const submit = () => {
    const tco2 = Number(form.tco2);
    if (!companyId) return;
    if (!form.project.trim()) {
      toast('error', '프로젝트명을 입력하세요.');
      return;
    }
    if (!(tco2 > 0)) {
      toast('error', '수량을 입력하세요.');
      return;
    }
    createVcm.mutate(
      { companyId, standard: form.standard, project: form.project, tco2 },
      {
        onSuccess: () => {
          toast('success', '크레딧을 등록했습니다.');
          setShowForm(false);
          setForm({ standard: 'VCS', project: '', tco2: '' });
        },
        onError: (e: unknown) => toast('error', `등록 실패: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  const doRetire = (id: number) =>
    retireVcm.mutate(id, {
      onSuccess: () => toast('success', '상쇄 처리했습니다.'),
      onError: (e: unknown) => toast('error', `상쇄 실패: ${e instanceof Error ? e.message : '오류'}`),
    });
  const doSell = (id: number) =>
    sellVcm.mutate(id, {
      onSuccess: () => toast('success', '매도 처리했습니다.'),
      onError: (e: unknown) => toast('error', `매도 실패: ${e instanceof Error ? e.message : '오류'}`),
    });

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: '보유 크레딧 (VCM)' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">자발적 크레딧 보유 원장</h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} /> 크레딧 등록
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        회사가 보유한 자발적시장(VCS·GS·KVER) 크레딧 원장. 상쇄사용·매도는 불가역 처리됩니다.
      </p>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-400">
              표준
              <select
                value={form.standard}
                onChange={(e) => setForm({ ...form, standard: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              >
                <option value="VCS">VCS</option>
                <option value="GS">GS</option>
                <option value="KVER">KVER</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              프로젝트
              <input
                type="text"
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              />
            </label>
            <label className="text-xs text-slate-400">
              수량(tCO₂eq)
              <input
                type="number"
                value={form.tco2}
                onChange={(e) => setForm({ ...form, tco2: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="cancel" size="sm" onClick={() => setShowForm(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" loading={createVcm.isPending} onClick={submit}>
              등록
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">표준</th>
              <th className="px-4 py-3">프로젝트</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">액션</th>
            </tr>
          </thead>
          <tbody>
            {CREDITS.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">
                  보유 크레딧이 없습니다.
                </td>
              </tr>
            )}
            {CREDITS.map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">
                  <Badge variant="info">{c.standard}</Badge>
                </td>
                <td className="px-4 py-3">{c.project}</td>
                <td className="px-4 py-3 text-right">{c.tco2.toLocaleString()} tCO₂eq</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_LABEL[c.status].variant}>{STATUS_LABEL[c.status].label}</Badge>
                </td>
                <td className="px-4 py-3">
                  {c.status === 'HELD' ? (
                    <div className="flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => doRetire(c.id)}>
                        상쇄
                      </Button>
                      <Button variant="cancel" size="sm" onClick={() => doSell(c.id)}>
                        매도
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
