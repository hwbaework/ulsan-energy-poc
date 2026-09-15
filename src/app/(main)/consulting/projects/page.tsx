'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Briefcase, CalendarClock, DollarSign, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { FilterBar, type FilterField } from '@/components/features/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useConsultations } from '@/hooks/consulting/useConsultations';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConsultingProject {
  id: number;
  name: string;
  origin: 'outsource';
  agencyName: string;
  assigneeName: string;
  targetCustomer: string;
  currentPhase: string;
  progress: number;
  status: string;
  deadline: string;
  contractAmount: number;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' | 'default' | 'info' }
> = {
  APPLIED: { label: '신청', variant: 'info' },
  ASSIGNED: { label: '배정완료', variant: 'primary' },
  SURVEYING: { label: '설문조사', variant: 'primary' },
  VISITING: { label: '현장방문', variant: 'primary' },
  DRAFTING: { label: '보고서 작성', variant: 'warning' },
  IN_PROGRESS: { label: '진행중', variant: 'primary' },
  REVIEWING: { label: '검수 대기', variant: 'warning' },
  COMPLETED: { label: '완료', variant: 'success' },
  ON_HOLD: { label: '보류', variant: 'default' },
  CANCELLED: { label: '취소', variant: 'danger' },
};

const DEFAULT_STATUS = { label: '알 수 없음', variant: 'default' as const };

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Filter fields                                                      */
/* ------------------------------------------------------------------ */

const AGENCY_OPTIONS = [
  { value: '', label: '전체' },
  ...Array.from(new Set(([] as ConsultingProject[]).map((p) => p.agencyName))).map((name) => ({
    value: name,
    label: name,
  })),
];

const FILTER_FIELDS: FilterField[] = [
  { key: 'search', label: '프로젝트 검색', type: 'text', placeholder: '프로젝트명 또는 대상 수용가 검색' },
  {
    key: 'status',
    label: '상태',
    type: 'select',
    placeholder: '전체',
    options: [
      { value: '', label: '전체' },
      { value: 'IN_PROGRESS', label: '진행중' },
      { value: 'REVIEWING', label: '검수 대기' },
      { value: 'COMPLETED', label: '완료' },
      { value: 'ON_HOLD', label: '보류' },
    ],
  },
  {
    key: 'agency',
    label: '용역사',
    type: 'select',
    placeholder: '전체',
    options: AGENCY_OPTIONS,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${(value / 10000).toLocaleString()}만`;
  return value.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ConsultingProjectsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>({ search: '', status: '', agency: '' });

  const { data: apiData, isError } = useConsultations();

  const STATUS_PROGRESS: Record<string, number> = {
    APPLIED: 5,
    ASSIGNED: 15,
    SURVEYING: 30,
    VISITING: 50,
    DRAFTING: 65,
    REVIEWING: 80,
    COMPLETED: 100,
    CANCELLED: 0,
  };

  const projects: ConsultingProject[] =
    !isError && apiData?.content
      ? apiData.content.map((c: any) => ({
          id: c.id,
          name: `${c.domain} 컨설팅`,
          origin: 'outsource' as const,
          agencyName: c.agencyName ?? '',
          assigneeName: c.consultantName ?? '미배정',
          targetCustomer: c.clientCompanyName ?? '',
          currentPhase: STATUS_MAP[c.status]?.label ?? c.status,
          progress: STATUS_PROGRESS[c.status] ?? 0,
          status: c.status ?? 'APPLIED',
          deadline: c.completedAt ? new Date(c.completedAt).toLocaleDateString('ko-KR') : '',
          contractAmount: c.contractAmount ?? 0,
        }))
      : [];

  const filtered = projects.filter((p) => {
    if (filters.search && !p.name.includes(filters.search) && !p.targetCustomer.includes(filters.search)) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.agency && p.agencyName !== filters.agency) return false;
    return true;
  });

  const inProgressCount = projects.filter((p) => p.status === 'IN_PROGRESS').length;
  const reviewingCount = projects.filter((p) => p.status === 'REVIEWING').length;
  const totalAmount = projects.reduce((sum, p) => sum + p.contractAmount, 0);

  /* ---- Columns ---- */

  const columns: Column<ConsultingProject>[] = [
    {
      key: 'name',
      header: '프로젝트명',
      width: '220px',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Briefcase size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{row.name}</p>
            <p className="text-xs text-slate-500">{row.targetCustomer}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'agency',
      header: '용역사 / 담당자',
      width: '160px',
      render: (row) => (
        <div>
          <p className="text-sm text-slate-300">{row.agencyName}</p>
          <p className="text-xs text-slate-500">{row.assigneeName}</p>
        </div>
      ),
    },
    {
      key: 'targetCustomer',
      header: '대상 수용가',
      render: (row) => <span className="text-sm text-slate-300">{row.targetCustomer}</span>,
    },
    {
      key: 'currentPhase',
      header: '현재 단계',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-300">{row.currentPhase}</span>,
    },
    {
      key: 'progress',
      header: '진행률',
      width: '130px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
          </div>
          <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{row.progress}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: '100px',
      render: (row) => {
        const s = STATUS_MAP[row.status] ?? DEFAULT_STATUS;
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'deadline',
      header: '마감일',
      width: '110px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.deadline}</span>,
    },
  ];

  /* ---- Render ---- */

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '프로젝트 관리' }]} />
      </div>
      <PageHeader
        title="용역 프로젝트 관리"
        description="SPC 컨설팅 용역 프로젝트를 관리합니다"
        actions={
          <Button size="sm" onClick={() => router.push('/consulting/projects/new')}>
            <Plus size={14} className="mr-1.5" /> 새 프로젝트
          </Button>
        }
      />

      <StatsGrid columns={4}>
        <StatCard icon={<Briefcase size={18} />} label="전체 프로젝트" value={projects.length} />
        <StatCard
          icon={<CalendarClock size={18} />}
          label="진행중"
          value={inProgressCount}
          change={{ value: inProgressCount, label: '진행중' }}
        />
        <StatCard icon={<ClipboardCheck size={18} />} label="검수 대기" value={reviewingCount} />
        <StatCard icon={<DollarSign size={18} />} label="총 계약 금액" value={`${formatCurrency(totalAmount)}원`} />
      </StatsGrid>

      <FilterBar
        fields={FILTER_FIELDS}
        onSearch={(values) => setFilters(values)}
        onReset={() => setFilters({ search: '', status: '', agency: '' })}
      />

      <SectionCard title="">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/consulting/project/${row.id}?origin=outsource`)}
          emptyMessage="등록된 용역 프로젝트가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
