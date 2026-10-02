'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/Design';
import type { ContractChange, TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CHANGE_TYPE, PARTY_LABEL, fmtDate, fmtKw, fmtPrice, kindLabel } from './meta';
import { ChangeStatusPill, PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { DealDetailModal } from './DealDetailModal';
import { ChangeDetailModal, changeText } from './ChangeDetailModal';

const arrow = { key: 'go', header: '', width: '40px', render: () => <ChevronRight size={15} className="text-slate-600" /> };
const WAIT_OR_ALL = [
  { value: 'wait', label: '처리 대기' },
  { value: 'all', label: '전체' },
];

/**
 * 거래 승인 — 관리자(SPC): 신청 검토·승인·반려, 수용가 서명 확인, 변경·해지 승인.
 * 발전사업자: 승인된 거래 — 전자서명하면 체결되어 내 계약으로 간다.
 */
export function TradeApprovalsScreen() {
  const role = useTradingRole();
  return role.isAdmin ? <AdminApprovals /> : <GeneratorApprovals />;
}

function AdminApprovals() {
  const role = useTradingRole();
  const [reqFilter, setReqFilter] = useState('wait');
  const [chFilter, setChFilter] = useState('wait');
  const [deal, setDeal] = useState<number | null>(null);
  const [change, setChange] = useState<ContractChange | null>(null);

  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);
  // 관리자가 처리할 신청 — 접수 · 검토 중 · 수용가 서명 확인 전
  const needsAdmin = (r: TradeRequest) =>
    r.status === 'SUBMITTED' || r.status === 'REVIEW' || (r.status === 'APPROVED' && !contractOf(r.contractId)?.signedByConsumer);
  const requests = useMemo(
    () => [...role.requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((r) => reqFilter === 'all' || needsAdmin(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role.requests, role.contracts, reqFilter],
  );
  const changes = useMemo(
    () => [...role.changes].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).filter((c) => chFilter === 'all' || c.status === 'REQUESTED'),
    [role.changes, chFilter],
  );
  const stats = {
    review: role.requests.filter((r) => r.status === 'SUBMITTED' || r.status === 'REVIEW').length,
    sign: role.requests.filter((r) => r.status === 'APPROVED' && !contractOf(r.contractId)?.signedByConsumer).length,
    change: role.changes.filter((c) => c.status === 'REQUESTED').length,
  };

  /** 지금 할 일 — 관리자 기준 */
  const todo = (r: TradeRequest) => {
    if (r.status === 'SUBMITTED') return '검토 시작';
    if (r.status === 'REVIEW') return '승인 · 반려';
    if (r.status === 'APPROVED') return contractOf(r.contractId)?.signedByConsumer ? '' : '수용가 서명 확인';
    return '';
  };

  const reqColumns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'gen', header: '발전사업자', width: '150px', render: (r) => cell(r.generatorCompanyName, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'consumer', header: '수용가 · 사업장', render: (r) => cell(`${r.consumerCompanyName} · ${r.siteName}`) },
    { key: 'capacity', header: '용량', width: '110px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'at', header: '신청일', width: '110px', sortable: true, sortValue: (r) => r.submittedAt, render: (r) => cellMuted(fmtDate(r.submittedAt)) },
    { key: 'status', header: '상태', width: '100px', render: (r) => <RequestStatusPill status={r.status} /> },
    { key: 'todo', header: '할 일', width: '130px', render: (r) => cell(todo(r), 'text-primary') },
    arrow,
  ];
  const chColumns: Column<ContractChange>[] = [
    { key: 'no', header: '요청번호', width: '140px', render: (c) => cellStrong(c.no) },
    { key: 'contract', header: '계약 · 발전소', render: (c) => cell(`${contractOf(c.contractId)?.no ?? ''} · ${contractOf(c.contractId)?.plantName ?? ''}`, 'text-white') },
    { key: 'type', header: '변경 유형', width: '100px', render: (c) => cell(CHANGE_TYPE[c.type]) },
    { key: 'detail', header: '내용', width: '220px', render: (c) => cell(changeText(c)) },
    { key: 'by', header: '요청자', width: '170px', render: (c) => cell(`${c.requestedByName} (${PARTY_LABEL[c.requestedBy]})`) },
    { key: 'at', header: '요청일', width: '110px', sortable: true, sortValue: (c) => c.requestedAt, render: (c) => cellMuted(fmtDate(c.requestedAt)) },
    { key: 'status', header: '상태', width: '100px', render: (c) => <ChangeStatusPill status={c.status} /> },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 승인" />

      <StatsGrid columns={3}>
        <StatCard label="신청 검토" value={`${stats.review}건`} />
        <StatCard label="수용가 서명 확인" value={`${stats.sign}건`} />
        <StatCard label="변경 · 해지" value={`${stats.change}건`} />
      </StatsGrid>

      <SectionCard
        title="거래 신청"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select options={WAIT_OR_ALL} value={reqFilter} onChange={(e) => setReqFilter(e.target.value)} className="w-32" />
          </label>
        }
        noPadding
      >
        <DataTable columns={reqColumns} data={requests} rowKey={(r) => r.id} emptyMessage="처리할 신청 없음" onRowClick={(r) => setDeal(r.id)} />
      </SectionCard>

      <SectionCard
        title="변경 · 해지"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select options={WAIT_OR_ALL} value={chFilter} onChange={(e) => setChFilter(e.target.value)} className="w-32" />
          </label>
        }
        noPadding
      >
        <DataTable columns={chColumns} data={changes} rowKey={(c) => c.id} emptyMessage="처리할 요청 없음" onRowClick={(c) => setChange(c)} />
      </SectionCard>

      <DealDetailModal requestId={deal} onClose={() => setDeal(null)} />
      <ChangeDetailModal change={change} contract={contractOf(change?.contractId)} onClose={() => setChange(null)} />
    </div>
  );
}

function GeneratorApprovals() {
  const role = useTradingRole();
  const [filter, setFilter] = useState('sign');
  const [deal, setDeal] = useState<number | null>(null);
  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);

  // 승인된 거래 — 서명 진행(APPROVED) · 체결(SIGNED)
  const rows = useMemo(
    () =>
      role.requests
        .filter((r) => (filter === 'sign' ? r.status === 'APPROVED' : r.status === 'APPROVED' || r.status === 'SIGNED'))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [role.requests, filter],
  );
  const mySign = role.requests.filter((r) => r.status === 'APPROVED' && !contractOf(r.contractId)?.signedByGenerator).length;
  const waitConsumer = role.requests.filter((r) => r.status === 'APPROVED' && contractOf(r.contractId)?.signedByGenerator).length;
  const year = String(new Date().getFullYear());
  const signedYear = role.requests.filter((r) => r.status === 'SIGNED' && r.updatedAt.startsWith(year)).length;

  const signState = (r: TradeRequest) => {
    if (r.status === 'SIGNED') return <StatusPill tone="normal" label="체결" />;
    const c = contractOf(r.contractId);
    if (!c?.signedByGenerator) return <StatusPill tone="warning" label="내 서명 필요" />;
    return <StatusPill tone="muted" label="수용가 서명 대기" />;
  };

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'contract', header: '계약번호', width: '130px', render: (r) => cellNum(contractOf(r.contractId)?.no ?? '') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'consumer', header: '수용가 · 사업장', render: (r) => cell(`${r.consumerCompanyName} · ${r.siteName}`, 'text-white') },
    { key: 'capacity', header: '용량', width: '110px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'start', header: '시작일', width: '110px', render: (r) => cellMuted(contractOf(r.contractId)?.startDate ?? '') },
    { key: 'sign', header: '서명', width: '140px', render: signState },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 승인" />

      <StatsGrid columns={3}>
        <StatCard label="내 서명 필요" value={`${mySign}건`} />
        <StatCard label="수용가 서명 대기" value={`${waitConsumer}건`} />
        <StatCard label={`${year} 체결`} value={`${signedYear}건`} />
      </StatsGrid>

      <SectionCard
        title="승인된 거래"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select
              options={[
                { value: 'sign', label: '서명 진행' },
                { value: 'all', label: '전체' },
              ]}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-32"
            />
          </label>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="승인된 거래 없음" onRowClick={(r) => setDeal(r.id)} />
      </SectionCard>

      <DealDetailModal requestId={deal} onClose={() => setDeal(null)} />
    </div>
  );
}
