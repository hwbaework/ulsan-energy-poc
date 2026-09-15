// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  RefreshCw,
  XCircle,
  Sun,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  Search,
  ChevronDown,
  Plus,
  BarChart3,
  History as HistoryIcon,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn, exportPdf } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import {
  useVolumeContracts,
  useSavingsContracts,
  useCalculateSavings,
  useCreateLeaseRequest,
} from '@/hooks/lease/useLease';
import { useAuditLogs } from '@/hooks/platform';
import { downloadPdf } from '@/lib/downloadPdf';
import { ENDPOINTS } from '@/api/endpoints';

/* ───────────────────────── Types ───────────────────────── */

type ContractStatus = 'new' | 'active' | 'expiring' | 'extending' | 'changing' | 'returning';

interface LeaseEquipment {
  id: string;
  name: string;
  type: '태양광' | 'ESS' | '태양광+ESS';
  typeIcon: LucideIcon;
  typeColor: string;
  capacityKw: number;
}

interface LeaseContract {
  id: string;
  number: string;
  label: string;
  lessor: string;
  site: string;
  totalCapacity: string;
  totalCapacityKw: number;
  unitPriceKrw: number; // PPA 요금 단가 (₩/kWh)
  equipmentType: string;
  equipmentIcon: LucideIcon;
  equipmentColor: string;
  equipments: LeaseEquipment[];
  period: { start: string; end: string; daysLeft: number; totalMonths: number };
  status: ContractStatus;
  monthlyFee: number; // 2~5월 4개월 평균 (실 PPA 요금는 월별 변동)
  selfConsumptionRate: number; // 자가소비율 (%) — 한일튜브 100% (공장 부하 > 발전)
  currentStep?: number;
  changeType?: 'equipment' | 'terms';
  returnFee?: number;
  extensionEstFee?: number;
}

const STATUS_META: Record<ContractStatus, { label: string; tone: string; bg: string; ring: string }> = {
  new: { label: '설치중', tone: 'text-teal-100', bg: 'bg-[#0e3a3a]', ring: 'ring-teal-400/60' },
  active: { label: '정상', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', ring: 'ring-emerald-500/30' },
  expiring: { label: '만료임박', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
  extending: { label: '연장진행', tone: 'text-blue-300', bg: 'bg-blue-500/[0.08]', ring: 'ring-blue-500/30' },
  changing: { label: '변경진행', tone: 'text-violet-300', bg: 'bg-violet-500/[0.08]', ring: 'ring-violet-500/30' },
  returning: { label: '반환요청', tone: 'text-rose-300', bg: 'bg-rose-500/[0.08]', ring: 'ring-rose-500/30' },
};

const PROCESS_STEPS = ['신청 접수', '설비 점검', '계약 검토', '설치/변경', '가동 개시'];

interface Site {
  id: string;
  label: string;
}

const SITES: Site[] = [{ id: 'hanil', label: '한일튜브 본사' }];

// 한일튜브 본사 옥상 직접 PPA — 실제 운영 정보 기반
//   계약: 2026-01-15 ~ 2046-01-14 (20년)
//   용량: 429.22 kW (API 반환값)
//   단가: ₩118/kWh (전 기간 고정)
//   월 평균 PPA 요금: ₩4,350,720 (2~5월 4개월 평균: 3,005,952 + 4,904,448 + 4,746,240 + 4,746,240)
//   자가소비율: 100% (공장 부하 > 발전)
//   D-day: 오늘 2026-05-29 기준 만료까지 약 7,171일
const CONTRACTS: LeaseContract[] = [
  {
    id: 'lc-001',
    number: 'LS-2026-001',
    label: '한일튜브 본사 옥상 태양광',
    lessor: '에스에너지',
    site: '한일튜브 본사',
    totalCapacity: '429.22 kW',
    totalCapacityKw: 429.22,
    unitPriceKrw: 118,
    equipmentType: '태양광',
    equipmentIcon: Sun,
    equipmentColor: 'text-amber-400',
    equipments: [
      {
        id: 'eq-h1',
        name: '본사 옥상 태양광',
        type: '태양광',
        typeIcon: Sun,
        typeColor: 'text-amber-400',
        capacityKw: 429.22,
      },
    ],
    period: { start: '2026-01-15', end: '2046-01-14', daysLeft: 7171, totalMonths: 240 },
    status: 'active',
    monthlyFee: 4_350_720,
    selfConsumptionRate: 100,
  },
];

/* ───────────────────────── Sub-components ───────────────────────── */

function ScopeTrigger({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[160px]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-white hover:bg-white/[0.08]',
      )}
    >
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="font-medium truncate flex-1">{value}</span>
      <ChevronDown size={14} className="text-slate-500 shrink-0" />
    </div>
  );
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        m.bg,
        m.tone,
        m.ring,
      )}
    >
      {m.label}
    </span>
  );
}

function StatusBoardCard({
  status,
  count,
  active,
  onClick,
}: {
  status: ContractStatus | 'all';
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const label = status === 'all' ? '전체' : STATUS_META[status].label;
  const tone = status === 'all' ? 'text-white' : STATUS_META[status].tone;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 min-w-[110px] flex-col items-start gap-1 rounded-lg border bg-surface-card px-4 py-3 text-left transition-all',
        active ? 'border-primary/60 ring-1 ring-primary/30' : 'border-white/[0.06] hover:border-white/[0.15]',
      )}
    >
      <span className={cn('text-xs', tone)}>{label}</span>
      <span className="text-2xl font-bold text-white tabular-nums">{count}</span>
    </button>
  );
}

function MiniProcessTracker({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {PROCESS_STEPS.map((_, i) => {
          const num = i + 1;
          const done = num < currentStep;
          const active = num === currentStep;
          return (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                done && 'bg-emerald-500/60',
                active && 'bg-primary',
                !done && !active && 'bg-white/[0.08]',
              )}
              title={`${num}. ${PROCESS_STEPS[i]}`}
            />
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        진행 단계{' '}
        <span className="text-white tabular-nums">
          {currentStep}/{PROCESS_STEPS.length}
        </span>{' '}
        · <span className="text-white">{PROCESS_STEPS[currentStep - 1]}</span>
      </p>
    </div>
  );
}

/* 우측 패널의 키 / 값 row — 한번에 모든 정보 노출 (스크롤 없이) */
function InfoRow({
  label,
  value,
  sub,
  valueClass,
  subClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
  subClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 py-2">
      {/* 라벨 — 한 눈에 들어오게 (이전: text-slate-500 흐릿 → text-slate-200 명확) */}
      <span className="text-xs text-slate-200 font-semibold shrink-0 w-[88px]">{label}</span>
      <div className="flex-1 min-w-0 text-right">
        <p className={cn('text-sm tabular-nums truncate', valueClass ?? 'text-white')}>{value}</p>
        {sub && <p className={cn('text-[11px] tabular-nums mt-0.5', subClass ?? 'text-slate-500')}>{sub}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

type ModalKind =
  | null
  | 'contract-view'
  | 'extend'
  | 'change'
  | 'return'
  | 'cancel'
  | 'add-equipment'
  | 'history'
  | 'simulation';

export default function LeaseContractsPage() {
  // API 호출
  const { data: volumeApiData } = useVolumeContracts();
  const { data: savingsApiData } = useSavingsContracts();
  const _apiVolumeContracts = volumeApiData?.content ?? [];
  const _apiSavingsContracts = savingsApiData?.content ?? [];

  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>(CONTRACTS[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [changeType, setChangeType] = useState<'equipment' | 'terms'>('equipment');
  const [reason, setReason] = useState('');
  const [siteId, setSiteId] = useState<'all' | string>('all');
  const [equipmentNote, setEquipmentNote] = useState('');
  const [simUsageKwh, setSimUsageKwh] = useState(50000);
  const [simSharePct, setSimSharePct] = useState(50);

  const createLeaseRequest = useCreateLeaseRequest();
  const { data: auditLogsData } = useAuditLogs({ size: 20 });
  const auditLogs = auditLogsData?.content ?? [];
  const { data: savingsResult } = useCalculateSavings({ usageKwh: simUsageKwh, sharePct: simSharePct });

  const selectedSite = useMemo(
    () => (siteId === 'all' ? null : (SITES.find((s) => s.id === siteId) ?? null)),
    [siteId],
  );

  const handleSiteChange = (id: 'all' | string) => {
    setSiteId(id);
  };

  const scopedContracts = useMemo(
    () =>
      CONTRACTS.filter((c) => {
        if (selectedSite && c.site !== selectedSite.label) return false;
        return true;
      }),
    [selectedSite],
  );

  const handleSelectContract = (id: string) => {
    setSelectedId(id);
  };

  const counts = useMemo(() => {
    const c: Record<ContractStatus | 'all', number> = {
      all: scopedContracts.length,
      new: 0,
      active: 0,
      expiring: 0,
      extending: 0,
      changing: 0,
      returning: 0,
    };
    for (const x of scopedContracts) c[x.status]++;
    return c;
  }, [scopedContracts]);

  const filtered = useMemo(() => {
    return scopedContracts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q) ||
          c.lessor.toLowerCase().includes(q) ||
          c.site.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedContracts, statusFilter, query]);

  const selected = useMemo(() => CONTRACTS.find((c) => c.id === selectedId) ?? CONTRACTS[0], [selectedId]);

  if (!selected || CONTRACTS.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '계약관리' }]}
        />
        <h1 className="text-2xl font-bold text-white">계약관리</h1>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-slate-400">등록된 Lease 계약이 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">리스 설비 계약을 신청하세요.</p>
        </div>
      </div>
    );
  }

  // 진행 / 잠금 — 다른 액션이 진행 중일 때
  const isExtending = selected.status === 'extending';
  const isChanging = selected.status === 'changing';
  const isReturning = selected.status === 'returning';
  const inProgressKind = isExtending ? 'extend' : isChanging ? 'change' : isReturning ? 'return' : null;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '계약관리' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">계약관리</h1>
          <p className="mt-1 text-sm text-slate-400">
            {selectedSite
              ? `${selectedSite.label} · ${scopedContracts.length}개 계약`
              : `전사 합산 · ${SITES.length}개 사업장 · ${CONTRACTS.length}개 계약`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setEquipmentNote('');
              setOpenModal('add-equipment');
            }}
          >
            <Plus size={16} className="mr-1.5" />
            설비 추가 신청
          </Button>
          <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSite?.label ?? '전사 합산'} />}>
            <DropdownItem onClick={() => handleSiteChange('all')}>
              <div>
                <p className="text-sm">전사 합산</p>
                <p className="text-xs text-slate-500">
                  {SITES.length}개 사업장 · {CONTRACTS.length}개 리스
                </p>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => {
              const count = CONTRACTS.filter((c) => c.site === s.label).length;
              return (
                <DropdownItem key={s.id} onClick={() => handleSiteChange(s.id)}>
                  <div>
                    <p className="text-sm">{s.label}</p>
                    <p className="text-xs text-slate-500">{count}개 리스</p>
                  </div>
                </DropdownItem>
              );
            })}
          </Dropdown>
        </div>
      </div>

      {/* Status Board */}
      <div className="flex flex-wrap gap-3">
        <StatusBoardCard
          status="all"
          count={counts.all}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        {(Object.keys(STATUS_META) as ContractStatus[]).map((s) => (
          <StatusBoardCard
            key={s}
            status={s}
            count={counts[s]}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {/* List 2/3 + Action panel 1/3 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left — 2/3 — Contract list (펼침 없이 인라인 통합) */}
        <div className="xl:col-span-2">
          <SectionCard
            title={`PPA 계약 ${filtered.length}건`}
            actions={
              <div className="relative w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="text"
                  placeholder="계약·발전사·사업장 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-4 py-2.5 text-left font-medium">계약</th>
                    <th className="px-3 py-2.5 text-left font-medium">사업장</th>
                    <th className="px-3 py-2.5 text-left font-medium">설비</th>
                    <th className="px-3 py-2.5 font-medium">단가</th>
                    <th className="px-3 py-2.5 font-medium">월 PPA 요금</th>
                    <th className="px-4 py-2.5 font-medium">잔여</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isSelected = c.id === selected.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleSelectContract(c.id)}
                        className={cn(
                          'border-b border-white/[0.04] cursor-pointer transition-colors',
                          isSelected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-white">{c.label}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {c.number} · {c.lessor}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-300">{c.site}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <c.equipmentIcon size={12} className={c.equipmentColor} />
                            <span className="text-xs text-slate-300">{c.equipmentType}</span>
                            <span className="text-[10px] text-slate-500">{c.equipments.length}기</span>
                          </div>
                          <p className="text-[11px] text-slate-500 tabular-nums">{c.totalCapacity}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">₩{c.unitPriceKrw}/kWh</td>
                        <td className="px-3 py-3 text-slate-200 tabular-nums text-xs font-semibold">
                          ₩{c.monthlyFee.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {c.status === 'new' ? (
                            <span className="text-teal-300 text-xs">설치 중</span>
                          ) : (
                            <span
                              className={cn(
                                'tabular-nums text-xs font-medium',
                                c.period.daysLeft < 90 ? 'text-amber-400' : 'text-slate-400',
                              )}
                            >
                              D-{c.period.daysLeft.toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-42 text-sm text-slate-500">
                        조건에 맞는 계약이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Right — 1/3 — 단일 컴팩트 패널 (한 카드에 전부) */}
        <div className="xl:col-span-1">
          <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden sticky top-4">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.10] ring-1 ring-amber-500/30">
                  <selected.equipmentIcon size={16} className={selected.equipmentColor} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-white">{selected.label}</p>
                    <StatusBadge status={selected.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                    {selected.lessor} · {selected.number}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Rows — 한번에 다 보이게 */}
            <div className="px-4 py-2 divide-y divide-white/[0.04]">
              <InfoRow label="사업장" value={selected.site} />
              <InfoRow
                label="용량"
                value={`${selected.totalCapacity}`}
                sub={
                  selected.equipments.length === 1
                    ? selected.equipments[0].type
                    : `${selected.equipments.length}기 (${Array.from(new Set(selected.equipments.map((e) => e.type))).join('+')})`
                }
              />
              <InfoRow label="단가" value={`₩${selected.unitPriceKrw}/kWh`} sub="전 기간 고정" />
              <InfoRow
                label="월 PPA 요금 (평균)"
                value={`₩${selected.monthlyFee.toLocaleString()}`}
                sub="2월·3월·4월·5월"
                valueClass="text-rose-300 font-bold"
              />
              <InfoRow
                label="계약 기간"
                value={`${selected.period.start} ~ ${selected.period.end}`}
                sub={`${selected.period.totalMonths}개월`}
              />
              <InfoRow
                label="잔여"
                value={`D-${selected.period.daysLeft.toLocaleString()}`}
                valueClass={cn('font-bold', selected.period.daysLeft < 90 ? 'text-amber-400' : 'text-white')}
              />
              <InfoRow
                label="자가소비율"
                value={selected.status === 'new' ? '—' : `${selected.selfConsumptionRate}%`}
                sub={selected.status === 'new' ? '가동 후 산출' : '공장 부하 > 발전 (전량 자가소비)'}
                subClass={selected.status === 'new' ? 'text-teal-300' : 'text-slate-500'}
              />
            </div>

            {/* Equipment list — 2기 이상일 때만 (1기면 계약명·용량 row 에 이미 정보 다 있음) */}
            {selected.equipments.length > 1 && (
              <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.015]">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                  설비 ({selected.equipments.length}기)
                </p>
                <div className="space-y-1">
                  {selected.equipments.map((eq) => (
                    <div key={eq.id} className="flex items-center gap-1.5 text-xs">
                      <eq.typeIcon size={11} className={cn(eq.typeColor, 'shrink-0')} />
                      <span className="text-slate-200 flex-1 truncate">{eq.name}</span>
                      <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{eq.capacityKw} kW</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 설치중 banner — status가 new일 때만 */}
            {selected.status === 'new' && selected.currentStep && (
              <div className="px-4 py-3 border-t border-white/[0.06] bg-[#0e3a3a]/40">
                <div className="flex items-start gap-2 mb-2">
                  <Clock size={12} className="mt-0.5 shrink-0 text-teal-200" />
                  <p className="text-[11px] font-semibold text-teal-100">설비 설치 진행 중</p>
                </div>
                <MiniProcessTracker currentStep={selected.currentStep} />
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-white/[0.06] space-y-2">
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpenModal('contract-view')}>
                <FileText size={12} className="mr-1.5" />
                계약서 보기
              </Button>

              {selected.status === 'new' ? (
                <Button
                  size="sm"
                  className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/40"
                  onClick={() => setOpenModal('cancel')}
                >
                  신청 취소
                </Button>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  <ActionButton
                    icon={RefreshCw}
                    label="연장"
                    color="blue"
                    active={isExtending}
                    locked={!isExtending && !!inProgressKind}
                    onClick={() => (isExtending ? setOpenModal('cancel') : setOpenModal('extend'))}
                  />
                  <ActionButton
                    icon={Wrench}
                    label="변경"
                    color="violet"
                    active={isChanging}
                    locked={!isChanging && !!inProgressKind}
                    onClick={() => {
                      if (isChanging) setOpenModal('cancel');
                      else {
                        setChangeType('equipment');
                        setOpenModal('change');
                      }
                    }}
                  />
                  <ActionButton
                    icon={XCircle}
                    label="반환"
                    color="rose"
                    active={isReturning}
                    locked={!isReturning && !!inProgressKind}
                    onClick={() => {
                      if (isReturning) setOpenModal('cancel');
                      else {
                        setReason('');
                        setOpenModal('return');
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Footer links — 추가 액션 */}
            <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <FooterLink icon={HistoryIcon} label="이력" onClick={() => setOpenModal('history')} />
              <FooterLink icon={BarChart3} label="시뮬레이션" onClick={() => setOpenModal('simulation')} />
              <FooterLink
                icon={FileText}
                label="PDF"
                external
                onClick={() => {
                  const idMatch = selected.id.match(/\d+/);
                  if (idMatch) {
                    downloadPdf(ENDPOINTS.lease.contractPdf(Number(idMatch[0])), `PPA 계약서_${selected.label}.pdf`);
                  } else {
                    exportPdf(
                      `PPA 계약서-${selected.label}`,
                      `${selected.label} PPA 계약서`,
                      ['항목', '값'],
                      [
                        ['계약', selected.label],
                        ['발전사업자', selected.lessor],
                        ['설비', selected.equipmentType],
                        ['용량', selected.totalCapacity],
                        ['단가', `₩${selected.unitPriceKrw}/kWh`],
                        ['기간', `${selected.period.start} ~ ${selected.period.end}`],
                      ],
                    );
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── Modals ─────────── */}

      {/* 계약서 보기 */}
      <Modal
        open={openModal === 'contract-view'}
        onClose={() => setOpenModal(null)}
        title={`${selected.label} · PPA 계약서`}
        size="md"
      >
        <div className="space-y-2">
          {[
            {
              key: 'main',
              label: 'PPA 계약서 (Power Purchase Agreement)',
              desc: `${selected.period.start} 체결 · ${selected.lessor}`,
            },
            {
              key: 'spec',
              label: '설비 사양서 (Equipment Spec)',
              desc: `${selected.equipmentType} · ${selected.totalCapacity}`,
            },
            { key: 'maint', label: '유지보수 계약 (Maintenance)', desc: '정기 점검 · 고장 수리 조건' },
          ].map((doc) => (
            <button
              key={doc.key}
              type="button"
              onClick={() =>
                exportPdf(
                  `${doc.label}-${selected.label}`,
                  `${selected.label} · ${doc.label}`,
                  ['항목', '값'],
                  [
                    ['문서', doc.label],
                    ['설명', doc.desc],
                    ['계약', selected.label],
                    ['발전사업자', selected.lessor],
                  ],
                )
              }
              className="w-full flex items-center gap-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] ring-1 ring-white/[0.06] px-4 py-3 text-left transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.04]">
                <FileText size={16} className="text-slate-300" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{doc.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{doc.desc}</p>
              </div>
              <ExternalLink size={14} className="text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      </Modal>

      {/* 연장 신청 */}
      <Modal
        open={openModal === 'extend'}
        onClose={() => setOpenModal(null)}
        title="계약 연장 신청"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                useToastStore.getState().add('success', `${selected.label} 연장 신청이 접수되었습니다`);
                setOpenModal(null);
              }}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              연장 신청
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-[#1a2841] ring-1 ring-blue-400/30 p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">계약</span>
              <span className="text-white">
                {selected.label} · {selected.lessor}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">현 월 PPA 요금</span>
              <span className="text-white tabular-nums">₩{selected.monthlyFee.toLocaleString()}</span>
            </div>
            {selected.extensionEstFee && (
              <div className="flex justify-between">
                <span className="text-slate-400">연장 예상 PPA 요금</span>
                <span className="text-emerald-300 tabular-nums font-semibold">
                  ₩{selected.extensionEstFee.toLocaleString()}/월
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">만료일</span>
              <span className="text-white tabular-nums">
                {selected.period.end} (D-{selected.period.daysLeft})
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            신청 후 발전사업자 설비 점검 → 조건 협의 → 연장 계약이 진행됩니다.
          </p>
        </div>
      </Modal>

      {/* 설비 변경 */}
      <Modal
        open={openModal === 'change'}
        onClose={() => setOpenModal(null)}
        title="설비 변경 신청"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                useToastStore.getState().add('success', `${selected.label} 설비 변경 신청이 접수되었습니다`);
                setOpenModal(null);
              }}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              변경 신청
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['equipment', 'terms'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChangeType(t)}
                className={cn(
                  'rounded-lg p-3 text-left ring-1 transition-colors',
                  changeType === t
                    ? 'bg-[#291a3a] ring-violet-400/50'
                    : 'bg-white/[0.03] ring-white/[0.06] hover:bg-white/[0.06]',
                )}
              >
                <p className={cn('text-sm font-semibold', changeType === t ? 'text-violet-200' : 'text-white')}>
                  {t === 'equipment' ? '설비 교체/증설' : '조건 변경'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t === 'equipment' ? '설비 교체, 용량 증설' : 'PPA 요금, 기간 조건 변경'}
                </p>
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-400">변경 사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary"
              placeholder="변경 항목 · 사유"
            />
          </div>
        </div>
      </Modal>

      {/* 반환 신청 */}
      <Modal
        open={openModal === 'return'}
        onClose={() => setOpenModal(null)}
        title="설비 반환 신청"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                useToastStore.getState().add('success', `${selected.label} 반환 신청이 접수되었습니다.`);
                setOpenModal(null);
              }}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              반환 신청
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-[#3a1a26] ring-1 ring-rose-400/40 p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-rose-200/80">계약</span>
              <span className="text-white">
                {selected.label} · {selected.lessor}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-200/80">남은 기간</span>
              <span className="text-white tabular-nums">D-{selected.period.daysLeft}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-rose-400/20">
              <span className="text-rose-200/80">예상 철거 · 원상복구 비용</span>
              <span className="text-base font-bold text-white tabular-nums">
                ₩{(selected.returnFee ?? 5_000_000).toLocaleString()}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">반환 사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary"
              placeholder="반환 사유"
            />
          </div>
          <p className="text-[11px] text-rose-300/80">
            <AlertTriangle size={11} className="inline mr-1" />
            발전사업자 설비 점검 후 철거 비용 확정 — 신청 후 14일 이내 철회 가능
          </p>
        </div>
      </Modal>

      {/* 신청 취소 */}
      <Modal
        open={openModal === 'cancel'}
        onClose={() => setOpenModal(null)}
        title="신청 취소"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>
              닫기
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                useToastStore.getState().add('warning', `${selected.label} 신청이 취소되었습니다`);
                setOpenModal(null);
              }}
            >
              취소 확정
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="text-white font-medium">{selected.label}</span> 진행 중인 신청을 취소합니다.
        </p>
      </Modal>

      {/* 설비 추가 신청 */}
      <Modal
        open={openModal === 'add-equipment'}
        onClose={() => setOpenModal(null)}
        title="설비 추가 신청"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={!equipmentNote.trim()}
              onClick={() => {
                createLeaseRequest.mutate(
                  { contractId: selected.id, type: 'EQUIPMENT_ADD', note: equipmentNote },
                  {
                    onSuccess: () => {
                      useToastStore.getState().add('success', '설비 추가 신청이 접수되었습니다');
                      setOpenModal(null);
                    },
                    onError: () => {
                      useToastStore.getState().add('error', '신청 중 오류가 발생했습니다');
                    },
                  },
                );
              }}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              신청
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">현재 계약</span>
              <span className="text-white">{selected.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">현재 용량</span>
              <span className="text-white tabular-nums">{selected.totalCapacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">발전사업자</span>
              <span className="text-white">{selected.lessor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">추가 설비 요청 내용</label>
            <textarea
              value={equipmentNote}
              onChange={(e) => setEquipmentNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary"
              placeholder="추가할 설비 종류, 희망 용량, 설치 위치 등"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            신청 후 발전사업자 현장 실사 → 설비 사양 확정 → 추가 계약이 진행됩니다.
          </p>
        </div>
      </Modal>

      {/* 계약 변경 이력 */}
      <Modal
        open={openModal === 'history'}
        onClose={() => setOpenModal(null)}
        title={`${selected.label} · 변경 이력`}
        size="lg"
      >
        <div className="max-h-80 overflow-y-auto">
          {auditLogs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">일시</th>
                  <th className="px-3 py-2 text-left font-medium">작업자</th>
                  <th className="px-3 py-2 text-left font-medium">액션</th>
                  <th className="px-3 py-2 text-left font-medium">상세</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2 text-xs text-slate-400 tabular-nums">
                      {log.createdAt?.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">{log.userName ?? `User ${log.userId}`}</td>
                    <td className="px-3 py-2 text-xs text-white">{log.action}</td>
                    <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">{log.detail ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-8 text-sm text-slate-500">변경 이력이 없습니다</p>
          )}
        </div>
      </Modal>

      {/* PPA 요금 시뮬레이션 */}
      <Modal open={openModal === 'simulation'} onClose={() => setOpenModal(null)} title="PPA 요금 시뮬레이션" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">월 전력 사용량 (kWh)</label>
              <input
                type="number"
                value={simUsageKwh}
                onChange={(e) => setSimUsageKwh(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">태양광 자가소비 비율 (%)</label>
              <input
                type="number"
                value={simSharePct}
                onChange={(e) => setSimSharePct(Number(e.target.value))}
                min={0}
                max={100}
                className="mt-1 w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
              />
            </div>
          </div>
          {savingsResult ? (
            <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 p-4 space-y-2">
              <p className="text-xs text-emerald-300 font-semibold">시뮬레이션 결과</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">예상 PPA 요금</p>
                  <p className="text-white tabular-nums font-semibold">
                    ₩{(savingsResult.estimatedLeaseFee ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">한전 대비 절감액</p>
                  <p className="text-emerald-300 tabular-nums font-semibold">
                    ₩{(savingsResult.estimatedSaving ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">절감률</p>
                  <p className="text-emerald-300 tabular-nums font-semibold">
                    {(savingsResult.savingRate ?? 0).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">연간 절감 추정</p>
                  <p className="text-emerald-300 tabular-nums font-semibold">
                    ₩{((savingsResult.estimatedSaving ?? 0) * 12).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-4 text-center">
              <p className="text-sm text-slate-400">사용량과 비율을 입력하면 절감 효과를 계산합니다</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* 우측 패널 소형 액션 버튼 — 3개 그리드 (연장/변경/반환) */
function ActionButton({
  icon: Icon,
  label,
  color,
  active,
  locked,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  color: 'blue' | 'violet' | 'rose';
  active?: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  const colorClass = {
    blue: { base: 'text-blue-300', active: 'bg-blue-500/[0.12] ring-blue-500/40', hover: 'hover:bg-blue-500/[0.08]' },
    violet: {
      base: 'text-violet-300',
      active: 'bg-violet-500/[0.12] ring-violet-500/40',
      hover: 'hover:bg-violet-500/[0.08]',
    },
    rose: { base: 'text-rose-300', active: 'bg-rose-500/[0.12] ring-rose-500/40', hover: 'hover:bg-rose-500/[0.08]' },
  }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={cn(
        'flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] ring-1 transition-colors',
        locked
          ? 'bg-white/[0.02] text-slate-600 ring-white/[0.04] cursor-not-allowed'
          : active
            ? cn(colorClass.active, colorClass.base, 'font-semibold')
            : cn('bg-white/[0.04] ring-white/[0.06]', colorClass.base, colorClass.hover),
      )}
      title={locked ? '다른 신청 진행 중' : active ? '진행 중 — 클릭해서 취소' : label}
    >
      <Icon size={12} />
      {active ? '진행중' : label}
    </button>
  );
}

/* 우측 패널 footer 링크 */
function FooterLink({
  icon: Icon,
  label,
  external,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-1.5 text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors"
    >
      <Icon size={11} />
      {label}
      {external && <ExternalLink size={9} className="opacity-60" />}
    </button>
  );
}
