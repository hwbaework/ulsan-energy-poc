'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Input } from '@/components/ui/Input';
import { PpaMonthlyCard } from './PpaMonthlyCard';
import type { Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { estimateMonthlyKwh, fmtKrw, fmtKw, kindLabel } from './meta';
import { PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';

const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
/** 월 사용료 — onsite 만(예상 월 사용량 × 1구간 단가). 자가소비는 매달 내는 돈이 없다 */
const returnOf = (c: Contract) => (c.kind === 'ONSITE' ? estimateMonthlyKwh(c.capacityKw) * c.unitPrice : 0);
// 손으로 그리던 화살표 칸은 뺐다 — 끝의 > 는 DataTable 의 rowLink 가 그린다(같이 두면 화살표가 둘, 2026-11-25 사용자)

/**
 * 계약 현황 — 체결된(서명이 끝난) 계약만. 서명 대기는 거래 승인에서. 통합관제처럼 위 KPI(용량) · 그래프 · 표.
 *  - 관리자: 전체. 계약 표는 계약마다 한 줄(기업마다 한 줄로 합치면 계약이 둘인 기업은 한쪽 계약으로만 갔다, 2026-11-25 사용자) — 누르면 내 계약에서 그 계약
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

  /** 계약마다 한 줄 — 기업 검색. 기업 이름순, 같은 기업이면 PPA 먼저 */
  const rows = useMemo(
    () =>
      [...active]
        .filter((c) => !q.trim() || c.consumerCompanyName.includes(q.trim()))
        .sort((a, b) => a.consumerCompanyName.localeCompare(b.consumerCompanyName, 'ko') || Number(b.kind === 'ONSITE') - Number(a.kind === 'ONSITE')),
    [active, q],
  );
  const cols: Column<Contract>[] = [
    { key: 'no', header: '계약번호', width: '160px', render: (c) => cellStrong(c.no) },
    { key: 'name', header: '기업', render: (c) => cell(c.consumerCompanyName, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'capacity', header: '용량', width: '120px', sortable: true, sortValue: (c) => c.capacityKw, render: (c) => cellNum(fmtKw(c.capacityKw)) },
    { key: 'term', header: '계약 기간', width: '100px', render: (c) => cellNum(`${c.termYears}년`) },
    { key: 'start', header: '시작일', width: '120px', render: (c) => cellMuted(c.startDate) },
    {
      key: 'monthly',
      header: '예상 월 사용료',
      width: '140px',
      sortable: true,
      sortValue: (c) => returnOf(c),
      render: (c) => cellNum(c.kind === 'ONSITE' ? fmtKrw(returnOf(c)) : '-'),
    },
  ];

  const contractsBase = role.isAdmin ? '/platform/ppa/contracts' : '/generator/ppa/contracts';

  return (
    <div className="space-y-6">
      <PageHeader title="계약 현황" />

      <StatsGrid columns={3}>
        <StatCard label="자가소비 용량" value={fmtKw(kw(self))} />
        <StatCard label="PPA 용량" value={fmtKw(kw(onsite))} />
        <StatCard label="예상 월 사용료 (PPA)" value={fmtKrw(monthly)} />
      </StatsGrid>

      <>
        {/* PPA — 달마다 얼마 들어왔는지(정산 실적) */}
        <PpaMonthlyCard contracts={onsite} mode="income" label="전체" />
        <SectionCard
          title={`계약 (${rows.length})`}
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
            columns={cols}
            data={rows}
            rowKey={(c) => c.id}
            emptyMessage="계약 없음"
            onRowClick={(c) => router.push(`${contractsBase}?contract=${c.id}`)}
            rowLink
          />
        </SectionCard>
      </>
    </div>
  );
}
