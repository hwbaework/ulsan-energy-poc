'use client';

import { useState } from 'react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useUsers, useActivateUser, useSuspendUser } from '@/hooks/platform/useUsers';
import { useCompanies, useActivateCompany, useSuspendCompany } from '@/hooks/platform/useCompanies';
import { useAssignRoleByCode } from '@/hooks/platform/useRoles';
import { useToastStore } from '@/stores/useToastStore';

// 승인 관리 — 가입 신청 계정을 표에서 바로 승인·반려한다. 상세 화면 없음.
// 구분: 기업 관리자(기업의 첫 계정, 기업도 함께 승인) / 기업 회원(기존 기업 소속, 기업이 승인돼 있어야 함)
// 역할은 소속 기업 유형으로 정해진다: 수용가 → 전기사용자, 발전사업자 → 발전사업자, SPC·운영사 → 관리자

type AccountType = 'COMPANY_ADMIN' | 'COMPANY_MEMBER';
const TYPE_LABEL: Record<AccountType, string> = { COMPANY_ADMIN: '기업 관리자', COMPANY_MEMBER: '기업 회원' };

function roleOfCompany(businessTypes: string[] = []): { code: string; label: string } {
  if (businessTypes.some((t) => t.includes('SPC') || t.includes('운영사'))) return { code: 'SYSTEM_ADMIN', label: '관리자 (SPC)' };
  if (businessTypes.some((t) => t.includes('발전'))) return { code: 'POWER_OPERATOR', label: '발전사업자' };
  return { code: 'CONSUMER_MANAGER', label: '전기사용자' };
}

interface Applicant {
  id: number;
  type: AccountType;
  name: string;
  email: string;
  phone: string;
  companyId?: number;
  company: string;
  companyStatus?: string;
  role: { code: string; label: string };
  date: string;
}

export default function ApprovalsPage() {
  const [rejectItem, setRejectItem] = useState<Applicant | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const addToast = useToastStore((s) => s.add);
  const { data: userData } = useUsers({ status: 'PENDING' });
  const { data: companyData } = useCompanies();
  const activateUser = useActivateUser();
  const activateCompany = useActivateCompany();
  const suspendUser = useSuspendUser();
  const suspendCompany = useSuspendCompany();
  const assignRole = useAssignRoleByCode();

  const companies: any[] = (companyData as any)?.content ?? [];
  const rows: Applicant[] = ((userData as any)?.content ?? [])
    .filter((u: any) => u.status === 'PENDING')
    .map((u: any) => {
      const c = companies.find((x) => x.id === u.companyId);
      return {
        id: u.id,
        type: (u.accountType ?? 'COMPANY_MEMBER') as AccountType,
        name: u.name ?? '',
        email: u.email ?? '',
        phone: u.phone ?? '',
        companyId: u.companyId,
        company: u.companyName ?? c?.name ?? '',
        companyStatus: c?.status,
        role: roleOfCompany(c?.businessTypes),
        date: (u.createdAt ?? '').slice(0, 10),
      };
    })
    .sort((a: Applicant, b: Applicant) => (a.date < b.date ? 1 : -1));

  // 기업 회원은 소속 기업(기업 관리자)이 먼저 승인돼 있어야 한다
  const blocked = (a: Applicant) => a.type === 'COMPANY_MEMBER' && !!a.companyStatus && a.companyStatus !== 'ACTIVE';

  const approve = async (a: Applicant) => {
    setBusyId(a.id);
    try {
      if (a.type === 'COMPANY_ADMIN' && a.companyId && a.companyStatus !== 'ACTIVE') await activateCompany.mutateAsync(a.companyId);
      await activateUser.mutateAsync(a.id);
      await assignRole.mutateAsync({ userId: a.id, roleCode: a.role.code });
      addToast('success', `${a.name}님 가입을 승인했습니다 · ${a.role.label}`);
    } catch {
      addToast('error', '승인에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  };
  const reject = async (a: Applicant) => {
    setBusyId(a.id);
    try {
      await suspendUser.mutateAsync(a.id);
      if (a.type === 'COMPANY_ADMIN' && a.companyId && a.companyStatus === 'PENDING') await suspendCompany.mutateAsync(a.companyId);
      addToast('success', `${a.name}님 가입을 반려하고 사유를 전달했습니다`);
      setRejectItem(null);
      setReason('');
    } catch {
      addToast('error', '반려에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  };

  // 열 순서·신청자 셀은 회원 관리와 동일: 신청자 → 소속 → 구분 → 역할 → 연락처 → 신청일 → 상태. 소속만 너비 미지정(남는 폭 전부)
  const columns: Column<Applicant>[] = [
    {
      key: 'name',
      header: '신청자',
      width: '200px',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-slate-300">{r.name[0]}</div>
          <div>
            <p className="text-sm font-medium text-white">{r.name}</p>
            <p className="text-xs text-slate-500">{r.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'company', header: '소속', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{r.company || '-'}</span> },
    // 너비 = 글자 폭 + 셀 패딩 32px (table-fixed + truncate 라 모자라면 잘린다)
    { key: 'type', header: '구분', width: '110px', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{TYPE_LABEL[r.type]}</span> },
    { key: 'role', header: '역할', width: '130px', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{r.role.label}</span> },
    { key: 'phone', header: '연락처', width: '150px', render: (r) => <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{r.phone || '-'}</span> },
    { key: 'date', header: '신청일', width: '130px', render: (r) => <span className="text-sm text-slate-400 tabular-nums whitespace-nowrap">{r.date}</span> },
    { key: 'status' as keyof Applicant, header: '상태', width: '90px', render: () => <StatusPill tone="warning" label="대기" /> },
    {
      key: 'actions' as keyof Applicant,
      header: '',
      width: '140px',
      render: (r) => (
        <div className="flex gap-1.5 whitespace-nowrap">
          <Button size="sm" disabled={busyId === r.id || blocked(r)} title={blocked(r) ? '소속 기업의 기업 관리자 승인이 먼저 필요합니다' : undefined} onClick={() => approve(r)}>
            {busyId === r.id ? '처리 중' : '승인'}
          </Button>
          <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => { setRejectItem(r); setReason(''); }}>
            반려
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '승인 관리' }]} />
      <h1 className="text-2xl font-bold text-white">승인 관리</h1>

      <SectionCard title="가입 승인 대기">
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="승인 대기 건이 없습니다" />
      </SectionCard>

      {/* 반려 — 사유를 써서 신청자에게 전달 */}
      <Modal open={!!rejectItem} onClose={() => setRejectItem(null)} title="가입 반려" size="sm">
        {rejectItem && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{rejectItem.name}</span>님 · {TYPE_LABEL[rejectItem.type]} · {rejectItem.company}
            </p>
            <Textarea label="반려 사유" placeholder="신청자에게 전달할 사유" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setRejectItem(null)}>
                취소
              </Button>
              <Button variant="danger" disabled={!reason.trim() || busyId === rejectItem.id} onClick={() => reject(rejectItem)}>
                {busyId === rejectItem.id ? '처리 중...' : '반려 전달'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
