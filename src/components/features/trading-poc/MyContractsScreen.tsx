'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { RmsBarChart } from '@/components/ui/Chart';
import { DataTable, type Column } from '@/components/features/DataList';
import { Select } from '@/components/ui/Select';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { ChangeType, Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { KIND_OPTIONS, fmtKrw, fmtKw, fmtNum, kindLabel } from './meta';
import { PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { ContractDetailModal } from './ContractDetailModal';
import { ChangeRequestModal } from './ChangeRequestModal';

const YEAR = '2026';
const CURRENT_PERIOD = '2026-09';
const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};

/** 내 계약 — 어떤 계약이 되어 있는지: 요약 · 월별 정산 그래프 · 계약 표(행 → 계약 상세). 계약 상세에서 변경·해지 신청. 관리자는 전체 계약 */
export function MyContractsScreen() {
  const role = useTradingRole();
  const [kind, setKind] = useState('all');
  const [detail, setDetail] = useState<Contract | null>(null);
  const [change, setChange] = useState<{ open: boolean; contractId?: number; type?: ChangeType }>({ open: false });

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const settlements = useMemo(() => settlementsOf(active), [active]);

  // 요약 — 체결된 계약 · 유형별 · 정산
  const stats = useMemo(() => {
    const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
    const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    const confirmed = settlements.filter((x) => x.status === 'CONFIRMED' && x.period.startsWith(YEAR));
    return {
      active: `${active.length}건 · ${fmtNum(kw(active), 2)} kW`,
      self: `${self.length}건 · ${fmtNum(kw(self), 2)} kW`,
      onsite: `${onsite.length}건 · ${fmtNum(kw(onsite), 2)} kW`,
      year: fmtKrw(confirmed.reduce((a, x) => a + x.total, 0)),
      month: fmtKrw(settlements.filter((x) => x.period === CURRENT_PERIOD).reduce((a, x) => a + x.total, 0)),
      pending: role.changes.filter((c) => c.status === 'REQUESTED').length,
    };
  }, [active, settlements, role.changes]);
  // 월별 정산 금액(부가세 제외) — onsite 전력 사용료(자가소비는 월 청구 없음)
  const chart = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const p = `${YEAR}-${String(i + 1).padStart(2, '0')}`;
        return { month: p, onsite: settlements.filter((x) => x.period === p).reduce((a, x) => a + x.supplyAmount, 0) };
      }),
    [settlements],
  );
  // 계약별 올해 정산액(확정)
  const yearOf = (id: number) =>
    settlements
      .filter((s) => s.contractId === id && s.status === 'CONFIRMED' && s.period.startsWith(YEAR))
      .reduce((a, s) => a + s.total, 0);

  const rows = useMemo(
    () =>
      active.filter((c) => kind === 'all' || c.kind === kind).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [active, kind],
  );

  const columns: Column<Contract>[] = [
    {
      key: 'no',
      header: '계약번호',
      width: '130px',
      sortable: true,
      sortValue: (c) => c.no,
      render: (c) => cellStrong(c.no),
    },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'consumer', header: '기업명', render: (c) => cell(c.consumerCompanyName, 'text-white') },
    {
      key: 'capacity',
      header: '용량',
      width: '110px',
      sortable: true,
      sortValue: (c) => c.capacityKw,
      render: (c) => cellNum(fmtKw(c.capacityKw)),
    },
    { key: 'term', header: '계약 기간', width: '100px', render: (c) => cellNum(`${c.termYears}년`) },
    {
      key: 'start',
      header: '시작일',
      width: '110px',
      sortable: true,
      sortValue: (c) => c.startDate,
      render: (c) => cellMuted(c.startDate),
    },
    { key: 'end', header: '종료일', width: '110px', render: (c) => cellMuted(c.endDate) },
    {
      key: 'year',
      header: `${YEAR} 정산액`,
      width: '130px',
      sortable: true,
      sortValue: (c) => yearOf(c.id),
      render: (c) => cellNum(fmtKrw(yearOf(c.id))),
    },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="내 계약" />

      {/* 어떤 계약이 되어 있는지 — 요약 · 그래프 */}
      <StatsGrid columns={3}>
        <StatCard label="계약" value={stats.active} />
        <StatCard label="자가소비" value={stats.self} />
        <StatCard label="onsite" value={stats.onsite} />
      </StatsGrid>
      <StatsGrid columns={3}>
        <StatCard label={`${YEAR} 정산 누계`} value={stats.year} />
        <StatCard label={`${CURRENT_PERIOD} 정산`} value={stats.month} />
        <StatCard label="변경 · 해지 처리 대기" value={`${stats.pending}건`} />
      </StatsGrid>
      <SectionCard title={`${YEAR} 월별 정산 금액 (부가세 제외)`}>
        <RmsBarChart data={chart} xKey="month" bars={[{ key: 'onsite', name: 'onsite 전력 사용료' }]} height={260} />
      </SectionCard>

      <SectionCard
        title="계약"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            계약 유형
            <Select
              options={[{ value: 'all', label: '전체' }, ...KIND_OPTIONS]}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-32"
            />
          </label>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          emptyMessage="계약 없음"
          onRowClick={(c) => setDetail(c)}
        />
      </SectionCard>

      <ContractDetailModal
        contract={detail}
        onClose={() => setDetail(null)}
        changes={role.changes}
        documents={role.documents}
        canRequestChange
        onRequestChange={(c, type) => {
          setDetail(null);
          setChange({ open: true, contractId: c.id, type });
        }}
      />
      <ChangeRequestModal
        open={change.open}
        onClose={() => setChange({ open: false })}
        contracts={active}
        contractId={change.contractId}
        type={change.type}
        requestedBy={role.party}
        requestedByName={role.companyName}
      />
    </div>
  );
}
