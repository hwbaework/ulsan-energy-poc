'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features';
import { StatusPill } from '@/components/ui/Design';
import { CONTRACT_KIND, commStatusOf, sourceOf } from '@/lib/design';
import { expandByContract } from '@/lib/contract-plants';
import type { MonitoringPlant, PlantContractKind } from '@/types/monitoring';

/**
 * 전체 상태 — 발전소(계약) 전부를 한 줄씩, 정상까지 보여준다.
 * 상태 = 통신 상태(정상/통신오류). 아직 복구되지 않은 통신오류 건이 있으면 통신오류.
 * RTU 끊김은 발전소 전체(계약 줄 전부), 인버터 끊김은 그 계약 줄에만.
 * 마지막 수신 = 통신오류 중이면 끊긴 시각, 아니면 인버터 마지막 수신 시각 중 가장 늦은 것.
 */
export interface CommOutage {
  plantId: number;
  contractKind?: PlantContractKind;
  title: string;
  detectedAt: string;
  resolvedAt?: string | null;
}

interface Row {
  key: string;
  type: string;
  name: string;
  contractKind?: PlantContractKind;
  status: string;
  lastAt: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function PlantCommStatusTable({ plants, outages }: { plants: MonitoringPlant[]; outages: CommOutage[] }) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const rows: Row[] = useMemo(
    () =>
      expandByContract(plants).map((p) => {
        const ongoing = outages
          .filter((o) => o.plantId === p.plantId && !o.resolvedAt)
          .filter((o) => o.title.includes('RTU') || !o.contractKind || !p.contractKind || o.contractKind === p.contractKind)
          .map((o) => new Date(o.detectedAt).getTime())
          .filter(Number.isFinite);
        const received = (p.inverters ?? []).map((i) => new Date(i.lastDataAt).getTime()).filter(Number.isFinite);
        return {
          key: p.key,
          type: p.type,
          name: p.displayName,
          contractKind: p.contractKind,
          status: ongoing.length ? 'COMM_ERROR' : 'NORMAL',
          lastAt: ongoing.length ? Math.min(...ongoing) : received.length ? Math.max(...received) : null,
        };
      }),
    [plants, outages],
  );

  // 필터 항목 = 데이터에 실제 있는 값만
  const statusOptions = useMemo(() => {
    const codes = [...new Set(rows.map((r) => r.status))].sort((x, y) => commStatusOf(x).order - commStatusOf(y).order);
    return [{ value: 'all', label: '전체 상태' }, ...codes.map((c) => ({ value: c, label: commStatusOf(c).label }))];
  }, [rows]);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => (status === 'all' || r.status === status) && (!q || r.name.toLowerCase().includes(q)),
  );

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: '발전소',
      render: (r) => <span className="text-sm font-medium text-white truncate block">{r.name}</span>,
    },
    {
      key: 'type',
      header: '설비',
      width: '110px',
      render: (r) => <span className="text-sm text-slate-300">{sourceOf(r.type).label}</span>,
    },
    {
      key: 'contractKind',
      header: '계약 유형',
      width: '120px',
      render: (r) => <span className="text-sm text-slate-300">{r.contractKind ? CONTRACT_KIND[r.contractKind].label : '-'}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '110px',
      sortable: true,
      sortValue: (r) => commStatusOf(r.status).order,
      render: (r) => {
        const s = commStatusOf(r.status);
        return <StatusPill tone={s.tone} label={s.label} />;
      },
    },
    {
      key: 'lastAt',
      header: '마지막 수신',
      width: '180px',
      sortable: true,
      sortValue: (r) => r.lastAt ?? 0,
      render: (r) => <span className="text-sm tabular-nums text-slate-300 whitespace-nowrap">{r.lastAt ? fmt(r.lastAt) : '-'}</span>,
    },
  ];

  return (
    <SectionCard
      title="전체 상태"
      actions={
        <div className="flex items-center gap-3">
          <div className="w-32">
            <Select options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="relative w-64">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="발전소 검색" className="pl-8" />
          </div>
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.key}
        defaultSort={{ key: 'status', direction: 'asc' }}
        emptyMessage={q || status !== 'all' ? '검색 결과가 없습니다' : '발전소가 없습니다'}
      />
    </SectionCard>
  );
}
