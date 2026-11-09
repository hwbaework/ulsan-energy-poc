'use client';

import { useState } from 'react';
import { Shield, Eye, Pencil, Trash2, KeyRound, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetPassword } from '@/hooks/platform/useUsers';
import { useAssignRoleByCode, useRoles } from '@/hooks/platform/useRoles';
import { useCompanies } from '@/hooks/platform/useCompanies';
import type { CreateUserRequest } from '@/types';
import { useToastStore } from '@/stores/useToastStore';

import { LIMIT } from '@/lib/field-limits';
type AccountType = 'COMPANY_ADMIN' | 'COMPANY_MEMBER';
const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = { COMPANY_ADMIN: '기업 관리자', COMPANY_MEMBER: '기업 회원' };
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'COMPANY_MEMBER', label: '기업 회원' },
  { value: 'COMPANY_ADMIN', label: '기업 관리자' },
];

interface UserRow {
  id: number;
  name: string;
  email: string;
  company: string;
  accountType: AccountType;
  role: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  lastLogin: string;
  phone: string;
  department: string;
}

// 기본 3개(회원가입 유형과 동일) — 실제 선택지는 역할 · 권한 관리 목록(useRoles)에서 읽고, 목록이 비었을 때만 이 값(2026-11-09)
const ROLE_OPTIONS = [
  { value: 'CONSUMER_MANAGER', label: '전기사용자' },
  { value: 'POWER_OPERATOR', label: '발전사업자' },
  { value: 'SYSTEM_ADMIN', label: '관리자 (SPC)' },
];

const ROLE_LABEL_MAP: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

/** 관리자가 비밀번호를 초기화하면 이 값으로 바뀐다. 사용자는 로그인 후 직접 변경 */
const RESET_PASSWORD = 'a123456789';

export default function UsersPage() {
  const showToast = useToastStore((s) => s.add);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [detailRow, setDetailRow] = useState<UserRow | null>(null);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editRole, setEditRole] = useState('');

  const [deleteRow, setDeleteRow] = useState<UserRow | null>(null);
  const [resetRow, setResetRow] = useState<UserRow | null>(null);

  // 회원 등록 폼
  const [createOpen, setCreateOpen] = useState(false);
  const [cEmail, setCEmail] = useState('');
  const [cName, setCName] = useState('');
  const [cCompanyId, setCCompanyId] = useState('');
  const [cAccountType, setCAccountType] = useState<AccountType>('COMPANY_MEMBER');
  const [cRole, setCRole] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cDept, setCDept] = useState('');
  const resetCreateForm = () => {
    setCEmail('');
    setCName('');
    setCCompanyId('');
    setCAccountType('COMPANY_MEMBER');
    setCRole('');
    setCPhone('');
    setCDept('');
  };

  const { data: apiData, isError } = useUsers({ keyword: search || undefined });
  const { data: companyData } = useCompanies({ size: 100 } as any);
  const companies: { id: number; name: string }[] = ((companyData as any)?.content ?? []).map((c: any) => ({ id: c.id, name: c.name }));
  const createUserMut = useCreateUser();
  const updateUserMut = useUpdateUser();
  const assignRoleByCodeMut = useAssignRoleByCode();
  const deleteUserMut = useDeleteUser();
  const resetPasswordMut = useResetPassword();

  // 역할 선택지 — 역할 · 권한 관리에서 추가한 역할도 그대로 나온다(코드 있는 역할만)
  const { data: rolesData } = useRoles();
  const liveRoles = (rolesData ?? []).filter((r) => !!r.code).map((r) => ({ value: r.code as string, label: r.name }));
  const roleOptions = liveRoles.length > 0 ? liveRoles : ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }));
  const roleLabel = (code: string) => roleOptions.find((r) => r.value === code)?.label ?? ROLE_LABEL_MAP[code] ?? code;

  const users: UserRow[] =
    !isError && apiData?.content
      ? apiData.content.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          company: u.companyName ?? '',
          accountType: ((u as any).accountType ?? 'COMPANY_MEMBER') as AccountType,
          role: u.roles?.[0] ?? 'CONSUMER_MANAGER',
          status: (u.status as UserRow['status']) ?? 'ACTIVE',
          lastLogin: u.lastLoginAt?.replace('T', ' ').slice(5, 16) ?? '-',
          phone: u.phone ?? '',
          department: (u as any).department ?? '',
        }))
      : [];

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !u.name.includes(search) && !u.email.includes(search) && !u.company.includes(search)) return false;
    return true;
  });

  function openEdit(row: UserRow) {
    setEditRow(row);
    setEditName(row.name);
    setEditPhone(row.phone);
    setEditDept(row.department);
    setEditRole(row.role);
  }

  const columns: Column<UserRow>[] = [
    // 칸 하나에 값 하나 — 사용자 이름 · 아이디는 따로(2026-11-09)
    {
      key: 'name',
      header: '사용자 이름',
      width: '140px',
      render: (row) => <span className="text-sm font-medium text-white">{row.name}</span>,
    },
    {
      key: 'email',
      header: '아이디 (이메일)',
      width: '240px',
      render: (row) => <span className="text-sm text-slate-300">{row.email}</span>,
    },
    {
      key: 'company',
      header: '소속',
      render: (row) => <span className="text-sm text-slate-300">{row.company || '-'}</span>,
    },
    {
      key: 'accountType',
      header: '구분',
      width: '110px',
      render: (row) => <span className="text-sm text-slate-300">{ACCOUNT_TYPE_LABEL[row.accountType]}</span>,
    },
    {
      key: 'role',
      header: '역할',
      width: '160px',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-violet-400" />
          <span className="text-sm text-slate-300">{roleLabel(row.role)}</span>
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: '최근 로그인',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.lastLogin}</span>,
    },
    {
      key: 'actions' as keyof UserRow,
      header: '',
      // 아이콘 4개(26px) + 사이 + 셀 여백 32px — 130px 이면 삭제 아이콘이 잘린다
      width: '170px',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDetailRow(row); // 보기 팝업 — 상세 페이지로 가지 않는다(기업 관리와 같음, 2026-11-09)
            }}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            title="상세"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-blue-400 transition-colors"
            title="수정"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setResetRow(row);
            }}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-amber-400 transition-colors"
            title="비밀번호 초기화"
          >
            <KeyRound size={14} />
          </button>
          {/* 관리자(SPC) 회원은 삭제 불가 — 버튼 자체를 두지 않는다 */}
          {row.role !== 'SYSTEM_ADMIN' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteRow(row);
              }}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-red-400 transition-colors"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '회원 관리' }]} />

      <h1 className="text-2xl font-bold text-white">회원 관리</h1>

      <SectionCard
        title="회원 목록"
        actions={
          /* /guide 표기 규칙: 필터 → 검색 → 등록 */
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select
                placeholder="역할 전체"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                options={[
                  { value: '', label: '역할 전체' },
                  ...roleOptions.map((r) => ({ value: r.value, label: r.label })),
                ]}
              />
            </div>
            <div className="w-64">
              <Input
                placeholder="이름, 이메일 또는 기업 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1" /> 회원 등록
            </Button>
          </div>
        }
      >
        <DataTable columns={columns} data={filtered} rowKey={(row) => row.id} emptyMessage="사용자가 없습니다" />
      </SectionCard>

      {/* 상세 모달 */}
      {/* 사용자 상세 — 보기만(기업 상세와 같은 꼴). 수정은 목록의 연필 아이콘으로만 */}
      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title="사용자 상세" size="md">
        {detailRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">사용자 이름</p>
                <p className="text-sm text-white font-medium">{detailRow.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">아이디 (이메일)</p>
                <p className="text-sm text-white">{detailRow.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">소속</p>
                <p className="text-sm text-white">{detailRow.company || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">구분</p>
                <p className="text-sm text-white">{ACCOUNT_TYPE_LABEL[detailRow.accountType]}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">역할</p>
                <p className="text-sm text-white">{roleLabel(detailRow.role)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">연락처</p>
                <p className="text-sm text-white tabular-nums">{detailRow.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">부서</p>
                <p className="text-sm text-white">{detailRow.department || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">최근 로그인</p>
                <p className="text-sm text-white tabular-nums">{detailRow.lastLogin}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" size="sm" onClick={() => setDetailRow(null)}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 수정 모달 */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="사용자 수정" size="md">
        {editRow && (
          <div className="space-y-4">
            {/* 아이디는 변경 불가 — 라벨 + 텍스트로만 노출 */}
            <div>
              <p className="text-xs text-slate-400 mb-1">아이디</p>
              <p className="text-sm text-white">{editRow.email}</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-3 py-2.5">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">비밀번호</p>
                <p className="text-sm text-slate-300">
                  초기화하면 <span className="font-semibold text-white tabular-nums">{RESET_PASSWORD}</span> 로 바뀝니다
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setResetRow(editRow)}>
                <KeyRound size={14} className="mr-1" /> 비밀번호 초기화
              </Button>
            </div>
            <Input maxLength={LIMIT.personName} label="이름" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input maxLength={LIMIT.phone} label="연락처" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <Input maxLength={LIMIT.department} label="부서" value={editDept} onChange={(e) => setEditDept(e.target.value)} />
            </div>
            <Select
              label="역할"
              options={roleOptions.map((r) => ({ value: r.value, label: r.label }))}
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
            />
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setEditRow(null)}>
                취소
              </Button>
              <Button
                disabled={updateUserMut.isPending || assignRoleByCodeMut.isPending}
                onClick={async () => {
                  try {
                    const profileChanged =
                      editName !== editRow.name ||
                      (editPhone || '') !== (editRow.phone || '') ||
                      (editDept || '') !== (editRow.department || '');
                    const roleChanged = editRole && editRole !== editRow.role && editRole !== '-';

                    if (profileChanged) {
                      await updateUserMut.mutateAsync({
                        id: editRow.id,
                        data: {
                          name: editName,
                          phone: editPhone || undefined,
                          department: editDept || undefined,
                        },
                      });
                    }

                    if (roleChanged) {
                      await assignRoleByCodeMut.mutateAsync({ userId: editRow.id, roleCode: editRole });
                    }

                    showToast('success', `${editName}님 정보가 수정되었습니다`);
                    setEditRow(null);
                  } catch {
                    showToast('error', '수정에 실패했습니다');
                  }
                }}
              >
                {updateUserMut.isPending || assignRoleByCodeMut.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 회원 등록 */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="회원 등록" size="md">
        <div className="space-y-4">
          <Input maxLength={LIMIT.email} label="아이디 (이메일)" required type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="user@company.co.kr" />
          <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-3 py-2.5">
            <p className="text-xs text-slate-400 mb-0.5">초기 비밀번호</p>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white tabular-nums">{RESET_PASSWORD}</span> 로 등록됩니다. 사용자는 로그인 후 직접 변경합니다.
            </p>
          </div>
          <Input maxLength={LIMIT.personName} label="이름" required value={cName} onChange={(e) => setCName(e.target.value)} />
          <Select
            label="소속"
            required
            value={cCompanyId}
            onChange={(e) => setCCompanyId(e.target.value)}
            options={[{ value: '', label: '선택' }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="구분" required value={cAccountType} onChange={(e) => setCAccountType(e.target.value as AccountType)} options={ACCOUNT_TYPE_OPTIONS} />
            <Select
              label="역할"
              required
              value={cRole}
              onChange={(e) => setCRole(e.target.value)}
              options={[{ value: '', label: '선택' }, ...roleOptions]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input maxLength={LIMIT.phone} label="연락처" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="010-0000-0000" />
            <Input maxLength={LIMIT.department} label="부서" value={cDept} onChange={(e) => setCDept(e.target.value)} />
          </div>
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button
              disabled={createUserMut.isPending || assignRoleByCodeMut.isPending}
              onClick={async () => {
                // 필수 — 아이디 · 이름 · 소속 · 구분 · 역할(2026-11-09). 연락처 · 부서만 선택
                const missing = [
                  !cEmail.trim() && '아이디 (이메일)',
                  !cName.trim() && '이름',
                  !cCompanyId && '소속',
                  !cAccountType && '구분',
                  !cRole && '역할',
                ].filter(Boolean) as string[];
                if (missing.length) {
                  showToast('error', `${missing.join(', ')}을(를) 입력해 주세요`);
                  return;
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail.trim())) {
                  showToast('error', '아이디는 이메일 형식으로 입력해 주세요');
                  return;
                }
                try {
                  const created = await createUserMut.mutateAsync({
                    email: cEmail.trim(),
                    password: RESET_PASSWORD,
                    name: cName.trim(),
                    companyId: Number(cCompanyId),
                    phone: cPhone || undefined,
                    department: cDept || undefined,
                    accountType: cAccountType,
                  } as CreateUserRequest);
                  await assignRoleByCodeMut.mutateAsync({ userId: created.id, roleCode: cRole });
                  showToast('success', `${cName.trim()}님이 등록되었습니다 · 초기 비밀번호 ${RESET_PASSWORD}`);
                  resetCreateForm();
                  setCreateOpen(false);
                } catch {
                  showToast('error', '회원 등록에 실패했습니다');
                }
              }}
            >
              {createUserMut.isPending || assignRoleByCodeMut.isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 비밀번호 초기화 — 공통 확인창(2026-11-09) */}
      <ConfirmDialog
        open={!!resetRow}
        onClose={() => setResetRow(null)}
        onConfirm={async () => {
          if (!resetRow) return;
          try {
            await resetPasswordMut.mutateAsync({ id: resetRow.id, newPassword: RESET_PASSWORD });
            showToast('success', `${resetRow.name}님 비밀번호가 ${RESET_PASSWORD} 로 초기화되었습니다`);
            setResetRow(null);
          } catch {
            showToast('error', '비밀번호 초기화에 실패했습니다');
          }
        }}
        title="비밀번호 초기화"
        message={`${resetRow?.name ?? ''} (${resetRow?.email ?? ''})의 비밀번호를 ${RESET_PASSWORD} 로 초기화합니다. 사용자는 로그인 후 비밀번호를 직접 바꿔야 합니다.`}
        confirmLabel="초기화"
        loading={resetPasswordMut.isPending}
      />

      {/* 사용자 삭제 — 공통 확인창(2026-11-09) */}
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={async () => {
          if (!deleteRow) return;
          try {
            await deleteUserMut.mutateAsync(deleteRow.id);
            showToast('success', `${deleteRow.name}님이 삭제되었습니다`);
            setDeleteRow(null);
          } catch {
            showToast('error', '삭제에 실패했습니다');
          }
        }}
        title="사용자 삭제"
        message={`${deleteRow?.name ?? ''} (${deleteRow?.email ?? ''})을 삭제합니다.`}
        confirmLabel="삭제"
        variant="danger"
        loading={deleteUserMut.isPending}
      />
    </div>
  );
}
