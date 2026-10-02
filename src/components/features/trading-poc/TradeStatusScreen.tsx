'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Select } from '@/components/ui/Select';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { IN_PROGRESS, REQUEST_STATUS, fmtDate, fmtKw, fmtPrice, kindLabel } from './meta';
import { PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { DealDetailModal } from './DealDetailModal';

const FILTER = [
  { value: 'progress', label: '진행 중' },
  { value: 'all', label: '전체' },
  ...(Object.keys(REQUEST_STATUS) as TradeRequest['status'][]).map((s) => ({ value: s, label: REQUEST_STATUS[s].label })),
];

/** 거래 현황 — 내가 신청한 거래가 어디까지 왔는지. 행을 누르면 같은 화면에서 상세 */
export function TradeStatusScreen() {
  const role = useTradingRole();
  const [status, setStatus] = useState('progress');
  const [detail, setDetail] = useState<number | null>(null);

  const sorted = useMemo(() => [...role.requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [role.requests]);
  const rows = useMemo(
    () => sorted.filter((r) => (status === 'progress' ? IN_PROGRESS.includes(r.status) : status === 'all' || r.status === status)),
    [sorted, status],
  );
  const stats = {
    review: sorted.filter((r) => r.status === 'SUBMITTED' || r.status === 'REVIEW').length,
    sign: sorted.filter((r) => r.status === 'APPROVED').length,
    signed: sorted.filter((r) => r.status === 'SIGNED').length,
    closed: sorted.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  };

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'consumer', header: '수용가', width: '140px', render: (r) => cell(r.consumerCompanyName, 'text-white') },
    { key: 'site', header: '사업장', render: (r) => cell(r.siteName) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '150px', render: (r: TradeRequest) => cell(r.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'submittedAt', header: '신청일', width: '110px', sortable: true, sortValue: (r) => r.submittedAt, render: (r) => cellMuted(fmtDate(r.submittedAt)) },
    { key: 'status', header: '상태', width: '100px', render: (r) => <RequestStatusPill status={r.status} /> },
    { key: 'go', header: '', width: '40px', render: () => <ChevronRight size={15} className="text-slate-600" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 현황" />

      <StatsGrid columns={4}>
        <StatCard label="접수 · 검토 중" value={`${stats.review}건`} />
        <StatCard label="서명 대기" value={`${stats.sign}건`} />
        <StatCard label="체결" value={`${stats.signed}건`} />
        <StatCard label="반려 · 취소" value={`${stats.closed}건`} />
      </StatsGrid>

      <SectionCard
        title="신청"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select options={FILTER} value={status} onChange={(e) => setStatus(e.target.value)} className="w-32" />
          </label>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="신청 없음" onRowClick={(r) => setDetail(r.id)} />
      </SectionCard>

      <DealDetailModal requestId={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
