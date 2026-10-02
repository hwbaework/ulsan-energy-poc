'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, FileEdit } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { ChangeType, Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { KIND_OPTIONS, fmtKrw, fmtKw, fmtNum, fmtPrice, kindLabel } from './meta';
import { PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { ContractDetailModal } from './ContractDetailModal';
import { ChangeRequestModal } from './ChangeRequestModal';

const CURRENT_PERIOD = '2026-09';
const arrow = { key: 'go', header: '', width: '40px', render: () => <ChevronRight size={15} className="text-slate-600" /> };

/** 내 계약 — 체결되어 지금 운영 중인 계약만. 계약 상세에서 변경·해지 신청(요청 목록은 변경·해지 메뉴). 관리자는 전체 계약 */
export function MyContractsScreen() {
  const role = useTradingRole();
  const [kind, setKind] = useState('all');
  const [detail, setDetail] = useState<Contract | null>(null);
  const [change, setChange] = useState<{ open: boolean; contractId?: number; type?: ChangeType }>({ open: false });

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const settlements = useMemo(() => settlementsOf(active), [active]);
  const stats = useMemo(() => {
    const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
    const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    return {
      self: `${self.length}건 · ${fmtNum(kw(self), 2)} kW`,
      onsite: `${onsite.length}건 · ${fmtNum(kw(onsite), 2)} kW`,
      month: fmtKrw(settlements.filter((s) => s.period === CURRENT_PERIOD).reduce((s, x) => s + x.total, 0)),
      pending: role.changes.filter((c) => c.status === 'REQUESTED').length,
    };
  }, [active, settlements, role.changes]);

  const rows = useMemo(
    () => active.filter((c) => kind === 'all' || c.kind === kind).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [active, kind],
  );

  const columns: Column<Contract>[] = [
    { key: 'no', header: '계약번호', width: '130px', sortable: true, sortValue: (c) => c.no, render: (c) => cellStrong(c.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'plant', header: '발전소', render: (c) => cell(c.plantName, 'text-white') },
    { key: 'consumer', header: '수용가 · 사업장', render: (c) => cell(`${c.consumerCompanyName} · ${c.siteName}`) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '150px', render: (c: Contract) => cell(c.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', sortable: true, sortValue: (c) => c.capacityKw, render: (c) => cellNum(fmtKw(c.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (c) => cellNum(fmtPrice(c.unitPrice)) },
    { key: 'start', header: '시작일', width: '110px', sortable: true, sortValue: (c) => c.startDate, render: (c) => cellMuted(c.startDate) },
    { key: 'end', header: '종료일', width: '110px', render: (c) => cellMuted(c.endDate) },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="내 계약"
        actions={
          active.length > 0 && (
            <Button onClick={() => setChange({ open: true })}>
              <FileEdit size={16} className="mr-1" /> 변경·해지 신청
            </Button>
          )
        }
      />

      <StatsGrid columns={4}>
        <StatCard label="자가소비" value={stats.self} />
        <StatCard label="onsite" value={stats.onsite} />
        <StatCard label="이번 달 정산 예정" value={stats.month} />
        <StatCard label="변경 · 해지 처리 대기" value={`${stats.pending}건`} />
      </StatsGrid>

      <SectionCard
        title="운영 중 계약"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            계약 유형
            <Select options={[{ value: 'all', label: '전체' }, ...KIND_OPTIONS]} value={kind} onChange={(e) => setKind(e.target.value)} className="w-32" />
          </label>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} emptyMessage="운영 중 계약 없음" onRowClick={(c) => setDetail(c)} />
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
