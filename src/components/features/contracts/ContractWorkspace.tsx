'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun,
  RefreshCw,
  FileEdit,
  XCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Building2,
  Handshake,
  FileText,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import {
  usePpaContracts,
  useContractDocuments,
  useRequestContractChange,
  useAllContractChanges,
} from '@/hooks/ppa/usePpa';
import { useVolumeContracts } from '@/hooks/lease/useLease';
import { ContractPdfViewer } from './ContractPdfViewer';
import { SigningTimeline } from './SigningTimeline';

type Persona = 'consumer' | 'generator' | 'spc';
type Model = 'onsite' | 'offsite' | 'lease';

function resolveModel(c: any): Model {
  const t = String(c.ppaSubType ?? '').toLowerCase();
  if (t === 'lease' || c.contractType === 'SAVINGS_SHARE') return 'lease';
  if (t === 'onsite') return 'onsite';
  return 'offsite';
}

const MODEL_META: Record<Model, { label: string; tone: string; bg: string; ring: string; desc: string }> = {
  onsite: {
    label: 'Onsite PPA',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
    desc: '발전사가 수용가 부지에 설치 — 한전망 미사용, 전량 직접 공급',
  },
  offsite: {
    label: 'Offsite PPA',
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
    ring: 'ring-blue-500/30',
    desc: '외부 발전소 — 한전망 경유 공급 (망 이용료 발생)',
  },
  lease: {
    label: '직접 PPA',
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ring: 'ring-violet-500/30',
    desc: '발전사업자 설비 제공 — 발전량 비례 정산 (온사이트 PPA)',
  },
};

const STATUS_META: Record<string, { label: string; tone: string; bg: string; ring: string }> = {
  NEW: { label: '체결 대기', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
  ACTIVE: { label: '정상', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', ring: 'ring-emerald-500/30' },
  EXPIRING: { label: '만료 임박', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
  EXTENDING: { label: '갱신 진행', tone: 'text-blue-300', bg: 'bg-blue-500/[0.08]', ring: 'ring-blue-500/30' },
  CHANGING: { label: '변경 진행', tone: 'text-violet-300', bg: 'bg-violet-500/[0.08]', ring: 'ring-violet-500/30' },
  TERMINATING: { label: '해지 진행', tone: 'text-rose-300', bg: 'bg-rose-500/[0.08]', ring: 'ring-rose-500/30' },
  TERMINATED: { label: '해지 완료', tone: 'text-slate-400', bg: 'bg-slate-500/[0.08]', ring: 'ring-slate-500/30' },
};
const statusMeta = (s: string) =>
  STATUS_META[s] ?? { label: s ?? '-', tone: 'text-slate-300', bg: 'bg-slate-500/[0.08]', ring: 'ring-slate-500/30' };

const PERSONA = {
  consumer: {
    counterpartyLabel: '발전사',
    counterpartyField: 'generatorCompanyName',
    settlement: '/ppa/billing/settlement',
  },
  generator: {
    counterpartyLabel: '수용가',
    counterpartyField: 'consumerCompanyName',
    settlement: '/generator/ppa/revenue/analytics',
  },
  spc: {
    counterpartyLabel: '당사자',
    counterpartyField: 'generatorCompanyName',
    settlement: '/platform/ppa/billing/settlement',
  },
} as const;

function daysLeft(endDate?: string) {
  if (!endDate) return 0;
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000));
}

function ModelBadge({ model, size = 'sm' }: { model: Model; size?: 'sm' | 'md' }) {
  const m = MODEL_META[model];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        m.bg,
        m.tone,
        m.ring,
      )}
    >
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
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

/* ───────────────────────── Detail ───────────────────────── */

type ActionKind = 'extend' | 'change' | 'return';

function ContractDetail({
  contract,
  persona,
  hasPending,
  onAction,
}: {
  contract: any;
  persona: Persona;
  hasPending?: boolean;
  onAction: (kind: ActionKind) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'doc' | 'terms' | 'settle'>('doc');
  const { data: documents } = useContractDocuments(contract.id);
  const doc = (documents ?? [])[0] as any;

  const model = contract.model as Model;
  const isLease = model === 'lease';
  const isVolumeLease = !!contract.isVolumeLease; // 별도 테이블 레거시 Lease — 변경·해지는 설비 계약 관리에서
  const isActive = contract.status === 'ACTIVE';
  const start = contract.startDate?.slice(0, 10) ?? '—';
  const end = contract.endDate?.slice(0, 10) ?? '—';
  const left = daysLeft(contract.endDate);
  const cap = (contract.totalCapacityKw ?? 0).toLocaleString();
  const generatorName = contract.generatorCompanyName ?? '발전사';
  const consumerName = contract.consumerCompanyName ?? '수용가';

  const TABS: { key: 'doc' | 'terms' | 'settle'; label: string }[] = [
    { key: 'doc', label: '계약서·서명' },
    { key: 'terms', label: '계약 조건' },
    { key: 'settle', label: '정산' },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-card">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
            <Sun size={18} className="text-amber-400" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ModelBadge model={model} size="md" />
              <p className="text-base font-bold text-white truncate">{contract.contractNumber}</p>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-200">{generatorName}</span>
              <Handshake size={11} className="text-slate-500" />
              <span className="text-slate-200">{consumerName}</span>
              <span className="text-slate-500">· SPC 중개</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">{MODEL_META[model].desc}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ring-1',
              tab === t.key
                ? 'bg-primary/[0.15] text-primary ring-primary/40'
                : 'bg-transparent text-slate-400 ring-transparent hover:text-white hover:bg-white/[0.04]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* 계약서·서명 */}
        {tab === 'doc' && isVolumeLease && (
          <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-6 text-center space-y-1.5">
            <FileText size={24} className="mx-auto text-slate-500" />
            <p className="text-sm text-slate-300">온사이트 PPA 설비 계약 — 별도 체결</p>
            <p className="text-xs text-slate-500">설비·보증·반환 조건은 설비 계약 관리에서 확인합니다.</p>
            <div className="pt-2">
              <Button variant="secondary" size="sm" onClick={() => router.push('/lease/contracts')}>
                설비 계약 관리로 이동 <ArrowRight size={13} className="ml-1.5" />
              </Button>
            </div>
          </div>
        )}
        {tab === 'doc' && !isVolumeLease && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3">체결 진행</p>
              <SigningTimeline contractId={contract.id} contractStatus={contract.status} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3">계약서</p>
              {doc ? (
                <ContractPdfViewer fileId={doc.fileId} fileName={doc.fileName} height="h-[38vh]" />
              ) : (
                <div className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.02] h-[38vh] flex flex-col items-center justify-center gap-2 text-center px-4">
                  <FileText size={24} className="text-slate-500" />
                  <p className="text-xs text-slate-400">아직 SPC가 계약서를 발행하지 않았습니다.</p>
                  <p className="text-[11px] text-slate-500">발행 후 이곳에서 계약서를 확인할 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 계약 조건 */}
        {tab === 'terms' && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <Term label="거래 모델" value={MODEL_META[model].label} />
            <Term label="용량" value={`${cap} kW`} />
            {isLease ? (
              <Term label="정산 기준" value="발전 수익 분배" />
            ) : (
              <Term label="공급 단가" value={`₩${(contract.unitPriceKrw ?? 0).toLocaleString()}/kWh`} />
            )}
            <Term label="발전사" value={generatorName} />
            <Term label="수용가" value={consumerName} />
            <Term label="계약 기간" value={`${start} ~ ${end}`} />
            <Term label="잔여" value={isActive ? `D-${left.toLocaleString()}` : '—'} />
            {model === 'offsite' && <Term label="공급 방식" value="한전망 경유 (망 이용료)" />}
            {model === 'onsite' && <Term label="공급 방식" value="부지 직접 공급 (망 미사용)" />}
            {contract.settlementDay && <Term label="정산일" value={`매월 ${contract.settlementDay}일`} />}
          </dl>
        )}

        {/* 정산 */}
        {tab === 'settle' && (
          <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-5 text-center space-y-2">
            <p className="text-sm text-slate-300">
              {isActive ? '계약이 발효되어 월별 정산이 진행됩니다.' : '계약 발효 후 정산이 시작됩니다.'}
            </p>
            <p className="text-xs text-slate-500">
              {persona === 'generator'
                ? '발전 수익·매출 기준 정산'
                : persona === 'spc'
                  ? '중개 정산 — 양측 정산 내역 관리'
                  : isLease
                    ? 'PPA 요금·절감액 기준 정산'
                    : '전력 사용·비용 기준 정산'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => router.push(PERSONA[persona].settlement)}>
              정산 상세 보기 <ArrowRight size={13} className="ml-1.5" />
            </Button>
          </div>
        )}
      </div>

      {/* 액션 */}
      <div className="px-4 pb-4">
        {isVolumeLease ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
            <p className="text-xs text-slate-400">
              온사이트 PPA 설비 계약 — 연장·설비 반환은 계약 관리에서 처리합니다.
            </p>
            <Button variant="secondary" size="sm" onClick={() => router.push('/lease/contracts')}>
              설비 계약 관리
            </Button>
          </div>
        ) : !isActive ? (
          <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/20 px-4 py-3 text-xs text-amber-300">
            계약 발효 전입니다 — 양측 전자서명이 완료되면 갱신·변경·해지를 신청할 수 있습니다.
          </div>
        ) : persona === 'spc' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
            <p className="text-xs text-slate-400">
              SPC는 양측 계약을 관리·중개합니다. 변경·해지 신청은 양측 검토 후 승인됩니다.
            </p>
            <Button variant="secondary" size="sm" onClick={() => router.push('/platform/ppa/dashboard')}>
              계약 현황 대시보드
            </Button>
          </div>
        ) : hasPending ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/20 px-4 py-3">
            <p className="text-xs text-amber-300">
              진행 중인 변경·해지 요청이 있습니다 — 처리 완료 후 신청할 수 있습니다.
            </p>
            <Button variant="secondary" size="sm" onClick={() => router.push('/ppa/contract-changes')}>
              진행 상태 보기
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <ActionButton kind="extend" onClick={() => onAction('extend')} />
            <ActionButton kind="change" onClick={() => onAction('change')} />
            <ActionButton kind="return" onClick={() => onAction('return')} isLease={isLease} />
          </div>
        )}
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500 flex items-center gap-1">
        <Building2 size={10} /> {label}
      </dt>
      <dd className="text-sm font-medium text-white mt-0.5 tabular-nums">{value}</dd>
    </div>
  );
}

function ActionButton({ kind, onClick, isLease }: { kind: ActionKind; onClick: () => void; isLease?: boolean }) {
  const cfg = {
    extend: { title: '갱신', icon: RefreshCw, color: 'text-blue-400' },
    change: { title: '변경', icon: FileEdit, color: 'text-violet-400' },
    return: { title: isLease ? '설비 반환' : '해지', icon: XCircle, color: 'text-rose-400' },
  }[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg py-3 text-xs ring-1 ring-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-colors',
        cfg.color,
      )}
    >
      <cfg.icon size={16} />
      <span className="font-medium">{cfg.title}</span>
    </button>
  );
}

/* ───────────────────────── Workspace ───────────────────────── */

const STATUS_BOARD: { key: string; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'NEW', label: '체결 대기' },
  { key: 'ACTIVE', label: '정상' },
  { key: 'EXPIRING', label: '만료 임박' },
  { key: 'progress', label: '변경·해지' },
];

export function ContractWorkspace({ persona: personaOverride }: { persona?: Persona } = {}) {
  // 페르소나는 로그인 사용자에서 자동 판별 (라우트와 무관하게 일관) — prop 으로 override 가능
  const user = useAuthStore((s) => s.user);
  const persona: Persona =
    personaOverride ??
    (() => {
      const p = getPersona(user);
      if (p === 'generator') return 'generator';
      if (p === 'spc' || p === 'admin' || p === 'operator' || p === 'agency') return 'spc';
      return 'consumer';
    })();
  const showToast = useToastStore((s) => s.add);
  const { data, isLoading } = usePpaContracts();
  const { data: leaseData } = useVolumeContracts();
  const changeMut = useRequestContractChange();
  const { data: changesData } = useAllContractChanges();
  const rows = useMemo(() => ((data as any)?.content ?? data ?? []) as any[], [data]);
  const contracts = useMemo(() => {
    const ppa = rows.map((c) => ({ ...c, model: resolveModel(c), isVolumeLease: false }));
    // 별도 테이블 volume_lease_contracts(레거시 Lease) 병합 — 발전사·수용가 양쪽 스코프
    const leaseRows = ((leaseData as any)?.content ?? leaseData ?? []) as any[];
    const lease = leaseRows.map((v) => {
      const start = v.startDate?.slice(0, 10);
      const end =
        start && v.contractYears
          ? new Date(new Date(start).setFullYear(new Date(start).getFullYear() + v.contractYears))
              .toISOString()
              .slice(0, 10)
          : undefined;
      return {
        id: `lease-${v.id}`,
        contractNumber: `LEASE-${String(v.id).padStart(4, '0')}`,
        ppaSubType: 'lease',
        contractType: 'SAVINGS_SHARE',
        status: v.status ?? 'ACTIVE',
        generatorCompanyName: v.generatorCompanyName ?? '발전사',
        consumerCompanyName: v.consumerCompanyName ?? v.siteName ?? '수용가',
        consumerSiteName: v.siteName,
        totalCapacityKw: v.capacityKw ?? 0,
        unitPriceKrw: 0,
        monthlyRent: v.monthlyRent,
        startDate: start,
        endDate: end,
        model: 'lease' as Model,
        isVolumeLease: true,
      };
    });
    return [...ppa, ...lease];
  }, [rows, leaseData]);
  // 진행 중(REQUESTED) 변경·해지가 있는 계약 — 중복 신청 차단
  const pendingContractIds = useMemo(() => {
    const s = new Set<number>();
    for (const ch of ((changesData as any) ?? []) as any[]) if (ch.status === 'REQUESTED') s.add(ch.contractId);
    return s;
  }, [changesData]);

  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modal, setModal] = useState<null | ActionKind>(null);
  const [reason, setReason] = useState('');
  // 변경/갱신 새 값
  const [changeItem, setChangeItem] = useState<'price' | 'capacity' | 'period'>('price');
  const [newPrice, setNewPrice] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [renewYears, setRenewYears] = useState('5');
  const [newEnd, setNewEnd] = useState('');

  const openModal = (k: ActionKind) => {
    setReason('');
    setChangeItem('price');
    setNewPrice('');
    setNewCapacity('');
    setRenewYears('5');
    setNewEnd('');
    setModal(k);
  };
  const addYears = (date?: string, years = 0) => {
    const d = date ? new Date(date) : new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  };

  const counts = useMemo(() => {
    const c = { all: contracts.length, NEW: 0, ACTIVE: 0, EXPIRING: 0, progress: 0 };
    for (const x of contracts) {
      if (x.status === 'NEW') c.NEW++;
      else if (x.status === 'ACTIVE') c.ACTIVE++;
      else if (x.status === 'EXPIRING') c.EXPIRING++;
      else if (['EXTENDING', 'CHANGING', 'TERMINATING', 'TERMINATED'].includes(x.status)) c.progress++;
    }
    return c as Record<string, number>;
  }, [contracts]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return contracts;
    if (statusFilter === 'progress')
      return contracts.filter((c) => ['EXTENDING', 'CHANGING', 'TERMINATING', 'TERMINATED'].includes(c.status));
    return contracts.filter((c) => c.status === statusFilter);
  }, [contracts, statusFilter]);

  const selected = contracts.find((c) => c.id === selectedId) ?? filtered[0] ?? contracts[0];

  const counterpartyField = PERSONA[persona].counterpartyField;

  const submitAction = async () => {
    if (!selected || !modal) return;
    const changeType = modal === 'extend' ? 'RENEWAL' : modal === 'change' ? 'MODIFICATION' : 'TERMINATION';
    const label = modal === 'extend' ? '갱신' : modal === 'change' ? '변경' : '해지';
    const input: any = { contractId: Number(selected.id), changeType, description: reason || undefined };
    if (modal === 'extend') {
      input.newEndDate = addYears(selected.endDate, Math.max(1, Number(renewYears) || 1));
      if (newPrice) input.newUnitPriceKrw = Number(newPrice);
    } else if (modal === 'change') {
      input.changeItem = changeItem;
      if (changeItem === 'price' && newPrice) input.newUnitPriceKrw = Number(newPrice);
      if (changeItem === 'capacity' && newCapacity) input.newCapacityKw = Number(newCapacity);
      if (changeItem === 'period' && newEnd) input.newEndDate = newEnd;
    }
    try {
      await changeMut.mutateAsync(input);
      showToast('success', `${selected.contractNumber} ${label} 신청이 접수되었습니다 — 발전사 동의 후 SPC 확정`);
    } catch {
      showToast('error', `${label} 신청에 실패했습니다`);
    }
    setModal(null);
    setReason('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={26} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래' }, { label: '계약관리' }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">계약관리</h1>
        <p className="mt-1 text-sm text-slate-400">
          {persona === 'spc' ? '전체 계약' : `내 계약`} · 총 {contracts.length}건
        </p>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <FileText size={28} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">관리할 계약이 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">매칭·서명이 완료된 계약이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <>
          {/* 상태보드 */}
          <div className="flex flex-wrap gap-3">
            {STATUS_BOARD.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={cn(
                  'flex flex-1 min-w-[110px] flex-col items-start gap-1 rounded-lg border bg-surface-card px-4 py-3 text-left transition-all',
                  statusFilter === s.key
                    ? 'border-primary/60 ring-1 ring-primary/30'
                    : 'border-white/[0.06] hover:border-white/[0.15]',
                )}
              >
                <span className="text-xs text-slate-400">{s.label}</span>
                <span className="text-2xl font-bold text-white tabular-nums">{counts[s.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* 목록 */}
            <div className="xl:col-span-7">
              <SectionCard title={`계약 ${filtered.length}건`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                        <th className="px-4 py-2 text-left font-medium">계약</th>
                        <th className="px-3 py-2 text-left font-medium">{PERSONA[persona].counterpartyLabel}</th>
                        <th className="px-3 py-2 text-left font-medium">용량</th>
                        <th className="px-3 py-2 text-left font-medium">정산</th>
                        <th className="px-3 py-2 text-left font-medium">상태</th>
                        <th className="px-4 py-2 text-left font-medium">잔여</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => {
                        const isSel = selected && c.id === selected.id;
                        const left = daysLeft(c.endDate);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            className={cn(
                              'border-b border-white/[0.04] cursor-pointer transition-colors',
                              isSel ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <ModelBadge model={c.model} />
                                <span className="text-sm font-medium text-white tabular-nums">{c.contractNumber}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-300">{c[counterpartyField] ?? '—'}</td>
                            <td className="px-3 py-3 text-xs text-slate-300 tabular-nums">
                              {(c.totalCapacityKw ?? 0).toLocaleString()} kW
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-300 tabular-nums">
                              {c.model === 'lease' ? '수익 분배' : `₩${(c.unitPriceKrw ?? 0).toLocaleString()}/kWh`}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={c.status} />
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums text-slate-400">
                              {c.status === 'ACTIVE' ? `D-${left.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            {/* 상세 */}
            <div className="xl:col-span-5">
              {selected && (
                <ContractDetail
                  contract={selected}
                  persona={persona}
                  hasPending={pendingContractIds.has(selected.id)}
                  onAction={openModal}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* 갱신/변경/해지 신청 모달 */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'extend' ? '갱신 신청' : modal === 'change' ? '변경 신청' : '해지 신청'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              취소
            </Button>
            <Button variant="primary" disabled={changeMut.isPending} onClick={submitAction}>
              <CheckCircle2 size={14} className="mr-1.5" />
              {modal === 'extend' ? '갱신 신청' : modal === 'change' ? '변경 신청' : '해지 신청'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {selected && (
            <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3 text-sm flex items-center justify-between">
              <span className="text-slate-400">대상 계약</span>
              <span className="text-white">
                {selected.contractNumber} · 현재{' '}
                {selected.model === 'lease' ? '수익분배' : `₩${(selected.unitPriceKrw ?? 0).toLocaleString()}/kWh`} ·{' '}
                {(selected.totalCapacityKw ?? 0).toLocaleString()}kW · ~{selected.endDate?.slice(0, 10)}
              </span>
            </div>
          )}

          {/* 갱신 — 갱신 기간 + (선택) 새 단가 */}
          {modal === 'extend' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">갱신 기간 (년)</label>
                <Input
                  type="number"
                  min={1}
                  value={renewYears}
                  onChange={(e) => setRenewYears(e.target.value)}
                  className="mt-1"
                />
                {selected && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    새 종료일: {addYears(selected.endDate, Math.max(1, Number(renewYears) || 1))}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-400">새 단가 (원/kWh, 선택)</label>
                <Input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="mt-1"
                  placeholder="미입력 시 유지"
                />
              </div>
            </div>
          )}

          {/* 변경 — 항목 선택 + 새 값 */}
          {modal === 'change' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">변경 항목</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[
                    { k: 'price', label: '단가' },
                    { k: 'capacity', label: '용량' },
                    { k: 'period', label: '기간' },
                  ].map((it) => (
                    <button
                      key={it.k}
                      type="button"
                      onClick={() => setChangeItem(it.k as any)}
                      className={cn(
                        'rounded-lg py-2 text-xs ring-1 transition-colors',
                        changeItem === it.k
                          ? 'bg-violet-500/[0.12] ring-violet-400/50 text-violet-200'
                          : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:bg-white/[0.06]',
                      )}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
              {changeItem === 'price' && (
                <div>
                  <label className="text-xs text-slate-400">새 단가 (원/kWh)</label>
                  <Input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="mt-1"
                    placeholder="예: 130"
                  />
                </div>
              )}
              {changeItem === 'capacity' && (
                <div>
                  <label className="text-xs text-slate-400">새 용량 (kW)</label>
                  <Input
                    type="number"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="mt-1"
                    placeholder="예: 1200"
                  />
                </div>
              )}
              {changeItem === 'period' && (
                <div>
                  <label className="text-xs text-slate-400">새 종료일</label>
                  <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="mt-1" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400">신청 사유</label>
            <div className="mt-1">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="신청 사유·요청 내용"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            신청 후 발전사 동의 → SPC 확정 시 계약에 반영됩니다. (직접 PPA는 거래소 신고 대상)
          </p>
        </div>
      </Modal>
    </div>
  );
}
