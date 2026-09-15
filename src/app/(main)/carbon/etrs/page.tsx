'use client';

import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCarbonEtrs, useFileEtrs } from '@/hooks/edm/useCarbonExt';

// ETRS 신고 관리 — 설계 docs/기획/02 rev.2 §5.2 (배출권등록부 계정이전·결제·신고기한)
// 협의매매 체결분은 GIR ETRS 계정이전+결제은행 연계, 신고 의무(탄소중립기본법). /api/v1/carbon/etrs 배선.

export default function EtrsPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: FILINGS, isError } = useCarbonEtrs(companyId);
  // 설계 22: 회사 미귀속/호출 실패 시 신고 대행 차단(빈 실데이터는 허용).
  const canManage = companyId != null && !isError;
  const fileEtrs = useFileEtrs();
  const pending = FILINGS.filter((f) => f.status === 'PENDING').length;
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: 'ETRS 신고' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">ETRS 신고 관리</h1>
        <span className="text-xs text-slate-400">
          신고 대기 <b className="text-amber-400 tabular-nums">{pending}</b>건
        </span>
      </div>
      <p className="text-xs text-slate-400">
        협의매매 체결분은 배출권등록부(ETRS)에 <span className="text-sky-300">계정이전·결제은행</span> 연계로 결제되며,
        탄소중립기본법상 신고 의무가 있습니다. 신고 기한을 관리하고 대행합니다.
      </p>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">체결 상대</th>
              <th className="px-4 py-3">종류</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3">신고기한</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {FILINGS.map((f) => (
              <tr key={f.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{f.counterparty}</td>
                <td className="px-4 py-3">{f.type}</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.amount.toLocaleString()} tCO₂eq</td>
                <td className="px-4 py-3">
                  <span className="text-slate-400">{f.deadline}</span>
                  {f.dDay != null && <span className="ml-1.5 text-xs text-amber-400">D-{f.dDay}</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={f.status === 'FILED' ? 'success' : 'warning'}>
                    {f.status === 'FILED' ? '신고완료' : '신고대기'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {f.status === 'FILED' ? (
                    <Button variant="ghost" size="sm">
                      증빙 ↓
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={fileEtrs.isPending}
                      disabled={!canManage}
                      onClick={() => canManage && fileEtrs.mutate(Number(f.id))}
                    >
                      신고 대행
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        신고 대행 건당 수수료가 발생한다. 계정이전(GIR ETRS 매도계정→매수계정)·증빙은 자동 보관된다.
      </p>
    </div>
  );
}
