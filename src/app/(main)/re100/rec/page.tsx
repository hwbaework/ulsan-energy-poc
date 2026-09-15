'use client';

import { useState } from 'react';
import { Leaf, CreditCard } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRecHoldings, useGreenPremiums } from '@/hooks/re100/useRe100Ext';

// REC·녹색프리미엄 — 설계 v2/docs/11 §2.1 + 백엔드 배선(설계문서 17). 계획서 p.125 이행수단.
// 정직 상태(설계 22 정합): mock 폴백 없음 — 실데이터/빈/오류를 정확히 구분 표시. 가짜 수치 금지.
const currentYear = new Date().getFullYear();

export default function RecPage() {
  const [tab, setTab] = useState<'REC' | 'GREEN'>('REC');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const recQ = useRecHoldings(companyId);
  const greenQ = useGreenPremiums(companyId);
  const REC_HOLDINGS = recQ.data ?? [];
  const GREEN_PREMIUM = greenQ.data ?? [];
  const totalRec = REC_HOLDINGS.reduce((s, r) => s + r.amount, 0);
  const greenThisYear = GREEN_PREMIUM.filter((g) => g.year === currentYear).reduce((s, g) => s + g.amount, 0);

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 REC·녹색프리미엄을 조회할 수 없습니다'
      : recQ.isError || greenQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: 'REC·녹색프리미엄' }]} />
      <h1 className="text-xl font-bold text-white">REC · 녹색프리미엄</h1>

      {guardReason && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-300">
          {guardReason}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Leaf size={15} /> 보유 REC
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {totalRec.toLocaleString()} <span className="text-sm text-slate-400">REC</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CreditCard size={15} /> 녹색프리미엄({currentYear})
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {greenThisYear.toLocaleString()} <span className="text-sm text-slate-400">MWh</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['REC', 'GREEN'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs ${tab === t ? 'bg-primary/20 text-primary' : 'bg-white/[0.03] text-slate-400'}`}
          >
            {t === 'REC' ? 'REC 구매' : '녹색프리미엄'}
          </button>
        ))}
      </div>

      {tab === 'REC' ? (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-xs text-slate-400 bg-white/[0.02]">
            RPS 미활용 재생에너지 REC를 한국에너지공단 전기소비자용 거래플랫폼에서 구매
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">발전원</th>
                <th className="px-4 py-3 text-right">가중치</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3 text-right">단가</th>
              </tr>
            </thead>
            <tbody>
              {REC_HOLDINGS.length ? (
                REC_HOLDINGS.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{r.source}</td>
                    <td className="px-4 py-3 text-right">{r.weight}</td>
                    <td className="px-4 py-3 text-right">{r.amount.toLocaleString()} REC</td>
                    <td className="px-4 py-3 text-right">{r.price.toLocaleString()}원</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                    보유한 REC가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-xs text-slate-400 bg-white/[0.02]">
            기존 전기요금과 별도의 녹색 프리미엄을 한전에 납부하여 재생에너지 전기 구매
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">연도</th>
                <th className="px-4 py-3 text-right">구매량</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {GREEN_PREMIUM.length ? (
                GREEN_PREMIUM.map((g) => (
                  <tr key={g.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{g.year}</td>
                    <td className="px-4 py-3 text-right">{g.amount.toLocaleString()} MWh</td>
                    <td className="px-4 py-3">{g.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    녹색프리미엄 구매 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
