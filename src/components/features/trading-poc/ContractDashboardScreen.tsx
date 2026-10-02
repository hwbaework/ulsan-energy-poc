'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { RmsBarChart } from '@/components/ui/Chart';
import { Button } from '@/components/ui/Button';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { Contract, TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { IN_PROGRESS, daysLeft, fmtDate, fmtKrw, fmtKw, fmtKwh, fmtNum, fmtPrice, kindLabel } from './meta';
import { ContractStatusPill, PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';

const YEAR = '2026';
const CURRENT_PERIOD = '2026-09';

type Row = Contract & { yearKwh: number; yearAmount: number };

/** 계약 현황 — 운영 중 계약을 유형별로 모아 보고, 월별 정산 추이와 계약별 올해 실적을 본다. */
export function ContractDashboardScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const settlements = useMemo(() => settlementsOf(role.contracts), [role.contracts]);

  const stats = useMemo(() => {
    const active = role.contracts.filter((c) => c.status === 'ACTIVE');
    const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
    const confirmed = settlements.filter((s) => s.status === 'CONFIRMED' && s.period.startsWith(YEAR));
    return {
      active: active.length,
      activeKw: kw(active),
      self: self.length,
      selfKw: kw(self),
      onsite: onsite.length,
      onsiteKw: kw(onsite),
      yearAmount: confirmed.reduce((s, x) => s + x.total, 0),
      yearKwh: confirmed.reduce((s, x) => s + x.generationKwh, 0),
      thisMonth: settlements.filter((s) => s.period === CURRENT_PERIOD).reduce((s, x) => s + x.total, 0),
      inProgress: role.requests.filter((r) => IN_PROGRESS.includes(r.status)).length,
      expiring: active.filter((c) => daysLeft(c.endDate) <= 365).length,
    };
  }, [role.contracts, role.requests, settlements]);

  // 월별 정산 금액(부가세 제외) — 자가소비 · onsite 누적 막대
  const chart = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const p = `${YEAR}-${String(i + 1).padStart(2, '0')}`;
      const of = (kind: 'self' | 'onsite') => settlements.filter((s) => s.period === p && s.ppaKind === kind).reduce((s, x) => s + x.supplyAmount, 0);
      return { month: `${i + 1}월`, 자가소비: of('self'), onsite: of('onsite') };
    });
  }, [settlements]);

  const rows = useMemo<Row[]>(
    () =>
      role.contracts
        .filter((c) => c.status !== 'PENDING_SIGN')
        .map((c) => {
          const mine = settlements.filter((s) => s.contractId === c.id && s.status === 'CONFIRMED' && s.period.startsWith(YEAR));
          return { ...c, yearKwh: mine.reduce((s, x) => s + x.generationKwh, 0), yearAmount: mine.reduce((s, x) => s + x.total, 0) };
        })
        .sort((a, b) => (a.status === b.status ? b.yearAmount - a.yearAmount : a.status === 'ACTIVE' ? -1 : 1)),
    [role.contracts, settlements],
  );
  const inProgress = useMemo(() => role.requests.filter((r) => IN_PROGRESS.includes(r.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [role.requests]);

  const columns: Column<Row>[] = [
    { key: 'no', header: '계약번호', width: '130px', render: (c) => cellStrong(c.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'plant', header: '발전소', render: (c) => cell(c.plantName, 'text-white') },
    { key: 'consumer', header: '수용가', width: '140px', render: (c) => cell(c.consumerCompanyName) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '140px', render: (c: Row) => cell(c.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', sortable: true, sortValue: (c) => c.capacityKw, render: (c) => cellNum(fmtKw(c.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (c) => cellNum(fmtPrice(c.unitPrice)) },
    { key: 'yearKwh', header: `${YEAR} 발전·공급량`, width: '150px', sortable: true, sortValue: (c) => c.yearKwh, render: (c) => cellNum(fmtKwh(c.yearKwh)) },
    { key: 'yearAmount', header: `${YEAR} 정산액`, width: '130px', sortable: true, sortValue: (c) => c.yearAmount, render: (c) => cellNum(fmtKrw(c.yearAmount)) },
    {
      key: 'end',
      header: '종료일',
      width: '150px',
      render: (c) => cellMuted(c.status === 'TERMINATED' ? `${c.terminatedAt} (해지)` : `${c.endDate} (${Math.max(0, Math.round(daysLeft(c.endDate) / 365))}년 남음)`),
    },
    { key: 'status', header: '상태', width: '90px', render: (c) => <ContractStatusPill status={c.status} /> },
  ];

  const reqColumns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'plant', header: '발전소(설비)', render: (r) => cell(r.plantName, 'text-white') },
    { key: 'consumer', header: '수용가', width: '140px', render: (r) => cell(r.consumerCompanyName) },
    { key: 'capacity', header: '용량', width: '110px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'updatedAt', header: '최근 변경', width: '110px', render: (r) => cellMuted(fmtDate(r.updatedAt)) },
    { key: 'status', header: '상태', width: '90px', render: (r) => <RequestStatusPill status={r.status} /> },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => router.push(`/trading/deal/${r.id}`)}>
          상세
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="계약 현황" />

      {/* KPI 2줄 (3+3) */}
      <StatsGrid columns={3}>
        <StatCard label="운영 중 계약" value={`${stats.active}건 · ${fmtNum(stats.activeKw, 2)} kW`} />
        <StatCard label="자가소비" value={`${stats.self}건 · ${fmtNum(stats.selfKw, 2)} kW`} />
        <StatCard label="onsite" value={`${stats.onsite}건 · ${fmtNum(stats.onsiteKw, 2)} kW`} />
      </StatsGrid>
      <StatsGrid columns={3}>
        <StatCard label={`${YEAR} 정산 누계`} value={fmtKrw(stats.yearAmount)} />
        <StatCard label="이번 달 정산 예정" value={fmtKrw(stats.thisMonth)} />
        <StatCard label="진행 중 신청" value={`${stats.inProgress}건`} />
      </StatsGrid>

      <SectionCard title={`${YEAR} 월별 정산 금액 (부가세 제외)`}>
        <RmsBarChart data={chart} xKey="month" bars={[{ key: '자가소비', name: '자가소비' }, { key: 'onsite', name: 'onsite' }]} stacked height={260} />
      </SectionCard>

      <SectionCard title="계약별 현황" count={rows.length} noPadding>
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} emptyMessage="계약 없음" />
      </SectionCard>

      <SectionCard title="진행 중 신청" count={inProgress.length} noPadding>
        <DataTable columns={reqColumns} data={inProgress} rowKey={(r) => r.id} emptyMessage="진행 중인 신청 없음" onRowClick={(r) => router.push(`/trading/deal/${r.id}`)} />
      </SectionCard>
    </div>
  );
}
