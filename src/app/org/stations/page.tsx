'use client';

import { useState } from 'react';
import type { Package } from 'lucide-react';
import {
  Plus,
  Sun,
  Wind,
  Droplets,
  Battery,
  MapPin,
  Factory,
  Building2,
  Warehouse,
  FileCheck,
  Zap,
  Users,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { usePersonaOverride, getPersona, type Persona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { cn } from '@/lib/utils';
import { usePowerStationsByCompany } from '@/hooks/common/usePowerStations';
import { useConsumerSites, useCreateConsumerSite } from '@/hooks/consumer/useConsumer';
import { useSpcAssets } from '@/hooks/spc/useSpc';
import { useProfileByUser } from '@/hooks/consulting/useConsultations';
import * as consultationApi from '@/api/consulting/consultations';
import * as stationApi from '@/api/common/power-stations';
import type { PowerStation } from '@/types/power-station';
import type { ConsumerSite } from '@/types/consumer';
import type { SpcAsset } from '@/types/spc';
import type { Consultant, ConsultantCertification } from '@/types/consultation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consultantKeys } from '@/api/queryKeys';

/* ─── Generator config ─── */

const DEFAULT_TYPE_INFO = { icon: Sun, label: '기타', color: 'text-slate-400', bg: 'bg-slate-500/10' };
const DEFAULT_STATUS_INFO = { label: '운영중', variant: 'success' as const };

const STATION_TYPE_ICON: Record<string, { icon: typeof Sun; label: string; color: string; bg: string }> = {
  SOLAR: { icon: Sun, label: '태양광', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  WIND: { icon: Wind, label: '풍력', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  HYDRO: { icon: Droplets, label: '수력', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ESS: { icon: Battery, label: 'ESS', color: 'text-violet-400', bg: 'bg-violet-500/10' },
};

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  ACTIVE: { label: '운영중', variant: 'success' },
  INACTIVE: { label: '중지', variant: 'danger' },
  SUSPENDED: { label: '점검중', variant: 'warning' },
  PENDING: { label: '대기', variant: 'warning' },
};

const GENERATOR_TYPE_OPTIONS = [
  { value: 'SOLAR', label: '태양광' },
  { value: 'WIND', label: '풍력' },
  { value: 'HYDRO', label: '수력' },
  { value: 'ESS', label: 'ESS' },
];

/* ─── Consumer config ─── */

const SITE_TYPE_ICON: Record<string, { icon: typeof Factory; label: string; color: string; bg: string }> = {
  factory: { icon: Factory, label: '공장', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  building: { icon: Building2, label: '빌딩', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warehouse: { icon: Warehouse, label: '물류센터', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const CONSUMER_TYPE_OPTIONS = [
  { value: 'factory', label: '공장' },
  { value: 'building', label: '빌딩' },
  { value: 'warehouse', label: '물류센터' },
];

/* ─── SPC config ─── */

const ASSET_TYPE_ICON: Record<string, { icon: typeof Package; label: string; color: string; bg: string }> = {
  ppa: { icon: FileCheck, label: 'PPA계약', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  generation: { icon: Zap, label: '발전자원', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  demand: { icon: Users, label: '수요자원', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

const ASSET_STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  active: { label: '활성', variant: 'success' },
  pending: { label: '대기', variant: 'warning' },
  expired: { label: '만료', variant: 'danger' },
};

const SPC_TYPE_OPTIONS = [
  { value: 'ppa', label: 'PPA계약' },
  { value: 'generation', label: '발전자원' },
  { value: 'demand', label: '수요자원' },
];

/* ─── Page Config ─── */

interface PageConfig {
  title: string;
  description: string;
  addLabel: string;
}

const PAGE_CONFIG: Record<Persona, PageConfig> = {
  generator: { title: '발전소 관리', description: '등록된 발전소와 설비를 관리합니다', addLabel: '발전소 등록' },
  consumer: { title: '사업장 관리', description: '등록된 사업장의 에너지 사용을 관리합니다', addLabel: '사업장 등록' },
  consultant: {
    title: '컨설턴트 프로필',
    description: '마켓플레이스에 노출되는 전문가 프로필을 관리합니다',
    addLabel: '자격증 추가',
  },
  spc: { title: '자산 관리', description: 'PPA 계약 및 발전/수요 자원을 관리합니다', addLabel: '자산 등록' },
  admin: { title: '시스템 설정', description: '플랫폼 운영 및 시스템 환경을 관리합니다', addLabel: '' },
  operator: { title: '담당 발전소', description: '현장 운영 담당 발전소 목록', addLabel: '' },
  agency: {
    title: '용역 프로젝트',
    description: '소속 컨설턴트의 용역 프로젝트를 관리합니다',
    addLabel: '프로젝트 등록',
  },
};

/* ─── Loading ─── */

function LoadingView() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-slate-400" />
    </div>
  );
}

function EmptyView({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <p className="text-sm mb-4">등록된 항목이 없습니다</p>
      <Button size="sm" onClick={onAdd}>
        <Plus size={14} className="mr-1.5" /> {label}
      </Button>
    </div>
  );
}

/* ─── Component ─── */

export default function StationsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const userVal = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(userVal);

  const config = PAGE_CONFIG[persona];

  if (persona === 'admin') return <AdminSystemView config={config} />;
  if (persona === 'consumer')
    return (
      <ConsumerView config={config} addOpen={addOpen} setAddOpen={setAddOpen} companyId={userVal?.companyId ?? 0} />
    );
  if (persona === 'consultant')
    return <ConsultantView config={config} addOpen={addOpen} setAddOpen={setAddOpen} userId={userVal?.id ?? 0} />;
  if (persona === 'spc')
    return <SpcView config={config} addOpen={addOpen} setAddOpen={setAddOpen} companyId={userVal?.companyId ?? 0} />;
  return <GeneratorView config={config} addOpen={addOpen} setAddOpen={setAddOpen} />;
}

/* ─── Generator View ─── */

function GeneratorView({
  config,
  addOpen,
  setAddOpen,
}: {
  config: PageConfig;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}) {
  // 회사 스코프 — 로그인 회사 소유 발전소만 표시(타사 노출 방지). by-company는 배열 반환.
  const companyId = useAuthStore((s) => s.user?.companyId) ?? undefined;
  const { data, isLoading } = usePowerStationsByCompany(companyId);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.add);

  const stations: PowerStation[] = data ?? [];

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formCapacity, setFormCapacity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPermitNo, setFormPermitNo] = useState('');
  const [formCommissionDate, setFormCommissionDate] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: object) => stationApi.createPowerStation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['power-stations'] });
      setAddOpen(false);
      addToast('success', '발전소 등록 완료');
      setFormName('');
      setFormType('');
      setFormCapacity('');
      setFormAddress('');
    },
    onError: () => addToast('error', '발전소 등록 실패'),
  });

  const handleRegister = () => {
    createMutation.mutate({
      name: formName,
      generationType: formType,
      capacityKw: parseFloat(formCapacity) || 0,
      address: formAddress,
      externalPlantId: formPermitNo || undefined,
      commissionedAt: formCommissionDate || undefined,
    });
  };

  if (isLoading) return <LoadingView />;

  const operatingCount = stations.filter((s) => s.status === 'ACTIVE').length;
  const maintenanceCount = stations.filter((s) => s.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{config.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5" /> {config.addLabel}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{stations.length}</p>
          <p className="text-xs text-slate-400 mt-1">전체 발전소</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{operatingCount}</p>
          <p className="text-xs text-slate-400 mt-1">운영중</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{maintenanceCount}</p>
          <p className="text-xs text-slate-400 mt-1">점검중</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{stations.length}</p>
          <p className="text-xs text-slate-400 mt-1">총 설비</p>
        </div>
      </div>

      {stations.length === 0 ? (
        <EmptyView label={config.addLabel} onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {stations.map((station) => {
            const typeInfo = STATION_TYPE_ICON[station.generationType] ?? DEFAULT_TYPE_INFO;
            const statusInfo = STATUS_BADGE[station.status] ?? DEFAULT_STATUS_INFO;
            const Icon = typeInfo.icon;
            return (
              <div
                key={station.id}
                className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 hover:ring-white/[0.12] transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${typeInfo.bg}`}>
                      <Icon size={18} className={typeInfo.color} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{station.name}</p>
                      <p className="text-xs text-slate-500">
                        {typeInfo.label} · {station.capacityKw}kW
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
                <div className="space-y-2.5">
                  {station.address && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} />
                      <span>{station.address}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                    <div>
                      <p className="text-[10px] text-slate-500">설비 용량</p>
                      <p className="text-sm font-semibold text-white tabular-nums">
                        {station.capacityKw.toLocaleString()} kW
                      </p>
                    </div>
                    {station.commissionedAt && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500">준공일</p>
                        <p className="text-sm font-semibold text-white tabular-nums">{station.commissionedAt}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setAddOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.08] p-8 text-slate-500 hover:border-primary/30 hover:text-primary transition-colors"
          >
            <Plus size={24} />
            <span className="text-sm">{config.addLabel}</span>
          </button>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={config.addLabel} size="md">
        <div className="space-y-4">
          <Input
            label="발전소명"
            placeholder="그린솔라 2호"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="유형"
              placeholder="유형 선택"
              options={GENERATOR_TYPE_OPTIONS}
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
            />
            <Input
              label="설비 용량 (kW)"
              placeholder="500"
              required
              value={formCapacity}
              onChange={(e) => setFormCapacity(e.target.value)}
            />
          </div>
          <Input
            label="소재지"
            placeholder="경기도 화성시 봉담읍"
            required
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="사업 허가번호"
              placeholder="허가번호 입력"
              value={formPermitNo}
              onChange={(e) => setFormPermitNo(e.target.value)}
            />
            <Input
              label="준공일"
              type="date"
              value={formCommissionDate}
              onChange={(e) => setFormCommissionDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button onClick={handleRegister} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록중...' : '등록'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Consumer View ─── */

function ConsumerView({
  config,
  addOpen,
  setAddOpen,
  companyId,
}: {
  config: PageConfig;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  companyId: number;
}) {
  const { data, isLoading } = useConsumerSites({ companyId });
  const createMutation = useCreateConsumerSite();
  const addToast = useToastStore((s) => s.add);

  const sites: ConsumerSite[] = data?.content ?? [];

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formPower, setFormPower] = useState('');
  const [formAddress, setFormAddress] = useState('');

  const handleRegister = () => {
    createMutation.mutate(
      {
        companyId,
        name: formName,
        siteType: formType,
        address: formAddress,
        contractPowerKw: parseFloat(formPower) || undefined,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          addToast('success', '사업장 등록 완료');
          setFormName('');
          setFormType('');
          setFormPower('');
          setFormAddress('');
        },
        onError: () => addToast('error', '사업장 등록 실패'),
      },
    );
  };

  if (isLoading) return <LoadingView />;

  const operatingCount = sites.filter((s) => s.status === 'operating' || s.status === 'ACTIVE').length;
  const maintenanceCount = sites.filter((s) => s.status === 'maintenance' || s.status === 'SUSPENDED').length;
  const avgRePercent =
    sites.length > 0 ? Math.round(sites.reduce((a, s) => a + (s.rePercent ?? 0), 0) / sites.length) : 0;

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{config.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5" /> {config.addLabel}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{sites.length}</p>
          <p className="text-xs text-slate-400 mt-1">전체 사업장</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{operatingCount}</p>
          <p className="text-xs text-slate-400 mt-1">운영중</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{maintenanceCount}</p>
          <p className="text-xs text-slate-400 mt-1">점검중</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{avgRePercent}%</p>
          <p className="text-xs text-slate-400 mt-1">RE100 평균</p>
        </div>
      </div>

      {sites.length === 0 ? (
        <EmptyView label={config.addLabel} onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map((site) => {
              const typeInfo = SITE_TYPE_ICON[site.siteType] ?? DEFAULT_TYPE_INFO;
              const isActive = site.status === 'operating' || site.status === 'ACTIVE';
              const isMaintenance = site.status === 'maintenance' || site.status === 'SUSPENDED';
              const statusInfo = isMaintenance
                ? { label: '점검중', variant: 'warning' as const }
                : isActive
                  ? { label: '운영중', variant: 'success' as const }
                  : { label: '중지', variant: 'danger' as const };
              const Icon = typeInfo.icon;
              return (
                <div
                  key={site.id}
                  className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 hover:ring-white/[0.12] transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${typeInfo.bg}`}>
                        <Icon size={18} className={typeInfo.color} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{site.name}</p>
                        <p className="text-xs text-slate-500">{typeInfo.label}</p>
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                  <div className="space-y-2.5">
                    {site.address && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin size={12} />
                        <span>{site.address}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <div>
                        <p className="text-[10px] text-slate-500">피크수요</p>
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {site.peakDemandKw ? `${site.peakDemandKw.toLocaleString()} kW` : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500">계약전력</p>
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {site.contractPowerKw ? `${site.contractPowerKw.toLocaleString()} kW` : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <div>
                        <p className="text-[10px] text-slate-500">RE100</p>
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            (site.rePercent ?? 0) >= 50 ? 'text-emerald-400' : 'text-amber-400',
                          )}
                        >
                          {site.rePercent ?? 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setAddOpen(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.08] p-8 text-slate-500 hover:border-primary/30 hover:text-primary transition-colors"
            >
              <Plus size={24} />
              <span className="text-sm">{config.addLabel}</span>
            </button>
          </div>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">RE100 이행 현황</h3>
            <div className="space-y-3">
              {sites.map((site) => (
                <div key={site.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-24 truncate">{site.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (site.rePercent ?? 0) >= 50 ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                      style={{ width: `${site.rePercent ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{site.rePercent ?? 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={config.addLabel} size="md">
        <div className="space-y-4">
          <Input
            label="사업장명"
            placeholder="에코 제3공장"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="유형"
              placeholder="유형 선택"
              options={CONSUMER_TYPE_OPTIONS}
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
            />
            <Input
              label="계약 전력 (kW)"
              placeholder="500"
              required
              value={formPower}
              onChange={(e) => setFormPower(e.target.value)}
            />
          </div>
          <Input
            label="소재지"
            placeholder="경기도 안산시"
            required
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button onClick={handleRegister} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록중...' : '등록'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Consultant Profile View ─── */

function ConsultantView({
  config,
  addOpen,
  setAddOpen,
  userId,
}: {
  config: PageConfig;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  userId: number;
}) {
  const { data: profileData, isLoading: profileLoading } = useProfileByUser(userId);
  const profile = profileData as Consultant | undefined;

  const { data: certData } = useQuery({
    queryKey: consultantKeys.certifications(profile?.id ?? 0),
    queryFn: () => consultationApi.getCertifications(profile?.id ?? 0),
    enabled: !!profile?.id,
  });
  const certifications = (certData ?? []) as ConsultantCertification[];

  const addToast = useToastStore((s) => s.add);
  const [formCertName, setFormCertName] = useState('');
  const [formIssuer, setFormIssuer] = useState('');
  const [formIssuedAt, setFormIssuedAt] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const handleRegister = () => {
    setAddOpen(false);
    addToast('success', '자격증 추가 완료');
    setFormCertName('');
    setFormIssuer('');
    setFormIssuedAt('');
    setFormExpiresAt('');
  };

  if (profileLoading) return <LoadingView />;

  if (!profile) {
    return (
      <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
        <div>
          <h1 className="text-xl font-bold text-white">{config.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-sm">컨설턴트 프로필이 등록되지 않았습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{config.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary shrink-0">
            {profile.userName?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white">{profile.userName}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{profile.region}</p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{profile.bio}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => addToast('info', '프로필 수정은 컨설턴트 프로필 페이지에서 가능합니다')}
          >
            프로필 수정
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/[0.06]">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.experienceYears ?? '-'}년</p>
            <p className="text-xs text-slate-500 mt-0.5">경력</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.completedProjects}건</p>
            <p className="text-xs text-slate-500 mt-0.5">완료 프로젝트</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-400">{profile.rating}</p>
            <p className="text-xs text-slate-500 mt-0.5">고객 평점</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">자격증 · 인증</h3>
          <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1" /> {config.addLabel}
          </Button>
        </div>
        {certifications.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">등록된 자격증이 없습니다</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {certifications.map((cert, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm text-white">{cert.certType}</p>
                  <p className="text-xs text-slate-500">
                    {cert.issuer} · {cert.issuedAt ?? '-'}
                  </p>
                </div>
                <Badge variant={cert.expiresAt && new Date(cert.expiresAt) < new Date() ? 'danger' : 'success'}>
                  {cert.expiresAt && new Date(cert.expiresAt) < new Date() ? '만료' : '유효'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="자격증 추가" size="md">
        <div className="space-y-4">
          <Input
            label="자격증명"
            placeholder="에너지관리기사"
            required
            value={formCertName}
            onChange={(e) => setFormCertName(e.target.value)}
          />
          <Input
            label="발급기관"
            placeholder="한국산업인력공단"
            required
            value={formIssuer}
            onChange={(e) => setFormIssuer(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="취득일" type="date" value={formIssuedAt} onChange={(e) => setFormIssuedAt(e.target.value)} />
            <Input
              label="만료일 (선택)"
              type="date"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button onClick={handleRegister}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Admin System View ─── */

function AdminSystemView({ config }: { config: PageConfig }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-white">{config.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{config.description}</p>
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">시스템 상태</h3>
        </div>
        <div className="divide-y divide-white/[0.06]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white">점검 모드</p>
              <p className="text-xs text-slate-500">활성화 시 사용자에게 점검 안내 페이지를 표시합니다</p>
            </div>
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                maintenanceMode ? 'bg-amber-500' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  maintenanceMode ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white">신규 가입 허용</p>
              <p className="text-xs text-slate-500">비활성화 시 초대를 통해서만 가입 가능합니다</p>
            </div>
            <button
              onClick={() => setSignupOpen(!signupOpen)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                signupOpen ? 'bg-emerald-500' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  signupOpen ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">약관 · 정책</h3>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {[
            { name: '이용약관', version: 'v2.1', updated: '2026-03-01' },
            { name: '개인정보처리방침', version: 'v3.0', updated: '2026-04-15' },
            { name: '전자금융거래이용약관', version: 'v1.2', updated: '2025-12-01' },
          ].map((doc) => (
            <div key={doc.name} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm text-white">{doc.name}</p>
                <p className="text-xs text-slate-500">
                  {doc.version} · {doc.updated} 개정
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => useToastStore.getState().add('info', `${doc.name} 수정 모드`)}
              >
                수정
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">공지사항</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => useToastStore.getState().add('info', '공지사항 작성 기능이 곧 추가됩니다')}
          >
            <Plus size={14} className="mr-1" /> 공지 작성
          </Button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {[
            { title: '5월 정기점검 안내', date: '2026-05-01', status: '게시중' },
            { title: 'PPA 거래 수수료 변경 안내', date: '2026-04-20', status: '게시중' },
            { title: '신규 기능 업데이트 안내', date: '2026-04-10', status: '종료' },
          ].map((notice) => (
            <div key={notice.title} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm text-white">{notice.title}</p>
                <p className="text-xs text-slate-500">{notice.date}</p>
              </div>
              <Badge variant={notice.status === '게시중' ? 'success' : 'default'}>{notice.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SPC View ─── */

function SpcView({
  config,
  addOpen,
  setAddOpen,
  companyId,
}: {
  config: PageConfig;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  companyId: number;
}) {
  const { data: assets = [], isLoading } = useSpcAssets(companyId);
  const addToast = useToastStore((s) => s.add);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formScale, setFormScale] = useState('');
  const [formStartDate, setFormStartDate] = useState('');

  const handleRegister = () => {
    setAddOpen(false);
    addToast('success', '자산 등록 완료');
    setFormName('');
    setFormType('');
    setFormScale('');
    setFormStartDate('');
  };

  if (isLoading) return <LoadingView />;

  const assetList = assets as SpcAsset[];
  const activeCount = assetList.filter((a) => a.status === 'active').length;
  const ppaCount = assetList.filter((a) => a.assetType === 'ppa').length;

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{config.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5" /> {config.addLabel}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{assetList.length}</p>
          <p className="text-xs text-slate-400 mt-1">전체 자산</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-1">활성</p>
        </div>
        <div className="rounded-lg bg-surface-card ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-violet-400 tabular-nums">{ppaCount}</p>
          <p className="text-xs text-slate-400 mt-1">PPA 계약</p>
        </div>
      </div>

      {assetList.length === 0 ? (
        <EmptyView label={config.addLabel} onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {assetList.map((asset) => {
              const typeInfo = ASSET_TYPE_ICON[asset.assetType] ?? DEFAULT_TYPE_INFO;
              const statusInfo = ASSET_STATUS_BADGE[asset.status] ?? DEFAULT_STATUS_INFO;
              const Icon = typeInfo.icon;
              return (
                <div
                  key={asset.id}
                  className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 hover:ring-white/[0.12] transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${typeInfo.bg}`}>
                        <Icon size={18} className={typeInfo.color} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{asset.name}</p>
                        <p className="text-xs text-slate-500">{typeInfo.label}</p>
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <div>
                        <p className="text-[10px] text-slate-500">규모</p>
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {asset.scaleValue}
                          {asset.scaleUnit}
                        </p>
                      </div>
                      {asset.startDate && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500">시작일</p>
                          <p className="text-sm font-semibold text-white tabular-nums">{asset.startDate}</p>
                        </div>
                      )}
                    </div>
                    {asset.monthlyRevenue != null && (
                      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <div>
                          <p className="text-[10px] text-slate-500">월 수익</p>
                          <p className="text-sm font-semibold text-emerald-400 tabular-nums">
                            {asset.monthlyRevenue.toLocaleString()}원
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setAddOpen(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.08] p-8 text-slate-500 hover:border-primary/30 hover:text-primary transition-colors"
            >
              <Plus size={24} />
              <span className="text-sm">{config.addLabel}</span>
            </button>
          </div>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">포트폴리오 요약</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-violet-400 tabular-nums">
                  {assetList.filter((a) => a.assetType === 'ppa').reduce((sum, a) => sum + a.scaleValue, 0)}
                  {assetList.find((a) => a.assetType === 'ppa')?.scaleUnit ?? 'MW'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">PPA 총 용량</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-400 tabular-nums">
                  {assetList.filter((a) => a.assetType === 'generation').reduce((sum, a) => sum + a.scaleValue, 0)}
                  {assetList.find((a) => a.assetType === 'generation')?.scaleUnit ?? 'MW'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">발전자원</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400 tabular-nums">
                  {assetList.filter((a) => a.assetType === 'demand').reduce((sum, a) => sum + a.scaleValue, 0)}
                  {assetList.find((a) => a.assetType === 'demand')?.scaleUnit ?? 'MW'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">수요자원</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={config.addLabel} size="md">
        <div className="space-y-4">
          <Input
            label="자산명"
            placeholder="A사 태양광 PPA"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="유형"
              placeholder="유형 선택"
              options={SPC_TYPE_OPTIONS}
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
            />
            <Input
              label="규모"
              placeholder="10MW / 20년"
              required
              value={formScale}
              onChange={(e) => setFormScale(e.target.value)}
            />
          </div>
          <Input label="시작일" type="month" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button onClick={handleRegister}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
