'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { FINISHED, REQUEST_STATUS, fmtDate, kindLabel } from './meta';
import { PageHeader, RequestStatusPill, cell, cellMuted, cellNum } from './Bits';

type Row = TradeRequest & { contractNo?: string };

/** 거래 이력 — 끝난 거래를 어디(상대방)와 했는지 쭉 나열. 진행 중은 거래 신청. */
export function TradeHistoryScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [result, setResult] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo<Row[]>(() => {
    const s = q.trim().toLowerCase();
    return role.requests
      .filter((r) => FINISHED.includes(r.status))
      .map((r) => ({ ...r, contractNo: role.contracts.find((c) => c.id === r.contractId)?.no }))
      .filter((r) => result === 'all' || r.status === result)
      .filter((r) => !s || [r.consumerCompanyName, r.generatorCompanyName, r.siteName].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [role.requests, role.contracts, result, q]);

  const columns: Column<Row>[] = [
    { key: 'updatedAt', header: '일자', width: '120px', sortable: true, sortValue: (r) => r.updatedAt, render: (r) => cellMuted(fmtDate(r.updatedAt)) },
    {
      key: 'party',
      header: '거래 상대',
      render: (r) => cell(role.isAdmin ? `${r.generatorCompanyName} → ${r.consumerCompanyName}` : r.consumerCompanyName, 'font-medium text-white'),
    },
    { key: 'site', header: '사업장', render: (r) => cell(r.siteName) },
    { key: 'kind', header: '계약 유형', width: '110px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'status', header: '결과', width: '100px', render: (r) => <RequestStatusPill status={r.status} /> },
    { key: 'contract', header: '계약번호', width: '140px', render: (r) => (r.contractNo ? cellNum(r.contractNo) : cellMuted('-')) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 이력" />
      <SectionCard
        title="거래 이력"
        count={rows.length}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              결과
              <Select options={[{ value: 'all', label: '전체' }, ...FINISHED.map((s) => ({ value: s, label: REQUEST_STATUS[s].label }))]} value={result} onChange={(e) => setResult(e.target.value)} className="w-28" />
            </label>
            <Input placeholder="거래 상대 · 사업장 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="거래 이력 없음" onRowClick={(r) => router.push(`/trading/deal/${r.id}`)} />
      </SectionCard>
    </div>
  );
}
