'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Star,
  Briefcase,
  Phone,
  MapPin,
  FileText,
  Plus,
  TrendingUp,
  Mail,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAgency } from '@/hooks/consulting/useAgency';
import { useCreateInvitation, useInvitations } from '@/hooks/platform/useInvitations';
import { useUsers } from '@/hooks/platform/useUsers';
import { useRoles } from '@/hooks/platform/useRoles';
import { useMe } from '@/hooks/auth/useAuth';
import { useToastStore } from '@/stores/useToastStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Agency {
  id: number;
  name: string;
  representative: string;
  businessNumber: string;
  phone: string;
  address: string;
  specializations: string[];
  completedProjects: number;
  activeProjects: number;
  rating: number;
  consultantCount: number;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  contractedAt: string;
}

interface Consultant {
  id: number;
  name: string;
  specializations: string[];
  rating: number;
  activeProjects: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Project {
  id: number;
  name: string;
  targetCustomer: string;
  assignee: string;
  phase: string;
  progress: number;
  deadline: string;
}

interface Settlement {
  id: string;
  milestone: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  date: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

const SETTLEMENT_STATUS_MAP = {
  PENDING: { variant: 'info' as const, label: '검수 대기' },
  APPROVED: { variant: 'warning' as const, label: '승인/미지급' },
  PAID: { variant: 'success' as const, label: '지급 완료' },
};

/* ------------------------------------------------------------------ */
/*  Tabs definition                                                    */
/* ------------------------------------------------------------------ */

const TAB_LIST = [
  { id: 'consultants', label: '소속 컨설턴트' },
  { id: 'projects', label: '프로젝트 현황' },
  { id: 'settlements', label: '정산 내역' },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AgencyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('consultants');
  const [addConsultantOpen, setAddConsultantOpen] = useState(false);

  const agencyId = Number(params.id);
  const { data: apiAgency, isError } = useAgency(agencyId);
  const { data: me } = useMe();
  const createInvitation = useCreateInvitation();
  const addToast = useToastStore((s) => s.add);

  // 소속 컨설턴트 조회 (agencyId로 필터)
  const { data: usersData } = useUsers({ size: 100 });
  const agencyConsultants: Consultant[] = ((usersData as any)?.content ?? [])
    .filter((u: any) => u.agencyId === agencyId && u.roles?.some((r: string) => r === 'CONSULTANT'))
    .map((u: any) => ({
      id: u.id,
      name: u.name ?? '',
      specializations: [],
      rating: 0,
      activeProjects: 0,
      status: u.isActive ? ('ACTIVE' as const) : ('INACTIVE' as const),
    }));

  // 이 용역사에 보낸 초대 목록
  const { data: invitationsData } = useInvitations();
  const agencyInvitations = ((invitationsData as any)?.content ?? []).filter(
    (i: any) => i.companyId === (apiAgency as any)?.companyId && i.status === 'PENDING',
  );

  // 역할 목록에서 컨설턴트 roleId 추출
  const { data: rolesData } = useRoles();
  const consultantRoleId =
    (Array.isArray(rolesData) ? rolesData : []).find((r: any) => r.name === 'CONSULTANT')?.id ?? 0;

  // 추가 모달 폼
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addSpec, setAddSpec] = useState('');
  const addValid = addEmail.trim() && addName.trim();

  const handleAddConsultant = () => {
    if (!addValid || !consultantRoleId || !me?.id) return;
    const companyId = (apiAgency as any)?.companyId;
    if (!companyId) {
      addToast('error', '용역사 기업 정보를 확인할 수 없습니다');
      return;
    }
    createInvitation.mutate(
      { data: { companyId, email: addEmail.trim(), roleId: consultantRoleId }, invitedById: me.id },
      {
        onSuccess: () => {
          addToast('success', `${addName}(${addEmail})에게 초대 메일이 발송되었습니다`);
          setAddConsultantOpen(false);
          setAddName('');
          setAddEmail('');
          setAddPhone('');
          setAddSpec('');
        },
        onError: () => addToast('error', '초대 발송에 실패했습니다'),
      },
    );
  };

  const agency: Agency =
    !isError && apiAgency
      ? {
          id: apiAgency.id,
          name: (apiAgency as any).companyName ?? (apiAgency as any).name ?? '',
          representative: (apiAgency as any).representative ?? '',
          businessNumber: (apiAgency as any).businessNumber ?? '',
          phone: (apiAgency as any).phone ?? '',
          address: (apiAgency as any).address ?? '',
          specializations: parseSpecs((apiAgency as any).specializations),
          completedProjects: (apiAgency as any).completedProjects ?? 0,
          activeProjects: (apiAgency as any).activeProjects ?? 0,
          rating: (apiAgency as any).rating ?? 0,
          consultantCount: (apiAgency as any).consultantCount ?? 0,
          status: (apiAgency as any).status ?? 'ACTIVE',
          contractedAt: (apiAgency as any).contractedAt ?? '',
        }
      : {
          id: agencyId,
          name: '',
          representative: '',
          businessNumber: '',
          phone: '',
          address: '',
          specializations: [],
          completedProjects: 0,
          activeProjects: 0,
          rating: 0,
          consultantCount: 0,
          status: 'ACTIVE',
          contractedAt: '',
        };

  /* ---- Consultant columns ---- */
  const consultantColumns: Column<Consultant>[] = [
    {
      key: 'name',
      header: '이름',
      width: '140px',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
            {row.name.charAt(0)}
          </div>
          <span className="text-sm font-medium text-white">{row.name}</span>
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
      key: 'activeProjects',
      header: '진행 프로젝트',
      width: '110px',
      align: 'center',
      render: (row) => <span className="text-sm text-slate-300 tabular-nums">{row.activeProjects}건</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'danger'}>
          {row.status === 'ACTIVE' ? '활동중' : '비활동'}
        </Badge>
      ),
    },
  ];

  /* ---- Project columns ---- */
  const projectColumns: Column<Project>[] = [
    {
      key: 'name',
      header: '프로젝트명',
      width: '240px',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Briefcase size={14} className="text-emerald-400" />
          </div>
          <span className="text-sm font-medium text-white">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'targetCustomer',
      header: '대상 고객',
      render: (row) => <span className="text-sm text-slate-300">{row.targetCustomer}</span>,
    },
    {
      key: 'assignee',
      header: '담당자',
      width: '100px',
      render: (row) => <span className="text-sm text-slate-300">{row.assignee}</span>,
    },
    {
      key: 'phase',
      header: '단계',
      width: '100px',
      render: (row) => <Badge variant="info">{row.phase}</Badge>,
    },
    {
      key: 'progress',
      header: '진행률',
      width: '140px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
          </div>
          <span className="text-xs text-slate-400 tabular-nums">{row.progress}%</span>
        </div>
      ),
    },
    {
      key: 'deadline',
      header: '마감일',
      width: '110px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.deadline}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: '통합에너지 컨설팅', path: '/consulting' },
            { label: '용역사 관리', path: '/consulting/agencies' },
            { label: agency.name },
          ]}
        />
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push('/consulting/agencies')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        용역사 목록으로
      </button>

      {/* Agency header card */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-lg font-bold text-blue-400">
              {agency.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{agency.name}</h1>
                <Badge
                  variant={agency.status === 'ACTIVE' ? 'success' : agency.status === 'PENDING' ? 'warning' : 'danger'}
                >
                  {agency.status === 'ACTIVE' ? '활성' : agency.status === 'PENDING' ? '심사중' : '정지'}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> {agency.representative}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText size={14} /> {agency.businessNumber}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone size={14} /> {agency.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> {agency.address}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {agency.specializations.map((s) => (
                  <span
                    key={s}
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ring-1 ${SPEC_COLORS[s] ?? 'bg-white/5 text-slate-400 ring-white/10'}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<Users size={16} className="text-blue-400" />}
          label="소속 컨설턴트"
          value={`${agency.consultantCount}명`}
        />
        <StatCard
          icon={<TrendingUp size={16} className="text-emerald-400" />}
          label="진행 프로젝트"
          value={agency.activeProjects}
        />
        <StatCard
          icon={<Briefcase size={16} className="text-violet-400" />}
          label="완료 프로젝트"
          value={agency.completedProjects}
        />
        <StatCard icon={<Star size={16} className="text-amber-400" />} label="평균 평점" value={agency.rating} />
      </StatsGrid>

      {/* Tabs */}
      <Tabs tabs={TAB_LIST} activeId={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'consultants' && (
        <>
          <SectionCard
            title={`소속 컨설턴트 ${agencyConsultants.length}명`}
            actions={
              <Button size="sm" onClick={() => setAddConsultantOpen(true)}>
                <Plus size={14} className="mr-1.5" /> 컨설턴트 초대
              </Button>
            }
          >
            <DataTable
              columns={consultantColumns}
              data={agencyConsultants}
              rowKey={(row) => row.id}
              emptyMessage="소속된 컨설턴트가 없습니다. 컨설턴트를 초대해 주세요."
            />
          </SectionCard>

          {agencyInvitations.length > 0 && (
            <SectionCard title={`초대 대기 ${agencyInvitations.length}건`}>
              <div className="divide-y divide-white/[0.04]">
                {agencyInvitations.map((inv: any) => (
                  <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30">
                      <Mail size={14} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{inv.email}</p>
                      <p className="text-[11px] text-slate-500">
                        발송: {inv.createdAt?.split('T')[0]} · 만료: {inv.expiresAt?.split('T')[0]}
                      </p>
                    </div>
                    <Badge variant="warning">
                      <Clock size={9} className="mr-1" />
                      수락 대기
                    </Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {activeTab === 'projects' && (
        <SectionCard title="프로젝트 현황">
          <DataTable
            columns={projectColumns}
            data={[]}
            rowKey={(row) => row.id}
            emptyMessage="진행 중인 프로젝트가 없습니다"
          />
        </SectionCard>
      )}

      {activeTab === 'settlements' && (
        <SectionCard title="정산 내역">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                <tr>
                  <th className="px-6 py-3 font-medium">정산번호</th>
                  <th className="px-6 py-3 font-medium">마일스톤</th>
                  <th className="px-6 py-3 font-medium">금액</th>
                  <th className="px-6 py-3 font-medium">상태</th>
                  <th className="px-6 py-3 font-medium">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {([] as Settlement[]).map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3 text-slate-300 tabular-nums">{s.id}</td>
                    <td className="px-6 py-3 text-white">{s.milestone}</td>
                    <td className="px-6 py-3 text-white tabular-nums">₩ {s.amount.toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <Badge variant={SETTLEMENT_STATUS_MAP[s.status].variant}>
                        {SETTLEMENT_STATUS_MAP[s.status].label}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-slate-500 tabular-nums">{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
      {/* 컨설턴트 초대 모달 */}
      <Modal
        open={addConsultantOpen}
        onClose={() => setAddConsultantOpen(false)}
        title="컨설턴트 초대"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddConsultantOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddConsultant} disabled={!addValid || createInvitation.isPending}>
              <Mail size={14} className="mr-1.5" />
              {createInvitation.isPending ? '발송 중...' : '초대 메일 발송'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            {agency.name}에 소속될 컨설턴트를 초대합니다. 초대 메일을 통해 가입하면 자동으로 소속 컨설턴트로 등록됩니다.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="이름"
              placeholder="홍길동"
              required
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
            <Input
              label="이메일"
              type="email"
              placeholder="name@company.com"
              required
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="연락처 (참고용)"
              placeholder="010-0000-0000"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
            />
            <Select
              label="주요 전문분야"
              placeholder="선택"
              value={addSpec}
              onChange={(e) => setAddSpec(e.target.value)}
              options={[
                { value: 'PPA', label: 'PPA 계약' },
                { value: 'RE100', label: 'RE100 이행' },
                { value: 'CBAM', label: 'CBAM 대응' },
                { value: '분산에너지', label: '분산에너지' },
                { value: '탄소감축', label: '탄소감축' },
              ]}
            />
          </div>
          <div className="rounded-lg bg-blue-500/[0.06] ring-1 ring-blue-500/20 px-3 py-2.5 text-[11px] text-blue-300 space-y-1">
            <p className="font-semibold text-blue-200">초대 프로세스</p>
            <p>1. 입력한 이메일로 초대 메일이 발송됩니다.</p>
            <p>2. 컨설턴트가 초대 링크를 통해 가입하면 {agency.name} 소속으로 자동 등록됩니다.</p>
            <p>3. 소속 컨설턴트는 정산/제안 관리 없이 컨설팅 업무만 수행합니다.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
