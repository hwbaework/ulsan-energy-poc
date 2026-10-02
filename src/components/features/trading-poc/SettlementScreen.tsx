'use client';

import { useMemo, useState } from 'react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { RmsBarChart } from '@/components/ui/Chart';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/Design';
import { settlementsOf } from '@/stores/useTradingPocStore';
import { useTradingRole } from './useTradingRole';
import { fmtKrw, fmtKwh, fmtPrice } from './meta';
import { PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';

const YEAR = '2026';
const CURRENT_PERIOD = '2026-09';

type Row = ReturnType<typeof settlementsOf>[number];

/**
 * 수익·정산 — 체결된 계약의 월 정산. 금액 = 발전·공급량 × 계약 단가(+부가세 10%).
 * 계약이 바뀌면(체결·변경·해지) 정산도 따라간다. 전월까지 확정, 이번 달은 정산 예정
 */
export function SettlementScreen() {
  const role = useTradingRole();
  const all = useMemo(() => settlementsOf(role.contracts).filter((s) => s.period.startsWith(YEAR)), [role.contracts]);
  const periods = useMemo(() => [...new Set(all.map((s) => s.period))].sort().reverse(), [all]);
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [contractId, setContractId] = useState('all');

  const stats = useMemo(() => {
    const confirmed = all.filter((s) => s.status === 'CONFIRMED');
    return {
      month: fmtKrw(all.filter((s) => s.period === CURRENT_PERIOD).reduce((a, s) => a + s.total, 0)),
      year: fmtKrw(confirmed.reduce((a, s) => a + s.total, 0)),
      kwh: fmtKwh(confirmed.reduce((a, s) => a + s.generationKwh, 0)),
    };
  }, [all]);

  // 월별 정산 금액(부가세 제외, 만원) — 자가소비 · onsite
  const chart = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const p = `${YEAR}-${String(i + 1).padStart(2, '0')}`;
        const of = (k: 'self' | 'onsite') => Math.round(all.filter((s) => s.period === p && s.ppaKind === k).reduce((a, s) => a + s.supplyAmount, 0) / 10_000);
        return { month: p, 자가소비: of('self'), onsite: of('onsite') };
      }),
    [all],
  );

  const contracts = useMemo(() => {
    const ids = new Set(all.map((s) => s.contractId));
    return role.contracts.filter((c) => ids.has(c.id));
  }, [all, role.contracts]);
  const rows = useMemo(
    () =>
      all
        .filter((s) => period === 'all' || s.period === period)
        .filter((s) => contractId === 'all' || String(s.contractId) === contractId)
        .sort((a, b) => b.period.localeCompare(a.period) || b.total - a.total),
    [all, period, contractId],
  );

  const columns: Column<Row>[] = [
    { key: 'period', header: '정산월', width: '100px', sortable: true, sortValue: (s) => s.period, render: (s) => cellStrong(s.period) },
    { key: 'contract', header: '계약번호', width: '130px', render: (s) => cellNum(s.contractNumber) },
    { key: 'plant', header: '발전소', render: (s) => cell(s.plantName, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (s) => cell(s.ppaKind === 'onsite' ? 'onsite' : '자가소비') },
    { key: 'consumer', header: '수용가', width: '140px', render: (s) => cell(s.consumerCompanyName) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '150px', render: (s: Row) => cell(s.generatorCompanyName) }] : []),
    { key: 'kwh', header: '발전·공급량', width: '130px', sortable: true, sortValue: (s) => s.generationKwh, render: (s) => cellNum(fmtKwh(s.generationKwh)) },
    { key: 'price', header: '단가', width: '110px', render: (s) => cellNum(fmtPrice(s.smpUnitPrice)) },
    { key: 'supply', header: '공급가액', width: '130px', render: (s) => cellNum(fmtKrw(s.supplyAmount)) },
    { key: 'vat', header: '부가세', width: '110px', render: (s) => cellMuted(fmtKrw(s.vat)) },
    { key: 'total', header: '합계', width: '130px', sortable: true, sortValue: (s) => s.total, render: (s) => cellStrong(fmtKrw(s.total)) },
    {
      key: 'status',
      header: '상태',
      width: '100px',
      render: (s) => (s.status === 'CONFIRMED' ? <StatusPill tone="normal" label="확정" /> : <StatusPill tone="warning" label="정산 예정" />),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="수익·정산" />

      <StatsGrid columns={3}>
        <StatCard label={`${CURRENT_PERIOD} 정산 예정`} value={stats.month} />
        <StatCard label={`${YEAR} 확정 누계`} value={stats.year} />
        <StatCard label={`${YEAR} 발전·공급량`} value={stats.kwh} />
      </StatsGrid>

      <SectionCard title={`${YEAR} 월별 정산 금액 (만원, 부가세 제외)`}>
        <RmsBarChart data={chart} xKey="month" bars={[{ key: '자가소비', name: '자가소비' }, { key: 'onsite', name: 'onsite' }]} stacked height={260} />
      </SectionCard>

      <SectionCard
        title="월 정산"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              정산월
              <Select options={[{ value: 'all', label: '전체' }, ...periods.map((p) => ({ value: p, label: p }))]} value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약
              <Select
                options={[{ value: 'all', label: '전체' }, ...contracts.map((c) => ({ value: String(c.id), label: `${c.no} · ${c.plantName}` }))]}
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="w-56"
              />
            </label>
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(s) => s.id} emptyMessage="정산 없음" />
      </SectionCard>
    </div>
  );
}
