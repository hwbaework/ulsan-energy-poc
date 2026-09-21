'use client';

import { useRef, useState } from 'react';
import { Plus, Building2, Eye, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany } from '@/hooks/platform/useCompanies';
import { useUsers } from '@/hooks/platform/useUsers';
import { useToastStore } from '@/stores/useToastStore';
const BIZ_NUM_RE = /^\d{3}-\d{2}-\d{5}$/;

function licenseFileName(companyName: string) {
  return `사업자등록증_${companyName || 'company'}.txt`;
}
function downloadLicense(companyName: string, bizNum: string, rep: string) {
  // POC — 실제 업로드 파일이 없어 데모용 파일을 내려받는다.
  const content = [
    '사업자 등록증 (데모)',
    '',
    `기업명: ${companyName || '-'}`,
    `사업자등록번호: ${bizNum || '-'}`,
    `대표자: ${rep || '-'}`,
  ].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = licenseFileName(companyName);
  a.click();
  URL.revokeObjectURL(url);
}

interface FormErrors {
  name?: string;
  businessNumber?: string;
  representative?: string;
}

function validateCompanyForm(name: string, bizNum: string, rep: string): FormErrors {
  const errors: FormErrors = {};
  if (!name.trim()) errors.name = '기업명을 입력해주세요';
  if (!bizNum.trim()) {
    errors.businessNumber = '사업자등록번호를 입력해주세요';
  } else if (!BIZ_NUM_RE.test(bizNum.trim())) {
    errors.businessNumber = '형식: 000-00-00000';
  }
  if (!rep.trim()) errors.representative = '대표자명을 입력해주세요';
  return errors;
}

interface CompanyRow {
  id: number;
  name: string;
  representative: string;
  businessNumber: string;
  phone: string;
  type: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  memberCount: number;
  createdAt: string;
}

// 사업 유형 → 회원가입 3유형과 동일한 표기
function companyType(businessTypes: string[] = []): string {
  if (businessTypes.includes('발전사업자')) return '발전사업자';
  if (businessTypes.includes('수용가')) return '전기사용자';
  if (businessTypes.includes('SPC') || businessTypes.includes('운영사')) return '관리자 (SPC)';
  return '-';
}

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBizNum, setFormBizNum] = useState('');
  const [formRep, setFormRep] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [detailRow, setDetailRow] = useState<CompanyRow | null>(null);
  const { data: usersData } = useUsers({});
  const [editRow, setEditRow] = useState<CompanyRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<CompanyRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editBizNum, setEditBizNum] = useState('');
  const [editRep, setEditRep] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [addLicenseName, setAddLicenseName] = useState<string | null>(null);
  const [editLicenseName, setEditLicenseName] = useState<string | null>(null);
  const addFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((s) => s.add);
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const [addErrors, setAddErrors] = useState<FormErrors>({});
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  function openEdit(row: CompanyRow) {
    setEditRow(row);
    setEditName(row.name);
    setEditBizNum(row.businessNumber);
    setEditRep(row.representative);
    setEditPhone(row.phone);
    setEditAddress('');
    setEditLicenseName(null);
  }

  const { data: apiData, isError } = useCompanies({ q: search || undefined });

  const companies: CompanyRow[] =
    !isError && apiData?.content
      ? apiData.content.map((c) => ({
          id: c.id,
          name: c.name,
          representative: c.representativeName ?? '',
          businessNumber: c.businessNumber,
          phone: c.phone ?? '',
          type: companyType(c.businessTypes),
          status: (c.status as CompanyRow['status']) ?? 'ACTIVE',
          memberCount: 0,
          createdAt: c.createdAt?.split('T')[0] ?? '',
        }))
      : [];

  const filtered = companies.filter((c) => c.name.includes(search) || c.representative.includes(search));


  const columns: Column<CompanyRow>[] = [
    {
      key: 'name',
      header: '기업명',
      width: '240px',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <Building2 size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{row.name}</p>
            <p className="text-xs text-slate-500 tabular-nums">{row.businessNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'representative',
      header: '대표자',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-300">{row.representative}</span>,
    },
    {
      key: 'type',
      header: '유형',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-300">{row.type}</span>,
    },
    {
      key: 'phone',
      header: '기업 연락처',
      width: '160px',
      render: (row) => <span className="text-sm text-slate-400 tabular-nums">{row.phone}</span>,
    },
    {
      key: 'createdAt',
      header: '등록일',
      width: '120px',
      render: (row) => <span className="text-sm text-slate-500 tabular-nums">{row.createdAt}</span>,
    },
    {
      key: 'id' as keyof CompanyRow,
      header: '',
      width: '120px',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDetailRow(row);
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
      <Breadcrumb items={[{ label: '관리' }, { label: '기업 관리' }]} />

      <h1 className="text-2xl font-bold text-white">기업 관리</h1>

      <SectionCard
        title="기업 목록"
        actions={
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Input
                placeholder="기업명 또는 대표자 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} className="mr-1.5" /> 기업 등록
            </Button>
          </div>
        }
      >
        <DataTable columns={columns} data={filtered} rowKey={(row) => row.id} emptyMessage="등록된 기업이 없습니다" />
      </SectionCard>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddErrors({});
        }}
        title="기업 등록"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="기업명"
            placeholder="(주)그린에너지"
            required
            value={formName}
            onChange={(e) => {
              setFormName(e.target.value);
              if (addErrors.name) setAddErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={addErrors.name}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="사업자등록번호"
              placeholder="000-00-00000"
              required
              value={formBizNum}
              onChange={(e) => {
                setFormBizNum(e.target.value);
                if (addErrors.businessNumber) setAddErrors((prev) => ({ ...prev, businessNumber: undefined }));
              }}
              error={addErrors.businessNumber}
            />
            <Input
              label="대표자명"
              placeholder="홍길동"
              required
              value={formRep}
              onChange={(e) => {
                setFormRep(e.target.value);
                if (addErrors.representative) setAddErrors((prev) => ({ ...prev, representative: undefined }));
              }}
              error={addErrors.representative}
            />
          </div>
          <Input
            label="기업 연락처"
            placeholder="02-0000-0000"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
          />
          <Input
            label="기업 주소"
            placeholder="서울특별시 강남구"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />
          <div>
            <p className="text-sm font-medium text-accent mb-1.5">사업자등록증 (선택)</p>
            <input
              ref={addFileRef}
              type="file"
              accept=".pdf,.jpg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAddLicenseName(f.name);
                e.target.value = '';
              }}
            />
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => addFileRef.current?.click()}>
                <Upload size={14} className="mr-1.5" /> 파일 선택
              </Button>
              {addLicenseName && <span className="text-sm text-slate-300">{addLicenseName}</span>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button
              variant="secondary"
              onClick={() => {
                setAddOpen(false);
                setAddErrors({});
              }}
            >
              취소
            </Button>
            <Button
              disabled={createCompany.isPending}
              onClick={() => {
                const errs = validateCompanyForm(formName, formBizNum, formRep);
                if (Object.keys(errs).length > 0) {
                  setAddErrors(errs);
                  return;
                }
                createCompany.mutate(
                  {
                    name: formName.trim(),
                    businessNumber: formBizNum.trim(),
                    representativeName: formRep.trim(),
                    phone: formPhone.trim() || undefined,
                    address: formAddress.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      addToast('success', `${formName.trim()} 기업이 등록되었습니다`);
                      setAddOpen(false);
                      setAddErrors({});
                      setFormName('');
                      setFormBizNum('');
                      setFormRep('');
                      setFormPhone('');
                      setFormAddress('');
                    },
                    onError: (err) => addToast('error', `등록 실패: ${(err as Error).message}`),
                  },
                );
              }}
            >
              {createCompany.isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>
      </Modal>
      {/* 상세 모달 */}
      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title="기업 상세" size="md">
        {detailRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">기업명</p>
                <p className="text-sm text-white font-medium">{detailRow.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">사업자등록번호</p>
                <p className="text-sm text-slate-300 tabular-nums">{detailRow.businessNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">대표자</p>
                <p className="text-sm text-slate-300">{detailRow.representative || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">기업 연락처</p>
                <p className="text-sm text-slate-300 tabular-nums">{detailRow.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">등록일</p>
                <p className="text-sm text-slate-300 tabular-nums">{detailRow.createdAt}</p>
              </div>
            </div>

            {(() => {
              const members = (usersData?.content ?? []).filter((u) => (u.companyName ?? '') === detailRow.name);
              return (
                <div>
                  <p className="mb-2 text-xs text-slate-500">소속 멤버 ({members.length})</p>
                  {members.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                            <th className="px-3 py-2 font-medium">이름</th>
                            <th className="px-3 py-2 font-medium">이메일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((u) => (
                            <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                              <td className="px-3 py-2 text-white">{u.name}</td>
                              <td className="px-3 py-2 text-slate-400">{u.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-white/[0.06] px-3 py-4 text-center text-sm text-slate-500">
                      소속 멤버가 없습니다
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDetailRow(null);
                  openEdit(detailRow);
                }}
              >
                <Pencil size={14} className="mr-1.5" /> 수정
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDetailRow(null)}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 수정 모달 */}
      <Modal
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          setEditErrors({});
        }}
        title="기업 수정"
        size="md"
      >
        {editRow && (
          <div className="space-y-4">
            <Input
              label="기업명"
              required
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: undefined }));
              }}
              error={editErrors.name}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="사업자등록번호"
                required
                value={editBizNum}
                onChange={(e) => {
                  setEditBizNum(e.target.value);
                  if (editErrors.businessNumber) setEditErrors((prev) => ({ ...prev, businessNumber: undefined }));
                }}
                error={editErrors.businessNumber}
              />
              <Input
                label="대표자명"
                required
                value={editRep}
                onChange={(e) => {
                  setEditRep(e.target.value);
                  if (editErrors.representative) setEditErrors((prev) => ({ ...prev, representative: undefined }));
                }}
                error={editErrors.representative}
              />
            </div>
            <Input label="기업 연락처" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Input label="기업 주소" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            <div>
              <p className="text-sm font-medium text-accent mb-1.5">사업자등록증</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{editLicenseName ?? licenseFileName(editName)}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadLicense(editName, editBizNum, editRep)}
                >
                  <Download size={14} className="mr-1.5" /> 다운로드
                </Button>
              </div>
              <input
                ref={editFileRef}
                type="file"
                accept=".pdf,.jpg,.png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setEditLicenseName(f.name);
                    addToast('success', '사업자 등록증을 교체했습니다');
                  }
                  e.target.value = '';
                }}
              />
              <Button variant="secondary" size="sm" className="mt-1.5" onClick={() => editFileRef.current?.click()}>
                <Upload size={14} className="mr-1.5" /> 등록증 업데이트
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditRow(null);
                  setEditErrors({});
                }}
              >
                취소
              </Button>
              <Button
                disabled={updateCompany.isPending}
                onClick={() => {
                  const errs = validateCompanyForm(editName, editBizNum, editRep);
                  if (Object.keys(errs).length > 0) {
                    setEditErrors(errs);
                    return;
                  }
                  updateCompany.mutate(
                    {
                      id: editRow.id,
                      data: {
                        name: editName.trim(),
                        businessNumber: editBizNum.trim(),
                        representativeName: editRep.trim(),
                        phone: editPhone.trim() || undefined,
                        address: editAddress.trim() || undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        addToast('success', `${editName.trim()} 기업 정보가 수정되었습니다`);
                        setEditRow(null);
                        setEditErrors({});
                      },
                      onError: (err) => addToast('error', `수정 실패: ${(err as Error).message}`),
                    },
                  );
                }}
              >
                {updateCompany.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal open={!!deleteRow} onClose={() => setDeleteRow(null)} title="기업 삭제" size="sm">
        {deleteRow && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{deleteRow.name}</span>을(를) 정말 삭제하시겠습니까?
            </p>
            <p className="text-xs text-slate-500">이 작업은 되돌릴 수 없으며, 관련 멤버의 소속 정보도 해제됩니다.</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setDeleteRow(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={deleteCompany.isPending}
                onClick={() => {
                  deleteCompany.mutate(deleteRow.id, {
                    onSuccess: () => {
                      addToast('success', `${deleteRow.name} 기업이 삭제되었습니다`);
                      setDeleteRow(null);
                    },
                    onError: (err) => addToast('error', `삭제 실패: ${(err as Error).message}`),
                  });
                }}
              >
                {deleteCompany.isPending ? '삭제 중...' : '삭제'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
