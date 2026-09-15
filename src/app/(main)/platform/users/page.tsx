'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useUsers, useUpdateUser, useSuspendUser, useActivateUser, useDeleteUser } from '@/hooks/platform/useUsers';
import { useAssignRoleByCode } from '@/hooks/platform/useRoles';
import { useToastStore } from '@/stores/useToastStore';

interface UserRow {
  id: number;
  name: string;
  email: string;
  company: string;
  role: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  lastLogin: string;
  phone: string;
  department: string;
}

const ROLE_OPTIONS = [
  { value: 'SYSTEM_ADMIN', label: '시스템 관리자' },
  { value: 'COMPANY_ADMIN', label: '기업 관리자' },
  { value: 'POWER_OPERATOR', label: '발전사업자' },
  { value: 'CONSUMER_MANAGER', label: '수용가 담당자' },
  { value: 'CONSULTANT', label: '컨설턴트' },
  { value: 'SPC_OPERATOR', label: 'SPC 운영자' },
  { value: 'FIELD_OPERATOR', label: '현장 운영자' },
  { value: 'AGENCY_ADMIN', label: '용역사 관리자' },
];

const ROLE_LABEL_MAP: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

function roleLabel(code: string): string {
  return ROLE_LABEL_MAP[code] ?? code;
}

export default function UsersPage() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.add);
  const [tabId, setTabId] = useState('all');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [detailRow, setDetailRow] = useState<UserRow | null>(null);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editRole, setEditRole] = useState('');

  const [deleteRow, setDeleteRow] = useState<UserRow | null>(null);

  const { data: apiData, isError } = useUsers({ keyword: search || undefined });
  const updateUserMut = useUpdateUser();
  const assignRoleByCodeMut = useAssignRoleByCode();
  const suspendMut = useSuspendUser();
  const activateMut = useActivateUser();
  const deleteUserMut = useDeleteUser();

  const roleOptions = ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }));

  const users: UserRow[] =
    !isError && apiData?.content
      ? apiData.content.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          company: u.companyName ?? '',
          role: u.roles?.[0] ?? '-',
          status: (u.status as UserRow['status']) ?? 'ACTIVE',
          lastLogin: u.lastLoginAt?.replace('T', ' ').slice(5, 16) ?? '-',
          phone: u.phone ?? '',
          department: (u as any).department ?? '',
        }))
      : [];

  const filtered = users.filter((u) => {
    if (tabId === 'active' && u.status !== 'ACTIVE') return false;
    if (tabId === 'pending' && u.status !== 'PENDING') return false;
    if (tabId === 'suspended' && u.status !== 'SUSPENDED') return false;
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
    {
      key: 'name',
      header: '사용자',
      width: '200px',
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
      key: 'company',
      header: '소속',
      render: (row) => <span className="text-sm text-slate-300">{row.company || '-'}</span>,
    },
    {
      key: 'role',
      header: '역할',
      width: '160px',
      render: (row) =>
        row.role === '-' ? (
          <span className="text-sm text-slate-500">미배정</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="text-violet-400" />
            <span className="text-sm text-slate-300">{roleLabel(row.role)}</span>
          </div>
        ),
    },
    {
      key: 'status',
      header: '상태',
      width: '90px',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'PENDING' ? 'warning' : 'danger'}>
          {row.status === 'ACTIVE' ? '활성' : row.status === 'PENDING' ? '대기' : '정지'}
        </Badge>
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
      width: '130px',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/platform/users/${row.id}`);
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
              setDeleteRow(row);
            }}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-red-400 transition-colors"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '회원 관리' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">회원 관리</h1>
          <p className="mt-1 text-sm text-slate-400">플랫폼 사용자를 관리합니다</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'all', label: `전체 (${users.length})` },
          { id: 'active', label: `활성 (${users.filter((u) => u.status === 'ACTIVE').length})` },
          { id: 'pending', label: `대기 (${users.filter((u) => u.status === 'PENDING').length})` },
          { id: 'suspended', label: `정지 (${users.filter((u) => u.status === 'SUSPENDED').length})` },
        ]}
        activeId={tabId}
        onChange={setTabId}
      />

      <div className="flex items-center gap-3">
        <div className="w-72">
          <Input
            placeholder="이름, 이메일 또는 기업명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
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
      </div>

      <SectionCard title="">
        <DataTable columns={columns} data={filtered} rowKey={(row) => row.id} emptyMessage="사용자가 없습니다" />
      </SectionCard>

      {/* 상세 모달 */}
      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title="사용자 상세" size="md">
        {detailRow && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-lg font-medium text-slate-300">
                {detailRow.name[0]}
              </div>
              <div>
                <p className="text-base font-medium text-white">{detailRow.name}</p>
                <p className="text-sm text-slate-500">{detailRow.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">소속</p>
                <p className="text-sm text-white">{detailRow.company || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">역할</p>
                <p className="text-sm text-white">{detailRow.role === '-' ? '미배정' : roleLabel(detailRow.role)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">상태</p>
                <Badge
                  variant={
                    detailRow.status === 'ACTIVE' ? 'success' : detailRow.status === 'PENDING' ? 'warning' : 'danger'
                  }
                >
                  {detailRow.status === 'ACTIVE' ? '활성' : detailRow.status === 'PENDING' ? '대기' : '정지'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">최근 로그인</p>
                <p className="text-sm text-slate-300 tabular-nums">{detailRow.lastLogin}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">연락처</p>
                <p className="text-sm text-slate-300">{detailRow.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">부서</p>
                <p className="text-sm text-slate-300">{detailRow.department || '-'}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              {detailRow.status === 'ACTIVE' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    try {
                      await suspendMut.mutateAsync(detailRow.id);
                      showToast('success', `${detailRow.name} 계정이 정지되었습니다`);
                      setDetailRow(null);
                    } catch {
                      showToast('error', '계정 정지에 실패했습니다');
                    }
                  }}
                >
                  계정 정지
                </Button>
              )}
              {detailRow.status === 'SUSPENDED' && (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await activateMut.mutateAsync(detailRow.id);
                      showToast('success', `${detailRow.name} 계정이 활성화되었습니다`);
                      setDetailRow(null);
                    } catch {
                      showToast('error', '계정 활성화에 실패했습니다');
                    }
                  }}
                >
                  계정 활성화
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDetailRow(null);
                  openEdit(detailRow);
                }}
              >
                <Pencil size={14} className="mr-1" /> 수정
              </Button>
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
            <div className="text-sm text-slate-400 mb-2">{editRow.email}</div>
            <Input label="이름" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="연락처" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <Input label="부서" value={editDept} onChange={(e) => setEditDept(e.target.value)} />
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

      {/* 삭제 확인 */}
      <Modal open={!!deleteRow} onClose={() => setDeleteRow(null)} title="사용자 삭제" size="sm">
        {deleteRow && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{deleteRow.name}</span> ({deleteRow.email})을(를) 정말
              삭제하시겠습니까?
            </p>
            <p className="text-xs text-slate-500">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setDeleteRow(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={deleteUserMut.isPending}
                onClick={async () => {
                  try {
                    await deleteUserMut.mutateAsync(deleteRow.id);
                    showToast('success', `${deleteRow.name}님이 삭제되었습니다`);
                    setDeleteRow(null);
                  } catch {
                    showToast('error', '삭제에 실패했습니다');
                  }
                }}
              >
                {deleteUserMut.isPending ? '삭제 중...' : '삭제'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
