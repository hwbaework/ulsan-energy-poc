'use client';

import { useMemo, useState } from 'react';
import { FileEdit } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { ChangeType, Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CONTRACT_STATUS, KIND_OPTIONS, daysLeft, fmtKrw, fmtKw, fmtNum, fmtPrice, kindLabel } from './meta';
import { ContractStatusPill, PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { ContractDetailModal } from './ContractDetailModal';
import { ChangeRequestModal } from './ChangeRequestModal';

const CURRENT_PERIOD = '2026-09';

/** 내 계약 — 체결된 계약(서명 대기 · 운영 중 · 해지). 관리자는 전체 계약. */
export function MyContractsScreen() {
  const role = useTradingRole();
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Contract | null>(null);
  const [change, setChange] = useState<{ open: boolean; contractId?: number; type?: ChangeType }>({ open: false });

  const settlements = useMemo(() => settlementsOf(role.contracts), [role.contracts]);
  const stats = useMemo(() => {
    const active = role.contracts.filter((c) => c.status === 'ACTIVE');
    const sum = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
    const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    const thisMonth = settlements.filter((s) => s.period === CURRENT_PERIOD).reduce((s, x) => s + x.total, 0);
    const expiring = active.filter((c) => daysLeft(c.endDate) <= 365).length;
    return { self, onsite, selfKw: sum(self), onsiteKw: sum(onsite), thisMonth, expiring, pendingSign: role.contracts.filter((c) => c.status === 'PENDING_SIGN').length };
  }, [role.contracts, settlements]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return role.contracts
      .filter((c) => status === 'all' || c.status === status)
      .filter((c) => kind === 'all' || c.kind === kind)
      .filter((c) => !s || [c.no, c.plantName, c.consumerCompanyName, c.siteName, c.generatorCompanyName].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => (a.status === b.status ? b.startDate.localeCompare(a.startDate) : a.status === 'PENDING_SIGN' ? -1 : b.status === 'PENDING_SIGN' ? 1 : a.status === 'ACTIVE' ? -1 : 1));
  }, [role.contracts, status, kind, q]);

  const activeContracts = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);

  const columns: Column<Contract>[] = [
    { key: 'no', header: '계약번호', width: '130px', sortable: true, sortValue: (c) => c.no, render: (c) => cellStrong(c.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'plant', header: '발전소', render: (c) => cell(c.plantName, 'text-white') },
    { key: 'consumer', header: '수용가 · 사업장', render: (c) => cell(`${c.consumerCompanyName} · ${c.siteName}`) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '140px', render: (c: Contract) => cell(c.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', sortable: true, sortValue: (c) => c.capacityKw, render: (c) => cellNum(fmtKw(c.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (c) => cellNum(fmtPrice(c.unitPrice)) },
    { key: 'start', header: '시작일', width: '110px', sortable: true, sortValue: (c) => c.startDate, render: (c) => cellMuted(c.startDate) },
    { key: 'end', header: '종료일', width: '110px', render: (c) => cellMuted(c.status === 'TERMINATED' ? (c.terminatedAt ?? c.endDate) : c.endDate) },
    { key: 'status', header: '상태', width: '90px', render: (c) => <ContractStatusPill status={c.status} /> },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (c) => (
        <Button size="sm" onClick={() => setDetail(c)}>
          상세
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="내 계약"
        actions={
          activeContracts.length > 0 && (
            <Button onClick={() => setChange({ open: true })}>
              <FileEdit size={16} className="mr-1" /> 변경·해지 신청
            </Button>
          )
        }
      />

      <StatsGrid columns={4}>
        <StatCard label="자가소비 계약" value={`${stats.self.length}건`} sub={`${fmtNum(stats.selfKw, 2)} kW`} />
        <StatCard label="onsite 계약" value={`${stats.onsite.length}건`} sub={`${fmtNum(stats.onsiteKw, 2)} kW`} />
        <StatCard label="이번 달 정산 예정" value={fmtKrw(stats.thisMonth)} sub={`${CURRENT_PERIOD.replace('-', '.')} 청구 예정 (부가세 포함)`} />
        <StatCard label="서명 대기" value={`${stats.pendingSign}건`} sub={stats.expiring > 0 ? `만료 1년 이내 ${stats.expiring}건` : '만료 1년 이내 없음'} />
      </StatsGrid>

      <SectionCard
        title="계약"
        count={rows.length}
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
            <Input placeholder="계약번호 · 발전소 · 수용가 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} emptyMessage="계약 없음" onRowClick={(c) => setDetail(c)} />
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
        contracts={activeContracts}
        contractId={change.contractId}
        type={change.type}
        requestedBy={role.party}
        requestedByName={role.companyName}
      />
    </div>
  );
}
