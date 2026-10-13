'use client';

import { useMemo } from 'react';
import { SectionCard } from '@/components/features/SectionCard';
import { RmsBarChart } from '@/components/ui/Chart';
import { YIELD_KWH_PER_KW, settlementsOf, termsAmount } from '@/stores/useTradingPocStore';
import type { Contract } from '@/types/trading-poc';
import { fmtKrw } from './meta';

/**
 * PPA 월별 — 금년 1~12월 전부. 정산이 온 달은 실적, 아직 안 온 달은 예상(설비 용량 × 월 발전시간 × PPA 단가, VAT 포함).
 * 관리자 = 들어오는 수입(회사 골라 보기), 기업 = 내는 납부
 */
export function PpaMonthlyCard({ contracts, mode }: { contracts: Contract[]; mode: 'income' | 'pay' }) {
  const onsite = useMemo(() => contracts.filter((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE'), [contracts]);
  const rows = useMemo(() => {
    const st = settlementsOf(onsite);
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, k) => {
      const period = `${year}-${String(k + 1).padStart(2, '0')}`;
      const got = st.filter((x) => x.period === period);
      if (got.length > 0) {
        return {
          month: `${k + 1}월`,
          kwh: got.reduce((a, x) => a + x.generationKwh, 0),
          금액: Math.round(got.reduce((a, x) => a + x.total, 0) / 10_000),
          state: got.every((x) => x.status === 'CONFIRMED') ? 'done' : 'wait',
        } as const;
      }
      // 예상 — 계약 기간 안인 계약만
      const live = onsite.filter((c) => c.startDate.slice(0, 7) <= period && (!c.terminatedAt || c.terminatedAt.slice(0, 7) >= period));
      const kwh = live.reduce((a, c) => a + Math.round(c.capacityKw * (YIELD_KWH_PER_KW[k] ?? 100)), 0);
      const won = live.reduce((a, c) => {
        const q = Math.round(c.capacityKw * (YIELD_KWH_PER_KW[k] ?? 100));
        return a + Math.round(termsAmount(c, period, q).supply * 1.1);
      }, 0);
      return { month: `${k + 1}월`, kwh, 금액: Math.round(won / 10_000), state: live.length > 0 ? 'expect' : 'none' } as const;
    });
  }, [onsite]);
  if (onsite.length === 0) return null;
  const actual = rows.filter((x) => x.state === 'done' || x.state === 'wait').reduce((a, x) => a + x.금액, 0);
  const yearTotal = rows.reduce((a, x) => a + x.금액, 0);
  const word = mode === 'income' ? '수입' : '납부';
  const doneLabel = mode === 'income' ? '입금' : '납부';
  const td = 'px-1 py-1 text-right tabular-nums';
  const chart = rows.map((x) => ({ month: x.month, [word]: x.state === 'expect' ? 0 : x.금액, 예상: x.state === 'expect' ? x.금액 : 0 }));
  return (
    <SectionCard title={`PPA 월별 ${word} (만원) · 금년 ${fmtKrw(actual * 10_000)} / 예상 합계 ${fmtKrw(yearTotal * 10_000)}`}>
      <RmsBarChart
        data={chart}
        xKey="month"
        bars={[
          { key: word, name: `${word} (만원)` },
          { key: '예상', name: '예상 (만원)' },
        ]}
        stacked
        height={240}
      />
      {/* 달마다 발전량 · 금액 · 상태 */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs text-slate-300">
          <thead className="text-slate-500">
            <tr>
              <th className="px-1 py-1 text-left font-medium">월</th>
              {rows.map((x) => (
                <th key={x.month} className={`${td} font-medium`}>
                  {x.month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-1 py-1 text-left text-slate-500">발전량 (kWh)</td>
              {rows.map((x) => (
                <td key={x.month} className={td}>
                  {x.state === 'none' ? '' : x.kwh.toLocaleString()}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-1 py-1 text-left text-slate-500">금액 (만원)</td>
              {rows.map((x) => (
                <td key={x.month} className={`${td} ${x.state === 'expect' ? 'text-slate-400' : 'text-white'}`}>
                  {x.state === 'none' ? '' : x.금액.toLocaleString()}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-1 py-1 text-left text-slate-500">상태</td>
              {rows.map((x) => (
                <td
                  key={x.month}
                  className={`${td} ${x.state === 'done' ? 'text-emerald-300' : x.state === 'wait' ? 'text-amber-300' : 'text-slate-500'}`}
                >
                  {x.state === 'done' ? doneLabel : x.state === 'wait' ? '대기' : x.state === 'expect' ? '예상' : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
