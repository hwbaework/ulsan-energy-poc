'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileEdit } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ContractChange } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { ChangeRequestModal } from './ChangeRequestModal';
import { CHANGE_STATES, changeStateOf, changeTypeLabel, fmtDate, kindLabel } from './meta';
import { ChangeStatePill, PageHeader, cell, cellMuted, cellStrong } from './Bits';

/** 변경·해지 — 요청 목록. 신청은 신청 화면, 줄을 누르면 상세(단계 · 협의 채팅 · 합의서 양쪽 서명). 팝업 없음 */
export function ContractChangesScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [status, setStatus] = useState('all');
  const [newOpen, setNewOpen] = useState(false);
  const [side, setSide] = useState('all');
  /** 지금 계정 기준 — 보낸 요청(내가 신청) / 받은 요청(상대가 신청). 관리자는 SPC 신청이 보낸 요청 */
  const sentByMe = (c: ContractChange) => (role.isAdmin ? c.requestedBy === 'spc' : c.requestedBy !== 'spc');
  const base = role.isAdmin ? '/platform/trading/changes' : '/generator/trading/changes';

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);
  const rows = useMemo(
    () =>
      [...role.changes]
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
        .filter((c) => status === 'all' || changeStateOf(c) === status)
        .filter((c) => side === 'all' || (side === 'sent') === sentByMe(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role.changes, status, side, role.isAdmin],
  );
  const year = String(new Date().getFullYear());
  const stats = {
    pending: role.changes.filter((c) => c.status === 'REQUESTED').length,
    approved: role.changes.filter((c) => c.status === 'APPROVED' && (c.decidedAt ?? '').startsWith(year)).length,
    rejected: role.changes.filter((c) => c.status === 'REJECTED' && (c.decidedAt ?? '').startsWith(year)).length,
    terminated: role.contracts.filter((c) => c.status === 'TERMINATED').length,
  };

  const columns: Column<ContractChange>[] = [
    { key: 'no', header: '요청번호', width: '160px', render: (c) => cellStrong(c.no) },
    {
      key: 'side',
      header: '구분',
      width: '110px',
      render: (c) =>
        sentByMe(c) ? cell('보낸 요청', 'font-medium text-sky-400') : cell('받은 요청', 'font-medium text-amber-400'),
    },
    { key: 'contract', header: '계약번호', width: '160px', render: (c) => cell(contractOf(c.contractId)?.no ?? '') },
    // 어느 기업인지만 — 요청한 쪽은 계약한 그 기업이라 따로 보이지 않는다. 내용은 줄을 눌러 안에서
    {
      key: 'company',
      header: '기업명',
      render: (c) => cell(contractOf(c.contractId)?.consumerCompanyName ?? '', 'text-white'),
    },
    {
      key: 'kind',
      header: '계약 유형',
      width: '100px',
      render: (c) => cell(contractOf(c.contractId) ? kindLabel(contractOf(c.contractId)!.kind) : ''),
    },
    {
      key: 'type',
      header: '변경 유형',
      width: '100px',
      render: (c) => cell(changeTypeLabel(c.type, contractOf(c.contractId)?.kind)),
    },
    {
      key: 'at',
      header: '요청일',
      width: '130px',
      sortable: true,
      sortValue: (c) => c.requestedAt,
      render: (c) => cellMuted(fmtDate(c.requestedAt)),
    },
    { key: 'status', header: '상태', width: '120px', render: (c) => <ChangeStatePill ch={c} /> },
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
        <StatCard label="올해 승인" value={`${stats.approved}건`} />
        <StatCard label="올해 반려" value={`${stats.rejected}건`} />
        <StatCard label="해지 완료 계약" value={`${stats.terminated}건`} />
      </StatsGrid>

      <SectionCard
        title="변경·해지 요청"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              구분
              <Select
                options={[
                  { value: 'all', label: '전체' },
                  { value: 'sent', label: '보낸 요청' },
                  { value: 'received', label: '받은 요청' },
                ]}
                value={side}
                onChange={(e) => setSide(e.target.value)}
                className="w-32"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select
                options={[{ value: 'all', label: '전체' }, ...CHANGE_STATES.map((s) => ({ value: s, label: s }))]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-32"
              />
            </label>
          </div>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          emptyMessage="변경·해지 요청 없음"
          onRowClick={(c) => router.push(`${base}/view?id=${c.id}`)}
        />
      </SectionCard>
      <ChangeRequestModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        contracts={active}
        requestedBy={role.party}
        requestedByName={role.companyName}
        onSubmitted={(id) => router.push(`${base}/view?id=${id}`)}
      />
    </div>
  );
}
