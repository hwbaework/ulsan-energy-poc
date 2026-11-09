'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { LicenseBox } from './BizLicenseSheet';
import { TEXT_MAX } from '@/components/features/trading-poc/Bits';
import { useUsers, useActivateUser, useSuspendUser } from '@/hooks/platform/useUsers';
import { useCompanies, useActivateCompany, useSuspendCompany } from '@/hooks/platform/useCompanies';
import { useAssignRoleByCode } from '@/hooks/platform/useRoles';
import { useToastStore } from '@/stores/useToastStore';

/**
 * 가입 검토 — 가입 신청(대기) 계정을 등록증 · 신청 내용과 함께 보고 승인 / 반려.
 * 2026-11-09 승인 관리 메뉴를 없애면서 기업 관리(대기 기업) · 회원 관리(대기 회원)로 옮김. 상세 화면 없음.
 * 구분: 기업 관리자(기업의 첫 계정, 기업도 함께 승인) / 기업 회원(기존 기업 소속, 기업이 승인돼 있어야 함)
 * 역할은 소속 기업 유형으로 정해진다: 전기사용자 → 전기사용자, 발전사업자 → 발전사업자, SPC·운영사 → 관리자
 */

export type AccountType = 'COMPANY_ADMIN' | 'COMPANY_MEMBER';
const TYPE_LABEL: Record<AccountType, string> = { COMPANY_ADMIN: '기업 관리자', COMPANY_MEMBER: '기업 회원' };

function roleOfCompany(businessTypes: string[] = []): { code: string; label: string } {
  if (businessTypes.some((t) => t.includes('SPC') || t.includes('운영사'))) return { code: 'SYSTEM_ADMIN', label: '관리자 (SPC)' };
  if (businessTypes.some((t) => t.includes('발전'))) return { code: 'POWER_OPERATOR', label: '발전사업자' };
  return { code: 'CONSUMER_MANAGER', label: '전기사용자' };
}

export interface Applicant {
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
  department?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 가입 대기 신청 — 회원 id · 기업 id 로 찾는다 */
export function useSignupApplicants() {
  const { data: userData } = useUsers({ status: 'PENDING' });
  const { data: companyData } = useCompanies();
  const companies: any[] = (companyData as any)?.content ?? [];
  const applicants: Applicant[] = ((userData as any)?.content ?? [])
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
        department: u.department ?? '',
      };
    });
  return {
    applicants,
    companies,
    byUser: (userId: number) => applicants.find((a) => a.id === userId),
    /** 대기 기업의 첫 계정(기업 관리자) 신청 */
    byCompany: (companyId: number) => applicants.find((a) => a.companyId === companyId && a.type === 'COMPANY_ADMIN'),
  };
}

/** 가입 검토 창 — 왼쪽 사업자등록증, 오른쪽 신청자 · 소속 기업. 승인 / 반려(사유) */
export function SignupReviewModal({ applicant, companies, onClose }: { applicant: Applicant; companies: any[]; onClose: () => void }) {
  const addToast = useToastStore((s) => s.add);
  const activateUser = useActivateUser();
  const activateCompany = useActivateCompany();
  const suspendUser = useSuspendUser();
  const suspendCompany = useSuspendCompany();
  const assignRole = useAssignRoleByCode();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  // 기업 회원은 소속 기업(기업 관리자)이 먼저 승인돼 있어야 한다
  const blocked = applicant.type === 'COMPANY_MEMBER' && !!applicant.companyStatus && applicant.companyStatus !== 'ACTIVE';
  const c = companies.find((x) => x.id === applicant.companyId) ?? {};

  const approve = async () => {
    setBusy(true);
    try {
      if (applicant.type === 'COMPANY_ADMIN' && applicant.companyId && applicant.companyStatus !== 'ACTIVE') await activateCompany.mutateAsync(applicant.companyId);
      await activateUser.mutateAsync(applicant.id);
      await assignRole.mutateAsync({ userId: applicant.id, roleCode: applicant.role.code });
      addToast('success', `${applicant.name}님 가입을 승인했습니다 · ${applicant.role.label}`);
      onClose();
    } catch {
      addToast('error', '승인에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    setBusy(true);
    try {
      await suspendUser.mutateAsync(applicant.id);
      if (applicant.type === 'COMPANY_ADMIN' && applicant.companyId && applicant.companyStatus === 'PENDING') await suspendCompany.mutateAsync(applicant.companyId);
      addToast('success', `${applicant.name}님 가입을 반려하고 사유를 전달했습니다`);
      onClose();
    } catch {
      addToast('error', '반려에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const row = (k: string, v: string) => (
    <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-2">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-white tabular-nums">{v || '-'}</dd>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`가입 검토 · ${applicant.company || applicant.name}`}
      size="xl"
      footer={
        rejecting ? (
          <div className="flex justify-end gap-2">
            <Button variant="cancel" onClick={() => setRejecting(false)} disabled={busy}>
              취소
            </Button>
            <Button variant="danger" disabled={!reason.trim() || busy} onClick={() => void reject()}>
              반려
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="danger" disabled={busy} onClick={() => setRejecting(true)}>
              반려
            </Button>
            <Button disabled={busy || blocked} onClick={() => void approve()}>
              승인
            </Button>
          </div>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <LicenseBox fileUrl={c.licenseFileUrl} fileName={c.licenseFileName ?? `사업자등록증_${c.name ?? applicant.company}`} />
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1 font-semibold text-white">신청자</p>
            <dl className="divide-y divide-white/[0.06]">
              {row('이름', applicant.name)}
              {row('아이디 (이메일)', applicant.email)}
              {row('연락처', applicant.phone)}
              {row('부서', applicant.department ?? '')}
              {row('구분', TYPE_LABEL[applicant.type])}
              {row('역할', applicant.role.label)}
              {row('신청일', applicant.date)}
            </dl>
          </div>
          <div>
            <p className="mb-1 font-semibold text-white">소속 기업</p>
            <dl className="divide-y divide-white/[0.06]">
              {row('기업명', c.name ?? applicant.company)}
              {row('사업자등록번호', c.businessNumber)}
              {row('대표자', c.representativeName)}
              {row('업태', c.bizType)}
              {row('종목', c.bizCategory)}
              {row('설립일', c.foundedAt)}
              {row('기업 연락처', c.phone)}
              {row('기업 주소', c.address)}
              {row('기업 상태', c.status === 'ACTIVE' ? '활성' : c.status === 'PENDING' ? '대기' : c.status === 'SUSPENDED' ? '정지' : c.status)}
            </dl>
          </div>
          {blocked && <p className="text-amber-300">소속 기업의 기업 관리자 가입이 먼저 승인돼야 합니다</p>}
          {rejecting && <Textarea label="반려 사유" placeholder="신청자에게 전달할 사유" maxLength={TEXT_MAX} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />}
        </div>
      </div>
    </Modal>
  );
}
