'use client';

import { useState } from 'react';
import { Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useToastStore } from '@/stores/useToastStore';
import { useInvitations, useCreateInvitation, useResendInvitation } from '@/hooks/platform/useInvitations';
import { useCompanies } from '@/hooks/platform/useCompanies';
import { useRoles } from '@/hooks/platform/useRoles';
import { useMe } from '@/hooks/auth/useAuth';

interface InvitationRow {
  id: number;
  companyId: number;
  companyName: string;
  contactName: string;
  email: string;
  role: string;
  status: 'sent' | 'accepted' | 'expired';
  sentAt: string;
  expiresAt: string;
}

export default function InvitationsPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const addToast = useToastStore((s) => s.add);

  const { data: me } = useMe();
  const { data: apiData, isError } = useInvitations();
  const { data: companiesData } = useCompanies({ size: 100 });
  const { data: rolesData } = useRoles();
  const createInvitation = useCreateInvitation();
  const resendInvitation = useResendInvitation();

  const companyOptions = (companiesData?.content ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const roleOptions = (Array.isArray(rolesData) ? rolesData : []).map((r: { id: number; name: string }) => ({
    value: String(r.id),
    label: r.name,
  }));

  const invitations: InvitationRow[] =
    !isError && apiData?.content
      ? apiData.content.map((i) => ({
          id: i.id,
          companyId: i.companyId,
          companyName: i.companyName,
          contactName: i.invitedByName,
          email: i.email,
          role: i.roleName,
          status: (i.status === 'ACCEPTED'
            ? 'accepted'
            : i.status === 'EXPIRED'
              ? 'expired'
              : 'sent') as InvitationRow['status'],
          sentAt: i.createdAt?.split('T')[0] ?? '',
          expiresAt: i.expiresAt?.split('T')[0] ?? '',
        }))
      : [];

  const handleCreateInvitation = () => {
    if (!formCompanyId || !formEmail || !formRoleId) {
      addToast('error', '모든 필수 항목을 입력해주세요');
      return;
    }
    const hasPending = invitations.some(
      (i) => i.email === formEmail && i.companyId === Number(formCompanyId) && i.status === 'sent',
    );
    if (hasPending) {
      addToast('error', '해당 이메일로 이미 대기 중인 초대가 있습니다');
      return;
    }
    createInvitation.mutate(
      {
        data: {
          companyId: Number(formCompanyId),
          email: formEmail,
          roleId: Number(formRoleId),
        },
        invitedById: me?.id ?? 0,
      },
      {
        onSuccess: () => {
          addToast('success', '초대가 발송되었습니다');
          setInviteOpen(false);
          setFormCompanyId('');
          setFormEmail('');
          setFormRoleId('');
        },
        onError: (err) => {
          addToast('error', `초대 실패: ${(err as Error).message}`);
        },
      },
    );
  };

  const columns: Column<InvitationRow>[] = [
    {
      key: 'company',
      header: '기업',
      width: '180px',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-white">{row.companyName}</p>
          <p className="text-xs text-slate-500">{row.contactName}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      render: (row) => <span className="text-sm text-slate-300">{row.email}</span>,
    },
    {
      key: 'role',
      header: '역할',
      render: (row) => <span className="text-sm text-slate-400">{row.role}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '100px',
      render: (row) => {
        const config = {
          sent: { icon: Clock, variant: 'info' as const, label: '발송됨' },
          accepted: { icon: CheckCircle2, variant: 'success' as const, label: '수락' },
          expired: { icon: XCircle, variant: 'danger' as const, label: '만료' },
        }[row.status];
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        );
      },
    },
    {
      key: 'sentAt',
      header: '발송일',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.sentAt}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      align: 'right',
      render: (row) =>
        row.status === 'sent' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              resendInvitation.mutate(row.id, {
                onSuccess: () => addToast('success', `${row.companyName}에 초대를 재발송했습니다`),
                onError: (err) => addToast('error', `재발송 실패: ${(err as Error).message}`),
              });
            }}
          >
            재발송
          </Button>
        ) : row.status === 'expired' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setInviteOpen(true);
            }}
          >
            재초대
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '기업 초대' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">기업 초대</h1>
          <p className="mt-1 text-sm text-slate-400">기업을 초대하여 플랫폼에 참여시킵니다</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Send size={14} className="mr-1.5" /> 초대하기
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{invitations.length}</p>
          <p className="text-xs text-slate-400 mt-1">총 초대</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {invitations.filter((i) => i.status === 'accepted').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">수락</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-blue-400 tabular-nums">
            {invitations.filter((i) => i.status === 'sent').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">대기중</p>
        </div>
      </div>

      {/* Table */}
      <SectionCard title="초대 이력">
        <DataTable columns={columns} data={invitations} rowKey={(row) => row.id} emptyMessage="초대 이력이 없습니다" />
      </SectionCard>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="기업 초대" size="md">
        <div className="space-y-4">
          <Select
            label="기업"
            placeholder="기업 선택"
            value={formCompanyId}
            onChange={(e) => setFormCompanyId(e.target.value)}
            options={companyOptions}
          />
          <Input
            label="이메일"
            type="email"
            placeholder="admin@company.com"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            required
          />
          <Select
            label="역할"
            placeholder="역할 선택"
            value={formRoleId}
            onChange={(e) => setFormRoleId(e.target.value)}
            options={roleOptions}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateInvitation} disabled={createInvitation.isPending}>
              {createInvitation.isPending ? '발송 중...' : '초대 발송'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
