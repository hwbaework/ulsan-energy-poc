'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Search } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Input } from '@/components/ui/Input';
import { PpaMonthlyCard } from './PpaMonthlyCard';
import type { Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { estimateMonthlyKwh, fmtKrw, fmtKw } from './meta';
import { PageHeader, cellMuted, cellNum, cellStrong } from './Bits';

const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
/** 월 사용료 — onsite 만(예상 월 사용량 × 1구간 단가). 자가소비는 매달 내는 돈이 없다 */
const returnOf = (c: Contract) => (c.kind === 'ONSITE' ? estimateMonthlyKwh(c.capacityKw) * c.unitPrice : 0);
const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};

/**
 * 계약 현황 — 체결된(서명이 끝난) 계약만. 서명 대기는 거래 승인에서. 통합관제처럼 위 KPI(용량) · 그래프 · 표.
 *  - 관리자: 전체. 기업별 용량(자가소비 · onsite 쌓은 막대) + 기업별 계약 표(기업마다 한 줄, 누르면 내 계약에서 그 기업)
 *  - 기업: 내 계약만. 계약마다 한 줄
 */
export function ContractOverviewScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [q, setQ] = useState('');

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
  const onsite = active.filter((c) => c.kind === 'ONSITE');
  const monthly = active.reduce((s, c) => s + returnOf(c), 0);

  /** 기업별 — 기업마다 한 줄 */
  const companies = useMemo(() => {
    const ids = [...new Set(active.map((c) => c.consumerCompanyId))];
    return ids
      .map((id) => {
        const cs = active.filter((c) => c.consumerCompanyId === id);
        return {
          id,
          name: cs[0]!.consumerCompanyName,
          selfKw: kw(cs.filter((c) => c.kind === 'SELF_CONSUMPTION')),
          onsiteKw: kw(cs.filter((c) => c.kind === 'ONSITE')),
          start: cs.map((c) => c.startDate).sort()[0] ?? '',
          monthly: cs.reduce((s, c) => s + returnOf(c), 0),
        };
      })
      .sort((a, b) => b.selfKw + b.onsiteKw - (a.selfKw + a.onsiteKw));
  }, [active]);
  type Co = (typeof companies)[number];
  const shownCos = companies.filter((c) => !q.trim() || c.name.includes(q.trim()));
  /* 관리자 — 기업마다 한 줄 */
  const coCols: Column<Co>[] = [
    { key: 'name', header: '기업', render: (c) => cellStrong(c.name) },
    { key: 'self', header: '자가소비', width: '130px', render: (c) => cellNum(c.selfKw ? fmtKw(c.selfKw) : '-') },
    { key: 'onsite', header: 'PPA', width: '130px', render: (c) => cellNum(c.onsiteKw ? fmtKw(c.onsiteKw) : '-') },
    { key: 'start', header: '첫 시작일', width: '130px', render: (c) => cellMuted(c.start || '-') },
    {
      key: 'monthly',
      header: '월 사용료',
      width: '140px',
      sortable: true,
      sortValue: (c) => c.monthly,
      render: (c) => cellNum(c.monthly ? fmtKrw(c.monthly) : '-'),
    },
    arrow,
  ];

  const contractsBase = role.isAdmin ? '/platform/ppa/contracts' : '/generator/ppa/contracts';

  return (
    <div className="space-y-6">
      <PageHeader title="계약 현황" />

      <StatsGrid columns={3}>
        <StatCard label="자가소비 용량" value={fmtKw(kw(self))} />
        <StatCard label="PPA 용량" value={fmtKw(kw(onsite))} />
        <StatCard label="월 사용료 (PPA)" value={fmtKrw(monthly)} />
      </StatsGrid>

      <>
        {/* PPA — 달마다 얼마 들어왔는지(정산 실적) */}
        <PpaMonthlyCard contracts={onsite} mode="income" label="전체" />
        <SectionCard
          title={`기업별 계약 (${shownCos.length})`}
          actions={
            <div className="relative w-64">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
            </div>
          }
          noPadding
        >
          <DataTable
            columns={coCols}
            data={shownCos}
            rowKey={(c) => c.id}
            emptyMessage="계약 없음"
            onRowClick={(c) => router.push(`${contractsBase}?company=${c.id}`)}
          />
        </SectionCard>
      </>
    </div>
  );
}
