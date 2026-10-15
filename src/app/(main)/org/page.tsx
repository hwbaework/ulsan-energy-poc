'use client';

import { useEffect, useRef, useState } from 'react';
import { Edit3, Download, Upload, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { DataTable, type Column } from '@/components/features/DataList';
import { PageTitle } from '@/components/layout/PageTitle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useCompany, useUpdateCompany } from '@/hooks/platform/useCompanies';
import { useUsers } from '@/hooks/platform/useUsers';
import { usePersonaOverride, getPersona } from '@/lib/persona';
import { PpaScheduleCard } from '@/components/features/monitoring/PpaSchedule';
import { PaymentMethodCard } from '@/components/features/billing/PaymentMethodCard';
import { useIsCompanyAdmin } from '@/hooks/org/useCompanyRole';
import { FIELD_LABEL, LICENSE_FIELDS, useCompanyChangeStore, useHydrateCompanyChange, type CompanyFields } from '@/stores/useCompanyChangeStore';
import { localNow } from '@/stores/useBillingStore';
import { useHydrateTradingPoc, useTradingPocStore } from '@/stores/useTradingPocStore';

function statusLabel(status?: string): string {
  if (!status) return '-';
  return status === 'ACTIVE' ? '활성' : status === 'SUSPENDED' ? '정지' : status;
}

export default function OrgInfoPage() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    representativeName: '',
    bizType: '',
    bizCategory: '',
    phone: '',
    address: '',
  });
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const addToast = useToastStore((s) => s.add);
  // 사업자 등록증 — 플랫폼 관리자와 그 기업의 기업관리자만 열람 · 다운로드 · 새로 올리기
  const isCompanyAdminForLicense = useIsCompanyAdmin();
  const canViewLicense = persona === 'admin' || isCompanyAdminForLicense;

  const companyId = user?.companyId ?? 0;
  const { data: company, isLoading } = useCompany(companyId);
  // 기업 것은 기업 정보에서 — PPA 운전 일정 · 결제 수단. 고치는 건 기업관리자만, 소속 멤버는 보기(2026-10-15)
  useHydrateTradingPoc();
  const isCompanyAdmin = useIsCompanyAdmin();
  const hasPpa = useTradingPocStore((s) =>
    s.contracts.some((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE' && c.consumerCompanyId === companyId),
  );
  const updateCompany = useUpdateCompany();
  const { data: usersData } = useUsers({});
  const realMembers = (usersData?.content ?? [])
    .filter((u) => (u.companyName ?? '') === company?.name)
    .map((u) => ({
      name: u.name,
      department: u.department ?? '-',
      phone: u.phone ?? '-',
      email: u.email,
      status: u.status ?? 'ACTIVE',
    }));
  // 데모용 가데이터 — 실제 소속 회원은 회원 관리에서 추가
  const members: { name: string; department: string; phone: string; email: string; status: string }[] = [
    ...realMembers,
    {
      name: '김서연',
      department: '전력관리팀',
      phone: '010-1234-5678',
      email: 'seoyeon.kim@ulsan-energy.co.kr',
      status: 'ACTIVE',
    },
    {
      name: '박준호',
      department: '운영지원팀',
      phone: '010-2345-6789',
      email: 'junho.park@ulsan-energy.co.kr',
      status: 'PENDING',
    },
  ];

  useEffect(() => {
    if (company && !editing) {
      setForm({
        name: company.name ?? '',
        representativeName: company.representativeName ?? '',
        bizType: company.bizType ?? '',
        bizCategory: company.bizCategory ?? '',
        phone: company.phone ?? '',
        address: company.address ?? '',
      });
    }
  }, [company, editing]);

  const licenseFileName = `사업자등록증_${company?.name ?? 'company'}.txt`;
  // 기업 정보 변경 — 바로 바뀌지 않는다. 고친 칸 + 새 사업자 등록증을 '변경 요청'으로 보내고, 플랫폼 관리자가 승인 관리에서 확인하면 반영
  useHydrateCompanyChange();
  const [pendingLicense, setPendingLicense] = useState<string | null>(null); // 수정 중 고른 새 등록증(이름)
  const [pendingLicenseUrl, setPendingLicenseUrl] = useState<string | undefined>(undefined); // 관리자가 열어 볼 파일
  const sendChange = useCompanyChangeStore((s) => s.request);
  const lastChange = useCompanyChangeStore((s) => s.requests.find((r) => r.companyId === companyId));
  const changePending = lastChange?.status === 'PENDING';
  // 등록증에 적힌 칸(상호 · 대표자 · 업태 · 종목 · 주소)은 새 등록증을 올려야 고칠 수 있다
  const licenseLocked = persona !== 'admin' && !pendingLicense;
  const fileRef = useRef<HTMLInputElement>(null);
  const handleDownloadLicense = () => {
    // POC — 실제 업로드 파일이 없어 데모용 파일을 내려받는다. 실연동 시 저장된 원본 파일로 교체.
    const content = [
      '사업자 등록증 (데모)',
      '',
      `기업명: ${company?.name ?? '-'}`,
      `사업자등록번호: ${company?.businessNumber ?? '-'}`,
      `대표자: ${company?.representativeName ?? '-'}`,
      '',
      '※ 가입 시 등록한 사업자등록증 원본이 여기에서 다운로드됩니다.',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = licenseFileName;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', '사업자 등록증을 다운로드했습니다');
  };

  const handleSave = () => {
    if (!companyId || !company) return;
    // 기업 회원 — 변경 요청으로(관리자 확인 뒤 반영). 플랫폼 관리자는 바로 저장
    if (persona !== 'admin') {
      const keys = Object.keys(FIELD_LABEL) as (keyof CompanyFields)[];
      const changes = keys
        .map((k) => ({ key: k, before: String(company[k] ?? ''), after: form[k] }))
        .filter((c) => c.before !== c.after);
      if (changes.length === 0) {
        setEditing(false);
        return;
      }
      // 등록증 항목(상호 · 대표자 · 업태 · 종목 · 주소)만 새 등록증 + 관리자 검토, 연락처는 바로 반영
      const licenseChanges = changes.filter((c) => LICENSE_FIELDS.includes(c.key));
      const directChanges = changes.filter((c) => !LICENSE_FIELDS.includes(c.key));
      if (licenseChanges.length > 0 && !pendingLicense) {
        addToast('error', '상호 · 대표자 · 업태 · 종목 · 주소가 바뀌면 새 사업자 등록증을 올려 주세요');
        return;
      }
      if (directChanges.length > 0) {
        updateCompany.mutate({ id: companyId, data: Object.fromEntries(directChanges.map((c) => [c.key, c.after])) });
      }
      if (licenseChanges.length > 0 && pendingLicense) {
        sendChange({ companyId, companyName: company.name ?? '', changes: licenseChanges, fileName: pendingLicense, fileUrl: pendingLicenseUrl, requestedAt: localNow(), requestedBy: user?.name ?? '' });
        addToast('success', directChanges.length ? '연락처는 반영 · 나머지는 관리자 검토 뒤 반영됩니다' : '변경 요청 — 관리자 검토 뒤 반영됩니다');
      } else {
        addToast('success', '기업 정보를 저장했습니다');
      }
      setPendingLicense(null);
      setPendingLicenseUrl(undefined);
      setEditing(false);
      return;
    }
    updateCompany.mutate(
      { id: companyId, data: form },
      {
        onSuccess: () => {
          addToast('success', '기업 정보를 저장했습니다');
          setEditing(false);
        },
        onError: () => addToast('error', '기업 정보 저장에 실패했습니다'),
      },
    );
  };

  const startEdit = () => {
    if (company) {
      setForm({
        name: company.name ?? '',
        representativeName: company.representativeName ?? '',
        bizType: company.bizType ?? '',
        bizCategory: company.bizCategory ?? '',
        phone: company.phone ?? '',
        address: company.address ?? '',
      });
    }
    setEditing(true);
  };

  type Member = (typeof members)[number];
  const memberCols: Column<Member>[] = [
    { key: 'name', header: '이름', width: '140px', render: (m) => m.name },
    { key: 'dept', header: '부서', width: '160px', render: (m) => <span className="text-slate-300">{m.department}</span> },
    { key: 'phone', header: '연락처', width: '160px', render: (m) => <span className="tabular-nums text-slate-300">{m.phone}</span> },
    { key: 'email', header: '이메일', render: (m) => <span className="text-slate-300">{m.email}</span> },
    {
      key: 'status',
      header: '상태',
      width: '100px',
      render: (m) => (
        <Badge variant={m.status === 'ACTIVE' ? 'success' : m.status === 'SUSPENDED' ? 'danger' : 'warning'}>
          {m.status === 'ACTIVE' ? '활성' : m.status === 'SUSPENDED' ? '정지' : '대기'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <Breadcrumb items={[{ label: '설정' }, { label: '기업 정보' }]} />
      <PageTitle title="기업 정보" />

      <SectionCard
        title="기업 상세"
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateCompany.isPending}>
                <Save size={14} className="mr-1.5" /> 저장
              </Button>
            </div>
          ) : (
            (isCompanyAdminForLicense || persona === 'admin') && (
              <Button size="sm" variant="secondary" onClick={startEdit} disabled={!company || changePending}>
                <Edit3 size={14} className="mr-1.5" /> 수정
              </Button>
            )
          )
        }
      >
        {/* 한 줄 5칸 · 두 줄 — 칸 넓이 같게(합치는 칸 · 아이콘 없음). 사업자등록번호는 등록증으로만 바뀐다 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-5">
          <InfoField label="기업명">
            {editing ? (
              <Input disabled={licenseLocked} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            ) : (
              <p className="text-sm text-white">{company?.name ?? (isLoading ? '불러오는 중…' : '-')}</p>
            )}
          </InfoField>
          <InfoField label="사업자등록번호" value={company?.businessNumber ?? '-'} />
          <InfoField label="대표자">
            {editing ? (
              <Input disabled={licenseLocked} value={form.representativeName}
                onChange={(e) => setForm((f) => ({ ...f, representativeName: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-white">{company?.representativeName ?? '-'}</p>
            )}
          </InfoField>
          <InfoField label="업태">
            {editing ? (
              <Input disabled={licenseLocked} value={form.bizType} onChange={(e) => setForm((f) => ({ ...f, bizType: e.target.value }))} />
            ) : (
              <p className="text-sm text-white">{company?.bizType || '-'}</p>
            )}
          </InfoField>
          <InfoField label="종목">
            {editing ? (
              <Input disabled={licenseLocked} value={form.bizCategory}
                onChange={(e) => setForm((f) => ({ ...f, bizCategory: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-white">{company?.bizCategory || '-'}</p>
            )}
          </InfoField>
          <InfoField label="연락처">
            {editing ? (
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            ) : (
              <p className="text-sm text-white tabular-nums">{company?.phone ?? '-'}</p>
            )}
          </InfoField>
          <InfoField label="이메일" value={company?.email ?? '-'} />
          <InfoField label="주소">
            {editing ? (
              <Input disabled={licenseLocked} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            ) : (
              <p className="text-sm text-white">{company?.address ?? '-'}</p>
            )}
          </InfoField>
          <InfoField label="설립일" value={company?.createdAt?.split('T')[0] ?? '-'} />
          <InfoField label="상태">
            <Badge
              variant={company?.status === 'ACTIVE' ? 'success' : company?.status === 'SUSPENDED' ? 'danger' : 'info'}
            >
              {statusLabel(company?.status)}
            </Badge>
          </InfoField>
        </div>

        {/* 사업자 등록증 · 변경 요청 — 고친 내용은 새 등록증과 함께 요청으로 가고, 관리자 확인 뒤 반영 */}
        {canViewLicense && (
          <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">사업자 등록증</span>
              <span className="text-sm text-white">{licenseFileName}</span>
              <Button size="sm" variant="secondary" onClick={handleDownloadLicense}>
                <Download size={14} className="mr-1.5" /> 다운로드
              </Button>
              {editing && persona !== 'admin' && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 3 * 1024 * 1024) {
                          addToast('error', '3MB 이하 파일만 올릴 수 있습니다');
                        } else {
                          setPendingLicense(f.name);
                          // 관리자가 검토 창에서 열어 볼 수 있게 파일을 그대로 담는다
                          const rd = new FileReader();
                          rd.onload = () => setPendingLicenseUrl(typeof rd.result === 'string' ? rd.result : undefined);
                          rd.readAsDataURL(f);
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload size={14} className="mr-1.5" /> 새 등록증 올리기
                  </Button>
                  {pendingLicense && <span className="text-sm text-slate-300">{pendingLicense}</span>}
                </>
              )}
            </div>
            {lastChange && lastChange.status !== 'APPROVED' && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={lastChange.status === 'PENDING' ? 'warning' : 'danger'}>
                  {lastChange.status === 'PENDING' ? '변경 확인 중' : '변경 반려'}
                </Badge>
                <span className="text-slate-300">
                  {lastChange.changes.map((c) => `${FIELD_LABEL[c.key]} ${c.before || '-'} → ${c.after || '-'}`).join(' · ')}
                </span>
                <span className="tabular-nums text-slate-400">{lastChange.requestedAt.slice(0, 10)}</span>
                {lastChange.status === 'REJECTED' && lastChange.note && <span className="text-red-300">사유: {lastChange.note}</span>}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* PPA 운전 일정 — PPA 계약이 있는 기업만(플랫폼 관리자 계정은 대시보드 · 발전소 상세에서 본다) */}
      {persona !== 'admin' && hasPpa && <PpaScheduleCard companyId={companyId} readOnly={!isCompanyAdmin} />}

      {/* 결제 수단 — E-데이터마켓 신청 · 월 이용료 자동결제(토스페이먼츠) */}
      {persona !== 'admin' && <PaymentMethodCard companyId={companyId} canEdit={isCompanyAdmin} />}

      <SectionCard title={`소속 멤버 (${members.length})`} noPadding>
        <DataTable
          columns={memberCols}
          data={members}
          rowKey={(m) => m.email}
          emptyMessage="소속 멤버가 없습니다"
        />
      </SectionCard>
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
      <div className="mb-1 flex items-center gap-1.5">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      {children ?? <p className="text-sm text-white">{value}</p>}
    </div>
  );
}
