'use client';

// info 패널 = f(tier, lens, selection).
// 선택 O → 피처 properties 즉시 렌더(추가 fetch 0) + drill-in(기존 워크스페이스 링크).
// 선택 X → tier 요약 (GIS bbox 응답의 실제 피처 수 기반).
import Link from 'next/link';
import {
  MapPin,
  X,
  Zap,
  Factory,
  Activity,
  Sun,
  TrendingUp,
  ArrowRight,
  Layers,
  Target,
  Building2,
} from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar';
import { useMonitoringConsumers } from '@/hooks/monitoring/useMonitoring';
import { useConsumerSite, useSiteUsage } from '@/hooks/consumer/useConsumer';
import { useWorld, TIER_META, type Selection } from './world';
import { LAYERS } from './layers';
import { DT_MODELS } from './models';

// ── drill-in — 자산 레이어 → 기존 작업장(③) URL. 재작성 0, 링크만. ──
const DRILL_IN: Record<string, { label: string; href: (assetId: string) => string }[]> = {
  'power-plants': [
    { label: '발전 모니터링', href: (id) => `/monitoring/plant?asset=${encodeURIComponent(id)}` },
    { label: '전력거래', href: (id) => `/trading?asset=${encodeURIComponent(id)}` },
  ],
  'vpp-plants': [
    { label: 'VPP 자원 관리', href: (id) => `/vpp?asset=${encodeURIComponent(id)}` },
    { label: '발전 모니터링', href: (id) => `/monitoring/plant?asset=${encodeURIComponent(id)}` },
  ],
  substations: [{ label: '전력거래(계통)', href: (id) => `/trading?asset=${encodeURIComponent(id)}` }],
  'power-lines': [{ label: '전력거래(계통)', href: (id) => `/trading?asset=${encodeURIComponent(id)}` }],
  'power-towers': [{ label: '발전 모니터링', href: (id) => `/monitoring/plant?asset=${encodeURIComponent(id)}` }],
  'dt-models': [
    { label: 'PPA 계약', href: (id) => `/lease/contracts?asset=${encodeURIComponent(id)}` },
    { label: 'PPA 전력 현황', href: (id) => `/lease/power?asset=${encodeURIComponent(id)}` },
    { label: '발전 모니터링', href: (id) => `/monitoring/plant?asset=${encodeURIComponent(id)}` },
  ],
};

// 모델 앵커 props에서 info로 보이지 않을 내부 키
const MODEL_INTERNAL_KEYS = new Set(['assetId', 'modelId', 'name']);

const kwh = (v?: number) => (v == null ? '—' : `${Math.round(v).toLocaleString('ko-KR')} kWh`);

// monitoring 도메인 실데이터 블록 — 수용가 모니터링(useMonitoringConsumers)과 동일 훅·동일 UX 컴포넌트
function ModelMonitoring({ meta }: { meta: { matchName: string; siteId?: number } }) {
  const { data: consumers, isLoading } = useMonitoringConsumers();
  const { data: siteRaw } = useConsumerSite(meta.siteId ?? 0);
  const { data: usageRaw } = useSiteUsage(meta.siteId ?? 0);
  const c = consumers?.find((x) => x.name?.includes(meta.matchName));
  const site = siteRaw as { rePercent?: number; contractPowerKw?: number; peakDemandKw?: number } | undefined;
  const usage = usageRaw as
    | {
        period: string;
        totalUsageKwh: number;
        ppaSupplyKwh: number;
        selfGenKwh: number;
        peakDemandKw: number;
        rePercent: number;
      }[]
    | undefined;
  const latest = usage?.length ? usage[usage.length - 1] : undefined;

  // monitoring 도메인 실시간 값 우선, 없으면 사이트 월사용량(최근월)으로 폴백
  const monthlyDemand = c?.monthlyDemandKwh ?? latest?.totalUsageKwh;
  const monthlySupply = c?.monthlySupplyKwh ?? (latest ? latest.ppaSupplyKwh + latest.selfGenKwh : undefined);
  const reCurrent = c?.reCurrentPct ?? latest?.rePercent ?? site?.rePercent;
  const reTarget = c?.reTargetPct ?? 30;
  if (isLoading && !c && !site && !latest) {
    return (
      <SectionCard title="모니터링">
        <p className="py-2 text-sm text-slate-500">모니터링 데이터 불러오는 중…</p>
      </SectionCard>
    );
  }
  if (!c && !site && !latest) return null;

  return (
    <SectionCard title={latest ? `모니터링 · ${latest.period}` : '모니터링'}>
      <StatsGrid columns={2} className="mb-3">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="이달 수요" value={kwh(monthlyDemand)} />
        <StatCard icon={<Zap className="h-5 w-5" />} label="이달 공급 (RE)" value={kwh(monthlySupply)} />
        {c?.todaySupplyKwh != null ? (
          <StatCard icon={<Activity className="h-5 w-5" />} label="오늘 공급" value={kwh(c.todaySupplyKwh)} />
        ) : (
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="최대수요"
            value={latest?.peakDemandKw != null ? `${latest.peakDemandKw.toLocaleString('ko-KR')} kW` : '—'}
          />
        )}
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="RE 달성률"
          value={reCurrent != null ? `${reCurrent}%` : '—'}
          sub={`목표 ${reTarget}%`}
        />
      </StatsGrid>
      {reCurrent != null && (
        <ProgressBar
          value={reCurrent}
          max={reTarget}
          label="RE100 진행"
          variant={reCurrent >= reTarget ? 'success' : 'primary'}
        />
      )}
      {site?.contractPowerKw != null && (
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <span className="text-sm text-slate-400">계약전력</span>
          <span className="text-sm font-semibold text-white">{site.contractPowerKw.toLocaleString('ko-KR')} kW</span>
        </div>
      )}
    </SectionCard>
  );
}

// 피처 속성 표시 라벨 (dt-map-server attributes 기준)
const PROP_LABELS: Record<string, string> = {
  source: '전원',
  capacityMw: '설비용량(MW)',
  kv: '전압(kV)',
  operator: '운영사',
  method: '설치방식',
  kind: '유형',
  from: '기점',
  to: '종점',
  value: '일사량(kWh/㎡/일)',
};

function AssetInfo({ sel }: { sel: Selection }) {
  const tier = useWorld((s) => s.tier);
  const layer = LAYERS.find((l) => l.id === sel.layerId);
  const isModel = sel.layerId === 'dt-models';
  const model = isModel ? DT_MODELS.find((m) => m.id === sel.props.modelId) : undefined;
  const rows = isModel
    ? Object.entries(sel.props)
        .filter(([k, v]) => !MODEL_INTERNAL_KEYS.has(k) && v != null)
        .map(([k, v]) => ({ label: k, value: String(v) }))
    : Object.entries(sel.props)
        .filter(([k]) => PROP_LABELS[k] && sel.props[k] != null)
        .map(([k, v]) => ({ label: PROP_LABELS[k]!, value: String(v) }));
  const links = [
    ...(model?.monitoring?.siteId
      ? [{ label: '수용가 모니터링 상세', href: () => `/monitoring/consumer/${model.monitoring!.siteId}` }]
      : []),
    ...(DRILL_IN[sel.layerId] ?? []),
  ];

  return (
    <div className="space-y-4">
      <SectionCard title={sel.name}>
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">{sel.assetId}</span>
          <span>· {isModel ? '3D 트윈 모델' : (layer?.name ?? sel.layerId)}</span>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {rows.length === 0 && <p className="py-2 text-sm text-slate-500">속성 정보 없음</p>}
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">{r.label}</span>
              <span className="text-sm font-semibold text-white">{r.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* monitoring 도메인 실데이터 (수용가 모니터링과 동일 훅·UX) */}
      {model?.monitoring && <ModelMonitoring meta={model.monitoring} />}

      {/* 선택 관통 안내 — 같은 자산, 줌으로 깊이만 바뀜 */}
      <SectionCard title={`${TIER_META[tier].name} 관점`}>
        <p className="text-xs leading-relaxed text-slate-400">
          선택을 유지한 채 줌을 바꾸면 이 자산을 다른 고도(시장 → 계약 → 단지 → 실시간)로 관통합니다.
        </p>
      </SectionCard>

      {links.length > 0 && (
        <SectionCard title="상세 열기">
          <div className="space-y-1.5">
            {links.map((lnk) => (
              <Link
                key={lnk.label}
                href={lnk.href(sel.assetId)}
                className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                {lnk.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function TierSummary() {
  const tier = useWorld((s) => s.tier);
  const lens = useWorld((s) => s.lens);
  const counts = useWorld((s) => s.counts);
  const n = (id: string) => counts[id] ?? 0;

  // 활성 렌즈의 레이어별 뷰포트 내 피처 수 (GIS bbox 응답 실측)
  const visible = LAYERS.filter((l) => lens.includes(l.lens) && l.tiers.includes(tier) && l.kind !== 'tile');

  return (
    <div className="space-y-4">
      <StatsGrid columns={2}>
        <StatCard
          icon={<Factory className="h-5 w-5" />}
          label="발전소 (뷰 내)"
          value={`${n('power-plants')} 개`}
          sub="전원별 분포"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="변전소 (뷰 내)"
          value={`${n('substations')} 개`}
          sub="계통 노드"
        />
        <StatCard
          icon={<Sun className="h-5 w-5" />}
          label="VPP 자원 (뷰 내)"
          value={`${n('vpp-plants')} 개`}
          sub="분산 태양광"
        />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="육지 SMP" value="114.96 ₩/kWh" sub="KPX 2026.6" />
      </StatsGrid>

      <SectionCard title="표시 중 레이어" count={visible.length} countUnit="개">
        <div className="divide-y divide-white/[0.05]">
          {visible.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <Layers className="h-3.5 w-3.5 text-primary" /> {l.name}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums">{counts[l.id] ?? '—'}</span>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="py-2 text-sm text-slate-500">활성 렌즈 없음 — 상단 렌즈칩을 켜세요.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="이 고도에서 보는 것">
        <p className="text-sm text-slate-400">
          <Activity className="mr-1.5 inline h-4 w-4 text-primary" />
          {TIER_META[tier].sees} · 자산을 클릭하면 상세와 작업장 진입이 열립니다.
        </p>
      </SectionCard>
    </div>
  );
}

export function InfoPanel() {
  const tier = useWorld((s) => s.tier);
  const selection = useWorld((s) => s.selection);
  const select = useWorld((s) => s.select);
  const meta = TIER_META[tier];

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-extrabold tracking-wide">{tier}</span>
        <span className="text-base font-semibold">{meta.name}</span>
        <span className="text-xs text-slate-400">· {meta.scope}</span>
        {selection && (
          <button
            onClick={() => select(null)}
            className="ml-auto flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/40 hover:bg-cyan-500/25"
          >
            ● {selection.name} <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {selection ? <AssetInfo sel={selection} /> : <TierSummary />}
      <p className="mt-5 text-[11px] text-slate-500">지오메트리 · dt-map-server(PostGIS) 실데이터 — bbox·MVT 서빙</p>
    </div>
  );
}
