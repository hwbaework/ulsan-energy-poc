'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { IN_PROGRESS, KIND_OPTIONS, REQUEST_STATUS, fmtDate, fmtKw, fmtPrice, kindLabel } from './meta';
import { PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { NewRequestModal } from './NewRequestModal';

/**
 * 거래 신청 — 진행 중(접수·검토 중·서명 대기) 신청 목록. 체결·반려·취소는 거래 이력.
 * 관리자는 전체 발전사업자의 신청, 발전사업자는 자기 신청만.
 */
export function TradeRequestsScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const inProgress = useMemo(() => role.requests.filter((r) => IN_PROGRESS.includes(r.status)), [role.requests]);
  const year = new Date().getFullYear();
  const stats = useMemo(
    () => ({
      total: inProgress.length,
      review: inProgress.filter((r) => r.status === 'SUBMITTED' || r.status === 'REVIEW').length,
      sign: inProgress.filter((r) => r.status === 'APPROVED').length,
      signedThisYear: role.requests.filter((r) => r.status === 'SIGNED' && r.updatedAt.startsWith(String(year))).length,
    }),
    [inProgress, role.requests, year],
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inProgress
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => kind === 'all' || r.kind === kind)
      .filter((r) => !s || [r.no, r.plantName, r.consumerCompanyName, r.siteName, r.generatorCompanyName].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [inProgress, status, kind, q]);

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', sortable: true, sortValue: (r) => r.no, render: (r) => cellStrong(r.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'plant', header: '발전소(설비)', render: (r) => cell(r.plantName, 'text-white') },
    { key: 'consumer', header: '수용가 · 사업장', render: (r) => cell(`${r.consumerCompanyName} · ${r.siteName}`) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '140px', render: (r: TradeRequest) => cell(r.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', sortable: true, sortValue: (r) => r.capacityKw, render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'term', header: '기간', width: '70px', render: (r) => cellNum(`${r.termYears}년`) },
    { key: 'submittedAt', header: '신청일', width: '110px', sortable: true, sortValue: (r) => r.submittedAt, render: (r) => cellMuted(fmtDate(r.submittedAt)) },
    { key: 'status', header: '상태', width: '90px', render: (r) => <RequestStatusPill status={r.status} /> },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (r) => (
        <Button size="sm" onClick={() => router.push(`/trading/deal/${r.id}`)}>
          상세
        </Button>
      ),
    },
  ];

  const statusOptions = [{ value: 'all', label: '전체' }, ...IN_PROGRESS.map((s) => ({ value: s, label: REQUEST_STATUS[s].label }))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="거래 신청"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} className="mr-1" /> 신청 등록
          </Button>
        }
      />

      <StatsGrid columns={4}>
        <StatCard label="진행 중 신청" value={`${stats.total}건`} />
        <StatCard label="접수 · 검토 중" value={`${stats.review}건`} sub="SPC 검토 단계" />
        <StatCard label="서명 대기" value={`${stats.sign}건`} sub="승인 완료 · 전자서명 진행" />
        <StatCard label={`${year}년 체결`} value={`${stats.signedThisYear}건`} sub="거래 이력에서 확인" />
      </StatsGrid>

      <SectionCard
        title="진행 중 신청"
        count={rows.length}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} className="w-32" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약 유형
              <Select options={[{ value: 'all', label: '전체' }, ...KIND_OPTIONS]} value={kind} onChange={(e) => setKind(e.target.value)} className="w-32" />
            </label>
            <Input placeholder="신청번호 · 발전소 · 수용가 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="진행 중인 신청 없음" onRowClick={(r) => router.push(`/trading/deal/${r.id}`)} />
      </SectionCard>

      <NewRequestModal open={open} onClose={() => setOpen(false)} isAdmin={role.isAdmin} companyId={role.companyId} companyName={role.companyName} onSubmitted={(id) => router.push(`/trading/deal/${id}`)} />
    </div>
  );
}
