'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusPill, type StatusTone } from '@/components/ui/Design';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsultationsByCompany } from '@/hooks/consulting/useConsultations';
import type { Consultation } from '@/types/consultation';

// 내 컨설팅 — 통합관제·전력거래와 같은 표 꼴(SectionCard + DataTable + 상태 셀렉트 + 검색). 새 컨설팅은 무료진단에서만 시작한다.

const DOMAIN_LABEL: Record<string, string> = {
  RE100: 'RE100',
  CARBON_REDUCTION: '탄소감축',
  DISTRIBUTED_ENERGY: '분산에너지',
};

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  APPLIED: { label: '신청', tone: 'muted' },
  ASSIGNED: { label: '접수', tone: 'warning' },
  SURVEYING: { label: '진행 중', tone: 'warning' },
  VISITING: { label: '진행 중', tone: 'warning' },
  DRAFTING: { label: '진행 중', tone: 'warning' },
  REVIEWING: { label: '검토 중', tone: 'warning' },
  COMPLETED: { label: '완료', tone: 'normal' },
  CANCELLED: { label: '취소', tone: 'muted' },
};
const STATUS_FILTER = [
  { value: 'all', label: '전체' },
  { value: 'APPLIED', label: '신청' },
  { value: 'ASSIGNED', label: '접수' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'REVIEWING', label: '검토 중' },
  { value: 'COMPLETED', label: '완료' },
];
const IN_PROGRESS = new Set(['SURVEYING', 'VISITING', 'DRAFTING']);

type Row = Consultation & { title: string };

const cell = (v: string, cls = 'text-slate-300') => <span className={`text-sm ${cls} whitespace-nowrap`}>{v}</span>;

export default function ConsultingStatusListPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;
  const { data, isLoading } = useConsultationsByCompany(companyId);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo<Row[]>(() => {
    const list = (Array.isArray(data) ? data : []) as Consultation[];
    const s = q.trim().toLowerCase();
    return list
      .filter((c) => c.status !== 'CANCELLED')
      .map((c) => ({ ...c, title: `${DOMAIN_LABEL[c.domain] ?? c.domain} 컨설팅` }))
      .filter((c) => status === 'all' || (status === 'IN_PROGRESS' ? IN_PROGRESS.has(c.status) : c.status === status))
      .filter((c) => !s || c.title.toLowerCase().includes(s))
      .sort((a, b) => String(b.appliedAt ?? b.createdAt).localeCompare(String(a.appliedAt ?? a.createdAt)));
  }, [data, status, q]);

  const columns: Column<Row>[] = [
    { key: 'title', header: '컨설팅', render: (c) => cell(c.title, 'font-medium text-white') },
    { key: 'domain', header: '분야', width: '110px', render: (c) => cell(DOMAIN_LABEL[c.domain] ?? c.domain) },
    { key: 'status', header: '상태', width: '100px', render: (c) => <StatusPill tone={STATUS_META[c.status]?.tone ?? 'muted'} label={STATUS_META[c.status]?.label ?? c.status} /> },
    { key: 'appliedAt', header: '신청일', width: '120px', sortable: true, sortValue: (c) => c.appliedAt ?? '', render: (c) => cell((c.appliedAt ?? c.createdAt ?? '').slice(0, 10) || '-', 'text-slate-400 tabular-nums') },
    { key: 'assignedAt', header: '접수일', width: '120px', render: (c) => cell(c.assignedAt ? c.assignedAt.slice(0, 10) : '-', 'text-slate-400 tabular-nums') },
    { key: 'completedAt', header: '완료일', width: '120px', render: (c) => cell(c.completedAt ? c.completedAt.slice(0, 10) : '-', 'text-slate-400 tabular-nums') },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (c) => (
        <Button size="sm" onClick={() => router.push(`/consulting/status/${c.id}`)}>
          상세
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '내 컨설팅' }]} />
      <h1 className="text-2xl font-bold text-white">내 컨설팅</h1>

      <SectionCard
        title="컨설팅"
        count={rows.length}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select options={STATUS_FILTER} value={status} onChange={(e) => setStatus(e.target.value)} className="w-32" />
            </label>
            <Input placeholder="컨설팅 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} loading={isLoading} emptyMessage="컨설팅 없음" onRowClick={(c) => router.push(`/consulting/status/${c.id}`)} />
      </SectionCard>
    </div>
  );
}
