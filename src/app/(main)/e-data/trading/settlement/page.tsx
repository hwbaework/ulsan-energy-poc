'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDmSettlement, usePayout, type SettlementRow as Row } from '@/hooks/edm/useDm';

// 데이터 정산 — 설계 docs/기획/03 rev.2 §5.4 + 설계 12 §4 (gross·수수료 15%·net, 지급 실행 payout)
// GET /api/v1/datamarket/settlement 조회 + POST /settlement/payout 지급 실행(멱등·서버 재계산).

const FEE = 0.15;

export default function SettlementPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: ROWS, isLive, isError } = useDmSettlement(companyId);
  // 설계 22: 회사 미귀속/호출 실패 시 지급 차단(빈 실데이터는 허용).
  const canPay = companyId != null && !isError;
  const payout = usePayout();
  const [msg, setMsg] = useState('');

  const gross = ROWS.reduce((a, r) => a + r.gross, 0);
  const fee = Math.round(gross * FEE);
  const net = gross - fee;
  const statusVariant = (s: Row['status']) => (s === '완료' ? 'success' : s === '결제대기' ? 'warning' : 'default');

  // 지급 대상 = 완료(정산 가능) 행. 결제대기·무료는 제외.
  const payableIds = ROWS.filter((r) => r.status === '완료' && r.gross > 0).map((r) => r.order);

  async function handlePayout() {
    setMsg('');
    const res = await payout.mutateAsync({ companyId, settlementIds: payableIds });
    setMsg(
      res.isLive
        ? `지급 실행 완료 — ${res.paidCount}건 PAID 전이(서버 재계산).`
        : '지급 실행(로컬 낙관 — BE 미가동, isLive:false). 실제 지급은 서버 연결 후.',
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '거래', path: '/e-data/trading' }, { label: '정산' }]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">정산</h1>
          <Badge variant={isLive ? 'success' : isError ? 'warning' : 'default'}>
            {isLive ? '실시간' : isError ? '불러오기 실패' : '—'}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={handlePayout}
          loading={payout.isPending}
          disabled={!canPay || payableIds.length === 0}
          title={
            companyId == null
              ? '회사 정보가 없어 지급할 수 없습니다'
              : isError
                ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
                : payableIds.length === 0
                  ? '지급 대상 없음'
                  : ''
          }
        >
          <Wallet size={14} /> 지급 실행 ({payableIds.length}건)
        </Button>
      </div>
      {msg && <p className="text-xs text-sky-300">{msg}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-400">총 매출 (Gross)</p>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">₩{gross.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400">플랫폼 수수료 (15%)</p>
          <p className="mt-1 text-2xl font-bold text-slate-400 tabular-nums">₩{fee.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400">정산 예정 (Net)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">₩{net.toLocaleString()}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h2 className="px-4 py-3 text-sm font-semibold text-white">정산 내역</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">주문번호</th>
              <th className="px-4 py-3">데이터셋</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3 text-right">거래액</th>
              <th className="px-4 py-3 text-right">수수료</th>
              <th className="px-4 py-3 text-right">정산액</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const f = Math.round(r.gross * FEE);
              return (
                <tr key={r.order} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.order}</td>
                  <td className="px-4 py-3">{r.dataset}</td>
                  <td className="px-4 py-3 text-slate-400">{r.type}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.gross.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{f.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white">{(r.gross - f).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        거래액의 15% 수수료 차감 후 판매자에게 정산. 무료 공공데이터는 수수료 0(집객). 결제 PG 연동 + 정산 주기 적용.
      </p>
    </div>
  );
}
