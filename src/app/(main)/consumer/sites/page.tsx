// @ts-nocheck
'use client';

import { useState } from 'react';
import { Plus, Building2, MapPin, Zap, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  useConsumerSites,
  useCreateConsumerSite,
  useUpdateConsumerSite,
  useDeleteConsumerSite,
} from '@/hooks/consumer/useConsumer';

const SITE_TYPES = [
  { value: 'FACTORY', label: '공장' },
  { value: 'OFFICE', label: '사무실/빌딩' },
  { value: 'WAREHOUSE', label: '창고/물류' },
  { value: 'RETAIL', label: '매장/상업시설' },
  { value: 'OTHER', label: '기타' },
];

export default function ConsumerSitesPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? 0);

  const { data: sitesData, isLoading } = useConsumerSites({ companyId });
  const sites = sitesData?.content ?? [];
  const createMutation = useCreateConsumerSite();
  const updateMutation = useUpdateConsumerSite();
  const deleteMutation = useDeleteConsumerSite();
  const addToast = useToastStore((s) => s.add);

  // 등록 모달
  const [open, setOpen] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState('FACTORY');
  const [address, setAddress] = useState('');
  const [contractPowerKw, setContractPowerKw] = useState('');

  // 수정 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('FACTORY');
  const [editAddress, setEditAddress] = useState('');
  const [editPowerKw, setEditPowerKw] = useState('');

  const isValid = siteName.trim() && address.trim();
  const isEditValid = editName.trim() && editAddress.trim();

  const resetForm = () => {
    setSiteName('');
    setSiteType('FACTORY');
    setAddress('');
    setContractPowerKw('');
  };

  const handleSubmit = () => {
    if (!isValid) return;
    createMutation.mutate(
      {
        companyId,
        name: siteName.trim(),
        siteType,
        address: address.trim(),
        contractPowerKw: parseFloat(contractPowerKw) || undefined,
      },
      {
        onSuccess: () => {
          addToast('success', '사업장이 등록되었습니다.');
          setOpen(false);
          resetForm();
        },
        onError: () => addToast('error', '사업장 등록에 실패했습니다.'),
      },
    );
  };

  const openEdit = (site: any) => {
    setEditId(site.id);
    setEditName(site.name);
    setEditType(site.siteType ?? 'FACTORY');
    setEditAddress(site.address ?? '');
    setEditPowerKw(site.contractPowerKw != null ? String(site.contractPowerKw) : '');
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!isEditValid || editId == null) return;
    updateMutation.mutate(
      {
        id: editId,
        name: editName.trim(),
        siteType: editType,
        address: editAddress.trim(),
        contractPowerKw: parseFloat(editPowerKw) || undefined,
      },
      {
        onSuccess: () => {
          addToast('success', '사업장 정보가 수정되었습니다.');
          setEditOpen(false);
        },
        onError: () => addToast('error', '수정에 실패했습니다.'),
      },
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`"${name}" 사업장을 삭제하시겠습니까?`)) return;
    deleteMutation.mutate(id, {
      onSuccess: () => addToast('success', '사업장이 삭제되었습니다.'),
      onError: () => addToast('error', '삭제에 실패했습니다.'),
    });
  };

  const totalPower = sites.reduce((s: number, r: any) => s + (Number(r.contractPowerKw) || 0), 0);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '대시보드', path: '/consumer' }, { label: '사업장 관리' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">사업장 관리</h1>
          <p className="mt-1 text-sm text-slate-400">사업장을 등록하고 에너지 사용 현황을 관리합니다</p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          사업장 등록
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
          <p className="text-[11px] text-slate-400">등록 사업장</p>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">{sites.length}건</p>
        </div>
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
          <p className="text-[11px] text-slate-400">총 계약전력</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300 tabular-nums">{totalPower.toLocaleString()} kW</p>
        </div>
      </div>

      {/* 사업장 목록 */}
      <SectionCard title={`등록 사업장 ${sites.length}건`} description="등록된 사업장 목록">
        {isLoading ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">로딩 중...</p>
          </div>
        ) : sites.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 size={40} className="mx-auto text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">등록된 사업장이 없습니다</p>
            <p className="mt-1 text-xs text-slate-500">사업장을 등록하면 에너지 관리가 가능합니다</p>
            <Button variant="ghost" className="mt-4" onClick={() => setOpen(true)}>
              <Plus size={14} className="mr-1" />첫 사업장 등록하기
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {sites.map((site: any) => {
              const typeLabel = SITE_TYPES.find((t) => t.value === site.siteType)?.label ?? site.siteType;
              return (
                <div key={site.id} className="px-4 py-3 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/[0.10] text-blue-300 ring-1 ring-blue-500/30 shrink-0 mt-0.5">
                    <Building2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{site.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {typeLabel} · {site.address || '주소 미등록'} ·{' '}
                      {Number(site.contractPowerKw || 0).toLocaleString()} kW
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        site.status === 'OPERATING' || site.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400',
                      )}
                    >
                      {site.status === 'OPERATING' || site.status === 'ACTIVE' ? '운영중' : '점검중'}
                    </span>
                    <button
                      onClick={() => openEdit(site)}
                      className="p-1 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-colors"
                      title="수정"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(site.id, site.name)}
                      className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 등록 모달 */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="사업장 등록"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              취소
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!isValid || createMutation.isPending}>
              <Building2 size={14} className="mr-1.5" />
              {createMutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">사업장명 *</label>
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="예: 울산 제1공장" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">사업장 유형 *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {SITE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSiteType(t.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-colors',
                    siteType === t.value
                      ? 'border-primary/40 bg-primary/[0.06] text-primary ring-1 ring-primary/30'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/[0.15]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">주소 *</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 울산광역시 남구 산업로 123"
              icon={<MapPin size={14} />}
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">계약전력 (kW)</label>
            <Input
              type="number"
              value={contractPowerKw}
              onChange={(e) => setContractPowerKw(e.target.value)}
              placeholder="예: 500"
              icon={<Zap size={14} />}
            />
          </div>
        </div>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="사업장 수정"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={handleUpdate} disabled={!isEditValid || updateMutation.isPending}>
              <Pencil size={14} className="mr-1.5" />
              {updateMutation.isPending ? '수정 중...' : '저장'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">사업장명 *</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="예: 울산 제1공장" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">사업장 유형 *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {SITE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEditType(t.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-colors',
                    editType === t.value
                      ? 'border-primary/40 bg-primary/[0.06] text-primary ring-1 ring-primary/30'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/[0.15]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">주소 *</label>
            <Input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="예: 울산광역시 남구 산업로 123"
              icon={<MapPin size={14} />}
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">계약전력 (kW)</label>
            <Input
              type="number"
              value={editPowerKw}
              onChange={(e) => setEditPowerKw(e.target.value)}
              placeholder="예: 500"
              icon={<Zap size={14} />}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
