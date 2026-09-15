// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sun, Wind, Battery, Plus, Activity, CheckCircle2, AlertTriangle, Clock, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Camera, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';

import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useLeaseEquipmentStore } from '@/stores/useLeaseEquipmentStore';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRegisterEquipment } from '@/hooks/lease/useLease';
import { usePowerStationsByCompany } from '@/hooks/common/usePowerStations';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import {
  useTradingRequests,
  useCreateTradingRequest,
  useUpdateTradingRequest,
  useDeleteTradingRequest,
  useUpdateRequestStatus,
} from '@/hooks/trading/useTrading';

/* ───────────────────────── Types & Fallback ───────────────────────── */

type ResourceType = 'pv' | 'wind' | 'ess' | 'fuelCell';
type PlantStatus = 'normal' | 'maintenance' | 'fault';

// 인버터 — front /monitoring/plant/[id] 데이터 패턴 (이름·출력·온도·상태)
interface PlantInverter {
  name: string;
  outputKw: number;
  capacityKw: number;
  temp: string;
  status: 'normal' | 'warning' | 'maintenance';
}

interface Plant {
  id: string;
  name: string;
  type: ResourceType;
  resourceLabel: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  ring: string;
  chartColor: string;
  capacityKw: number;
  currentKw: number;
  dayKwh: number;
  monthKwh: number;
  region: string;
  address: string;
  model: string;
  facilityCode: string;
  operationStart: string;
  pattern: string;
  status: PlantStatus;
  utilization: number;
  recEligible: boolean; // REC 발급 자격 (false면 0개 — On-Site PPA 등)
  inverters: PlantInverter[]; // front /monitoring/plant 인버터 데이터 정합
}

const STATIC_PLANTS: Plant[] = [];

const STATUS_META: Record<PlantStatus, { label: string; tone: string; bg: string; ring: string; icon: LucideIcon }> = {
  normal: {
    label: '정상',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.08]',
    ring: 'ring-emerald-500/30',
    icon: CheckCircle2,
  },
  maintenance: {
    label: '점검',
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.08]',
    ring: 'ring-blue-500/30',
    icon: Clock,
  },
  fault: {
    label: '이상',
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.08]',
    ring: 'ring-amber-500/30',
    icon: AlertTriangle,
  },
};

/* ───────────────────────── PPA 설비 (직접 PPA) ─────────────────────────
 * 발전사가 보유한 "PPA 설비" 카탈로그 — 사진 중심
 * 설치 위치·용량은 등록 시점에 알 수 없음 (SPC 가 수용가와 매칭할 때 결정)
 * 승인 절차 없음 — 등록하면 SPC 가 Lease 매칭 시 열람
 * TODO(API): PPA 설비 등록/조회 + 사진 업로드 API 연결 */
// Lease 보상 = 수익 분배율(%) — 단가(₩) 개념 없음
// 발전사가 설비를 제공하고 Lease 수익의 몇 %를 받을지 희망값으로 제시 (매칭 협상에서 확정)
interface LeaseEquipment {
  id: string;
  kind: string; // 설비 유형
  model: string; // 모델·제조사
  note: string; // 메모 — 수량·상태 자유 기재
  sharePct: number; // 희망 분배율 (%) — Lease 수익 셰어
  negotiable: boolean; // 협의 가능 여부
  includesInstallation: boolean; // 시공비 포함 여부
  includesVat: boolean; // VAT 포함 여부
  installPeriod: string; // 예상 설치 기간 — 발전사 장비·시공 역량 기준
  photos: string[]; // 사진 URL (public/images) — 비어있으면 placeholder 아이콘
  photoCount: number; // 표시용 사진 수 (photos 없는 항목은 mock 수치)
  registeredAt: string;
}
const LEASE_EQUIPMENT_INITIAL: LeaseEquipment[] = [];
const LEASE_KIND_ICON: Record<string, LucideIcon> = {
  '태양광 모듈': Sun,
  인버터: Activity,
};
const LEASE_KIND_OPTIONS = ['태양광 모듈', '인버터', '기타'] as const;
type LeaseKind = (typeof LEASE_KIND_OPTIONS)[number];

/* ───────────────────────── Page ───────────────────────── */

export default function GeneratorPpaResourcesPage() {
  // 발전사 자원관리 — 로그인 회사가 소유한 발전소만 (admin도 우회 없음)
  const { data: apiPlants } = useMonitoringPlants(true);
  const PLANTS: Plant[] = useMemo(() => {
    const raw = (apiPlants ?? []) as any[];
    if (raw.length === 0) return STATIC_PLANTS;
    const typeMap: Record<string, ResourceType> = { SOLAR: 'pv', ORC: 'fuelCell', FUEL_CELL: 'fuelCell' };
    const iconMap: Record<string, LucideIcon> = { pv: Sun, wind: Wind, ess: Battery };
    const colorMap: Record<string, string> = {
      pv: 'text-amber-400',
      wind: 'text-sky-400',
      ess: 'text-rose-400',
      fuelCell: 'text-violet-400',
    };
    const bgMap: Record<string, string> = {
      pv: 'bg-amber-500/[0.10]',
      wind: 'bg-sky-500/[0.10]',
      ess: 'bg-rose-500/[0.10]',
      fuelCell: 'bg-violet-500/[0.10]',
    };
    const ringMap: Record<string, string> = {
      pv: 'ring-amber-500/30',
      wind: 'ring-sky-500/30',
      ess: 'ring-rose-500/30',
      fuelCell: 'ring-violet-500/30',
    };
    const chartColorMap: Record<string, string> = {
      pv: '#F59E0B',
      wind: '#38BDF8',
      ess: '#F43F5E',
      fuelCell: '#A78BFA',
    };
    const labelMap: Record<string, string> = { pv: '태양광', wind: '풍력', ess: 'ESS', fuelCell: '연료전지' };
    return raw.map((p: any) => {
      const rt: ResourceType = typeMap[p.type] ?? 'pv';
      return {
        id: String(p.plantId ?? p.id),
        name: p.name ?? '발전소',
        type: rt,
        resourceLabel: labelMap[rt],
        icon: iconMap[rt] ?? Sun,
        color: colorMap[rt],
        bg: bgMap[rt],
        ring: ringMap[rt],
        chartColor: chartColorMap[rt],
        capacityKw: p.capacity ?? 0,
        currentKw: p.currentOutput ?? 0,
        dayKwh: p.dailyEnergy ?? 0,
        monthKwh: (p.dailyEnergy ?? 0) * 28,
        region: p.region ?? '',
        address: p.address ?? '',
        model: p.model ?? '',
        facilityCode: p.facilityCode ?? `FC-${p.plantId ?? p.id}`,
        operationStart: p.operationStart ?? p.createdAt?.slice(0, 10) ?? '',
        pattern: '고정형',
        status: (p.status === 'NORMAL'
          ? 'normal'
          : p.status === 'MAINTENANCE'
            ? 'maintenance'
            : 'fault') as PlantStatus,
        utilization: p.capacity > 0 ? Math.round((p.currentOutput / p.capacity) * 100) : 0,
        recEligible: true,
        inverters: [],
      } as Plant;
    });
  }, [apiPlants]);

  const searchParams = useSearchParams();
  const initialScopeId = (() => {
    const q = searchParams.get('plant');
    return q && PLANTS.some((p) => p.id === q) ? q : 'all';
  })();
  const [scopeId, setScopeId] = useState<'all' | string>(initialScopeId);
  // PPA 설비 목록 (persist store — 사진 등 표시용. 영속화는 백엔드)
  const leaseEquipments = useLeaseEquipmentStore((s) => s.equipments);
  const addLeaseEquipment = useLeaseEquipmentStore((s) => s.addEquipment);
  const removeLeaseEquipment = useLeaseEquipmentStore((s) => s.removeEquipment);
  const companyId = useAuthStore((s) => s.user?.companyId) ?? 0;
  const registerEquipmentMut = useRegisterEquipment();

  // ─── 공급 자원 신청 (PPA 거래용) — 등록·SPC승인·희망단가·매칭풀 ───
  const { data: supplyReqData, isError: supplyReqError } = useTradingRequests({ requesterType: 'GENERATOR' });
  const supplyAll =
    !supplyReqError && supplyReqData ? (((supplyReqData as any).content ?? supplyReqData) as any[]) : [];
  const supplyItems = supplyAll.filter(
    (r: any) => r.requesterType === 'GENERATOR' && ['SUBMITTED', 'APPROVED', 'MATCHING'].includes(r.status),
  );
  const createSupplyMut = useCreateTradingRequest();
  const updateSupplyMut = useUpdateTradingRequest();
  const deleteSupplyMut = useDeleteTradingRequest();
  const supplyStatusMut = useUpdateRequestStatus();
  // 발전소 선택식 공급 등록 (설계문서 22 §5.2) — 회사 소유 power_stations 에서 선택, 용량은 자산에서 채움
  const supplyStationsQ = usePowerStationsByCompany(companyId || undefined);
  // 발전유형 게이팅 — 태양광만 PPA 공급 대상(설계25). 연료전지·ORC는 모니터링 전용.
  const supplyStations = (supplyStationsQ.data ?? []).filter((s: any) => s.generationType === 'SOLAR');
  const [supplyStationId, setSupplyStationId] = useState('');
  const [supplyPrice, setSupplyPrice] = useState('');
  const selectedSupplyStation = supplyStations.find((s: any) => String(s.id) === supplyStationId);
  const parseSupplyRes = (notes?: string) => {
    const m = notes?.match(/자원:\s*([^/]+)/);
    const v = m?.[1]?.trim();
    return v === '풍력' || v === 'ESS' || v === '연료전지' ? v : '태양광';
  };
  const SUPPLY_EMPTY = {
    plantName: '',
    resource: '태양광',
    capacityKw: '',
    operationStart: '',
    address: '',
    quantity: '',
  };
  const [supplyOpen, setSupplyOpen] = useState(false);
  // supplyForm/SUPPLY_EMPTY 는 수정 모달과의 상태 리셋 호환용 유지(설계문서 22 §5.2 선택식 전환 후 읽기 미사용).
  const [, setSupplyForm] = useState(SUPPLY_EMPTY);
  // 발전소 선택식 — 발전소만 선택하면 유효(용량·유형·주소는 자산에서 파생). 설계문서 22 §5.2.
  const supplyValid = !!supplyStationId;
  const [supplyEdit, setSupplyEdit] = useState<any | null>(null);
  const [supplyEditForm, setSupplyEditForm] = useState({
    plantName: '',
    capacityKw: '',
    region: '울산',
    resource: '태양광',
  });
  const [supplyCancel, setSupplyCancel] = useState<any | null>(null);
  const [priceTarget, setPriceTarget] = useState<any | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const submitSupply = async () => {
    if (!supplyValid || !selectedSupplyStation) return;
    // 자산에서 파생 — 재입력 아님 (설계문서 22 §5.2). 용량은 station.capacityKw 로 채움(trading_requests.capacity_kw NOT NULL 충족).
    const genTypeLabel =
      selectedSupplyStation.generationType === 'WIND'
        ? '풍력'
        : selectedSupplyStation.generationType === 'ESS'
          ? 'ESS'
          : selectedSupplyStation.generationType === 'FUEL_CELL'
            ? '연료전지'
            : '태양광';
    const noteParts = [`자원: ${genTypeLabel}`];
    if (selectedSupplyStation.address) noteParts.push(`주소: ${selectedSupplyStation.address}`);
    try {
      await createSupplyMut.mutateAsync({
        requesterType: 'GENERATOR',
        companyId,
        dealType: 'PPA',
        capacityKw: Number(selectedSupplyStation.capacityKw ?? 0),
        durationYears: 20,
        plantName: selectedSupplyStation.name,
        region: selectedSupplyStation.address || undefined,
        desiredUnitPrice: supplyPrice ? Number(supplyPrice) : undefined,
        powerStationId: selectedSupplyStation.id,
        notes: noteParts.join(' / '),
      });
      useToastStore.getState().add('success', `${selectedSupplyStation.name} 공급 자원을 신청했습니다 (SPC 승인 대기)`);
      setSupplyOpen(false);
      setSupplyForm(SUPPLY_EMPTY);
      setSupplyStationId('');
      setSupplyPrice('');
    } catch {
      useToastStore.getState().add('error', '공급 자원 신청에 실패했습니다');
    }
  };
  const submitSupplyPrice = async () => {
    if (!priceTarget || !priceInput) return;
    try {
      await updateSupplyMut.mutateAsync({ id: priceTarget.id, data: { desiredUnitPrice: Number(priceInput) } });
      await supplyStatusMut.mutateAsync({ id: priceTarget.id, status: 'MATCHING' });
      useToastStore.getState().add('success', '희망 단가가 등록되어 매칭풀에 올라갔습니다');
      setPriceTarget(null);
      setPriceInput('');
    } catch {
      useToastStore.getState().add('error', '희망 단가 등록에 실패했습니다');
    }
  };

  // PPA 설비 등록 모달
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [leasePhotos, setLeasePhotos] = useState<string[]>([]);
  const [leaseNegotiable, setLeaseNegotiable] = useState(true);
  const [leaseKind, setLeaseKind] = useState<LeaseKind>('태양광 모듈');
  const [leaseModel, setLeaseModel] = useState('');
  const [leaseSharePct, setLeaseSharePct] = useState('');
  const [leaseInstallPeriod, setLeaseInstallPeriod] = useState('');
  const [leaseInstallIncluded, setLeaseInstallIncluded] = useState(true);
  const [leaseVatIncluded, setLeaseVatIncluded] = useState(false);
  const [leaseNote, setLeaseNote] = useState('');
  // 사진 보기 모달
  const [leaseViewer, setLeaseViewer] = useState<LeaseEquipment | null>(null);
  const [leaseViewerIdx, setLeaseViewerIdx] = useState(0);
  const addLeasePhotos = (files: FileList | null) => {
    if (!files) return;
    setLeasePhotos((prev) => [...prev, ...Array.from(files).map((f) => URL.createObjectURL(f))]);
  };
  const resetLeaseForm = () => {
    setLeasePhotos([]);
    setLeaseNegotiable(true);
    setLeaseKind('태양광 모듈');
    setLeaseModel('');
    setLeaseSharePct('');
    setLeaseInstallPeriod('');
    setLeaseInstallIncluded(true);
    setLeaseVatIncluded(false);
    setLeaseNote('');
  };
  const submitLease = async () => {
    const pct = Number(leaseSharePct);
    if (!leaseModel.trim() || !leaseSharePct.trim() || isNaN(pct) || !leaseInstallPeriod.trim()) return;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // 백엔드 영속화 — SPC 거래상세 Lease 후보(GET /lease/equipments)가 이 설비를 조회한다.
    // notes에 분배율·설치기간 등 부가정보 직렬화 (전용 컬럼 미보유).
    const notes = [
      `희망분배율: ${pct}%`,
      `설치기간: ${leaseInstallPeriod.trim()}`,
      leaseNegotiable ? '협의가능' : '고정',
      leaseInstallIncluded ? '시공비포함' : '시공비별도',
      leaseVatIncluded ? 'VAT포함' : 'VAT별도',
      leaseNote.trim(),
    ]
      .filter(Boolean)
      .join(' / ');
    try {
      await registerEquipmentMut.mutateAsync({
        generatorCompanyId: companyId,
        equipmentName: leaseModel.trim(),
        equipmentType: leaseKind,
        capacityKw: 0,
        location: undefined,
        notes,
      });
    } catch {
      useToastStore.getState().add('error', 'PPA 설비 등록(서버)에 실패했습니다.');
      return;
    }
    // 로컬 store — 사진 등 백엔드 미지원 항목의 발전사 화면 표시용
    const newItem: LeaseEquipment = {
      id: `lease-${Date.now()}`,
      kind: leaseKind,
      model: leaseModel.trim(),
      note: leaseNote.trim(),
      sharePct: pct,
      negotiable: leaseNegotiable,
      includesInstallation: leaseInstallIncluded,
      includesVat: leaseVatIncluded,
      installPeriod: leaseInstallPeriod.trim(),
      photos: [...leasePhotos],
      photoCount: leasePhotos.length,
      registeredAt: dateStr,
    };
    addLeaseEquipment(newItem);
    useToastStore.getState().add('success', 'PPA 설비가 등록되었습니다 (SPC 매칭 풀에 노출).');
    setLeaseOpen(false);
    resetLeaseForm();
  };

  const isAll = scopeId === 'all';
  const scopedPlants = isAll ? PLANTS : PLANTS.filter((p) => p.id === scopeId);

  // 합산 KPI
  const kpis = useMemo(() => {
    const totalCurrent = scopedPlants.reduce((s, p) => s + p.currentKw, 0);
    const totalDay = scopedPlants.reduce((s, p) => s + p.dayKwh, 0);
    const totalMonth = scopedPlants.reduce((s, p) => s + p.monthKwh, 0);
    const normalCount = scopedPlants.filter((p) => p.status === 'normal').length;
    const maintenanceCount = scopedPlants.filter((p) => p.status === 'maintenance').length;
    const faultCount = scopedPlants.filter((p) => p.status === 'fault').length;
    return {
      totalCurrent,
      totalDay,
      totalMonth,
      normalCount,
      maintenanceCount,
      faultCount,
    };
  }, [scopedPlants]);

  const selectedPlantLabel = isAll ? `전체 합산 (${PLANTS.length})` : (scopedPlants[0]?.name ?? '전체 합산');

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/generator/trading' }, { label: '직접 PPA' }, { label: '자원관리' }]}
      />

      {/* Header — 우측 발전소 Dropdown + 자원 등록 (generator/ppa/dashboard 와 통일) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">자원관리</h1>
          <p className="mt-1 text-sm text-slate-400">발전소 등록 · 발전 이력 · 인버터 통합 관리</p>
        </div>
        <Dropdown
          align="right"
          trigger={
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[200px] cursor-pointer text-white hover:bg-white/[0.08]">
              <span className="text-xs text-slate-500 shrink-0">발전소</span>
              <span className="font-medium truncate flex-1">{selectedPlantLabel}</span>
              <ChevronDown size={14} className="text-slate-500 shrink-0" />
            </div>
          }
        >
          <DropdownItem onClick={() => setScopeId('all' as any)}>
            <div className="flex items-center gap-2">
              <Building2 size={14} />
              <div>
                <p className="text-sm">전체 합산</p>
                <p className="text-xs text-slate-500">{PLANTS.length}개 발전소</p>
              </div>
            </div>
          </DropdownItem>
          <div className="my-1 border-t border-white/[0.06]" />
          {PLANTS.map((p) => (
            <DropdownItem key={p.id} onClick={() => setScopeId(p.id as any)}>
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                <div>
                  <p className="text-sm">{p.name}</p>
                  <p className="text-xs text-slate-500">{(p as any).capacityKw?.toLocaleString?.() ?? '—'} kW</p>
                </div>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>
      </div>

      {/* KPI 4 — 메인 대시보드와 동일 구성 */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<Activity size={18} className="text-emerald-400" />}
          label="현재 출력"
          value={kpis.totalCurrent > 0 ? `${kpis.totalCurrent.toFixed(1)} kW` : '- kW'}
          sub={(() => {
            const totalCap = scopedPlants.reduce((s, p) => s + p.capacityKw, 0);
            return totalCap > 0
              ? `${Math.round((kpis.totalCurrent / totalCap) * 100)}% (발전소 용량 대비)`
              : '- (발전소 용량 대비)';
          })()}
        />
        <StatCard
          icon={<Sun size={18} className="text-amber-400" />}
          label="발전량 (전일)"
          value={`${kpis.totalDay.toLocaleString()} kWh`}
        />
        <StatCard
          icon={<Clock size={18} className="text-sky-400" />}
          label="발전시간 (전일)"
          value={`${kpis.totalDay > 0 ? (kpis.totalDay / (scopedPlants.reduce((s, p) => s + p.capacityKw, 0) || 1)).toFixed(1) : '0'} 시간`}
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-violet-400" />}
          label="금액 (전일)"
          value={`${((kpis.totalDay * 0.0926) / 10).toFixed(1)} 만원`}
        />
      </StatsGrid>

      {/* 발전소 목록 (전체 합산 모드) */}
      {isAll && PLANTS.length > 0 && (
        <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-md font-semibold text-white">발전소 목록</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">발전소</th>
                  <th className="px-4 py-2 text-left font-medium">자원 / 용량</th>
                  <th className="px-4 py-2 text-left font-medium">지역</th>
                  <th className="px-4 py-2 font-medium">현재 출력</th>
                  <th className="px-4 py-2 font-medium">오늘 발전</th>
                  <th className="px-4 py-2 font-medium">가동률</th>
                  <th className="px-4 py-2 text-left font-medium">상태</th>
                  <th className="px-4 py-2 text-left font-medium">상세</th>
                </tr>
              </thead>
              <tbody>
                {PLANTS.map((p) => {
                  const sm = STATUS_META[p.status];
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setScopeId(p.id)}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
                              p.bg,
                              p.ring,
                            )}
                          >
                            <p.icon size={13} className={p.color} />
                          </span>
                          <p className="text-sm text-white font-medium">{p.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="text-slate-300">{p.resourceLabel}</span>
                        <span className="text-slate-600 mx-1">·</span>
                        <span className="text-slate-400 tabular-nums">{p.capacityKw.toLocaleString()} kW</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{p.region}</td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                        {p.currentKw.toLocaleString()} kW
                      </td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">{p.dayKwh.toLocaleString()} kWh</td>
                      <td
                        className={cn(
                          'px-4 py-3 tabular-nums font-semibold text-sm',
                          p.utilization >= 80
                            ? 'text-emerald-400'
                            : p.utilization >= 60
                              ? 'text-white'
                              : p.utilization > 0
                                ? 'text-amber-400'
                                : 'text-slate-500',
                        )}
                      >
                        {p.utilization.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                            sm.bg,
                            sm.tone,
                            sm.ring,
                          )}
                        >
                          <sm.icon size={9} />
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setScopeId(p.id);
                          }}
                        >
                          상세
                          <ChevronRight size={12} className="ml-0.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 단일 발전소 — 발전량 추이 + 스펙·위치·운영 + 인버터 */}
      {!isAll &&
        scopedPlants[0] &&
        (() => {
          const selected = scopedPlants[0];
          const sm = STATUS_META[selected.status];
          return (
            <div className="space-y-4">
              {/* 목록으로 나가기 */}
              <Button variant="ghost" size="sm" onClick={() => setScopeId('all')}>
                <ChevronLeft size={13} className="mr-1" />
                전체 발전소 목록
              </Button>

              {/* 스펙·위치·운영 */}
              <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-white">스펙·위치·운영</h3>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                        sm.bg,
                        sm.tone,
                        sm.ring,
                      )}
                    >
                      <sm.icon size={10} />
                      {sm.label}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost">
                    <Download size={11} className="mr-1" />
                    스펙 시트
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 px-5 py-4 text-xs">
                  <div className="space-y-1.5">
                    <p>
                      <span className="text-slate-500 mr-2">자원 종류</span>
                      <span className="text-white">{selected.resourceLabel}</span>
                    </p>
                    <p>
                      <span className="text-slate-500 mr-2">설비 용량</span>
                      <span className="text-white tabular-nums">{selected.capacityKw.toLocaleString()} kW</span>
                    </p>
                    <p>
                      <span className="text-slate-500 mr-2">모델</span>
                      <span className="text-white">{selected.model}</span>
                    </p>
                    <p>
                      <span className="text-slate-500 mr-2">설비코드</span>
                      <span className="text-white tabular-nums">{selected.facilityCode}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p>
                      <span className="text-slate-500 mr-2">지역</span>
                      <span className="text-white">{selected.region}</span>
                    </p>
                    <p>
                      <span className="text-slate-500 mr-2">주소</span>
                      <span className="text-white">{selected.address}</span>
                    </p>
                    <p>
                      <span className="text-slate-500 mr-2">운영 시작</span>
                      <span className="text-white tabular-nums">{selected.operationStart}</span>
                    </p>
                    <p>
                      <span className="text-slate-500 mr-2">발전 패턴</span>
                      <span className="text-white">{selected.pattern}</span>
                    </p>
                  </div>
                </div>
              </section>

              {/* 인버터 현황 — front /monitoring/plant 인버터 데이터 정합 */}
              <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-md font-semibold text-white">인버터 현황</h3>
                  <p className="text-[11px] text-slate-500">
                    정상 {selected.inverters.filter((iv) => iv.status === 'normal').length} / 전체{' '}
                    {selected.inverters.length}기
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                      <th className="px-5 py-2 text-left font-medium">인버터</th>
                      <th className="px-4 py-2 text-left font-medium">출력</th>
                      <th className="px-4 py-2 text-left font-medium">용량</th>
                      <th className="px-4 py-2 text-left font-medium">온도</th>
                      <th className="px-4 py-2 text-left font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.inverters.map((iv) => {
                      const ivMeta =
                        iv.status === 'normal'
                          ? { label: '정상', cls: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30' }
                          : iv.status === 'warning'
                            ? { label: '경고', cls: 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30' }
                            : { label: '점검', cls: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30' };
                      return (
                        <tr key={iv.name} className="border-b border-white/[0.04]">
                          <td className="px-5 py-2.5 text-white text-sm">{iv.name}</td>
                          <td className="px-4 py-2.5 text-slate-300 tabular-nums text-xs">{iv.outputKw} kW</td>
                          <td className="px-4 py-2.5 text-slate-300 tabular-nums text-xs">{iv.capacityKw} kW</td>
                          <td className="px-4 py-2.5 text-slate-300 tabular-nums text-xs">{iv.temp}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                ivMeta.cls,
                              )}
                            >
                              {ivMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </div>
          );
        })()}

      {/* 공급 자원 신청 (PPA 거래용) — 등록 → SPC 승인 → 희망단가 → 매칭풀 */}
      <SectionCard
        title={
          <>
            공급 자원 신청{' '}
            <Badge variant="primary" className="ml-2">
              {supplyItems.length}건
            </Badge>
          </>
        }
        description="PPA 거래용 발전 자원 — SPC 승인 후 희망단가를 입력하면 매칭 풀에 등록됩니다"
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setSupplyForm(SUPPLY_EMPTY);
              setSupplyStationId('');
              setSupplyPrice('');
              setSupplyOpen(true);
            }}
          >
            <Plus size={14} className="mr-1" /> 자원 등록
          </Button>
        }
        noPadding
      >
        {supplyItems.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">신청된 공급 자원이 없습니다</p>
            <p className="text-xs text-slate-500 mt-1">&apos;자원 등록&apos;으로 PPA 거래용 발전 자원을 등록하세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">발전소</th>
                  <th className="px-4 py-2 text-left font-medium">자원</th>
                  <th className="px-4 py-2 text-left font-medium">용량</th>
                  <th className="px-4 py-2 text-left font-medium">등록일</th>
                  <th className="px-4 py-2 text-left font-medium">상태</th>
                  <th className="px-4 py-2 text-left font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {supplyItems.map((r: any) => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm text-white font-medium">{r.plantName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{parseSupplyRes(r.notes)}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">
                      {(r.capacityKw ?? 0).toLocaleString()} kW
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
                      {(r.submittedAt ?? r.createdAt)?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'SUBMITTED' ? (
                        <Badge variant="warning">SPC 승인 대기</Badge>
                      ) : r.status === 'MATCHING' ? (
                        <Badge variant="success">매칭풀 등록</Badge>
                      ) : (
                        <Badge variant="info">승인 완료</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'SUBMITTED' ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSupplyEdit(r);
                              setSupplyEditForm({
                                plantName: r.plantName ?? '',
                                capacityKw: String(r.capacityKw ?? ''),
                                region: r.region ?? '울산',
                                resource: parseSupplyRes(r.notes),
                              });
                            }}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-400 hover:text-rose-300"
                            onClick={() => setSupplyCancel(r)}
                          >
                            취소
                          </Button>
                        </div>
                      ) : r.status === 'APPROVED' ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPriceTarget(r);
                            setPriceInput(r.desiredUnitPrice ? String(r.desiredUnitPrice) : '');
                          }}
                        >
                          희망단가 입력
                        </Button>
                      ) : (
                        <span className="text-xs text-emerald-400">매칭풀 등록됨</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* PPA 설비 — 보유한 PPA 설비 카탈로그 (사진 중심, 승인 절차 없음) */}
      <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-md font-semibold text-white">PPA 설비</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              보유한 PPA 설비를 사진으로 등록 — SPC 가 온사이트 PPA 매칭 시 열람 · 설치 위치·용량은 매칭 단계에서 결정
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetLeaseForm();
              setLeaseOpen(true);
            }}
          >
            <Plus size={14} className="mr-1" />
            PPA 설비 등록
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 px-5 py-4">
          {leaseEquipments.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-slate-500">등록된 PPA 설비가 없습니다.</div>
          )}
          {leaseEquipments.map((e) => {
            const KindIcon = LEASE_KIND_ICON[e.kind] ?? ImageIcon;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setLeaseViewer(e);
                  setLeaseViewerIdx(0);
                }}
                className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] overflow-hidden text-left hover:ring-white/[0.16] transition-all group"
              >
                {/* 사진 영역 — photos 있으면 실제 이미지, 없으면 placeholder 아이콘 */}
                <div className="relative h-36 bg-gradient-to-br from-white/[0.06] to-white/[0.01] flex items-center justify-center">
                  {e.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photos[0]} alt={e.kind} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <KindIcon size={36} className="text-slate-600 group-hover:text-slate-500 transition-colors" />
                  )}
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-slate-300">
                    <Camera size={10} />
                    {e.photoCount}장
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-violet-500/[0.10] text-violet-300 ring-violet-500/30">
                    {e.kind}
                  </span>
                  <p className="text-sm text-white font-medium">{e.model}</p>
                  <p className="text-[11px] text-slate-400">{e.note}</p>
                  <div className="pt-1 space-y-0.5">
                    <p className="text-[11px] flex items-center flex-wrap gap-1.5">
                      <span className="text-slate-500">희망 분배율</span>
                      <span className="text-emerald-300 tabular-nums font-medium">{e.sharePct}%</span>
                      {e.negotiable && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ring-1 bg-blue-500/[0.10] text-blue-300 ring-blue-500/30">
                          협의 가능
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {e.includesVat ? 'VAT 포함' : 'VAT 별도'} ·{' '}
                      {e.includesInstallation ? '시공비 포함' : '시공비 별도'}
                    </p>
                    <p className="text-[11px]">
                      <span className="text-slate-500 mr-1.5">설치 기간</span>
                      <span className="text-slate-300">{e.installPeriod}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-600 tabular-nums">등록 {e.registeredAt}</p>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeLeaseEquipment(e.id);
                        useToastStore.getState().add('warning', 'PPA 설비가 삭제되었습니다.');
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* PPA 설비 사진 보기 — 카드 클릭 시 사진 넘겨보기 */}
      {leaseViewer &&
        (() => {
          const KindIcon = LEASE_KIND_ICON[leaseViewer.kind] ?? ImageIcon;
          return (
            <Modal
              open={!!leaseViewer}
              onClose={() => setLeaseViewer(null)}
              title={`${leaseViewer.kind} — 사진 보기`}
              size="lg"
              footer={
                <Button variant="ghost" onClick={() => setLeaseViewer(null)}>
                  닫기
                </Button>
              }
            >
              <div className="space-y-3">
                {/* 사진 영역 — photos 있으면 실제 이미지, 없으면 placeholder 아이콘 */}
                <div className="relative h-72 rounded-lg ring-1 ring-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.01] flex items-center justify-center overflow-hidden">
                  {leaseViewer.photos[leaseViewerIdx] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leaseViewer.photos[leaseViewerIdx]}
                      alt={`${leaseViewer.kind} 사진 ${leaseViewerIdx + 1}`}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  ) : (
                    <KindIcon size={56} className="text-slate-600" />
                  )}
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-slate-300 tabular-nums">
                    {leaseViewerIdx + 1} / {leaseViewer.photoCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLeaseViewerIdx((i) => (i - 1 + leaseViewer.photoCount) % leaseViewer.photoCount)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-300 hover:text-white"
                    aria-label="이전 사진"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaseViewerIdx((i) => (i + 1) % leaseViewer.photoCount)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-300 hover:text-white"
                    aria-label="다음 사진"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 text-xs">모델·제조사</span>
                    <span className="text-white">{leaseViewer.model}</span>
                  </div>
                  <div className="flex justify-between gap-3 items-center">
                    <span className="text-slate-500 text-xs">희망 분배율</span>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="text-emerald-300 tabular-nums">{leaseViewer.sharePct}%</span>
                        {leaseViewer.negotiable && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ring-1 bg-blue-500/[0.10] text-blue-300 ring-blue-500/30">
                            협의 가능
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {leaseViewer.includesVat ? 'VAT 포함' : 'VAT 별도'} ·{' '}
                        {leaseViewer.includesInstallation ? '시공비 포함' : '시공비 별도'}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 text-xs">예상 설치 기간</span>
                    <span className="text-slate-300 text-xs">{leaseViewer.installPeriod}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 text-xs">메모</span>
                    <span className="text-slate-300 text-xs text-right">{leaseViewer.note}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 text-xs">등록일</span>
                    <span className="text-slate-300 tabular-nums text-xs">{leaseViewer.registeredAt}</span>
                  </div>
                </div>
              </div>
            </Modal>
          );
        })()}

      {/* PPA 설비 등록 Modal — 사진 중심, 승인 절차 없음 (등록 즉시 SPC 열람 가능) */}
      <Modal
        open={leaseOpen}
        onClose={() => setLeaseOpen(false)}
        title="PPA 설비 등록"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaseOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={submitLease}
              disabled={!leaseModel.trim() || !leaseSharePct.trim() || !leaseInstallPeriod.trim()}
            >
              등록
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* 사진 업로드 — 핵심 입력 */}
          <div>
            <label className="text-[11px] text-slate-400">설비 사진 *</label>
            <label className="mt-1 flex flex-col items-center justify-center gap-1.5 rounded-lg ring-1 ring-dashed ring-white/[0.16] bg-white/[0.02] px-4 py-6 cursor-pointer hover:bg-white/[0.04] transition-colors">
              <Camera size={20} className="text-slate-500" />
              <span className="text-xs text-slate-400">사진을 선택하세요 (여러 장 가능)</span>
              <span className="text-[10px] text-slate-600">설비 전경 · 명판 · 보관 상태가 잘 보이게</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addLeasePhotos(e.target.files)}
              />
            </label>
            {leasePhotos.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {leasePhotos.map((url, i) => (
                  <div key={url} className="relative h-20 rounded-md overflow-hidden ring-1 ring-white/[0.08]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`설비 사진 ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setLeasePhotos((prev) => prev.filter((u) => u !== url))}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-slate-300 hover:text-white"
                      aria-label="사진 삭제"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">설비 유형 *</label>
              <div className="mt-1">
                <Select
                  options={LEASE_KIND_OPTIONS.map((k) => ({ value: k, label: k }))}
                  value={leaseKind}
                  onChange={(e) => setLeaseKind(e.target.value as LeaseKind)}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">모델·제조사 *</label>
              <Input
                placeholder="예: Q.PEAK DUO ML-G11 · 한화큐셀"
                className="mt-1"
                value={leaseModel}
                onChange={(e) => setLeaseModel(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">희망 분배율 *</label>
              <div className="mt-1 relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="예: 30"
                  className="pr-10"
                  value={leaseSharePct}
                  onChange={(e) => setLeaseSharePct(e.target.value)}
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400 tabular-nums pointer-events-none">
                  %
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Lease 수익 중 발전사가 받을 비율 (희망값)</p>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">예상 설치 기간 *</label>
              <Input
                placeholder="예: 계약 후 약 6주"
                className="mt-1"
                value={leaseInstallPeriod}
                onChange={(e) => setLeaseInstallPeriod(e.target.value)}
              />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Checkbox
                label="협의 가능"
                checked={leaseNegotiable}
                onChange={(e) => setLeaseNegotiable(e.target.checked)}
              />
              <Checkbox
                label="시공비 포함"
                checked={leaseInstallIncluded}
                onChange={(e) => setLeaseInstallIncluded(e.target.checked)}
              />
              <Checkbox
                label="VAT 포함"
                checked={leaseVatIncluded}
                onChange={(e) => setLeaseVatIncluded(e.target.checked)}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-slate-400">메모</label>
              <Input
                placeholder="수량·보관 상태 등 자유 기재 (예: 신품 1,200장 보유)"
                className="mt-1"
                value={leaseNote}
                onChange={(e) => setLeaseNote(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            ※ 설치 위치·용량은 SPC 매칭 단계에서 결정됩니다 — 분배율은 매칭 협상에서 최종 확정 · 등록 즉시 SPC 가 열람할
            수 있습니다.
          </p>
        </div>
      </Modal>

      {/* 공급 자원 — 신규 등록 모달 */}
      <Modal
        open={supplyOpen}
        onClose={() => setSupplyOpen(false)}
        title="공급 자원 등록"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSupplyOpen(false)}>
              취소
            </Button>
            <Button variant="primary" disabled={!supplyValid || createSupplyMut.isPending} onClick={submitSupply}>
              {createSupplyMut.isPending ? '신청 중...' : '등록 신청'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 발전소 선택식 (설계문서 22 §5.2) — 회사 소유 power_stations 선택, 용량·유형·주소는 자산에서 자동 표시 */}
          {supplyStationsQ.isLoading ? (
            <p className="text-xs text-slate-500">발전소 목록을 불러오는 중…</p>
          ) : supplyStations.length === 0 ? (
            // 빈 상태 안내 (설계문서 §5.3) — 신규 자산 폼을 열지 않고 발전소 관리로 안내
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-6 text-center space-y-2">
              <p className="text-sm text-slate-300">등록된 발전소가 없습니다</p>
              <p className="text-xs text-slate-500">
                먼저 발전소 관리(org/stations)에서 자산을 등록한 뒤 여기서 선택해 편입하세요.
              </p>
              <Link href="/org/stations">
                <Button size="sm" variant="secondary" className="mt-1">
                  발전소 관리로 이동
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-accent mb-1.5">발전소 선택 *</label>
                <Select
                  options={supplyStations.map((s: any) => ({
                    value: String(s.id),
                    label: `${s.name} (${s.capacityKw?.toLocaleString?.() ?? '—'} kW)`,
                  }))}
                  value={supplyStationId}
                  placeholder="공급할 발전소 선택"
                  onChange={(e) => setSupplyStationId(e.target.value)}
                />
              </div>
              {selectedSupplyStation && (
                <div className="grid grid-cols-2 gap-3 rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs">
                  <div>
                    <span className="text-slate-500 mr-2">자원 종류</span>
                    <span className="text-white">{selectedSupplyStation.generationType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-2">정격 용량</span>
                    <span className="text-white tabular-nums">
                      {selectedSupplyStation.capacityKw?.toLocaleString?.() ?? '—'} kW
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 mr-2">주소</span>
                    <span className="text-white">{selectedSupplyStation.address ?? '—'}</span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-accent mb-1.5">희망 단가 (원/kWh)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="예: 125 (선택 — 승인 후 입력 가능)"
                  value={supplyPrice}
                  onChange={(e) => setSupplyPrice(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                발전소를 선택하면 용량·유형·주소는 등록 자산에서 자동 반영됩니다. 등록 신청 시 SPC/Admin 검토 대기로
                접수됩니다.
              </p>
            </>
          )}
        </div>
      </Modal>

      {/* 공급 자원 — 수정 모달 */}
      <Modal
        open={!!supplyEdit}
        onClose={() => setSupplyEdit(null)}
        title={`신청 수정 — ${supplyEdit?.plantName ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSupplyEdit(null)}>
              닫기
            </Button>
            <Button
              variant="primary"
              disabled={!supplyEditForm.plantName || !supplyEditForm.capacityKw}
              onClick={async () => {
                if (!supplyEdit) return;
                try {
                  await updateSupplyMut.mutateAsync({
                    id: supplyEdit.id,
                    data: {
                      plantName: supplyEditForm.plantName,
                      capacityKw: Number(supplyEditForm.capacityKw),
                      region: supplyEditForm.region,
                      notes: `자원: ${supplyEditForm.resource}`,
                    },
                  });
                  useToastStore.getState().add('success', `${supplyEditForm.plantName} 신청이 수정되었습니다`);
                } catch {
                  useToastStore.getState().add('error', '신청 수정에 실패했습니다');
                }
                setSupplyEdit(null);
              }}
            >
              수정 저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-accent mb-1.5">발전소명 *</label>
              <Input
                value={supplyEditForm.plantName}
                onChange={(e) => setSupplyEditForm((f) => ({ ...f, plantName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-accent mb-1.5">자원 종류 *</label>
              <Select
                options={[
                  { value: '태양광', label: '태양광' },
                  { value: '풍력', label: '풍력' },
                  { value: 'ESS', label: 'ESS' },
                  { value: '연료전지', label: '연료전지' },
                ]}
                value={supplyEditForm.resource}
                onChange={(e) => setSupplyEditForm((f) => ({ ...f, resource: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-accent mb-1.5">설비 용량 (kW) *</label>
              <Input
                type="number"
                value={supplyEditForm.capacityKw}
                onChange={(e) => setSupplyEditForm((f) => ({ ...f, capacityKw: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-accent mb-1.5">소재 지역 *</label>
              <Input
                value={supplyEditForm.region}
                onChange={(e) => setSupplyEditForm((f) => ({ ...f, region: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* 공급 자원 — 취소 확인 모달 */}
      <Modal
        open={!!supplyCancel}
        onClose={() => setSupplyCancel(null)}
        title="신청 취소"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSupplyCancel(null)}>
              돌아가기
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!supplyCancel) return;
                try {
                  await deleteSupplyMut.mutateAsync(supplyCancel.id);
                  useToastStore.getState().add('warning', `${supplyCancel.plantName ?? '자원'} 신청이 취소되었습니다`);
                } catch {
                  useToastStore.getState().add('error', '신청 취소에 실패했습니다');
                }
                setSupplyCancel(null);
              }}
            >
              취소 확정
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="text-white font-medium">{supplyCancel?.plantName}</span> 공급 자원 신청을 취소하시겠습니까?
        </p>
      </Modal>

      {/* 공급 자원 — 희망단가 입력 모달 */}
      <Modal
        open={!!priceTarget}
        onClose={() => setPriceTarget(null)}
        title="희망 단가 입력"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPriceTarget(null)}>
              취소
            </Button>
            <Button variant="primary" disabled={!priceInput || supplyStatusMut.isPending} onClick={submitSupplyPrice}>
              {supplyStatusMut.isPending ? '등록 중...' : '매칭풀 등록'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            <span className="text-white font-medium">{priceTarget?.plantName ?? '발전소'}</span> 의 희망 단가를 입력하면
            SPC 매칭 후보 풀에 등록됩니다.
          </p>
          <div>
            <label className="block text-xs text-accent mb-1.5">희망 단가 (원/kWh)</label>
            <Input
              type="number"
              min={0}
              placeholder="예: 125"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
