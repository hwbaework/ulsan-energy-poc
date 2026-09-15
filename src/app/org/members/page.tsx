'use client';

import { useState } from 'react';
import { Send, MoreHorizontal, Shield, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToastStore } from '@/stores/useToastStore';
import { usePersonaOverride, getPersona, type Persona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUsers, useSuspendUser, useCreateUser, useDeleteUser } from '@/hooks/platform/useUsers';
import { useRoles, useAssignRole } from '@/hooks/platform/useRoles';

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'suspended';
  joinedAt: string;
}

const MEMBERS_BY_PERSONA: Record<Persona, Member[]> = {
  generator: [
    {
      id: 1,
      name: '박에너지',
      email: 'park@greenenergy.co.kr',
      role: '기업관리자',
      status: 'active',
      joinedAt: '2025-12-01',
    },
    {
      id: 2,
      name: '김태양',
      email: 'kim@greenenergy.co.kr',
      role: '발전소운영자',
      status: 'active',
      joinedAt: '2026-04-25',
    },
    {
      id: 3,
      name: '정수소',
      email: 'jung@greenenergy.co.kr',
      role: '발전소운영자',
      status: 'active',
      joinedAt: '2026-04-26',
    },
    { id: 4, name: '한바람', email: 'han@greenenergy.co.kr', role: '-', status: 'invited', joinedAt: '-' },
    {
      id: 5,
      name: '최지열',
      email: 'choi@greenenergy.co.kr',
      role: '조회자',
      status: 'suspended',
      joinedAt: '2026-01-10',
    },
  ],
  consumer: [
    {
      id: 1,
      name: '이수요',
      email: 'lee@ecoindustry.co.kr',
      role: '기업관리자',
      status: 'active',
      joinedAt: '2025-11-15',
    },
    {
      id: 2,
      name: '박관리',
      email: 'park@ecoindustry.co.kr',
      role: '에너지관리자',
      status: 'active',
      joinedAt: '2026-01-10',
    },
    {
      id: 3,
      name: '김사업',
      email: 'kim@ecoindustry.co.kr',
      role: '사업장관리자',
      status: 'active',
      joinedAt: '2026-02-05',
    },
    {
      id: 4,
      name: '정에너',
      email: 'jung@ecoindustry.co.kr',
      role: '에너지관리자',
      status: 'active',
      joinedAt: '2026-03-01',
    },
    { id: 5, name: '한조회', email: 'han@ecoindustry.co.kr', role: '조회자', status: 'active', joinedAt: '2026-03-15' },
    {
      id: 6,
      name: '최사업',
      email: 'choi@ecoindustry.co.kr',
      role: '사업장관리자',
      status: 'active',
      joinedAt: '2026-04-01',
    },
    { id: 7, name: '윤신입', email: 'yoon@ecoindustry.co.kr', role: '-', status: 'invited', joinedAt: '-' },
    {
      id: 8,
      name: '송정지',
      email: 'song@ecoindustry.co.kr',
      role: '조회자',
      status: 'suspended',
      joinedAt: '2026-01-20',
    },
  ],
  consultant: [
    {
      id: 1,
      name: '김컨설',
      email: 'kim@energyconsulting.co.kr',
      role: '기업관리자',
      status: 'active',
      joinedAt: '2025-10-01',
    },
    {
      id: 2,
      name: '박수석',
      email: 'park@energyconsulting.co.kr',
      role: '수석 컨설턴트',
      status: 'active',
      joinedAt: '2025-12-15',
    },
    {
      id: 3,
      name: '이분석',
      email: 'lee@energyconsulting.co.kr',
      role: '분석가',
      status: 'active',
      joinedAt: '2026-02-01',
    },
  ],
  spc: [
    {
      id: 1,
      name: '최운영',
      email: 'choi@greenspc.co.kr',
      role: '기업관리자',
      status: 'active',
      joinedAt: '2025-09-01',
    },
    {
      id: 2,
      name: '박사업',
      email: 'park@greenspc.co.kr',
      role: '사업운영자',
      status: 'active',
      joinedAt: '2025-11-01',
    },
    { id: 3, name: '김계약', email: 'kim@greenspc.co.kr', role: 'PPA관리자', status: 'active', joinedAt: '2026-01-15' },
    { id: 4, name: '정재무', email: 'jung@greenspc.co.kr', role: '재무담당', status: 'active', joinedAt: '2026-02-10' },
    {
      id: 5,
      name: '한운영',
      email: 'han@greenspc.co.kr',
      role: '사업운영자',
      status: 'active',
      joinedAt: '2026-03-01',
    },
    { id: 6, name: '이신입', email: 'lee@greenspc.co.kr', role: '-', status: 'invited', joinedAt: '-' },
  ],
  admin: [
    {
      id: 1,
      name: '관리자',
      email: 'admin@energy-platform.co.kr',
      role: '기업관리자',
      status: 'active' as const,
      joinedAt: '2025-06-01',
    },
    {
      id: 2,
      name: '김시스템',
      email: 'kim@energy-platform.co.kr',
      role: '시스템관리자',
      status: 'active' as const,
      joinedAt: '2025-08-15',
    },
    {
      id: 3,
      name: '박운영',
      email: 'park@energy-platform.co.kr',
      role: '운영자',
      status: 'active' as const,
      joinedAt: '2025-10-01',
    },
    {
      id: 4,
      name: '이운영',
      email: 'lee@energy-platform.co.kr',
      role: '운영자',
      status: 'active' as const,
      joinedAt: '2026-01-10',
    },
  ],
  operator: [
    {
      id: 1,
      name: '김현장',
      email: 'field@greenenergy.co.kr',
      role: '현장운영자',
      status: 'active' as const,
      joinedAt: '2026-01-15',
    },
    {
      id: 2,
      name: '박정비',
      email: 'maint@greenenergy.co.kr',
      role: '유지보수',
      status: 'active' as const,
      joinedAt: '2026-02-01',
    },
  ],
  agency: [
    {
      id: 1,
      name: '정용역',
      email: 'jung@energysolution.co.kr',
      role: '기업관리자',
      status: 'active' as const,
      joinedAt: '2025-11-01',
    },
    {
      id: 2,
      name: '김팀장',
      email: 'kim@energysolution.co.kr',
      role: '프로젝트관리자',
      status: 'active' as const,
      joinedAt: '2026-01-10',
    },
    {
      id: 3,
      name: '박매니저',
      email: 'park@energysolution.co.kr',
      role: '인력관리자',
      status: 'active' as const,
      joinedAt: '2026-03-01',
    },
  ],
};

const ROLES_BY_PERSONA: Record<Persona, { value: string; label: string }[]> = {
  generator: [
    { value: 'POWER_OPERATOR', label: '발전소 운영자' },
    { value: 'VIEWER', label: '조회자' },
  ],
  consumer: [
    { value: 'ENERGY_MANAGER', label: '에너지관리자' },
    { value: 'SITE_MANAGER', label: '사업장관리자' },
    { value: 'VIEWER', label: '조회자' },
  ],
  consultant: [
    { value: 'SENIOR_CONSULTANT', label: '수석 컨설턴트' },
    { value: 'CONSULTANT', label: '컨설턴트' },
    { value: 'ANALYST', label: '분석가' },
  ],
  spc: [
    { value: 'BIZ_OPERATOR', label: '사업운영자' },
    { value: 'PPA_MANAGER', label: 'PPA관리자' },
    { value: 'FINANCE', label: '재무담당' },
  ],
  admin: [
    { value: 'SYS_ADMIN', label: '시스템관리자' },
    { value: 'OPERATOR', label: '운영자' },
  ],
  operator: [
    { value: 'FIELD_OPERATOR', label: '현장운영자' },
    { value: 'MAINTENANCE_WORKER', label: '유지보수' },
  ],
  agency: [
    { value: 'AGENCY_ADMIN', label: '용역사 관리자' },
    { value: 'AGENCY_MANAGER', label: '프로젝트 관리자' },
  ],
};

export default function MembersPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const addToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const { data: rolesData } = useRoles();
  const { data: apiUsers, isError } = useUsers({ companyId: user?.companyId ?? undefined });
  const suspendUser = useSuspendUser();
  const assignRole = useAssignRole();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const apiRoleOptions = (rolesData as any[])?.map((r: any) => ({ value: String(r.id), label: r.name })) ?? [];
  const members =
    !isError && apiUsers?.content
      ? apiUsers.content.map((u: any) => ({
          id: u.id,
          name: u.name ?? '',
          email: u.email ?? '',
          role: u.roleName ?? '-',
          status: (u.status === 'ACTIVE'
            ? 'active'
            : u.status === 'INVITED'
              ? 'invited'
              : 'suspended') as Member['status'],
          joinedAt: u.createdAt?.split('T')[0] ?? '-',
        }))
      : MEMBERS_BY_PERSONA[persona];
  const ROLE_OPTIONS = apiRoleOptions.length > 0 ? apiRoleOptions : ROLES_BY_PERSONA[persona];

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: '멤버',
      width: '220px',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-slate-300">
            {row.name[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{row.name}</p>
            <p className="text-xs text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: '역할',
      render: (row) =>
        row.role === '-' ? (
          <span className="text-sm text-slate-500">미배정</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="text-violet-400" />
            <span className="text-sm text-slate-300">{row.role}</span>
          </div>
        ),
    },
    {
      key: 'status',
      header: '상태',
      width: '90px',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'invited' ? 'info' : 'danger'}>
          {row.status === 'active' ? '활성' : row.status === 'invited' ? '초대됨' : '정지'}
        </Badge>
      ),
    },
    {
      key: 'joinedAt',
      header: '가입일',
      width: '110px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.joinedAt}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '50px',
      align: 'right',
      render: (row) =>
        row.role === '기업관리자' ? null : (
          <Dropdown
            trigger={
              <button className="rounded p-1 text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <MoreHorizontal size={16} />
              </button>
            }
            align="right"
          >
            <DropdownItem
              onClick={() => {
                setRoleChangeTarget(row);
                setSelectedRole('');
              }}
            >
              역할 변경
            </DropdownItem>
            {row.status === 'invited' && (
              <DropdownItem onClick={() => addToast('success', '초대를 재발송했습니다')}>초대 재발송</DropdownItem>
            )}
            {row.status === 'active' && (
              <DropdownItem
                onClick={() => {
                  suspendUser.mutate(row.id, {
                    onSuccess: () => addToast('success', `${row.name}님의 계정을 정지했습니다`),
                    onError: () => addToast('error', '계정 정지에 실패했습니다'),
                  });
                }}
              >
                계정 정지
              </DropdownItem>
            )}
            <DropdownItem onClick={() => setRemoveTarget(row)}>멤버 제거</DropdownItem>
          </Dropdown>
        ),
    },
  ];

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">멤버 관리</h1>
          <p className="mt-1 text-sm text-slate-400">소속 멤버를 초대하고 관리합니다</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Send size={14} className="mr-1.5" /> 멤버 초대
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">
            {members.filter((m) => m.status === 'active').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">활성 멤버</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-blue-400 tabular-nums">
            {members.filter((m) => m.status === 'invited').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">초대 대기</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-slate-500 tabular-nums">
            {members.filter((m) => m.status === 'suspended').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">정지</p>
        </div>
      </div>

      <SectionCard title="">
        <DataTable columns={columns} data={members} rowKey={(row) => row.id} emptyMessage="멤버가 없습니다" />
      </SectionCard>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="멤버 초대" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 ring-1 ring-blue-500/20">
            <Mail size={14} className="text-blue-400" />
            <p className="text-xs text-blue-300">초대 메일이 발송되며, 기업관리자 권한으로 즉시 승인됩니다.</p>
          </div>
          <Input
            label="이메일"
            type="email"
            placeholder="colleague@greenenergy.co.kr"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select
            label="역할"
            placeholder="역할 선택"
            options={ROLE_OPTIONS}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              취소
            </Button>
            <Button
              disabled={!inviteEmail || createUser.isPending}
              onClick={() => {
                if (!inviteEmail) return;
                const roleId = Number(inviteRole);
                createUser.mutate(
                  {
                    email: inviteEmail,
                    name: inviteEmail.split('@')[0] ?? inviteEmail,
                    password: Math.random().toString(36).slice(-12),
                    companyId: user?.companyId ?? undefined,
                    roleIds: Number.isNaN(roleId) || !inviteRole ? undefined : [roleId],
                  },
                  {
                    onSuccess: () => {
                      addToast('success', '초대를 발송했습니다');
                      setInviteOpen(false);
                      setInviteEmail('');
                      setInviteRole('');
                    },
                    onError: () => addToast('error', '초대에 실패했습니다'),
                  },
                );
              }}
            >
              초대 발송
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          const target = removeTarget;
          deleteUser.mutate(target.id, {
            onSuccess: () => addToast('success', `${target.name}님을 제거했습니다`),
            onError: () => addToast('error', '멤버 제거에 실패했습니다'),
          });
          setRemoveTarget(null);
        }}
        title="멤버 제거"
        message={`${removeTarget?.name}님을 기업에서 제거하시겠��니까? 제거된 멤버는 더 이상 기업 데이터에 접근할 수 없습니다.`}
        confirmLabel="제거"
        variant="danger"
      />

      <Modal open={!!roleChangeTarget} onClose={() => setRoleChangeTarget(null)} title="역할 변경" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">{roleChangeTarget?.name}님의 역할을 변경합니다.</p>
          <Select
            label="새 역할"
            placeholder="역할 선택"
            options={ROLE_OPTIONS}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setRoleChangeTarget(null)}>
              취소
            </Button>
            <Button
              disabled={!selectedRole}
              onClick={() => {
                if (!roleChangeTarget || !selectedRole) return;
                assignRole.mutate(
                  { userId: roleChangeTarget.id, roleId: Number(selectedRole) },
                  {
                    onSuccess: () => {
                      addToast('success', `${roleChangeTarget.name}님의 역할을 변경했습니다`);
                      setRoleChangeTarget(null);
                    },
                    onError: () => addToast('error', '역할 변경에 실패했습니다'),
                  },
                );
              }}
            >
              변경
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
