'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { FINISHED, KIND_OPTIONS, REQUEST_STATUS, fmtDate, fmtKw, fmtNum, fmtPrice, kindLabel } from './meta';
import { PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';

type Row = TradeRequest & { contractNo?: string };

/** 거래 이력 — 끝난 신청(체결 · 반려 · 취소). 진행 중은 거래 신청. */
export function TradeHistoryScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [result, setResult] = useState('all');
  const [kind, setKind] = useState('all');
  const [year, setYear] = useState('all');
  const [q, setQ] = useState('');

  const finished = useMemo<Row[]>(
    () =>
      role.requests
        .filter((r) => FINISHED.includes(r.status))
        .map((r) => ({ ...r, contractNo: role.contracts.find((c) => c.id === r.contractId)?.no }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [role.requests, role.contracts],
  );
  const years = useMemo(() => Array.from(new Set(finished.map((r) => r.updatedAt.slice(0, 4)))).sort().reverse(), [finished]);
  const stats = useMemo(() => {
    const signed = finished.filter((r) => r.status === 'SIGNED');
    return {
      signed: signed.length,
      signedKw: signed.reduce((s, r) => s + r.capacityKw, 0),
      rejected: finished.filter((r) => r.status === 'REJECTED').length,
      cancelled: finished.filter((r) => r.status === 'CANCELLED').length,
    };
  }, [finished]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return finished
      .filter((r) => result === 'all' || r.status === result)
      .filter((r) => kind === 'all' || r.kind === kind)
      .filter((r) => year === 'all' || r.updatedAt.startsWith(year))
      .filter((r) => !s || [r.no, r.plantName, r.consumerCompanyName, r.generatorCompanyName, r.contractNo ?? ''].some((v) => v.toLowerCase().includes(s)));
  }, [finished, result, kind, year, q]);

  const columns: Column<Row>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'plant', header: '발전소(설비)', render: (r) => cell(r.plantName, 'text-white') },
    { key: 'consumer', header: '수용가 · 사업장', render: (r) => cell(`${r.consumerCompanyName} · ${r.siteName}`) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '140px', render: (r: Row) => cell(r.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', sortable: true, sortValue: (r) => r.capacityKw, render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'submittedAt', header: '신청일', width: '110px', sortable: true, sortValue: (r) => r.submittedAt, render: (r) => cellMuted(fmtDate(r.submittedAt)) },
    { key: 'updatedAt', header: '완료일', width: '110px', sortable: true, sortValue: (r) => r.updatedAt, render: (r) => cellMuted(fmtDate(r.updatedAt)) },
    { key: 'status', header: '결과', width: '80px', render: (r) => <RequestStatusPill status={r.status} /> },
    { key: 'contract', header: '계약번호', width: '130px', render: (r) => (r.contractNo ? cellNum(r.contractNo) : cellMuted('-')) },
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
      <PageHeader title="거래 이력" />

      <StatsGrid columns={4}>
        <StatCard label="체결" value={`${stats.signed}건`} sub={`${fmtNum(stats.signedKw, 2)} kW`} />
        <StatCard label="반려" value={`${stats.rejected}건`} />
        <StatCard label="취소" value={`${stats.cancelled}건`} />
        <StatCard label="전체 이력" value={`${finished.length}건`} />
      </StatsGrid>

      <SectionCard
        title="거래 이력"
        count={rows.length}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              결과
              <Select options={[{ value: 'all', label: '전체' }, ...FINISHED.map((s) => ({ value: s, label: REQUEST_STATUS[s].label }))]} value={result} onChange={(e) => setResult(e.target.value)} className="w-28" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약 유형
              <Select options={[{ value: 'all', label: '전체' }, ...KIND_OPTIONS]} value={kind} onChange={(e) => setKind(e.target.value)} className="w-32" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              연도
              <Select options={[{ value: 'all', label: '전체' }, ...years.map((y) => ({ value: y, label: `${y}년` }))]} value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
            </label>
            <Input placeholder="신청번호 · 발전소 · 계약번호 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="거래 이력 없음" onRowClick={(r) => router.push(`/trading/deal/${r.id}`)} />
      </SectionCard>
    </div>
  );
}
