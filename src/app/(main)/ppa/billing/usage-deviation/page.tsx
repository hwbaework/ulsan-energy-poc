// @ts-nocheck
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Zap,
  Cloud,
  Wrench,
  FileSignature,
  Search,
  _Download,
  ChevronRight,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ScrollableChart, RmsBarChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useContractDeviations } from '@/hooks/ppa/usePpa';

/* ───────────────────────── Types & Fallback ───────────────────────── */

type Resolution = 'internal' | 'kepco' | 'pending';

const RESOLUTION_META: Record<Resolution, { label: string; tone: string; bg: string; ring: string }> = {
  internal: { label: '내부 보완', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', ring: 'ring-emerald-500/30' },
  kepco: { label: '한전 청구', tone: 'text-amber-300', bg: 'bg-amber-500/[0.08]', ring: 'ring-amber-500/30' },
  pending: { label: '미처리', tone: 'text-rose-300', bg: 'bg-rose-500/[0.08]', ring: 'ring-rose-500/30' },
};

interface DeviationEvent {
  id: string;
  date: string; // 'M/D' 발생 날짜
  startHour: number; // 0-23 시작 시간 (정시 단위)
  endHour: number; // 1-24 종료 시간 (정시 단위, exclusive)
  contractLabel: string;
  site: string;
  kwh: number;
  cause: 'weather' | 'maintenance' | 'contract-shortage' | 'usage-spike';
  resolution: Resolution;
  resolutionDetail?: string;
  settlementImpact: number; // ₩ (음수 = 손실)
  re100Impact?: string; // e.g. '−0.4%p'
}

const formatHour = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const formatTimeRange = (start: number, end: number) => `${formatHour(start)} ~ ${formatHour(end)}`;

const CAUSE_META = {
  weather: { label: '기상', icon: Cloud, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  maintenance: { label: '점검', icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'contract-shortage': { label: '계약 부족', icon: FileSignature, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  'usage-spike': { label: '사용량 급증', icon: TrendingUp, color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

const EVENTS: DeviationEvent[] = [];

// 30일 트렌드 — 온사이트 PPA 태양광: 야간은 한전 전환, 주간 우천 시 편차
const TREND_30D = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 4, 1 + i);
  const isRainy = i === 7 || i === 14 || i === 21;
  const shortage = isRainy ? Math.round(100 + ((i * 7) % 50)) : Math.round(10 + ((i * 3) % 20));
  return { date: `${d.getMonth() + 1}/${d.getDate()}`, shortage };
});

// 시간대별 — 태양광 없는 야간(18~06)에 편차 집중
const HOURLY_DEVIATION = Array.from({ length: 24 }, (_, i) => {
  const isDaylight = i >= 6 && i <= 18;
  return {
    hour: `${String(i).padStart(2, '0')}시`,
    shortage: isDaylight ? 0 : Math.round(15 + ((i * 5) % 25)),
  };
});

/* ── 미처리 편차 처리 옵션 ────────────────────────────────────────── */

type ResolveMethod = 'internal' | 'kepco' | 'defer';

const RESOLVE_OPTIONS: Record<
  ResolveMethod,
  {
    label: string;
    description: string;
    costNote: string;
    re100Note: string;
    tone: string;
    bg: string;
    ring: string;
    icon: typeof ArrowRightLeft;
  }
> = {
  internal: {
    label: '내부 보완',
    description: '4종 자원 포트폴리오 안에서 자동 스왑하여 부족분 충당',
    costNote: '추가 비용 0',
    re100Note: 'RE100 이행률 유지',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.08]',
    ring: 'ring-emerald-500/30',
    icon: ArrowRightLeft,
  },
  kepco: {
    label: '한전 청구',
    description: '한전 그리드가 메운 부족분을 한전 단가로 청구 처리',
    costNote: '한전 단가 약 ₩300/kWh',
    re100Note: 'RE100 비인정 (-)',
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.08]',
    ring: 'ring-amber-500/30',
    icon: AlertTriangle,
  },
  defer: {
    label: '다음달 이월',
    description: '임시 보류 — 정산 마감 D-7 이내 재처리 필요',
    costNote: '결정 보류',
    re100Note: '미정 (이월 시점에 결정)',
    tone: 'text-slate-300',
    bg: 'bg-white/[0.04]',
    ring: 'ring-white/[0.08]',
    icon: Clock,
  },
};

/** 원인 + 부족량 기반 AI 추천 옵션. */
function recommendResolve(event: DeviationEvent): { method: ResolveMethod; reason: string } {
  if (event.cause === 'usage-spike') {
    return { method: 'internal', reason: '일시적 사용량 급증 — 다른 자원에서 보완 가능성 높음' };
  }
  if (event.cause === 'maintenance' || event.cause === 'contract-shortage') {
    return { method: 'kepco', reason: '구조적·예정된 부족 — 내부 보완 어려움' };
  }
  if (event.cause === 'weather' && event.kwh > 300) {
    return { method: 'kepco', reason: '대규모 기상 변동 — 내부 자원 여유 부족 우려' };
  }
  return { method: 'internal', reason: '소규모 편차 — 내부 보완 권장' };
}

function DeviationResolveModal({
  event,
  open,
  onClose,
  onApply,
}: {
  event: DeviationEvent | null;
  open: boolean;
  onClose: () => void;
  onApply: (method: ResolveMethod, memo: string) => void;
}) {
  const [method, setMethod] = useState<ResolveMethod>('internal');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (event) {
      const rec = recommendResolve(event);
      setMethod(rec.method);
      setMemo('');
    }
  }, [event?.id]);

  if (!event) return null;
  const cm = CAUSE_META[event.cause];
  const rec = recommendResolve(event);
  const estCost = method === 'kepco' ? Math.round(event.kwh * 300) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="편차 정산 처리"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={() => onApply(method, memo)}>
            <CheckCircle2 size={14} className="mr-1.5" />
            처리 적용
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 이벤트 요약 */}
        <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">대상 편차</p>
          <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-amber-300" />
              <span className="text-white font-medium">
                {event.contractLabel} · {event.site}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 tabular-nums">
                {event.date} {formatTimeRange(event.startHour, event.endHour)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 tabular-nums font-semibold text-amber-300">
              부족 {event.kwh.toLocaleString()} kWh
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
            <cm.icon size={11} className={cm.color} />
            원인: {cm.label}
          </p>
        </div>

        {/* AI 추천 */}
        <div className="rounded-lg bg-primary/[0.06] ring-1 ring-primary/30 p-3 flex items-start gap-2">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 text-xs">
            <p className="text-primary font-medium">
              AI 추천 — <span className="text-white">{RESOLVE_OPTIONS[rec.method].label}</span>
            </p>
            <p className="text-slate-400 mt-0.5">{rec.reason}</p>
          </div>
        </div>

        {/* 옵션 선택 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-300">처리 방식 선택</p>
          {(Object.keys(RESOLVE_OPTIONS) as ResolveMethod[]).map((key) => {
            const opt = RESOLVE_OPTIONS[key];
            const isSelected = method === key;
            const isRecommended = rec.method === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={cn(
                  'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  isSelected
                    ? `border-transparent ${opt.bg} ring-1 ${opt.ring}`
                    : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
                    opt.bg,
                    opt.ring,
                  )}
                >
                  <opt.icon size={16} className={opt.tone} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-semibold', isSelected ? 'text-white' : 'text-slate-200')}>
                      {opt.label}
                    </span>
                    {isRecommended && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/[0.10] px-1.5 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/30">
                        <Sparkles size={9} />
                        추천
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{opt.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    <span className="text-slate-500">
                      비용: <span className="text-white tabular-nums">{opt.costNote}</span>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">
                      RE100: <span className={opt.tone}>{opt.re100Note}</span>
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1',
                    isSelected ? 'bg-primary ring-primary' : 'bg-transparent ring-white/20',
                  )}
                >
                  {isSelected && <CheckCircle2 size={12} className="text-white" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* 비용 미리보기 */}
        {method === 'kepco' && (
          <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/20 px-3 py-2 text-xs">
            <p className="text-amber-300">
              예상 추가 청구액:{' '}
              <span className="font-semibold text-white tabular-nums">₩{estCost.toLocaleString()}</span>{' '}
              <span className="text-slate-500">({event.kwh.toLocaleString()} kWh × ₩300)</span>
            </p>
          </div>
        )}

        {/* 메모 */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">처리 메모 (선택)</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="처리 사유·검토 내용 등"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function ResolutionPill({ r }: { r: Resolution }) {
  const m = RESOLUTION_META[r];
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

/* ───────────────────────── Sites + ScopeTrigger ───────────────────────── */

interface Site {
  id: string;
  label: string;
}

const SITES: Site[] = [];

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

/* ───────────────────────── Page ───────────────────────── */

export default function PpaUsageDeviationPage() {
  return (
    <Suspense>
      <PpaUsageDeviationContent />
    </Suspense>
  );
}

function PpaUsageDeviationContent() {
  const { data: apiDeviations } = useContractDeviations(0);

  const allEvents: DeviationEvent[] = useMemo(() => {
    if (Array.isArray(apiDeviations) && apiDeviations.length > 0) {
      return apiDeviations.map((d: any, idx: number) => ({
        id: String(d.id ?? idx),
        date: d.date ?? '—',
        startHour: d.startHour ?? 0,
        endHour: d.endHour ?? 24,
        contractLabel: d.contractLabel ?? 'PPA',
        site: d.site ?? '—',
        kwh: d.kwh ?? 0,
        cause: (d.cause ?? 'weather') as DeviationEvent['cause'],
        resolution: (d.resolution ?? 'pending') as Resolution,
        resolutionDetail: d.resolutionDetail,
        settlementImpact: d.settlementImpact ?? 0,
        re100Impact: d.re100Impact,
      }));
    }
    return EVENTS;
  }, [apiDeviations]);

  const searchParams = useSearchParams();
  const initialResolution = (() => {
    const r = searchParams.get('resolution');
    return r === 'internal' || r === 'kepco' || r === 'pending' ? (r as Resolution) : 'all';
  })();

  const [resolutionFilter, setResolutionFilter] = useState<Resolution | 'all'>(initialResolution);
  const [query, setQuery] = useState('');
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<'all' | string>('all');
  const [scopePpaId, setScopePpaId] = useState<'all' | string>('all');

  const selectedSite = useMemo(
    () => (siteId === 'all' ? null : (SITES.find((s) => s.id === siteId) ?? null)),
    [siteId],
  );

  const sitePpas = useMemo(() => {
    if (!selectedSite) return [];
    const seen = new Map<string, string>();
    for (const e of allEvents) {
      if (e.site === selectedSite.label && !seen.has(e.contractLabel)) {
        seen.set(e.contractLabel, e.contractLabel);
      }
    }
    return Array.from(seen.values());
  }, [selectedSite, allEvents]);

  const handleSiteChange = (id: 'all' | string) => {
    setSiteId(id);
    setScopePpaId('all');
  };

  // Scope 적용된 base 이벤트
  const scopedEvents = useMemo(
    () =>
      allEvents.filter((e) => {
        if (selectedSite && e.site !== selectedSite.label) return false;
        if (scopePpaId !== 'all' && e.contractLabel !== scopePpaId) return false;
        return true;
      }),
    [allEvents, selectedSite, scopePpaId],
  );

  const isPending = (e: DeviationEvent) => e.resolution === 'pending' && !processedIds.has(e.id);
  const pendingEvents = scopedEvents.filter(isPending);
  const processingEvent = processingId ? (allEvents.find((e) => e.id === processingId) ?? null) : null;

  const handleApplyResolve = (method: ResolveMethod, _memo: string) => {
    if (!processingEvent) return;
    const opt = RESOLVE_OPTIONS[method];
    setProcessedIds((prev) => {
      const next = new Set(prev);
      next.add(processingEvent.id);
      return next;
    });
    setProcessingId(null);
    useToastStore
      .getState()
      .add(
        'success',
        `${processingEvent.contractLabel} ${processingEvent.date} 편차를 "${opt.label}"으로 처리했습니다.`,
      );
  };

  const stats = useMemo(() => {
    const totalShortage = scopedEvents.reduce((s, e) => s + e.kwh, 0);
    const internal = scopedEvents.filter((e) => e.resolution === 'internal').length;
    const totalImpact = scopedEvents.reduce((s, e) => s + e.settlementImpact, 0);
    const internalRate = scopedEvents.length > 0 ? Math.round((internal / scopedEvents.length) * 100) : 0;
    return { totalShortage, internal, totalImpact, internalRate };
  }, [scopedEvents]);

  const filtered = useMemo(() => {
    return scopedEvents.filter((e) => {
      if (resolutionFilter !== 'all' && e.resolution !== resolutionFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return e.contractLabel.toLowerCase().includes(q) || e.site.toLowerCase().includes(q);
      }
      return true;
    });
  }, [scopedEvents, resolutionFilter, query]);

  // Cause breakdown (scope 반영)
  const causeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of scopedEvents) c[e.cause] = (c[e.cause] ?? 0) + 1;
    return c;
  }, [scopedEvents]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '전력거래', path: '/ppa/trading' },
          { label: '정산 내역', path: '/ppa/billing/settlement' },
          { label: '사용량 편차' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">사용량 부족 내역</h1>
          <p className="mt-1 text-sm text-slate-400">계약 발전량 대비 부족분 추적 · 자동 헷지 처리 결과</p>
        </div>

        {/* Scope dropdowns */}
        <div className="flex flex-wrap gap-2 items-start">
          {/* 사업장 */}
          <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSite?.label ?? '전사 합산'} />}>
            <DropdownItem onClick={() => handleSiteChange('all')}>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm">전사 합산</p>
                  <p className="text-xs text-slate-500">{SITES.length}개 사업장</p>
                </div>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => {
              const count = allEvents.filter((e) => e.site === s.label).length;
              return (
                <DropdownItem key={s.id} onClick={() => handleSiteChange(s.id)}>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm">{s.label}</p>
                      <p className="text-xs text-slate-500">{count}건</p>
                    </div>
                  </div>
                </DropdownItem>
              );
            })}
          </Dropdown>

          {/* PPA */}
          {selectedSite ? (
            <Dropdown
              align="left"
              trigger={<ScopeTrigger label="PPA" value={scopePpaId !== 'all' ? scopePpaId : '사업장 내 전체'} />}
            >
              <DropdownItem onClick={() => setScopePpaId('all')}>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm">사업장 내 전체</p>
                    <p className="text-xs text-slate-500">{sitePpas.length}개 PPA 합산</p>
                  </div>
                </div>
              </DropdownItem>
              <div className="my-1 border-t border-white/[0.06]" />
              {sitePpas.map((label) => (
                <DropdownItem key={label} onClick={() => setScopePpaId(label)}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{label}</p>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
          ) : (
            <ScopeTrigger label="PPA" value="—" disabled />
          )}
        </div>
      </div>

      {/* KPI 3개 */}
      <StatsGrid columns={3}>
        <StatCard
          icon={<TrendingDown size={18} className="text-amber-400" />}
          label="총 부족량 (이번달)"
          value={`${stats.totalShortage.toLocaleString()} kWh`}
        />
        <StatCard
          icon={<ArrowRightLeft size={18} className="text-emerald-400" />}
          label="내부 보완률"
          value={`${stats.internalRate}%`}
          change={{ value: 12, label: '전월 대비' }}
        />
        <StatCard
          icon={<Zap size={18} className="text-rose-400" />}
          label="정산 순영향"
          value={`${stats.totalImpact >= 0 ? '+' : '−'}₩${Math.abs(stats.totalImpact).toLocaleString()}`}
        />
      </StatsGrid>

      {/* Trend + Hourly */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ScrollableChart
          data={TREND_30D}
          xKey="date"
          lines={[{ key: 'shortage', name: '부족 (kWh)', color: '#F59E0B', type: 'area' }]}
          title="일별 부족량 추이"
          description="30일 누적 부족량"
          height={240}
          initialWindow={30}
        />

        <RmsBarChart
          data={HOURLY_DEVIATION}
          xKey="hour"
          bars={[{ key: 'shortage', name: '부족', color: '#F59E0B' }]}
          title="시간대별 부족 분포"
          description="누적 부족량 (이번달)"
          height={240}
        />
      </div>

      {/* Cause + Resolution Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SectionCard title="원인 분해" description={`총 ${allEvents.length}건`}>
          <div className="space-y-2">
            {(Object.keys(CAUSE_META) as (keyof typeof CAUSE_META)[]).map((key) => {
              const meta = CAUSE_META[key];
              const count = causeCounts[key] ?? 0;
              const pct = allEvents.length > 0 ? Math.round((count / allEvents.length) * 100) : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded', meta.bg)}>
                        <meta.icon size={12} className={meta.color} />
                      </span>
                      <span className="text-slate-300">{meta.label}</span>
                    </span>
                    <span className="tabular-nums text-slate-400">
                      {count}건 <span className="text-slate-600">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className={meta.bg.replace('/10', '/60')} style={{ width: `${pct}%`, height: '100%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="처리 분해" description="자동 헷지 결과">
          <div className="space-y-2">
            {(Object.keys(RESOLUTION_META) as Resolution[]).map((r) => {
              const count = allEvents.filter((e) => e.resolution === r).length;
              const pct = allEvents.length > 0 ? Math.round((count / allEvents.length) * 100) : 0;
              return (
                <div
                  key={r}
                  className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.04]"
                >
                  <ResolutionPill r={r} />
                  <span className="text-sm tabular-nums">
                    <span className="text-white font-semibold">{count}</span>
                    <span className="text-slate-500"> ({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="정산 영향 합계" description="이번달 누적">
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-500/[0.08] ring-1 ring-amber-500/20 p-3">
              <p className="text-xs text-amber-300">한전 청구 (부족분)</p>
              <p className="text-lg font-bold text-white tabular-nums mt-1">
                ₩
                {Math.abs(
                  allEvents.filter((e) => e.resolution === 'kepco').reduce((s, e) => s + e.settlementImpact, 0),
                ).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/[0.08] ring-1 ring-emerald-500/20 p-3">
              <p className="text-xs text-emerald-300">내부 보완 (정산 영향 0)</p>
              <p className="text-lg font-bold text-white tabular-nums mt-1">
                {allEvents.filter((e) => e.resolution === 'internal').length}건
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Event Table */}
      <SectionCard
        title="부족 이벤트 로그"
        description={`${filtered.length}건`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
              {(['all', 'internal', 'kepco', 'pending'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setResolutionFilter(r)}
                  className={cn(
                    'rounded px-2.5 h-7 text-xs transition-colors',
                    resolutionFilter === r ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {r === 'all' ? '전체' : RESOLUTION_META[r].label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="px-6 py-3 border-b border-white/[0.06]">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="계약 / 사업장 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-white/[0.06] text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">날짜</th>
                <th className="px-4 py-2.5 text-left font-medium">시간</th>
                <th className="px-4 py-2.5 text-left font-medium">계약 / 사업장</th>
                <th className="px-4 py-2.5 text-left font-medium">부족량</th>
                <th className="px-4 py-2.5 text-left font-medium">원인</th>
                <th className="px-4 py-2.5 text-left font-medium">처리</th>
                <th className="px-4 py-2.5 font-medium">정산 영향</th>
                <th className="px-4 py-2.5 font-medium">RE100</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const cm = CAUSE_META[e.cause];
                const duration = e.endHour - e.startHour;
                return (
                  <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer">
                    <td className="px-4 py-3 text-slate-300 tabular-nums text-xs whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-slate-300 tabular-nums text-xs">{formatTimeRange(e.startHour, e.endHour)}</p>
                      <p className="text-[10px] text-slate-500 tabular-nums">{duration}시간</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{e.contractLabel}</p>
                      <p className="text-[11px] text-slate-500">{e.site}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TrendingDown size={14} className="text-amber-300" />
                        <span className="text-white tabular-nums font-semibold">{e.kwh.toLocaleString()} kWh</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <cm.icon size={12} className={cm.color} />
                        <span className="text-slate-300">{cm.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <ResolutionPill r={e.resolution} />
                        {e.resolutionDetail && <p className="text-[10px] text-slate-500">{e.resolutionDetail}</p>}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 tabular-nums font-medium',
                        e.settlementImpact > 0
                          ? 'text-emerald-400'
                          : e.settlementImpact < 0
                            ? 'text-amber-400'
                            : 'text-slate-500',
                      )}
                    >
                      {e.settlementImpact === 0
                        ? '—'
                        : `${e.settlementImpact >= 0 ? '+' : '−'}₩${Math.abs(e.settlementImpact).toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3 text-amber-400 tabular-nums text-xs">{e.re100Impact ?? '—'}</td>
                    <td className="px-4 py-3">
                      {isPending(e) ? (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setProcessingId(e.id);
                          }}
                          className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/[0.10] px-2 text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/[0.18]"
                        >
                          처리 <ChevronRight size={11} />
                        </button>
                      ) : (
                        <button onClick={() => setProcessingId(e.id)} className="text-slate-500 hover:text-white">
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-40 text-sm text-slate-500">
                    조건에 맞는 이벤트가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Pending alert */}
      {pendingEvents.length > 0 && (
        <div className="rounded-lg bg-[#3a2a14] ring-1 ring-amber-500/40 px-4 py-3 shadow-lg shadow-amber-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-100">정산 처리 미결정 {pendingEvents.length}건</p>
              <p className="text-xs text-amber-200/70 mt-0.5">
                전력은 정상 공급된 상태 — 한전 청구·내부 보완·이월 중 정산 방식 선택 필요
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setProcessingId(pendingEvents[0].id)}>
              처리하기
            </Button>
          </div>
        </div>
      )}

      <DeviationResolveModal
        event={processingEvent}
        open={!!processingEvent}
        onClose={() => setProcessingId(null)}
        onApply={handleApplyResolve}
      />
    </div>
  );
}
