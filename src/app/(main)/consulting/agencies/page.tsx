'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, Star, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAgencies } from '@/hooks/consulting/useAgency';

interface Agency {
  id: number;
  name: string;
  representative: string;
  businessNumber: string;
  phone: string;
  specializations: string[];
  completedProjects: number;
  activeProjects: number;
  rating: number;
  consultantCount: number;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  contractedAt: string;
}

function parseSpecs(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

const SPEC_COLORS: Record<string, string> = {
  PPA: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  RE100: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  탄소감축: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  분산에너지: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  CBAM: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
};

export default function AgenciesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const { data: apiData, isError } = useAgencies();
  const agencies: Agency[] =
    !isError && apiData?.content
      ? apiData.content.map((a: any) => ({
          id: a.id,
          name: a.companyName ?? a.name ?? '',
          representative: a.representative ?? '',
          businessNumber: a.businessNumber ?? '',
          phone: a.phone ?? '',
          specializations: parseSpecs(a.specializations),
          completedProjects: a.completedProjects ?? 0,
          activeProjects: a.activeProjects ?? 0,
          rating: a.rating ?? 0,
          consultantCount: a.consultantCount ?? 0,
          status: a.status ?? 'ACTIVE',
          contractedAt: a.contractedAt ?? a.createdAt ?? '',
        }))
      : [];

  const filtered = agencies.filter((a) => a.name.includes(search) || a.representative.includes(search));

  const activeCount = agencies.filter((a) => a.status === 'ACTIVE').length;
  const totalConsultants = agencies.reduce((s, a) => s + a.consultantCount, 0);
  const totalCompleted = agencies.reduce((s, a) => s + a.completedProjects, 0);

  const columns: Column<Agency>[] = [
    {
      key: 'name',
      header: '용역사명',
      width: '220px',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-400">
            {row.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{row.name}</p>
            <p className="text-xs text-slate-500">{row.businessNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'specializations',
      header: '전문분야',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.specializations.map((s) => (
            <span
              key={s}
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] ring-1 ${SPEC_COLORS[s] ?? 'bg-white/5 text-slate-400 ring-white/10'}`}
            >
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'rating',
      header: '평점',
      width: '80px',
      align: 'center',
      render: (row) => (
        <span className="flex items-center justify-center gap-1 text-sm text-amber-400">
          <Star size={12} className="fill-amber-400" /> {row.rating}
        </span>
      ),
    },
    {
      key: 'completedProjects',
      header: '완료/진행',
      width: '100px',
      align: 'center',
      render: (row) => (
        <div className="text-center">
          <span className="text-sm text-slate-300 tabular-nums">{row.completedProjects}</span>
          <span className="text-slate-500 mx-1">/</span>
          <span className="text-sm text-primary tabular-nums">{row.activeProjects}</span>
        </div>
      ),
    },
    {
      key: 'consultantCount',
      header: '인원',
      width: '70px',
      align: 'center',
      render: (row) => <span className="text-sm text-slate-300 tabular-nums">{row.consultantCount}명</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'PENDING' ? 'warning' : 'danger'}>
          {row.status === 'ACTIVE' ? '활성' : row.status === 'PENDING' ? '심사중' : '정지'}
        </Badge>
      ),
    },
    {
      key: 'contractedAt',
      header: '계약일',
      width: '110px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.contractedAt}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '용역사 관리' }]} />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">용역사 관리</h1>
          <p className="mt-1 text-sm text-slate-400">계약된 컨설팅 용역사를 관리합니다</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5" /> 용역사 등록
        </Button>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<Building2 size={16} className="text-blue-400" />}
          label="전체 용역사"
          value={agencies.length}
        />
        <StatCard icon={<Briefcase size={16} className="text-emerald-400" />} label="활성 용역사" value={activeCount} />
        <StatCard label="총 컨설턴트" value={`${totalConsultants}명`} />
        <StatCard label="누적 완료 프로젝트" value={totalCompleted} />
      </StatsGrid>

      <div className="w-72">
        <Input placeholder="용역사명 또는 대표자 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <SectionCard title="">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/consulting/agencies/${row.id}`)}
          emptyMessage="등록된 용역사가 없습니다"
        />
      </SectionCard>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="용역사 등록" size="md">
        <div className="space-y-4">
          <Input label="용역사명" placeholder="에너지컨설팅(주)" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="사업자등록번호" placeholder="000-00-00000" required />
            <Input label="대표자명" placeholder="홍길동" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="연락처" placeholder="02-0000-0000" />
            <Select
              label="주요 전문분야"
              placeholder="선택"
              options={[
                { value: 'PPA', label: 'PPA 계약' },
                { value: 'RE100', label: 'RE100 이행' },
                { value: 'CBAM', label: 'CBAM 대응' },
              ]}
            />
          </div>
          <Input label="주소" placeholder="서울특별시 강남구" />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setAddOpen(false)}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
