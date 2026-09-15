'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Sun, Zap, Plug, Activity, Receipt, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Badge } from '@/components/ui/Badge';
import { RmsAreaChart } from '@/components/ui/Chart';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsumerSupplyDemand, useConsumerSupplyImpact } from '@/hooks/monitoring/useMonitoring';
import type { ConsumerSupplyDemand, ConsumerSupplyImpact } from '@/types/monitoring';
import { useKepcoAvgPrice } from '@/hooks/platform/useBillingRates';
import { usePpaContracts } from '@/hooks/ppa/usePpa';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';

type ChartRow = { time: string; 사용량: number; PPA: number; 한전: number };
const HOURLY: ChartRow[] = [];
const DAILY: ChartRow[] = [];
const MONTHLY: ChartRow[] = [];

type TimeUnit = 'hour' | 'day' | 'month';
const UNIT_LABEL: Record<TimeUnit, string> = { hour: '시간', day: '일', month: '월' };

// PPA 계약별 메타 (resourceIcon 등 UI 보조 — 백엔드엔 없는 시각 정보)
// kind 색상은 contracts/trading 페이지와 동일 (Lease=보라, Offsite=파랑, Onsite=에메랄드)
type PpaKind = 'lease' | 'offsite' | 'onsite';
const PPA_PLANT_META: Record<
  string,
  { icon: LucideIcon; color: string; tone: string; bg: string; kind: PpaKind; installing?: boolean }
> = {};
const PPA_PLANT_META_DEFAULT = {
  icon: Sun,
  color: '#F59E0B',
  tone: 'text-amber-400',
  bg: 'bg-amber-500/[0.10]',
  kind: 'lease' as PpaKind,
  installing: false,
};
const KIND_BADGE: Record<PpaKind, { label: string; tone: string; bg: string; ring: string; desc: string }> = {
  lease: {
    label: '직접 PPA',
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ring: 'ring-violet-500/30',
    desc: '자가소비 구조 (잉여 발생 X)',
  },
  offsite: {
    label: '직접 PPA - Offsite PPA',
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
    ring: 'ring-blue-500/30',
    desc: '망 경유 공급',
  },
  onsite: {
    label: '직접 PPA - Onsite PPA',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
    desc: '부지 내 설치 · 전량 공급',
  },
};

/* ───────────────────────── Page ───────────────────────── */

export default function PpaStatusPage() {
  const router = useRouter();
  const [unit, setUnit] = useState<TimeUnit>('hour');
  const companyId = useAuthStore((s) => s.user?.companyId ?? 0);
  const KEPCO_AVG_PRICE = useKepcoAvgPrice();

  const { data: apiContracts } = usePpaContracts();
  const { data: sitesData } = useConsumerSites(companyId ? { companyId } : undefined);

  const SITES = useMemo(() => {
    const raw = ((sitesData as any)?.content ?? sitesData ?? []) as any[];
    return raw
      .filter((s: any) => !s.deletedAt)
      .map((s: any) => ({ id: String(s.id), label: s.name, location: s.address ?? '' }));
  }, [sitesData]);
  const SITE = SITES[0] ?? { id: '', label: '—', location: '' };

  const PPA_LIST = useMemo(() => {
    const raw = ((apiContracts as any)?.content ?? apiContracts ?? []) as any[];
    return raw.map((c: any) => ({
      id: String(c.id),
      label: `${c.contractType === 'LEASE' ? '온사이트 PPA' : c.contractType === 'ONSITE' ? 'Onsite PPA' : 'Offsite PPA'} · ${c.contractNumber ?? `PPA-${c.id}`}`,
      counterparty: c.generatorCompanyName ?? '—',
    }));
  }, [apiContracts]);
  const PPA = PPA_LIST[0] ?? { id: '', label: '—', counterparty: '' };

  const ESTIMATED_INVOICE = 0;
  const ESTIMATED_DUE = '';

  const { data: sdData, isError: sdError } = useConsumerSupplyDemand(companyId);
  const SUPPLY_DEMAND: ConsumerSupplyDemand =
    !sdError && sdData
      ? sdData
      : ({
          companyId: 0,
          consumerName: '',
          monthlyDemandKwh: 0,
          monthlySupplyKwh: 0,
          todaySupplyKwh: 0,
          supplyDemandRatioPct: 0,
          reTargetPct: 0,
          reCurrentPct: 0,
          ppaDetails: [],
        } as ConsumerSupplyDemand);

  const { data: siData, isError: siError } = useConsumerSupplyImpact(companyId);
  const SUPPLY_IMPACT: ConsumerSupplyImpact =
    !siError && siData
      ? siData
      : ({
          companyId: 0,
          consumerName: '',
          activeAnomalies: [],
          totalContractCapacityKw: 0,
          impactedCapacityKw: 0,
        } as ConsumerSupplyImpact);

  const nowUseKw = 0;
  const nowPpaKw = 0;
  const nowKepcoKw = 0;

  const monthlyKepcoKwh = SUPPLY_DEMAND.monthlyDemandKwh - SUPPLY_DEMAND.monthlySupplyKwh;

  const impactPct =
    SUPPLY_IMPACT.totalContractCapacityKw > 0
      ? Math.round((SUPPLY_IMPACT.impactedCapacityKw / SUPPLY_IMPACT.totalContractCapacityKw) * 100)
      : 0;

  const chartData = useMemo(() => {
    if (unit === 'hour') return HOURLY;
    if (unit === 'day') return DAILY;
    return MONTHLY;
  }, [unit]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '전력 현황' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">전력 현황</h1>
          <p className="mt-1 text-sm text-slate-400">
            {SITE.label} · {SUPPLY_DEMAND.ppaDetails.length}개 PPA · 우리 수급·매칭·RE100 한눈에
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            align="left"
            trigger={
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08] cursor-pointer transition-colors min-w-[180px]">
                <span className="text-xs text-slate-500 shrink-0">사업장</span>
                <span className="font-medium truncate flex-1">{SITE.label}</span>
                <ChevronDown size={14} className="text-slate-500 shrink-0" />
              </div>
            }
          >
            <DropdownItem onClick={() => {}}>
              <p className="text-sm">{SITE.label}</p>
              <p className="text-xs text-slate-500">{SITE.location}</p>
            </DropdownItem>
          </Dropdown>

          <Dropdown
            align="left"
            trigger={
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08] cursor-pointer transition-colors min-w-[220px]">
                <span className="text-xs text-slate-500 shrink-0">PPA</span>
                <span className="font-medium truncate flex-1">{PPA.label}</span>
                <ChevronDown size={14} className="text-slate-500 shrink-0" />
              </div>
            }
          >
            {PPA_LIST.map((p) => (
              <DropdownItem key={p.id} onClick={() => router.push('/ppa/contracts')}>
                <p className="text-sm">{p.label}</p>
                <p className="text-xs text-slate-500">{p.counterparty}</p>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* KPI 4종 — 발전사 '발전 현황'(/generator/ppa/dashboard) 대칭 패턴 (시간축):
          ① 지금 사용 (현재 시각) ② 오늘 누적 ③ 이달 누적 ④ 이달 예상 정산금
          (RE100 누적 이행률·수급 비율은 KPI 아래 별도 카드로) */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<Zap size={18} className="text-rose-400" />}
          label="지금 사용"
          value={`${nowUseKw.toLocaleString()} kW`}
          sub={`PPA ${nowPpaKw} · 한전 ${nowKepcoKw} kW`}
        />
        <StatCard
          icon={<Activity size={18} className="text-sky-400" />}
          label="오늘 누적 사용"
          value="0 kWh"
          sub="PPA 0 · 한전 0 kWh"
        />
        <StatCard
          icon={<Activity size={18} className="text-amber-400" />}
          label="이달 누적 사용"
          value={`${SUPPLY_DEMAND.monthlyDemandKwh.toLocaleString()} kWh`}
          sub={`PPA ${SUPPLY_DEMAND.monthlySupplyKwh.toLocaleString()} · 한전 ${monthlyKepcoKwh.toLocaleString()} kWh`}
        />
        <StatCard
          icon={<Receipt size={18} className="text-emerald-400" />}
          label="이달 예상 정산금"
          value={`₩ ${ESTIMATED_INVOICE.toLocaleString()}`}
          sub={`납부 기한 ${ESTIMATED_DUE}`}
          onClick={() => router.push('/ppa/billing/settlement')}
        />
      </StatsGrid>

      {/* RE100 달성 현황 — 누적 이행률 vs 2030 목표 */}
      <SectionCard
        title="RE100 달성 현황"
        description={`재생에너지 사용 비중 — 2030 목표 ${SUPPLY_DEMAND.reTargetPct}%`}
      >
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-400 tabular-nums">
                {SUPPLY_DEMAND.reCurrentPct}
                <span className="text-base font-normal text-slate-400">%</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                이번 달 PPA 공급 {SUPPLY_DEMAND.monthlySupplyKwh.toLocaleString()} kWh / 총 사용{' '}
                {SUPPLY_DEMAND.monthlyDemandKwh.toLocaleString()} kWh
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-300 tabular-nums">
                목표까지 {(SUPPLY_DEMAND.reTargetPct - SUPPLY_DEMAND.reCurrentPct).toFixed(1)}%p
              </p>
              <p className="text-[11px] text-slate-500">2030 RE100 목표 {SUPPLY_DEMAND.reTargetPct}%</p>
            </div>
          </div>
          {/* 진행 바 — 현재 이행률 + 목표 마커 */}
          <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${Math.min(SUPPLY_DEMAND.reCurrentPct, 100)}%` }}
            />
            {/* 목표 마커 */}
            <div
              className="absolute top-0 h-full w-0.5 bg-amber-400"
              style={{ left: `${SUPPLY_DEMAND.reTargetPct}%` }}
              title={`2030 목표 ${SUPPLY_DEMAND.reTargetPct}%`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
            <span>0%</span>
            <span className="text-amber-400">▲ 목표 {SUPPLY_DEMAND.reTargetPct}%</span>
            <span>100%</span>
          </div>
        </div>
      </SectionCard>

      {/* 사용량 vs PPA vs 한전 — 시간/일/월 */}
      <SectionCard
        title="사용량 vs PPA 공급 vs 한전 보충"
        description="우리가 쓴 전력을 어디서 받았는지 — PPA(재생E)와 한전 보충 구성"
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
            {(['hour', 'day', 'month'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  unit === u ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white',
                )}
              >
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        }
      >
        <div className="px-2 py-2">
          <RmsAreaChart
            data={chartData}
            xKey="time"
            areas={[
              { key: '한전', name: '한전 보충', color: '#94A3B8' },
              { key: 'PPA', name: 'PPA 공급 (재생E)', color: '#F59E0B' },
              { key: '사용량', name: '총 사용량', color: '#EF4444' },
            ]}
            height={280}
          />
        </div>
      </SectionCard>

      {/* PPA 계약별 이행률 — 기획서 "실시간 자원별 매칭"의 정확한 구현 (ppaDetails) */}
      <SectionCard
        title={`PPA 계약별 이행률 (${SUPPLY_DEMAND.ppaDetails.length})`}
        description="계약 용량 대비 이번 달 발전 이행률 — SPC 매칭·발전사 공급량 결과"
      >
        <div className="space-y-4">
          {SUPPLY_DEMAND.ppaDetails.map((p) => {
            const meta = PPA_PLANT_META[p.contractNumber] ?? PPA_PLANT_META_DEFAULT;
            const kindMeta = KIND_BADGE[meta.kind];
            const Icon = meta.icon;
            const utilization = Math.round((p.monthlyGenerationKwh / SUPPLY_DEMAND.monthlySupplyKwh) * 100);
            return (
              <div key={p.contractNumber} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/[0.06]',
                        meta.bg,
                      )}
                    >
                      <Icon size={14} className={meta.tone} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                            kindMeta.bg,
                            kindMeta.tone,
                            kindMeta.ring,
                          )}
                        >
                          {kindMeta.label}
                        </span>
                        <p className="text-sm font-medium text-white truncate">{p.plantName}</p>
                        {meta.installing && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-teal-500/[0.10] text-teal-200 ring-teal-400/40">
                            설치중
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                        {p.contractNumber} · 계약 용량 {p.contractCapacityKw.toLocaleString()} kW
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {meta.installing ? (
                      <p className="text-sm font-semibold text-teal-200">발전 개시 전</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-emerald-400 tabular-nums">{p.fulfillmentPct}%</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {p.monthlyGenerationKwh.toLocaleString()} kWh
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(p.fulfillmentPct, 100)}%`, backgroundColor: meta.color }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {meta.installing
                    ? `${kindMeta.desc} · 설치 완료 후 발전 데이터가 집계됩니다`
                    : `PPA 공급 중 차지 비중 ${utilization}% · ${kindMeta.desc}`}
                </p>
              </div>
            );
          })}

          {/* 한전 보충 — 백엔드 ppaDetails엔 없지만 비중 비교를 위해 함께 표시 */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-500/[0.10] ring-1 ring-white/[0.06]">
              <Plug size={14} className="text-slate-300" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">한전 보충</p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                PPA로 못 채운 부족분 · 한전 산업용 단가 ₩{KEPCO_AVG_PRICE}/kWh
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-slate-300 tabular-nums">
                {(100 - SUPPLY_DEMAND.supplyDemandRatioPct).toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">{monthlyKepcoKwh.toLocaleString()} kWh</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 공급 영향 — 활성 이상감지 (백엔드 ConsumerSupplyImpact). 0건이면 숨김 */}
      {SUPPLY_IMPACT.activeAnomalies.length > 0 && (
        <SectionCard
          title="공급 영향 (활성 이상)"
          description={`총 계약 용량 ${SUPPLY_IMPACT.totalContractCapacityKw.toLocaleString()} kW 중 ${SUPPLY_IMPACT.impactedCapacityKw.toLocaleString()} kW (${impactPct}%) 영향`}
        >
          <ul className="divide-y divide-white/[0.04]">
            {SUPPLY_IMPACT.activeAnomalies.map((a) => (
              <li key={a.anomalyId} className="flex items-center gap-3 px-5 py-3">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{a.title}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {a.plantName} · 영향 용량 {a.contractCapacityKw.toLocaleString()} kW
                  </p>
                </div>
                <Badge variant="warning">{a.severity}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
