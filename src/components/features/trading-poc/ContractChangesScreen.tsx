'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, FileEdit } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ContractChange } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CHANGE_STATUS, CHANGE_TYPE, PARTY_LABEL, fmtDate, kindLabel } from './meta';
import { ChangeStatusPill, PageHeader, cell, cellMuted, cellStrong } from './Bits';
import { ChangeRequestModal } from './ChangeRequestModal';
import { ChangeDetailModal, changeText } from './ChangeDetailModal';

/** 변경·해지 — 운영 중 계약의 단가·용량·기간 변경과 해지 신청 · 요청 목록. 관리자 승인은 거래 승인에서도 */
export function ContractChangesScreen() {
  const role = useTradingRole();
  const [status, setStatus] = useState('all');
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<ContractChange | null>(null);

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);
  const rows = useMemo(
    () => [...role.changes].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).filter((c) => status === 'all' || c.status === status),
    [role.changes, status],
  );
  const year = String(new Date().getFullYear());
  const stats = {
    pending: role.changes.filter((c) => c.status === 'REQUESTED').length,
    approved: role.changes.filter((c) => c.status === 'APPROVED' && (c.decidedAt ?? '').startsWith(year)).length,
    rejected: role.changes.filter((c) => c.status === 'REJECTED' && (c.decidedAt ?? '').startsWith(year)).length,
    terminated: role.contracts.filter((c) => c.status === 'TERMINATED').length,
  };

  const columns: Column<ContractChange>[] = [
    { key: 'no', header: '요청번호', width: '140px', render: (c) => cellStrong(c.no) },
    { key: 'contract', header: '계약 · 발전소', render: (c) => cell(`${contractOf(c.contractId)?.no ?? ''} · ${contractOf(c.contractId)?.plantName ?? ''}`, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(contractOf(c.contractId) ? kindLabel(contractOf(c.contractId)!.kind) : '') },
    { key: 'type', header: '변경 유형', width: '100px', render: (c) => cell(CHANGE_TYPE[c.type]) },
    { key: 'detail', header: '내용', width: '220px', render: (c) => cell(changeText(c)) },
    { key: 'by', header: '요청자', width: '170px', render: (c) => cell(`${c.requestedByName} (${PARTY_LABEL[c.requestedBy]})`) },
    { key: 'at', header: '요청일', width: '110px', sortable: true, sortValue: (c) => c.requestedAt, render: (c) => cellMuted(fmtDate(c.requestedAt)) },
    { key: 'status', header: '상태', width: '100px', render: (c) => <ChangeStatusPill status={c.status} /> },
    { key: 'go', header: '', width: '40px', render: () => <ChevronRight size={15} className="text-slate-600" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="변경·해지"
        actions={
          active.length > 0 && (
            <Button onClick={() => setNewOpen(true)}>
              <FileEdit size={16} className="mr-1" /> 변경·해지 신청
            </Button>
          )
        }
      />

      <StatsGrid columns={4}>
        <StatCard label="처리 대기" value={`${stats.pending}건`} />
        <StatCard label={`${year} 승인`} value={`${stats.approved}건`} />
        <StatCard label={`${year} 반려`} value={`${stats.rejected}건`} />
        <StatCard label="해지 완료 계약" value={`${stats.terminated}건`} />
      </StatsGrid>

      <SectionCard
        title="변경·해지 요청"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select
              options={[{ value: 'all', label: '전체' }, ...(Object.keys(CHANGE_STATUS) as ContractChange['status'][]).map((s) => ({ value: s, label: CHANGE_STATUS[s].label }))]}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-32"
            />
          </label>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} emptyMessage="변경·해지 요청 없음" onRowClick={(c) => setDetail(c)} />
      </SectionCard>

      <ChangeRequestModal open={newOpen} onClose={() => setNewOpen(false)} contracts={active} requestedBy={role.party} requestedByName={role.companyName} />
      <ChangeDetailModal change={detail} contract={contractOf(detail?.contractId)} onClose={() => setDetail(null)} />
    </div>
  );
}
