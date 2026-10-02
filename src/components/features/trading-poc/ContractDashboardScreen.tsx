'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Select } from '@/components/ui/Select';
import type { Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CONTRACT_STATUS, KIND_OPTIONS, daysLeft, fmtKw, fmtNum, fmtPrice, kindLabel } from './meta';
import { ContractStatusPill, PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { ContractDetailModal } from './ContractDetailModal';

/** 계약 현황 — 계약에 관련된 현황만(WBS 2.1.6): 유형별 계약 수·용량, 서명 대기·만료 예정·해지, 계약별 기간. 돈 내역은 거래 이력 */
export function ContractDashboardScreen() {
  const role = useTradingRole();
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [detail, setDetail] = useState<Contract | null>(null);

  const stats = useMemo(() => {
    const active = role.contracts.filter((c) => c.status === 'ACTIVE');
    const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
    const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    return {
      active: `${active.length}건 · ${fmtNum(kw(active), 2)} kW`,
      self: `${self.length}건 · ${fmtNum(kw(self), 2)} kW`,
      onsite: `${onsite.length}건 · ${fmtNum(kw(onsite), 2)} kW`,
      pending: role.contracts.filter((c) => c.status === 'PENDING_SIGN').length,
      expiring: active.filter((c) => daysLeft(c.endDate) <= 365).length,
      terminated: role.contracts.filter((c) => c.status === 'TERMINATED').length,
    };
  }, [role.contracts]);

  const order: Record<Contract['status'], number> = { PENDING_SIGN: 0, ACTIVE: 1, TERMINATED: 2 };
  const rows = useMemo(
    () =>
      role.contracts
        .filter((c) => status === 'all' || c.status === status)
        .filter((c) => kind === 'all' || c.kind === kind)
        .sort((a, b) => order[a.status] - order[b.status] || b.startDate.localeCompare(a.startDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role.contracts, status, kind],
  );

  const columns: Column<Contract>[] = [
    { key: 'no', header: '계약번호', width: '130px', render: (c) => cellStrong(c.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'plant', header: '발전소', render: (c) => cell(c.plantName, 'text-white') },
    { key: 'consumer', header: '수용가', width: '140px', render: (c) => cell(c.consumerCompanyName) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '150px', render: (c: Contract) => cell(c.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', sortable: true, sortValue: (c) => c.capacityKw, render: (c) => cellNum(fmtKw(c.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (c) => cellNum(fmtPrice(c.unitPrice)) },
    { key: 'start', header: '시작일', width: '110px', sortable: true, sortValue: (c) => c.startDate, render: (c) => cellMuted(c.startDate) },
    {
      key: 'end',
      header: '종료일',
      width: '170px',
      render: (c) => cellMuted(c.status === 'TERMINATED' ? `${c.terminatedAt ?? ''} (해지)` : `${c.endDate} (${Math.max(0, Math.round(daysLeft(c.endDate) / 365))}년 남음)`),
    },
    { key: 'status', header: '상태', width: '100px', render: (c) => <ContractStatusPill status={c.status} /> },
    { key: 'go', header: '', width: '40px', render: () => <ChevronRight size={15} className="text-slate-600" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="계약 현황" />

      <StatsGrid columns={3}>
        <StatCard label="운영 중 계약" value={stats.active} />
        <StatCard label="자가소비" value={stats.self} />
        <StatCard label="onsite" value={stats.onsite} />
      </StatsGrid>
      <StatsGrid columns={3}>
        <StatCard label="서명 대기" value={`${stats.pending}건`} />
        <StatCard label="1년 내 만료" value={`${stats.expiring}건`} />
        <StatCard label="해지" value={`${stats.terminated}건`} />
      </StatsGrid>

      <SectionCard
        title="계약별 현황"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select
                options={[{ value: 'all', label: '전체' }, ...(Object.keys(CONTRACT_STATUS) as Contract['status'][]).map((s) => ({ value: s, label: CONTRACT_STATUS[s].label }))]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-32"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약 유형
              <Select options={[{ value: 'all', label: '전체' }, ...KIND_OPTIONS]} value={kind} onChange={(e) => setKind(e.target.value)} className="w-32" />
            </label>
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} emptyMessage="계약 없음" onRowClick={(c) => setDetail(c)} />
      </SectionCard>

      <ContractDetailModal contract={detail} onClose={() => setDetail(null)} changes={role.changes} documents={role.documents} canRequestChange={false} />
    </div>
  );
}
