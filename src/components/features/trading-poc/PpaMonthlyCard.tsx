'use client';

import { useMemo, useState } from 'react';
import { SectionCard } from '@/components/features/SectionCard';
import { RmsBarChart } from '@/components/ui/Chart';
import { Select } from '@/components/ui/Select';
import { TABLE, TABLE_HEAD_ROW, TABLE_ROW, TABLE_TD, TABLE_TH } from '@/components/features/DataList';
import { cn } from '@/lib/utils';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { Contract } from '@/types/trading-poc';

/**
 * PPA 월별 — 금년 1~12월 전부. 정산이 온 달만 값(실적), 아직 안 온 달은 빈 칸(예상 계산 없음 — 2026-10-13).
 * 관리자 = 들어오는 수입(회사 골라 보기), 기업 = 내는 납부. 연도 골라 보고, 맨 끝에 그 해 합계
 * @param label 제목 뒤 범위 — 관리자 '전체' 또는 회사 이름
 */
export function PpaMonthlyCard({ contracts, mode, label }: { contracts: Contract[]; mode: 'income' | 'pay'; label?: string }) {
  const onsite = useMemo(() => contracts.filter((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE'), [contracts]);
  const thisYear = new Date().getFullYear();
  const firstYear = onsite.length ? Math.min(...onsite.map((c) => Number(c.startDate.slice(0, 4)))) : thisYear;
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => String(thisYear - i));
  const [year, setYear] = useState(String(thisYear));
  const rows = useMemo(() => {
    const st = settlementsOf(onsite);
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
      return { month: `${k + 1}월`, kwh: 0, 금액: 0, state: 'none' } as const;
    });
  }, [onsite, year]);
  if (onsite.length === 0) return null;
  const sumWon = rows.reduce((a, x) => a + x.금액, 0);
  const sumKwh = rows.reduce((a, x) => a + x.kwh, 0);
  const anyRow = rows.some((x) => x.state !== 'none');
  const word = mode === 'income' ? '수입' : '납부';
  const doneLabel = mode === 'income' ? '입금' : '납부';
  const td = cn(TABLE_TD, 'px-3 text-right tabular-nums');
  const th = cn(TABLE_TH, 'px-3 text-right');
  const chart = rows.map((x) => ({ month: x.month, [word]: x.금액 }));
  return (
    <SectionCard
      title={`PPA 월별 ${word} (만원)${label ? ` · ${label}` : ''}`}
      actions={<Select options={years.map((y) => ({ value: y, label: `${y}년` }))} value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />}
    >
      <RmsBarChart
        data={chart}
        xKey="month"
        bars={[{ key: word, name: `${word} (만원)` }]}
        height={240}
      />
      {/* 달마다 발전량 · 금액 · 상태 */}
      <div className="mt-3 overflow-x-auto">
        <table className={cn(TABLE, 'table-fixed')}>
          <colgroup>
            <col className="w-28" />
            {rows.map((x) => (
              <col key={x.month} />
            ))}
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={cn(TABLE_TH, 'px-3')}>월</th>
              {rows.map((x) => (
                <th key={x.month} className={th}>
                  {x.month}
                </th>
              ))}
              <th className={th}>합계</th>
            </tr>
          </thead>
          <tbody>
            <tr className={TABLE_ROW}>
              <td className={cn(TABLE_TD, 'px-3 text-slate-300')}>발전량 (kWh)</td>
              {rows.map((x) => (
                <td key={x.month} className={`${td} ${x.state === 'none' ? 'text-slate-600' : ''}`}>
                  {x.state === 'none' ? '-' : x.kwh.toLocaleString()}
                </td>
              ))}
              <td className={`${td} font-semibold text-white`}>{anyRow ? sumKwh.toLocaleString() : '-'}</td>
            </tr>
            <tr className={TABLE_ROW}>
              <td className={cn(TABLE_TD, 'px-3 text-slate-300')}>금액 (만원)</td>
              {rows.map((x) => (
                <td key={x.month} className={`${td} font-semibold ${x.state === 'none' ? 'text-slate-600' : 'text-white'}`}>
                  {x.state === 'none' ? '-' : x.금액.toLocaleString()}
                </td>
              ))}
              <td className={`${td} font-bold text-white`}>{anyRow ? sumWon.toLocaleString() : '-'}</td>
            </tr>
            <tr className={TABLE_ROW}>
              <td className={cn(TABLE_TD, 'px-3 text-slate-300')}>상태</td>
              {rows.map((x) => (
                <td
                  key={x.month}
                  className={`${td} ${x.state === 'done' ? 'text-emerald-300' : x.state === 'wait' ? 'text-amber-300' : 'text-slate-600'}`}
                >
                  {x.state === 'done' ? doneLabel : x.state === 'wait' ? '대기' : '-'}
                </td>
              ))}
              <td className={td} />
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
