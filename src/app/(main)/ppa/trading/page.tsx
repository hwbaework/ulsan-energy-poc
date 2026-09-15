'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Zap, Percent, ArrowUpRight, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import {
  useTradingRequests,
  useCreateTradingRequest,
  useUpdateTradingRequest,
  useUpdateRequestStatus,
} from '@/hooks/trading/useTrading';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';
import { useAuthStore } from '@/stores/useAuthStore';
import { DEAL_TYPE_META } from '@/lib/constants/deal-type';

/* ───────────────────────── 진입 카드 ───────────────────────── */

const ENTRY_CARDS = [
  {
    id: 'lease',
    label: '직접 PPA',
    tagline: '발전사업자가 부지에 설치 → 발전량 비례 청구 (온사이트 PPA)',
    icon: Sun,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ctaBg: 'bg-violet-500 hover:bg-violet-400',
    cta: '직접 PPA 신청하기',
    features: ['발전사가 수요자 부지에 발전소 설치', '발전전력 전량 수요자에게 공급', '발전량에 비례하여 청구'],
  },
  {
    id: 'direct-ppa',
    label: '직접 PPA',
    tagline: 'Onsite PPA · Offsite PPA 중 선택',
    icon: Zap,
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
    ctaBg: 'bg-blue-500 hover:bg-blue-400',
    cta: '유형 선택',
    features: ['Onsite: 부지 PPA 요금 + 전력 전량 공급', 'Offsite: 외부 발전소, 망 경유', '5/10/15/20년 장기 계약'],
  },
];

const DIRECT_PPA_OPTIONS = [
  {
    id: 'onsite',
    label: '직접 PPA — Onsite PPA',
    tagline: '발전사가 부지 PPA 요금 지급 + 발전소 설치 → 전력 전량 공급',
    icon: Percent,
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
  },
  {
    id: 'offsite',
    label: '직접 PPA — Offsite PPA',
    tagline: '발전사가 외부 발전소 → 망 경유로 전력 공급',
    icon: Zap,
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
  },
];

/* ───────────────────────── 사업장 스코프 트리거 — /ppa/contracts 와 동일 패턴 ───────────────────────── */

function ScopeTrigger({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[160px] cursor-pointer text-white hover:bg-white/[0.08]">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="font-medium truncate flex-1">{value}</span>
      <ChevronDown size={14} className="text-slate-500 shrink-0" />
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function ConsumerTradingPage() {
  const showToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const { data: reqData, isError: reqError } = useTradingRequests({ requesterType: 'CONSUMER' });
  const allRequests = !reqError && reqData ? (((reqData as any).content ?? reqData) as any[]) : [];

  // MATCHED(계약 서명 대기)는 노출 — 양측 전자서명 완료 시 FINALIZED 로 전환되어 목록에서 빠진다
  const activeRequests = allRequests.filter(
    (r: any) => r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && r.status !== 'FINALIZED',
  );

  const { data: sitesData, isError: sitesError } = useConsumerSites(
    user?.companyId ? { companyId: user.companyId } : undefined,
  );
  const sites = !sitesError && sitesData ? (((sitesData as any).content ?? sitesData) as any[]) : [];

  // ─── 사업장 스코프 — /ppa/contracts 와 동일 패턴 (전사 합산 / 사업장별) ───
  const [siteFilter, setSiteFilter] = useState<'all' | string>('all');
  const selectedSiteLabel =
    siteFilter === 'all' ? null : (sites.find((s) => String(s.id) === siteFilter)?.name ?? null);
  const scopedActive = selectedSiteLabel
    ? activeRequests.filter((r) => r.siteName === selectedSiteLabel)
    : activeRequests;

  // 수정/취소 모달 상태 — 백엔드가 DTO 전체를 덮어쓰므로 원본 전체를 보관해 누락 필드 보존
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [cancelingRequest, setCancelingRequest] = useState<{ id: number; companyName: string } | null>(null);

  const [editForm, setEditForm] = useState({
    dealType: 'PPA',
    siteId: '',
    capacityKw: '',
    durationYears: '',
    desiredUnitPrice: '',
    region: '',
    surveyDate: '',
    notes: '',
  });

  const openEditModal = (req: any) => {
    setEditingRequest(req);
    setEditForm({
      dealType: req.dealType,
      siteId: req.siteName ? (sites.find((s) => s.name === req.siteName)?.id?.toString() ?? '') : '',
      capacityKw: String(req.capacityKw ?? ''),
      durationYears: String(req.durationYears ?? ''),
      desiredUnitPrice: req.desiredUnitPrice ? String(req.desiredUnitPrice) : '',
      region: req.region ?? '',
      surveyDate: '',
      notes: req.notes ?? '',
    });
  };

  // 모달 상태
  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  const [ppaSelectorOpen, setPpaSelectorOpen] = useState(false);
  const [ppaFormOpen, setPpaFormOpen] = useState(false);
  const [ppaSubType, setPpaSubType] = useState<'onsite' | 'offsite'>('onsite');

  // Lease 폼
  const [leaseForm, setLeaseForm] = useState({ siteId: '', capacityKw: '', surveyDate: '', notes: '' });
  const resetLeaseForm = () => setLeaseForm({ siteId: '', capacityKw: '', surveyDate: '', notes: '' });
  const leaseValid = !!leaseForm.siteId && !!leaseForm.capacityKw && !!leaseForm.surveyDate;

  // 직접 PPA 폼
  const [ppaForm, setPpaForm] = useState({
    siteId: '',
    capacityKw: '',
    durationYears: '20',
    desiredUnitPrice: '',
    region: '울산',
    notes: '',
  });
  const resetPpaForm = () =>
    setPpaForm({ siteId: '', capacityKw: '', durationYears: '20', desiredUnitPrice: '', region: '울산', notes: '' });
  const ppaValid = !!ppaForm.siteId && !!ppaForm.capacityKw && !!ppaForm.durationYears;

  const handlePickEntry = (id: string) => {
    if (id === 'lease') {
      resetLeaseForm();
      setLeaseModalOpen(true);
    } else if (id === 'direct-ppa') setPpaSelectorOpen(true);
  };

  const handlePickPpaType = (sub: 'onsite' | 'offsite') => {
    setPpaSubType(sub);
    setPpaSelectorOpen(false);
    resetPpaForm();
    setPpaFormOpen(true);
  };

  const createRequestMut = useCreateTradingRequest();
  const updateRequestMut = useUpdateTradingRequest();
  const updateStatusMut = useUpdateRequestStatus();

  const handleLeaseSubmit = async () => {
    try {
      await createRequestMut.mutateAsync({
        requesterType: 'CONSUMER',
        companyId: user?.companyId,
        dealType: 'SAVINGS_SHARE',
        capacityKw: Number(leaseForm.capacityKw),
        durationYears: 20,
        region: '울산',
        siteName: sites.find((s) => String(s.id) === leaseForm.siteId)?.name || undefined,
        notes: leaseForm.notes || undefined,
      } as any);
      showToast('success', '직접 PPA 문의가 접수되었습니다');
    } catch {
      showToast('error', '직접 PPA 신청에 실패했습니다');
    }
    setLeaseModalOpen(false);
    resetLeaseForm();
  };

  const handlePpaSubmit = async () => {
    try {
      await createRequestMut.mutateAsync({
        requesterType: 'CONSUMER',
        companyId: user?.companyId,
        dealType: 'PPA',
        ppaSubType,
        capacityKw: Number(ppaForm.capacityKw),
        durationYears: Number(ppaForm.durationYears),
        desiredUnitPrice: ppaForm.desiredUnitPrice ? Number(ppaForm.desiredUnitPrice) : undefined,
        region: ppaForm.region || '울산',
        siteName: sites.find((s) => String(s.id) === ppaForm.siteId)?.name || undefined,
        notes: ppaForm.notes || undefined,
      } as any);
      showToast('success', '직접 PPA 신청이 접수되었습니다');
    } catch {
      showToast('error', 'PPA 신청에 실패했습니다');
    }
    setPpaFormOpen(false);
    resetPpaForm();
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '거래 신청' }]} />

      {/* Header — 사업장 스코프 (/ppa/contracts 와 동일 패턴) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">거래 신청</h1>
          <p className="mt-1 text-sm text-accent">
            {selectedSiteLabel ?? '전사 합산'} · {sites.length}개 사업장 · 진행 중 {scopedActive.length}건
          </p>
        </div>
        <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSiteLabel ?? '전사 합산'} />}>
          <DropdownItem onClick={() => setSiteFilter('all')}>
            <div>
              <p className="text-sm">전사 합산</p>
              <p className="text-xs text-slate-500">
                {sites.length}개 사업장 · {activeRequests.length}건 신청
              </p>
            </div>
          </DropdownItem>
          <div className="my-1 border-t border-white/[0.06]" />
          {sites.map((s) => {
            const count = activeRequests.filter((r) => r.siteName === s.name).length;
            return (
              <DropdownItem key={s.id} onClick={() => setSiteFilter(String(s.id))}>
                <div>
                  <p className="text-sm">{s.name}</p>
                  <p className="text-xs text-slate-500">{count}건 신청</p>
                </div>
              </DropdownItem>
            );
          })}
        </Dropdown>
      </div>

      {/* ───────── 진행 중인 신청 — 사업장 스코프 적용 ───────── */}
      <SectionCard
        title={
          <>
            진행 중인 신청{' '}
            <Badge variant="primary" className="ml-2">
              {scopedActive.length}건
            </Badge>
          </>
        }
      >
        {scopedActive.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-slate-400">진행 중인 거래 신청이 없습니다.</p>
            <p className="mt-1 text-sm text-slate-500">아래에서 신규 계약을 신청하세요.</p>
          </div>
        ) : (
          <div className="px-5 divide-y divide-white/[0.06]">
            {scopedActive.map((req) => {
              // 유형별 메타 — 직접 PPA 는 mock 확장 ppaSubType 으로 Onsite/Offsite 분기
              const baseMeta = (DEAL_TYPE_META[req.dealType] ?? DEAL_TYPE_META.PPA)!;
              const meta =
                req.dealType === 'PPA'
                  ? req.ppaSubType === 'onsite'
                    ? {
                        ...baseMeta,
                        label: '직접 PPA - Onsite PPA',
                        icon: Percent,
                        tone: 'text-emerald-300',
                        tagBg: 'bg-emerald-500/[0.15]',
                      }
                    : { ...baseMeta, label: '직접 PPA - Offsite PPA' }
                  : baseMeta;
              // 진행은 거래상세 허브에서 — 카드는 요약 + 진입만 (status 기반 배지)
              // 백엔드는 MATCHED/CANCELLED만 수정 차단 — 매칭 전(SUBMITTED·MATCHING)까지 수정/취소 허용
              const isEditable = req.status === 'SUBMITTED' || req.status === 'MATCHING';
              const st =
                req.status === 'SUBMITTED'
                  ? { label: '신청 접수', variant: 'warning' as const }
                  : req.status === 'MATCHING'
                    ? { label: '진행 중', variant: 'primary' as const }
                    : req.status === 'MATCHED'
                      ? { label: '계약 서명 대기', variant: 'warning' as const }
                      : req.status === 'IN_PROGRESS'
                        ? { label: '진행 중', variant: 'primary' as const }
                        : { label: req.status, variant: 'default' as const };

              return (
                <div key={req.id} className="py-5 first:pt-4 last:pb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-slate-300 tabular-nums font-medium shrink-0">거래 #{req.id}</span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
                        meta.tagBg,
                        meta.tone,
                      )}
                    >
                      {meta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{req.companyName}</p>
                      <p className="text-xs text-accent/70 mt-0.5">
                        <span className="text-slate-300">{req.siteName ?? '—'}</span> ·{' '}
                        {req.capacityKw.toLocaleString()} kW · {req.durationYears}년 · {req.region ?? '울산'} · 접수{' '}
                        {(req.submittedAt ?? req.createdAt).slice(0, 10)}
                      </p>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Button variant="primary" size="sm" onClick={() => router.push(`/trading/deal/${req.id}`)}>
                      {req.status === 'MATCHED' ? '계약 서명하기' : '상세에서 진행'}
                    </Button>
                    {isEditable && (
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => openEditModal(req)}>
                          수정
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setCancelingRequest({ id: req.id, companyName: req.companyName })}
                        >
                          취소
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ───────── 신규 계약 시작하기 ───────── */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">신규 계약 시작하기</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ENTRY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} className="rounded-xl border border-white/[0.06] bg-surface-card p-6 flex flex-col">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', card.bg)}>
                    <Icon size={16} className={card.tone} />
                  </span>
                  <h3 className={cn('text-xl font-bold', card.tone)}>{card.label}</h3>
                </div>
                <p className="text-xs text-accent mb-5">{card.tagline}</p>
                <button
                  type="button"
                  onClick={() => handlePickEntry(card.id)}
                  className={cn(
                    'w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors flex items-center justify-center gap-1.5',
                    card.ctaBg,
                  )}
                >
                  {card.cta}
                  <ArrowUpRight size={14} />
                </button>
                <ul className="mt-5 space-y-1.5">
                  {card.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-xs text-accent">
                      <span className={cn('mt-1 h-1 w-1 rounded-full shrink-0', card.tone.replace('text-', 'bg-'))} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───────── 직접 PPA 문의 모달 ───────── */}
      <Modal
        open={leaseModalOpen}
        onClose={() => {
          setLeaseModalOpen(false);
          resetLeaseForm();
        }}
        title="직접 PPA 문의"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setLeaseModalOpen(false);
                resetLeaseForm();
              }}
            >
              닫기
            </Button>
            <Button variant="primary" onClick={handleLeaseSubmit} disabled={!leaseValid}>
              <Sparkles size={14} className="mr-1" />
              문의하기
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-violet-500/[0.10] ring-1 ring-violet-500/30 px-4 py-3">
            <p className="text-sm font-semibold text-violet-300">직접 PPA</p>
            <p className="text-xs text-accent mt-0.5">발전사업자가 부지에 설치 → 발전량 비례 청구 (온사이트 PPA)</p>
          </div>

          <div>
            <label className="text-xs text-accent block mb-1.5">대상 사업장 *</label>
            <select
              value={leaseForm.siteId}
              onChange={(e) => setLeaseForm({ ...leaseForm, siteId: e.target.value })}
              className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white"
            >
              <option value="">선택하세요</option>
              {sites.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            {sites.length === 0 && <p className="text-[11px] text-accent/70 mt-1">등록된 사업장이 없습니다</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-accent block mb-1.5">설치희망 용량 (kW) *</label>
              <Input
                type="number"
                value={leaseForm.capacityKw}
                onChange={(e) => setLeaseForm({ ...leaseForm, capacityKw: e.target.value })}
                placeholder="500"
              />
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">실사 희망 날짜 *</label>
              <Input
                type="date"
                value={leaseForm.surveyDate}
                onChange={(e) => setLeaseForm({ ...leaseForm, surveyDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-accent block mb-1.5">요청사항</label>
            <textarea
              value={leaseForm.notes}
              onChange={(e) => setLeaseForm({ ...leaseForm, notes: e.target.value })}
              placeholder="선호 발전사·설치 시기·수익 분배 비율 등 협의하고 싶은 내용"
              className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white min-h-[80px]"
            />
          </div>

          <p className="text-[11px] text-accent/70 pt-2 border-t border-accent/10">
            * 직접 PPA는 단일 발전사 배정 방식 — SPC가 부지 실사 후 적합한 발전사를 매칭합니다.
          </p>
        </div>
      </Modal>

      {/* ───────── 직접 PPA 유형 선택 모달 ───────── */}
      <Modal open={ppaSelectorOpen} onClose={() => setPpaSelectorOpen(false)} title="직접 PPA — 유형 선택" size="md">
        <p className="text-xs text-accent mb-4">계약 형태를 먼저 선택해주세요. 선택 후 세부 신청 폼이 열립니다.</p>
        <div className="space-y-2">
          {DIRECT_PPA_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => handlePickPpaType(opt.id as 'onsite' | 'offsite')}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3 flex items-center gap-3 text-left transition-colors"
              >
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', opt.bg)}>
                  <Icon size={16} className={opt.tone} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold', opt.tone)}>{opt.label}</p>
                  <p className="text-xs text-accent mt-0.5">{opt.tagline}</p>
                </div>
                <ChevronRight size={16} className="text-accent/70 shrink-0" />
              </button>
            );
          })}
        </div>
      </Modal>

      {/* ───────── 직접 PPA 신청 폼 모달 ───────── */}
      <Modal
        open={ppaFormOpen}
        onClose={() => {
          setPpaFormOpen(false);
          resetPpaForm();
        }}
        title={ppaSubType === 'onsite' ? '직접 PPA — Onsite 신청' : '직접 PPA — Offsite 신청'}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPpaFormOpen(false);
                resetPpaForm();
              }}
            >
              닫기
            </Button>
            <Button variant="primary" onClick={handlePpaSubmit} disabled={!ppaValid}>
              신청하기
              <ArrowUpRight size={14} className="ml-1" />
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-500/[0.10] ring-1 ring-blue-500/30 px-4 py-3">
            <p className="text-sm font-semibold text-blue-300">
              {ppaSubType === 'onsite' ? '직접 PPA — Onsite PPA' : '직접 PPA — Offsite PPA'}
            </p>
            <p className="text-xs text-accent mt-0.5">
              {ppaSubType === 'onsite'
                ? '발전사가 부지 PPA 요금 지급 + 발전소 설치 → 전력 전량 공급'
                : '발전사가 외부 발전소 → 망 경유로 전력 공급'}
            </p>
          </div>

          <div>
            <label className="text-xs text-accent block mb-1.5">
              {ppaSubType === 'onsite' ? '설치 대상 사업장' : '전력 공급 받을 사업장'} *
            </label>
            <select
              value={ppaForm.siteId}
              onChange={(e) => setPpaForm({ ...ppaForm, siteId: e.target.value })}
              className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white"
            >
              <option value="">선택하세요</option>
              {sites.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            {sites.length === 0 && <p className="text-[11px] text-accent/70 mt-1">등록된 사업장이 없습니다</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-accent block mb-1.5">희망 용량 (kW) *</label>
              <Input
                type="number"
                value={ppaForm.capacityKw}
                onChange={(e) => setPpaForm({ ...ppaForm, capacityKw: e.target.value })}
                placeholder="500"
              />
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">계약 기간 (년) *</label>
              <Input
                type="number"
                value={ppaForm.durationYears}
                onChange={(e) => setPpaForm({ ...ppaForm, durationYears: e.target.value })}
                placeholder="20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-accent block mb-1.5">희망 단가 (₩/kWh)</label>
              <Input
                type="number"
                value={ppaForm.desiredUnitPrice}
                onChange={(e) => setPpaForm({ ...ppaForm, desiredUnitPrice: e.target.value })}
                placeholder="140"
              />
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">지역</label>
              <Input
                type="text"
                value={ppaForm.region}
                onChange={(e) => setPpaForm({ ...ppaForm, region: e.target.value })}
                placeholder="울산"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-accent block mb-1.5">요청사항</label>
            <textarea
              value={ppaForm.notes}
              onChange={(e) => setPpaForm({ ...ppaForm, notes: e.target.value })}
              placeholder="REC 분리 여부·계약 조건 등 협의하고 싶은 내용"
              className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white min-h-[80px]"
            />
          </div>

          <p className="text-[11px] text-accent/70 pt-2 border-t border-accent/10">
            * 필수 입력 항목. 신청 후 SPC 매칭을 거쳐 계약이 진행됩니다.
          </p>
        </div>
      </Modal>

      {/* ───────── 수정 모달 ───────── */}
      <Modal
        open={!!editingRequest}
        onClose={() => setEditingRequest(null)}
        title={
          editForm.dealType === 'LEASE' || editForm.dealType === 'SAVINGS_SHARE' ? '직접 PPA 수정' : '직접 PPA 수정'
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingRequest(null)}>
              닫기
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editingRequest) return;
                try {
                  const resolvedSiteName = editForm.siteId
                    ? sites.find((s) => String(s.id) === editForm.siteId)?.name
                    : editingRequest.siteName;
                  await updateRequestMut.mutateAsync({
                    id: editingRequest.id,
                    data: {
                      requesterType: editingRequest.requesterType,
                      companyId: editingRequest.companyId,
                      dealType: editForm.dealType,
                      ppaSubType: editingRequest.ppaSubType,
                      capacityKw: Number(editForm.capacityKw),
                      durationYears: Number(editForm.durationYears),
                      desiredUnitPrice: editForm.desiredUnitPrice ? Number(editForm.desiredUnitPrice) : undefined,
                      region: editForm.region || undefined,
                      siteName: resolvedSiteName || undefined,
                      matching247Target: editingRequest.matching247Target,
                      plantName: editingRequest.plantName,
                      expectedAnnualKwh: editingRequest.expectedAnnualKwh,
                      recEligible: editingRequest.recEligible,
                      notes: editForm.notes || undefined,
                    } as any,
                  });
                  showToast('success', '수정이 완료되었습니다');
                } catch {
                  showToast('error', '수정에 실패했습니다');
                }
                setEditingRequest(null);
              }}
            >
              저장
            </Button>
          </>
        }
      >
        {editingRequest && (editForm.dealType === 'LEASE' || editForm.dealType === 'SAVINGS_SHARE') && (
          <div className="space-y-4">
            <div className="rounded-lg bg-violet-500/[0.10] ring-1 ring-violet-500/30 px-4 py-3">
              <p className="text-sm font-semibold text-violet-300">직접 PPA</p>
              <p className="text-xs text-accent mt-0.5">발전사업자가 부지에 설치 → 발전량 비례 청구 (온사이트 PPA)</p>
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">대상 사업장 *</label>
              <select
                value={editForm.siteId}
                onChange={(e) => setEditForm({ ...editForm, siteId: e.target.value })}
                className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white"
              >
                <option value="">선택하세요</option>
                {sites.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-accent block mb-1.5">설치희망 용량 (kW) *</label>
                <Input
                  type="number"
                  value={editForm.capacityKw}
                  onChange={(e) => setEditForm({ ...editForm, capacityKw: e.target.value })}
                  placeholder="500"
                />
              </div>
              <div>
                <label className="text-xs text-accent block mb-1.5">실사 희망 날짜 *</label>
                <Input
                  type="date"
                  value={editForm.surveyDate}
                  onChange={(e) => setEditForm({ ...editForm, surveyDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">요청사항</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="선호 발전사·설치 시기·수익 분배 비율 등"
                className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white min-h-[80px]"
              />
            </div>
          </div>
        )}
        {editingRequest && editForm.dealType === 'PPA' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-500/[0.10] ring-1 ring-blue-500/30 px-4 py-3">
              <p className="text-sm font-semibold text-blue-300">직접 PPA</p>
              <p className="text-xs text-accent mt-0.5">Onsite PPA · Offsite PPA</p>
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">대상 사업장 *</label>
              <select
                value={editForm.siteId}
                onChange={(e) => setEditForm({ ...editForm, siteId: e.target.value })}
                className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white"
              >
                <option value="">선택하세요</option>
                {sites.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-accent block mb-1.5">희망 용량 (kW) *</label>
                <Input
                  type="number"
                  value={editForm.capacityKw}
                  onChange={(e) => setEditForm({ ...editForm, capacityKw: e.target.value })}
                  placeholder="500"
                />
              </div>
              <div>
                <label className="text-xs text-accent block mb-1.5">계약 기간 (년) *</label>
                <Input
                  type="number"
                  value={editForm.durationYears}
                  onChange={(e) => setEditForm({ ...editForm, durationYears: e.target.value })}
                  placeholder="20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-accent block mb-1.5">희망 단가 (₩/kWh)</label>
                <Input
                  type="number"
                  value={editForm.desiredUnitPrice}
                  onChange={(e) => setEditForm({ ...editForm, desiredUnitPrice: e.target.value })}
                  placeholder="140"
                />
              </div>
              <div>
                <label className="text-xs text-accent block mb-1.5">지역</label>
                <Input
                  type="text"
                  value={editForm.region}
                  onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                  placeholder="울산"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-accent block mb-1.5">요청사항</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="REC 분리 여부·계약 조건 등"
                className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-white min-h-[80px]"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ───────── 취소 확인 모달 ───────── */}
      <Modal
        open={!!cancelingRequest}
        onClose={() => setCancelingRequest(null)}
        title="거래 신청 취소"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelingRequest(null)}>
              닫기
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!cancelingRequest) return;
                try {
                  await updateStatusMut.mutateAsync({ id: cancelingRequest.id, status: 'CANCELLED' });
                  showToast('success', '거래 신청이 취소되었습니다');
                } catch {
                  showToast('error', '취소에 실패했습니다');
                }
                setCancelingRequest(null);
              }}
            >
              신청 취소
            </Button>
          </>
        }
      >
        {cancelingRequest && (
          <p className="text-sm text-accent-hover">
            <strong className="text-white">{cancelingRequest.companyName}</strong>의 거래 신청을 취소하시겠습니까?
            <br />
            <span className="text-xs text-accent/70">취소된 신청은 되돌릴 수 없습니다.</span>
          </p>
        )}
      </Modal>
    </div>
  );
}
