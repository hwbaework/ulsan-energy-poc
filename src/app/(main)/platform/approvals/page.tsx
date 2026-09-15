// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { Building2, UserPlus, FileText, Mail, Phone, MapPin, Briefcase, CheckCircle, Zap } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useUsers, useActivateUser, useSuspendUser } from '@/hooks/platform/useUsers';
import { useCompanies, useActivateCompany, useSuspendCompany } from '@/hooks/platform/useCompanies';
import { usePowerStations } from '@/hooks/common/usePowerStations';
import { useToastStore } from '@/stores/useToastStore';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

interface ApprovalItem {
  id: number;
  type: 'company' | 'user' | 'station';
  category: 'company' | 'consultant' | 'enterprise' | 'station';
  name: string;
  email: string;
  company: string;
  phone: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  roles: string[];
  companyId?: number;
  companyStatus?: string;
  businessNumber?: string;
  representative?: string;
  companyPhone?: string;
  address?: string;
  department?: string;
  capacity?: number;
  stationType?: string;
  stationStatus?: string;
}

const ENTERPRISE_ROLE_LABELS: Record<string, string> = {
  POWER_OPERATOR: '발전사업자',
  CONSUMER_MANAGER: '수용가',
  AGENCY_ADMIN: '용역사 (에이전시)',
  SPC_OPERATOR: 'SPC (전기 공급사업자)',
};

const ROLE_OPTIONS = [
  { value: 'POWER_OPERATOR', label: '발전사업자' },
  { value: 'CONSUMER_MANAGER', label: '수용가' },
  { value: 'COMPANY_ADMIN', label: '기업 관리자' },
  { value: 'SPC_OPERATOR', label: 'SPC 운영자' },
  { value: 'CONSULTANT', label: '컨설턴트' },
  { value: 'PPA_MANAGER', label: 'PPA 관리자' },
];

const STATUS_FILTER = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기중' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
];

export default function ApprovalsPage() {
  const [tabId, setTabId] = useState('company');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [detailItem, setDetailItem] = useState<ApprovalItem | null>(null);
  const [rejectItem, setRejectItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const router = useRouter();
  const addToast = useToastStore((s) => s.add);
  const { data: apiUsers, isError: usersErr } = useUsers({ status: 'PENDING' });
  const { data: apiCompanies, isError: companiesErr } = useCompanies();
  const { data: apiStations, isError: stationsErr } = usePowerStations();
  const activateUser = useActivateUser();
  const activateCompany = useActivateCompany();
  const suspendUser = useSuspendUser();
  const suspendCompany = useSuspendCompany();
  const queryClient = useQueryClient();
  const _activateStation = useMutation({
    mutationFn: (id: number) => getApiClient().patch(ENDPOINTS.powerStations.activate(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['powerStations'] }),
  });
  const deactivateStation = useMutation({
    mutationFn: (id: number) => getApiClient().patch(ENDPOINTS.powerStations.deactivate(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['powerStations'] }),
  });
  const [companyApproved, setCompanyApproved] = useState(false);

  const companyStatusMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (!companiesErr && apiCompanies?.content) {
      apiCompanies.content.forEach((c: any) => {
        if (c.id != null) map[c.id] = c.status ?? 'PENDING';
      });
    }
    return map;
  }, [companiesErr, apiCompanies]);

  const approvals: ApprovalItem[] = (() => {
    const items: ApprovalItem[] = [];
    if (!usersErr && apiUsers?.content) {
      apiUsers.content.forEach((u: any) => {
        if (u.status === 'PENDING') {
          const roles: string[] = u.roles ?? [];
          const isConsultant = roles.some((r: string) => r.toUpperCase() === 'CONSULTANT');
          const cId = u.companyId ?? undefined;
          items.push({
            id: u.id,
            type: 'user',
            category: isConsultant ? 'consultant' : 'enterprise',
            name: u.name ?? '',
            email: u.email ?? '',
            company: u.companyName ?? '',
            phone: u.phone ?? '',
            date: u.createdAt?.split('T')[0] ?? '',
            status: 'pending',
            roles,
            companyId: cId,
            companyStatus: cId != null ? (companyStatusMap[cId] ?? 'PENDING') : undefined,
            businessNumber: u.businessNumber,
            representative: u.representative,
            companyPhone: u.companyPhone,
            address: u.companyAddress,
            department: u.department,
          });
        }
      });
    }
    if (!companiesErr && apiCompanies?.content) {
      apiCompanies.content.forEach((c: any) => {
        if (c.status === 'PENDING') {
          items.push({
            id: c.id,
            type: 'company',
            category: 'company',
            name: c.name ?? '',
            email: c.email ?? '',
            company: c.name ?? '',
            phone: c.phone ?? '',
            date: c.createdAt?.split('T')[0] ?? '',
            status: 'pending',
            roles: [],
            businessNumber: c.businessNumber,
            representative: c.representative,
            address: c.address,
          });
        }
      });
    }
    const stationList = (apiStations as any)?.content ?? apiStations ?? [];
    if (!stationsErr && Array.isArray(stationList)) {
      stationList.forEach((s: any) => {
        if (s.status === 'PENDING' || s.status === 'INACTIVE') {
          items.push({
            id: s.id,
            type: 'station',
            category: 'station',
            name: s.name ?? '',
            email: '',
            company: s.companyName ?? '',
            phone: '',
            date: s.createdAt?.split('T')[0] ?? '',
            status: 'pending',
            roles: [],
            companyId: s.companyId,
            address: s.address ?? s.location ?? '',
            capacity: s.capacity ?? s.capacityKw ?? 0,
            stationType: s.type ?? s.resourceType ?? '',
            stationStatus: s.status,
          });
        }
      });
    }
    return items;
  })();

  const companyPendingCount = approvals.filter((d) => d.category === 'company' && d.status === 'pending').length;
  const enterprisePendingCount = approvals.filter((d) => d.category === 'enterprise' && d.status === 'pending').length;
  const consultantPendingCount = approvals.filter((d) => d.category === 'consultant' && d.status === 'pending').length;
  const stationPendingCount = approvals.filter((d) => d.category === 'station' && d.status === 'pending').length;

  const filtered = approvals.filter((item) => {
    if (tabId === 'company' && item.category !== 'company') return false;
    if (tabId === 'consultant' && item.category !== 'consultant') return false;
    if (tabId === 'user' && item.category !== 'enterprise') return false;
    if (tabId === 'station' && item.category !== 'station') return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<ApprovalItem>[] = [
    {
      key: 'type',
      header: '구분',
      width: '80px',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.category === 'company' ? (
            <Building2 size={14} className="text-blue-400" />
          ) : row.category === 'consultant' ? (
            <Briefcase size={14} className="text-amber-400" />
          ) : row.category === 'station' ? (
            <Zap size={14} className="text-violet-400" />
          ) : (
            <UserPlus size={14} className="text-emerald-400" />
          )}
          <span className="text-xs text-slate-400">
            {row.category === 'company'
              ? '기업'
              : row.category === 'consultant'
                ? '컨설턴트'
                : row.category === 'station'
                  ? '발전소'
                  : '기업회원'}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      header: '이름',
      width: '160px',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-white">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'company',
      header: '소속 / 용량',
      render: (row) => (
        <div>
          <span className="text-sm text-slate-300">{row.type === 'company' ? '-' : row.company || '-'}</span>
          {row.type === 'station' && row.capacity != null && row.capacity > 0 && (
            <p className="text-xs text-slate-500">{row.capacity.toLocaleString()} kW</p>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: '신청일',
      width: '110px',
      render: (row) => <span className="text-sm text-slate-400 tabular-nums">{row.date}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (row) => (
        <Badge variant={row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'danger'}>
          {row.status === 'pending' ? '대기' : row.status === 'approved' ? '승인' : '반려'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => setDetailItem(row)}>
              상세
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRejectItem(row);
                setRejectReason('');
              }}
            >
              반려
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '승인 관리' }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">승인 관리</h1>
        <p className="mt-1 text-sm text-slate-400">기업, 사용자, 발전소 등록 요청을 검토합니다</p>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'company', label: `기업 (${companyPendingCount})` },
          { id: 'station', label: `발전소 (${stationPendingCount})` },
          { id: 'consultant', label: `컨설턴트 (${consultantPendingCount})` },
          { id: 'user', label: `회원관리 (${enterprisePendingCount})` },
        ]}
        activeId={tabId}
        onChange={setTabId}
      />

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="w-40">
          <Select
            options={STATUS_FILTER}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="상태 필터"
          />
        </div>
        <span className="text-xs text-slate-500">{filtered.length}건</span>
      </div>

      {/* Table */}
      <SectionCard title="">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          emptyMessage="승인 대기 항목이 없습니다"
        />
      </SectionCard>

      {/* Detail Modal */}
      <Modal
        open={!!detailItem}
        onClose={() => {
          setDetailItem(null);
          setCompanyApproved(false);
        }}
        title={`${detailItem?.type === 'company' ? '기업' : detailItem?.type === 'station' ? '발전소' : '사용자'} 승인 — ${detailItem?.name}`}
        size="md"
      >
        {detailItem && (
          <div className="space-y-5">
            {/* 발전소 정보 (station only) */}
            {detailItem.type === 'station' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">발전소 정보</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={<Zap size={14} />} label="발전소명" value={detailItem.name} />
                  <InfoRow icon={<Building2 size={14} />} label="소속 기업" value={detailItem.company || '-'} />
                  <InfoRow icon={<FileText size={14} />} label="설비 유형" value={detailItem.stationType || '-'} />
                  <InfoRow
                    icon={<Zap size={14} />}
                    label="설비 용량"
                    value={detailItem.capacity ? `${detailItem.capacity.toLocaleString()} kW` : '-'}
                  />
                  <InfoRow icon={<MapPin size={14} />} label="소재지" value={detailItem.address ?? '-'} span />
                </div>
              </div>
            )}

            {/* 신청자 정보 (user/company) */}
            {detailItem.type !== 'station' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">신청자 정보</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={<Mail size={14} />} label="이메일" value={detailItem.email} />
                  <InfoRow icon={<Phone size={14} />} label="연락처" value={detailItem.phone || '-'} />
                  {detailItem.type === 'user' && (
                    <>
                      <InfoRow icon={<UserPlus size={14} />} label="부서" value={detailItem.department ?? '-'} />
                      {detailItem.roles.length > 0 && (
                        <InfoRow
                          icon={<Briefcase size={14} />}
                          label="신청 역할"
                          value={detailItem.roles.map((r) => ENTERPRISE_ROLE_LABELS[r] ?? r).join(', ')}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 기업 정보 (user/company) */}
            {detailItem.type !== 'station' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">기업 정보</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={<Building2 size={14} />} label="기업명" value={detailItem.company || '-'} />
                  <InfoRow
                    icon={<FileText size={14} />}
                    label="사업자등록번호"
                    value={detailItem.businessNumber ?? '-'}
                  />
                  <InfoRow icon={<UserPlus size={14} />} label="대표자명" value={detailItem.representative ?? '-'} />
                  <InfoRow icon={<Phone size={14} />} label="기업 연락처" value={detailItem.companyPhone ?? '-'} />
                  <InfoRow icon={<MapPin size={14} />} label="기업 주소" value={detailItem.address ?? '-'} span />
                </div>
              </div>
            )}

            {/* Role Assignment */}
            {detailItem.type === 'user' && (
              <Select
                label="역할 배정"
                placeholder="역할을 선택하세요"
                options={ROLE_OPTIONS}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
            )}

            {/* 기업 승인 완료 후 회원관리 이동 안내 */}
            {companyApproved && detailItem.type === 'company' && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <CheckCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-300">기업이 승인되었습니다</p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">소속 사용자의 승인도 진행하시겠습니까?</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => {
                      setDetailItem(null);
                      setCompanyApproved(false);
                      router.push('/platform/users');
                    }}
                  >
                    회원 관리로 이동
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button
                variant="secondary"
                onClick={() => {
                  setDetailItem(null);
                  setCompanyApproved(false);
                }}
              >
                닫기
              </Button>
              {!companyApproved && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setRejectItem(detailItem);
                      setRejectReason('');
                      setDetailItem(null);
                    }}
                  >
                    반려
                  </Button>
                  <Button
                    disabled={
                      activateUser.isPending ||
                      activateCompany.isPending ||
                      _activateStation.isPending ||
                      (detailItem.type === 'user' &&
                        !!detailItem.companyStatus &&
                        detailItem.companyStatus !== 'ACTIVE')
                    }
                    onClick={() => {
                      if (detailItem.type === 'station') {
                        _activateStation.mutate(detailItem.id, {
                          onSuccess: () => {
                            addToast('success', `${detailItem.name} 발전소를 승인했습니다`);
                            setDetailItem(null);
                          },
                          onError: (err: any) => {
                            const msg = err?.response?.data?.message || err?.message || '승인 실패';
                            addToast('error', `발전소 승인 실패: ${msg}`);
                          },
                        });
                      } else if (detailItem.type === 'company') {
                        activateCompany.mutate(detailItem.id, {
                          onSuccess: () => {
                            addToast('success', `${detailItem.name} 기업을 승인했습니다`);
                            setCompanyApproved(true);
                          },
                          onError: (err: any) => {
                            const msg = err?.response?.data?.message || err?.message || '승인 실패';
                            addToast('error', `기업 승인 실패: ${msg}`);
                          },
                        });
                      } else {
                        activateUser.mutate(detailItem.id, {
                          onSuccess: () => {
                            addToast('success', `${detailItem.name}님을 승인했습니다`);
                            setDetailItem(null);
                          },
                          onError: (err: any) => {
                            const msg = err?.response?.data?.message || err?.message || '승인 실패';
                            addToast(
                              'error',
                              msg.includes('승인되지 않았') ? '소속 기업을 먼저 승인해주세요' : `승인 실패: ${msg}`,
                            );
                          },
                        });
                      }
                    }}
                  >
                    {activateUser.isPending || activateCompany.isPending || _activateStation.isPending
                      ? '처리 중...'
                      : '승인'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Confirm */}
      <Modal open={!!rejectItem} onClose={() => setRejectItem(null)} title="반려 사유 입력" size="sm">
        {rejectItem && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{rejectItem.name}</span>의{' '}
              {rejectItem.type === 'station' ? '등록' : '가입'} 요청을 반려합니다.
            </p>
            <Textarea
              placeholder="반려 사유를 입력하세요 (신청자에게 이메일로 전달됩니다)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejectItem(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={suspendUser.isPending || suspendCompany.isPending || deactivateStation.isPending}
                onClick={() => {
                  if (rejectItem.type === 'station') {
                    deactivateStation.mutate(rejectItem.id, {
                      onSuccess: () => {
                        addToast('success', `${rejectItem.name} 발전소 등록을 반려했습니다`);
                        setRejectItem(null);
                      },
                      onError: (err) => addToast('error', `반려 실패: ${(err as Error).message}`),
                    });
                  } else if (rejectItem.type === 'company') {
                    suspendCompany.mutate(rejectItem.id, {
                      onSuccess: () => {
                        addToast('success', `${rejectItem.name} 기업의 가입을 반려했습니다`);
                        setRejectItem(null);
                      },
                      onError: (err) => addToast('error', `반려 실패: ${(err as Error).message}`),
                    });
                  } else {
                    suspendUser.mutate(rejectItem.id, {
                      onSuccess: () => {
                        addToast('success', `${rejectItem.name}님의 가입을 반려했습니다`);
                        setRejectItem(null);
                      },
                      onError: (err) => addToast('error', `반려 실패: ${(err as Error).message}`),
                    });
                  }
                }}
              >
                {suspendUser.isPending || suspendCompany.isPending || deactivateStation.isPending
                  ? '처리 중...'
                  : '반려 확인'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  span,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}
