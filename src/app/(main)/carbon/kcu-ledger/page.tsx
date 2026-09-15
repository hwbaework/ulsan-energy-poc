'use client';

import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCarbonHolding } from '@/hooks/edm/useCarbon';
import { useKcuLedger, type KcuLedgerEntry } from '@/hooks/edm/useCarbonDelta';

// KCU 원장 — 기획 14 §7 (P3). carbon_holding.kcu 잔고 변동의 완전 이력(append-only).
// 불변식: SUM(amount) = holding.kcu. 마지막 행 balance_after = 현 잔고.
const ENTRY_LABEL: Record<KcuLedgerEntry['entryType'], { label: string; variant: 'success' | 'danger' | 'default' }> = {
  CONVERT_IN: { label: 'KOC→KCU 전환', variant: 'success' },
  TRANSFER_IN: { label: '이전 유입', variant: 'success' },
  SELL: { label: '매도', variant: 'danger' },
  RETIRE: { label: '상쇄', variant: 'danger' },
  TRANSFER_OUT: { label: '이전 유출', variant: 'danger' },
  ADJUST: { label: '정정', variant: 'default' },
};

export default function KcuLedgerPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: holding } = useCarbonHolding(companyId);
  const { data: LEDGER, isLive } = useKcuLedger(companyId);

  const ledgerSum = LEDGER.reduce((acc, e) => acc + e.amount, 0);
  const consistent = Math.abs(ledgerSum - holding.kcu) < 0.005;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: 'KCU 원장' }]} />
      <h1 className="text-xl font-bold text-white">KCU 원장 (상쇄배출권)</h1>
      <p className="text-xs text-slate-400">
        KCU 잔고 변동의 완전 이력(append-only). 전환·매도·상쇄·이전 line-item과 잔고 추이를 감사 목적으로 보관합니다.
      </p>

      <Card className="p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-slate-500">현재 KCU 잔고</p>
          <p className="text-lg font-bold text-white">
            {holding.kcu.toLocaleString()} <span className="text-xs text-slate-400">tCO₂eq</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">원장 합계 SUM(amount)</p>
          <p className="text-lg font-bold text-white">
            {ledgerSum.toLocaleString()} <span className="text-xs text-slate-400">tCO₂eq</span>
          </p>
        </div>
        {isLive && (
          <Badge variant={consistent ? 'success' : 'danger'}>
            {consistent ? '불변식 정합 (SUM=잔고)' : '불변식 불일치'}
          </Badge>
        )}
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">일시</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3 text-right">증감</th>
              <th className="px-4 py-3 text-right">기입 후 잔고</th>
              <th className="px-4 py-3">원인</th>
              <th className="px-4 py-3">비고</th>
            </tr>
          </thead>
          <tbody>
            {LEDGER.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                  원장 기입이 없습니다.
                </td>
              </tr>
            )}
            {LEDGER.map((e) => (
              <tr key={e.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3 text-xs text-slate-400">
                  {e.createdAt ? e.createdAt.slice(0, 19).replace('T', ' ') : '-'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ENTRY_LABEL[e.entryType].variant}>{ENTRY_LABEL[e.entryType].label}</Badge>
                </td>
                <td className={`px-4 py-3 text-right ${e.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {e.amount >= 0 ? '+' : ''}
                  {e.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">{e.balanceAfter.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {e.refType ?? '-'}
                  {e.refId ? ` #${e.refId}` : ''}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{e.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
