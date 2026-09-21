'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, MapPin, Phone, FileText, Edit3, Download, Upload, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { PageTitle } from '@/components/layout/PageTitle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useCompany, useUpdateCompany } from '@/hooks/platform/useCompanies';
import { useUsers } from '@/hooks/platform/useUsers';
import { usePersonaOverride, getPersona } from '@/lib/persona';

function statusLabel(status?: string): string {
  if (!status) return '-';
  return status === 'ACTIVE' ? '활성' : status === 'SUSPENDED' ? '정지' : status;
}

export default function OrgInfoPage() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', representativeName: '', phone: '', address: '' });
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const addToast = useToastStore((s) => s.add);
  // 사업자 등록증은 최초 가입자(기업 소유자)와 관리자만 열람·다운로드. 소유자 식별 값이 없어 현재는 관리자만 노출.
  const canViewLicense = persona === 'admin';

  const companyId = user?.companyId ?? 0;
  const { data: company, isLoading } = useCompany(companyId);
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
    { name: '김서연', department: '전력관리팀', phone: '010-1234-5678', email: 'seoyeon.kim@ulsan-energy.co.kr', status: 'ACTIVE' },
    { name: '박준호', department: '운영지원팀', phone: '010-2345-6789', email: 'junho.park@ulsan-energy.co.kr', status: 'PENDING' },
  ];

  useEffect(() => {
    if (company && !editing) {
      setForm({
        name: company.name ?? '',
        representativeName: company.representativeName ?? '',
        phone: company.phone ?? '',
        address: company.address ?? '',
      });
    }
  }, [company, editing]);

  const licenseFileName = `사업자등록증_${company?.name ?? 'company'}.txt`;
  // 등록증 교체는 즉시 반영하지 않고 관리자 확인 대기로 둔다(중요 정보 검증).
  const [pendingLicense, setPendingLicense] = useState<string | null>(null); // 선택했으나 아직 저장 전
  const [licensePending, setLicensePending] = useState(false); // 저장 후 관리자 확인 대기 중
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
    if (!companyId) return;
    updateCompany.mutate(
      { id: companyId, data: form },
      {
        onSuccess: () => {
          addToast('success', '기업 정보를 저장했습니다');
          if (pendingLicense) {
            // 등록증은 바로 바꾸지 않고 관리자 확인 요청 상태로 전환
            setLicensePending(true);
            setPendingLicense(null);
            addToast('info', '사업자 등록증 변경은 관리자 확인 후 반영됩니다');
          }
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
        phone: company.phone ?? '',
        address: company.address ?? '',
      });
    }
    setPendingLicense(null);
    setEditing(true);
  };

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
            <Button size="sm" variant="secondary" onClick={startEdit} disabled={!company}>
              <Edit3 size={14} className="mr-1.5" /> 수정
            </Button>
          )
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-5">
          <InfoField icon={<Building2 size={14} />} label="기업명">
            {editing ? (
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            ) : (
              <p className="text-sm text-white">{company?.name ?? (isLoading ? '불러오는 중…' : '-')}</p>
            )}
          </InfoField>
          <InfoField icon={<FileText size={14} />} label="사업자등록번호" value={company?.businessNumber ?? '-'} />
          <InfoField label="대표자">
            {editing ? (
              <Input
                value={form.representativeName}
                onChange={(e) => setForm((f) => ({ ...f, representativeName: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-white">{company?.representativeName ?? '-'}</p>
            )}
          </InfoField>
          <InfoField icon={<Phone size={14} />} label="연락처">
            {editing ? (
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            ) : (
              <p className="text-sm text-white">{company?.phone ?? '-'}</p>
            )}
          </InfoField>
          <InfoField icon={<MapPin size={14} />} label="주소" span>
            {editing ? (
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            ) : (
              <p className="text-sm text-white">{company?.address ?? '-'}</p>
            )}
          </InfoField>
          <InfoField label="이메일" value={company?.email ?? '-'} />
          <InfoField label="설립일" value={company?.createdAt?.split('T')[0] ?? '-'} />
          <InfoField label="상태">
            <Badge
              variant={company?.status === 'ACTIVE' ? 'success' : company?.status === 'SUSPENDED' ? 'danger' : 'info'}
            >
              {statusLabel(company?.status)}
            </Badge>
          </InfoField>
          {canViewLicense && (
            <InfoField icon={<FileText size={14} />} label="사업자 등록증" span>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">{licenseFileName}</span>
                  {licensePending && <Badge variant="warning">변경 승인 대기</Badge>}
                  <Button size="sm" variant="secondary" onClick={handleDownloadLicense}>
                    <Download size={14} className="mr-1.5" /> 다운로드
                  </Button>
                </div>
                {editing && (
                  <div className="space-y-1.5">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setPendingLicense(f.name);
                        e.target.value = '';
                      }}
                    />
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                      <Upload size={14} className="mr-1.5" /> 등록증 업데이트
                    </Button>
                    {pendingLicense && (
                      <p className="text-xs text-primary">선택됨: {pendingLicense} · 저장 시 관리자 확인을 요청합니다.</p>
                    )}
                    <p className="text-xs text-slate-500">사업자 등록증 변경은 저장 후 관리자 확인을 거쳐 반영됩니다.</p>
                  </div>
                )}
              </div>
            </InfoField>
          )}
        </div>
      </SectionCard>

      <SectionCard title={`소속 멤버 (${members.length})`}>
        <div className="px-6 py-5">
          {members.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                    <th className="px-4 py-2.5 font-medium">이름</th>
                    <th className="px-4 py-2.5 font-medium">부서</th>
                    <th className="px-4 py-2.5 font-medium">연락처</th>
                    <th className="px-4 py-2.5 font-medium">이메일</th>
                    <th className="px-4 py-2.5 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={`${m.email}-${idx}`} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5 text-white">{m.name}</td>
                      <td className="px-4 py-2.5 text-slate-300">{m.department}</td>
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums">{m.phone}</td>
                      <td className="px-4 py-2.5 text-slate-400">{m.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={m.status === 'ACTIVE' ? 'success' : m.status === 'SUSPENDED' ? 'danger' : 'warning'}>
                          {m.status === 'ACTIVE' ? '활성' : m.status === 'SUSPENDED' ? '정지' : '대기'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-white/[0.06] px-4 py-6 text-center text-sm text-slate-500">
              소속 멤버가 없습니다
            </p>
          )}
        </div>
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
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      {children ?? <p className="text-sm text-white">{value}</p>}
    </div>
  );
}
