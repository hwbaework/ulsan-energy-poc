'use client';

import { useMemo } from 'react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import type { Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { estimateMonthlyKwh, fmtKw, fmtNum, totalCostOf } from './meta';
import { PageHeader } from './Bits';

const won = (n: number) => `₩${fmtNum(Math.round(n))}`;
const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);

/**
 * 계약 현황 — 거래 승인에서 체결된 최종 계약만, 유형별 건수(보기만, WBS 2.1.6).
 * 관리자는 전체 · 그 외는 자기 것. 계약 하나하나는 내 계약, 월 정산은 수익·정산.
 */
export function ContractOverviewScreen() {
  const role = useTradingRole();

  const { self, onsite } = useMemo(() => {
    const signed = role.contracts.filter((c) => c.status === 'ACTIVE');
    return {
      self: signed.filter((c) => c.kind === 'SELF_CONSUMPTION'),
      onsite: signed.filter((c) => c.kind === 'ONSITE'),
    };
  }, [role.contracts]);

  const selfTotal = self.reduce((s, c) => s + totalCostOf(c), 0);
  const selfOm = self.reduce((s, c) => s + (c.omRatePct ? (totalCostOf(c) * c.omRatePct) / 100 : 0), 0);
  const onsiteKwh = onsite.reduce((s, c) => s + estimateMonthlyKwh(c.capacityKw), 0);
  const onsiteMonthly = onsite.reduce(
    (s, c) => s + estimateMonthlyKwh(c.capacityKw) * (c.segments?.[0]?.price ?? c.unitPrice),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="계약 현황" />

      {/* 유형별로 따로 — 자가소비 줄 · onsite 줄 */}
      <StatsGrid columns={3}>
        <StatCard label="자가소비 계약" value={`${self.length}건 · ${fmtKw(kw(self))}`} />
        <StatCard label="자가소비 예상 설치비" value={won(selfTotal)} />
        <StatCard label="자가소비 연간 O&M" value={won(selfOm)} />
      </StatsGrid>
      <StatsGrid columns={3}>
        <StatCard label="onsite 계약" value={`${onsite.length}건 · ${fmtKw(kw(onsite))}`} />
        <StatCard label="onsite 예상 월 사용량" value={`${fmtNum(onsiteKwh)} kWh`} />
        <StatCard label="onsite 예상 월 납입료" value={won(onsiteMonthly)} />
      </StatsGrid>
    </div>
  );
}
