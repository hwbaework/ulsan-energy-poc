'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  FileText,
  Users,
  Zap,
  Edit3,
  Briefcase,
  FolderKanban,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SectionCard, StatCard, StatsGrid } from '@/components/features';
import { usePersonaOverride, getPersona, type Persona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useCompany, useUpdateCompany } from '@/hooks/platform/useCompanies';

const STATS_META_BY_PERSONA: Record<Persona, { icon: React.ReactNode; label: string }[]> = {
  generator: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 멤버' },
    { icon: <Zap size={18} className="text-amber-400" />, label: '등록 발전소' },
  ],
  consumer: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 멤버' },
    { icon: <Briefcase size={18} className="text-amber-400" />, label: '등록 사업장' },
  ],
  consultant: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 멤버' },
    { icon: <FolderKanban size={18} className="text-amber-400" />, label: '진행 프로젝트' },
  ],
  spc: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 멤버' },
    { icon: <Package size={18} className="text-amber-400" />, label: 'PPA 계약' },
  ],
  admin: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 멤버' },
    { icon: <ShieldCheck size={18} className="text-amber-400" />, label: '등록 기업' },
  ],
  operator: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 멤버' },
    { icon: <Zap size={18} className="text-amber-400" />, label: '담당 발전소' },
  ],
  agency: [
    { icon: <Users size={18} className="text-blue-400" />, label: '소속 컨설턴트' },
    { icon: <FolderKanban size={18} className="text-amber-400" />, label: '진행 프로젝트' },
  ],
};

function statusLabel(status?: string): string {
  if (!status) return '-';
  return status === 'ACTIVE' ? '활성' : status === 'SUSPENDED' ? '정지' : status;
}

export default function OrgInfoPage() {
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', representativeName: '', phone: '', address: '' });
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const addToast = useToastStore((s) => s.add);

  const companyId = user?.companyId ?? 0;
  const { data: company, isLoading } = useCompany(companyId);
  const updateCompany = useUpdateCompany();

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? '',
        representativeName: company.representativeName ?? '',
        phone: company.phone ?? '',
        address: company.address ?? '',
      });
    }
  }, [company]);

  const statsMeta = STATS_META_BY_PERSONA[persona];

  const handleSave = () => {
    if (!companyId) return;
    updateCompany.mutate(
      { id: companyId, data: form },
      {
        onSuccess: () => {
          addToast('success', '기업 정보를 저장했습니다');
          setEditOpen(false);
        },
        onError: () => addToast('error', '기업 정보 저장에 실패했습니다'),
      },
    );
  };

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-white">기업 정보</h1>
        <p className="mt-1 text-sm text-slate-400">기업 기본 정보를 확인하고 관리합니다</p>
      </div>

      <StatsGrid columns={3}>
        {statsMeta.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value="-" />
        ))}
        <StatCard
          icon={<Building2 size={18} className="text-emerald-400" />}
          label="기업 상태"
          value={statusLabel(company?.status)}
        />
      </StatsGrid>

      <SectionCard
        title="기업 상세"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)} disabled={!company}>
            <Edit3 size={14} className="mr-1.5" /> 수정
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-5">
          <InfoField
            icon={<Building2 size={14} />}
            label="기업명"
            value={company?.name ?? (isLoading ? '불러오는 중…' : '-')}
          />
          <InfoField icon={<FileText size={14} />} label="사업자등록번호" value={company?.businessNumber ?? '-'} />
          <InfoField label="대표자" value={company?.representativeName ?? '-'} />
          <InfoField icon={<Phone size={14} />} label="연락처" value={company?.phone ?? '-'} />
          <InfoField icon={<MapPin size={14} />} label="주소" value={company?.address ?? '-'} span />
          <InfoField label="이메일" value={company?.email ?? '-'} />
          <InfoField label="설립일" value={company?.createdAt?.split('T')[0] ?? '-'} />
          <InfoField label="상태">
            <Badge
              variant={company?.status === 'ACTIVE' ? 'success' : company?.status === 'SUSPENDED' ? 'danger' : 'info'}
            >
              {statusLabel(company?.status)}
            </Badge>
          </InfoField>
        </div>
      </SectionCard>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="기업 정보 수정" size="md">
        <div className="space-y-4">
          <Input label="기업명" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="대표자"
              value={form.representativeName}
              onChange={(e) => setForm((f) => ({ ...f, representativeName: e.target.value }))}
            />
            <Input
              label="연락처"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <Input
            label="주소"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={updateCompany.isPending}>
              저장
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
  span,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  span?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      {children ?? <p className="text-sm text-white">{value}</p>}
    </div>
  );
}
