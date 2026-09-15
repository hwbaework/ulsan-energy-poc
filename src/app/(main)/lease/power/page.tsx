// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Battery,
  _Activity,
  Building2,
  Plus,
  X,
  Download,
  Mail,
  FileText,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsLineChart, RmsAreaChart } from '@/components/ui/Chart';
import { cn, exportExcel, exportPdf } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';

/* 페이지 공통 breadcrumb (정상 / 빈 상태 둘 다 동일) */
const PAGE_BREADCRUMB = [{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '전력관리' }];

/* ───────────────────────── Types & Mock data ───────────────────────── */

interface LeaseEquipment {
  id: string;
  label: string;
  type: '태양광' | 'ESS' | '태양광+ESS';
  capacityKw: number;
}

interface Site {
  id: string;
  label: string;
  location: string;
  equipments: LeaseEquipment[];
}

const SITES: Site[] = [
  {
    id: 'hanil',
    label: '한일튜브 본사',
    location: '울산광역시 북구',
    equipments: [{ id: 'eq-h1', label: '본사 옥상 태양광', type: '태양광', capacityKw: 429.22 }],
  },
];
const TOTAL_EQUIP_COUNT = SITES.reduce((s, x) => s + x.equipments.length, 0);

type TimeUnit = 'hour' | 'day' | 'month' | 'quarter' | 'year';
type CompareMode = 'target' | 'mom' | 'yoy';

// 시간/일/월만 노출 (사용자 결정 — ppa/power 동일 패턴, 분기/연 제외)
const TIME_UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'hour', label: '시간' },
  { value: 'day', label: '일' },
  { value: 'month', label: '월' },
];

// 차트 헤더 sub 텍스트의 시간 단위 라벨
const UNIT_LABEL: Record<TimeUnit, string> = {
  hour: '시간대별',
  day: '일별',
  month: '월별',
  quarter: '분기별',
  year: '연도별',
};
// 한일튜브 2026 시작 → 전년(2025) 데이터 없음 → 'yoy' 옵션 비활성화 (disabled)
// 2027년 이후 데이터 누적되면 disabled 제거
const _COMPARE_OPTIONS: { value: CompareMode; label: string; disabled?: boolean }[] = [
  { value: 'target', label: '목표대비' },
  { value: 'mom', label: '전월대비' },
  { value: 'yoy', label: '전년대비', disabled: true },
];

/* ── 설비 발전량 — 시간 단위 토글 ─── */
function generateFlowData(unit: TimeUnit) {
  const counts = { hour: 24, day: 30, month: 12, quarter: 8, year: 5 } as const;
  const count = counts[unit];
  const scale = ({ hour: 1, day: 24, month: 720, quarter: 2160, year: 8760 } as const)[unit];

  const labelFor = (i: number) => {
    if (unit === 'hour') return `${String(i).padStart(2, '0')}:00`;
    if (unit === 'day') return `4/${i + 1}`;
    if (unit === 'month') return `${i + 1}월`;
    if (unit === 'quarter') return `'${24 + Math.floor(i / 4)}Q${(i % 4) + 1}`;
    return `${2022 + i}`;
  };

  return Array.from({ length: count }, (_, i) => {
    const isDaylight = unit === 'hour' ? i >= 6 && i <= 18 : true;
    const phaseHour = unit === 'hour' ? ((i - 6) / 12) * Math.PI : 0;
    const phaseSeason = unit !== 'hour' ? (i / count) * Math.PI * 2 : 0;

    const pvBase = unit === 'hour' ? (isDaylight ? Math.sin(phaseHour) * 320 : 0) : 200 + 100 * Math.sin(phaseSeason);
    const generation = Math.max(0, Math.round((pvBase + Math.random() * 30) * scale));
    const generationMom = Math.round(generation * (0.88 + Math.random() * 0.2));
    const generationYoy = Math.round(generation * (0.78 + Math.random() * 0.3));

    // 발전량 예측 정확도 — (예상 − 실제) / 예상 × 100. mock 으로 ±10 정도 흔들림.
    const expected = Math.round(generation * (0.95 + Math.random() * 0.1));
    const errorPct = expected > 0 ? Math.round(((expected - generation) / expected) * 1000) / 10 : 0;

    // 전력공급량 — 자원별. 한일튜브 lease = 태양광만 (연료전지/ORC = 0).
    const solar = generation;
    const fuelCell = 0;
    const orc = 0;

    return {
      time: labelFor(i),
      generation,
      generationMom,
      generationYoy,
      errorPct,
      target: 0,
      solar,
      fuelCell,
      orc,
    };
  });
}

/* ───────────────────────── Sub-components ───────────────────────── */

function SegmentedToggle<V extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: V; label: string; disabled?: boolean }[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          title={opt.disabled ? '2025년 데이터 없음 — 2027년부터 활성화' : undefined}
          className={cn(
            'rounded transition-colors',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            opt.disabled
              ? 'text-slate-600 cursor-not-allowed line-through decoration-slate-700'
              : opt.value === value
                ? 'bg-primary text-white font-medium'
                : 'text-slate-400 hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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

export default function LeasePowerPage() {
  // API 호출 (데이터 없으면 mock fallback)
  const { data: _apiPlants } = useMonitoringPlants();

  const [siteId, setSiteId] = useState<'all' | string>('all');
  const [equipId, setEquipId] = useState<'all' | string>('all');
  const selectedSite = useMemo(
    () => (siteId === 'all' ? null : (SITES.find((s) => s.id === siteId) ?? null)),
    [siteId],
  );
  const availableEquips = selectedSite?.equipments ?? [];
  const selectedEquip = useMemo(
    () => (equipId === 'all' ? null : (availableEquips.find((e) => e.id === equipId) ?? null)),
    [equipId, availableEquips],
  );

  const [_timeUnit, _setTimeUnit] = useState<TimeUnit>('hour');
  const [_compareMode, _setCompareMode] = useState<CompareMode>('target');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSchedule, setEmailSchedule] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const handleSiteChange = (id: 'all' | string) => {
    setSiteId(id);
    setEquipId('all');
  };

  /* ─── ppa/power 동일 패턴 — 차트별 독립 시간 단위 + 날짜 picker ─── */
  type ChartCtl = { tu: TimeUnit; date: string; month: string; year: number };
  const [chart1, setChart1] = useState<ChartCtl>({ tu: 'hour', date: '2026-05-30', month: '2026-05', year: 2026 });
  const [chart2, setChart2] = useState<ChartCtl>({ tu: 'hour', date: '2026-05-30', month: '2026-05', year: 2026 });
  const [chart3, setChart3] = useState<ChartCtl>({ tu: 'hour', date: '2026-05-30', month: '2026-05', year: 2026 });
  const flowData1 = useMemo(() => generateFlowData(chart1.tu), [chart1.tu]);
  const flowData2 = useMemo(() => generateFlowData(chart2.tu), [chart2.tu]);
  const flowData3 = useMemo(() => generateFlowData(chart3.tu), [chart3.tu]);

  // 전력공급량 차트 자원 메타 — 한일튜브 lease = 태양광만 (연료전지/ORC 0%, ppa/power 와 동일 구조)
  const ALL_SUPPLY_RESOURCES = [
    { key: 'solar', name: '태양광', percent: 100, color: '#F59E0B' },
    { key: 'fuelCell', name: '연료전지', percent: 0, color: '#A78BFA' },
    { key: 'orc', name: 'ORC', percent: 0, color: '#06B6D4' },
  ];
  const [hiddenSupplyResources, setHiddenSupplyResources] = useState<Set<string>>(new Set());
  const toggleSupplyResource = (key: string) => {
    setHiddenSupplyResources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // percent 내림차순 정렬 — Legend 첫 번째 = 태양광
  const supplyAreas = useMemo(
    () => ALL_SUPPLY_RESOURCES.filter((a) => !hiddenSupplyResources.has(a.key)).sort((a, b) => b.percent - a.percent),
    [hiddenSupplyResources],
  );

  // 발전량 예측 정확도 — 오차율 + 목표 0%
  const errorLines = useMemo(
    () => [
      { key: 'errorPct', name: '오차율 (%)', color: '#F43F5E' },
      { key: 'target', name: '목표 0%', color: '#10B981' },
    ],
    [],
  );

  // 설비 메타 — 한일튜브 본사 옥상 태양광 (N개 확장 가능)
  const ALL_PLANTS = [{ key: 'generation', name: '한일튜브 본사 옥상 태양광', color: '#F59E0B' }];

  // 설비 pill 토글
  const [hiddenPlants, setHiddenPlants] = useState<Set<string>>(new Set());
  const togglePlant = (key: string) => {
    setHiddenPlants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 설비 발전량 라인 — plants 만 (전년 동기는 한일튜브 2026 시작 → 2025 데이터 없어 disabled)
  const plantLines = useMemo(() => {
    const lines: { key: string; name: string; color: string }[] = [];
    ALL_PLANTS.forEach((p) => {
      if (!hiddenPlants.has(p.key)) lines.push({ key: p.key, name: p.name, color: p.color });
    });
    return lines;
  }, [hiddenPlants]);

  // pill bar — plants + 전년 동기 (disabled)
  const plantPillItems = useMemo(
    () => [
      ...ALL_PLANTS.map((p) => ({ ...p, inactive: false })),
      { key: 'generationYoy', name: '전년 동기', color: '#94A3B8', inactive: true },
    ],
    [],
  );

  // (구버전 호환 — Control Bar 제거됐지만 컴파일러 위해 유지)
  const _flowData = flowData1;
  const _generationLines = plantLines;

  const scopeDescription = selectedEquip
    ? `${selectedSite!.label} > ${selectedEquip.label}`
    : selectedSite
      ? `${selectedSite.label} (${selectedSite.location})`
      : `전사 합산 · ${TOTAL_EQUIP_COUNT}개 설비`;

  if (SITES.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={PAGE_BREADCRUMB} />
        <h1 className="text-2xl font-bold text-white">전력관리</h1>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-slate-400">전력관리 데이터가 아직 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">Lease 설비가 등록되면 여기에 발전량 및 소비 현황이 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={PAGE_BREADCRUMB} />
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">전력관리</h1>
          <p className="mt-1 text-sm text-slate-400">{scopeDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSite?.label ?? '전사 합산'} />}>
            <DropdownItem onClick={() => handleSiteChange('all')}>
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                <div>
                  <p className="text-sm">전사 합산</p>
                  <p className="text-xs text-slate-500">
                    {SITES.length}개 사업장 · {TOTAL_EQUIP_COUNT}개 설비
                  </p>
                </div>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => (
              <DropdownItem key={s.id} onClick={() => handleSiteChange(s.id)}>
                <div className="flex items-center gap-2">
                  <Building2 size={14} />
                  <div>
                    <p className="text-sm">{s.label}</p>
                    <p className="text-xs text-slate-500">
                      {s.location} · {s.equipments.length}개 설비
                    </p>
                  </div>
                </div>
              </DropdownItem>
            ))}
          </Dropdown>

          {selectedSite ? (
            <Dropdown
              align="left"
              trigger={<ScopeTrigger label="설비" value={selectedEquip?.label ?? '사업장 내 전체'} />}
            >
              <DropdownItem onClick={() => setEquipId('all')}>
                <div className="flex items-center gap-2">
                  <Sun size={14} />
                  <div>
                    <p className="text-sm">사업장 내 전체</p>
                    <p className="text-xs text-slate-500">{availableEquips.length}개 설비 합산</p>
                  </div>
                </div>
              </DropdownItem>
              <div className="my-1 border-t border-white/[0.06]" />
              {availableEquips.map((e) => (
                <DropdownItem key={e.id} onClick={() => setEquipId(e.id)}>
                  <div className="flex items-center gap-2">
                    {e.type === 'ESS' ? <Battery size={14} /> : <Sun size={14} />}
                    <div>
                      <p className="text-sm">{e.label}</p>
                      <p className="text-xs text-slate-500">
                        {e.type} · {e.capacityKw} kW
                      </p>
                    </div>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
          ) : (
            <ScopeTrigger label="설비" value="—" disabled />
          )}
        </div>
      </div>

      {/* Control Bar 제거 — 차트가 자체 시간 단위·날짜 picker 가짐 (ppa/power 동일 패턴) */}

      {/* 설비 발전량 — ppa/power 패턴: 직접 div 박스 + 헤더(제목·sub + 시간 토글) + pill bar + < 날짜 > picker + 차트 */}
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-md font-semibold text-white">설비 발전량</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {`${UNIT_LABEL[chart1.tu]} 발전소 출력 추세 · 전년 동기 비교`}
            </p>
          </div>
          <SegmentedToggle
            options={TIME_UNIT_OPTIONS}
            value={chart1.tu}
            onChange={(v) => setChart1((s) => ({ ...s, tu: v }))}
            size="sm"
          />
        </div>
        <div className="px-5 py-4">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div className="flex flex-wrap gap-1.5">
              {plantPillItems.map((p) => {
                const hidden = hiddenPlants.has(p.key);
                const inactive = (p as { inactive?: boolean }).inactive;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => !inactive && togglePlant(p.key)}
                    disabled={inactive}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                      inactive
                        ? 'bg-transparent text-slate-600 ring-white/[0.04] cursor-not-allowed'
                        : hidden
                          ? 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400'
                          : 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]',
                    )}
                    aria-pressed={!hidden}
                    title={
                      inactive
                        ? '2025년 데이터 없음 — 2027년부터 활성화'
                        : hidden
                          ? '클릭해서 다시 표시'
                          : '클릭해서 숨김'
                    }
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                      style={{ backgroundColor: p.color, opacity: inactive ? 0.3 : hidden ? 0.3 : 1 }}
                    />
                    {p.name}
                    {!inactive &&
                      (hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />)}
                  </button>
                );
              })}
            </div>
            {/* < 날짜 > picker */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (chart1.tu === 'hour') {
                    const d = new Date(chart1.date);
                    d.setDate(d.getDate() - 1);
                    setChart1((s) => ({
                      ...s,
                      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                    }));
                  } else if (chart1.tu === 'day') {
                    const [y, m] = chart1.month.split('-').map(Number);
                    const d = new Date(y, m - 2, 1);
                    setChart1((s) => ({
                      ...s,
                      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    }));
                  } else {
                    setChart1((s) => ({ ...s, year: s.year - 1 }));
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                aria-label="이전"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-sm font-semibold text-white tabular-nums px-2 min-w-[100px] text-center">
                {chart1.tu === 'hour' && chart1.date}
                {chart1.tu === 'day' && chart1.month}
                {chart1.tu === 'month' && `${chart1.year}년`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (chart1.tu === 'hour') {
                    const d = new Date(chart1.date);
                    d.setDate(d.getDate() + 1);
                    setChart1((s) => ({
                      ...s,
                      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                    }));
                  } else if (chart1.tu === 'day') {
                    const [y, m] = chart1.month.split('-').map(Number);
                    const d = new Date(y, m, 1);
                    setChart1((s) => ({
                      ...s,
                      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    }));
                  } else {
                    setChart1((s) => ({ ...s, year: s.year + 1 }));
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                aria-label="다음"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          <RmsLineChart data={flowData1} xKey="time" lines={plantLines} height={300} />
        </div>
      </div>

      {/* 2: 전력공급량 — ppa/power 동일 패턴 (자원 pill + < 날짜 > picker) */}
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-md font-semibold text-white">전력공급량</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {`${UNIT_LABEL[chart2.tu]} 자원별 공급 누적 (태양광/연료전지/ORC)`}
            </p>
          </div>
          <SegmentedToggle
            options={TIME_UNIT_OPTIONS}
            value={chart2.tu}
            onChange={(v) => setChart2((s) => ({ ...s, tu: v }))}
            size="sm"
          />
        </div>
        <div className="px-5 py-4">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div className="flex flex-wrap gap-1.5">
              {ALL_SUPPLY_RESOURCES.map((r) => {
                const hidden = hiddenSupplyResources.has(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleSupplyResource(r.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                      hidden
                        ? 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400'
                        : 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]',
                    )}
                    aria-pressed={!hidden}
                    title={hidden ? '클릭해서 다시 표시' : '클릭해서 숨김'}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                      style={{ backgroundColor: r.color, opacity: hidden ? 0.3 : 1 }}
                    />
                    {r.name}
                    <span className="tabular-nums opacity-70">{r.percent}%</span>
                    {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (chart2.tu === 'hour') {
                    const d = new Date(chart2.date);
                    d.setDate(d.getDate() - 1);
                    setChart2((s) => ({
                      ...s,
                      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                    }));
                  } else if (chart2.tu === 'day') {
                    const [y, m] = chart2.month.split('-').map(Number);
                    const d = new Date(y, m - 2, 1);
                    setChart2((s) => ({
                      ...s,
                      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    }));
                  } else {
                    setChart2((s) => ({ ...s, year: s.year - 1 }));
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                aria-label="이전"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-sm font-semibold text-white tabular-nums px-2 min-w-[100px] text-center">
                {chart2.tu === 'hour' && chart2.date}
                {chart2.tu === 'day' && chart2.month}
                {chart2.tu === 'month' && `${chart2.year}년`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (chart2.tu === 'hour') {
                    const d = new Date(chart2.date);
                    d.setDate(d.getDate() + 1);
                    setChart2((s) => ({
                      ...s,
                      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                    }));
                  } else if (chart2.tu === 'day') {
                    const [y, m] = chart2.month.split('-').map(Number);
                    const d = new Date(y, m, 1);
                    setChart2((s) => ({
                      ...s,
                      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    }));
                  } else {
                    setChart2((s) => ({ ...s, year: s.year + 1 }));
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                aria-label="다음"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          <RmsAreaChart data={flowData2} xKey="time" areas={supplyAreas} height={300} />
        </div>
      </div>

      {/* 3: 발전량 예측 정확도 — 전년 비교 없이 오차율 + 목표 0% */}
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-md font-semibold text-white">발전량 예측 정확도</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {`예상 발전량 대비 실제 차이 — (예상 − 실제) / 예상 × 100, 목표선 0%`}
            </p>
          </div>
          <SegmentedToggle
            options={TIME_UNIT_OPTIONS}
            value={chart3.tu}
            onChange={(v) => setChart3((s) => ({ ...s, tu: v }))}
            size="sm"
          />
        </div>
        <div className="px-5 py-4">
          <div className="flex items-end justify-end mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (chart3.tu === 'hour') {
                    const d = new Date(chart3.date);
                    d.setDate(d.getDate() - 1);
                    setChart3((s) => ({
                      ...s,
                      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                    }));
                  } else if (chart3.tu === 'day') {
                    const [y, m] = chart3.month.split('-').map(Number);
                    const d = new Date(y, m - 2, 1);
                    setChart3((s) => ({
                      ...s,
                      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    }));
                  } else {
                    setChart3((s) => ({ ...s, year: s.year - 1 }));
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                aria-label="이전"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-sm font-semibold text-white tabular-nums px-2 min-w-[100px] text-center">
                {chart3.tu === 'hour' && chart3.date}
                {chart3.tu === 'day' && chart3.month}
                {chart3.tu === 'month' && `${chart3.year}년`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (chart3.tu === 'hour') {
                    const d = new Date(chart3.date);
                    d.setDate(d.getDate() + 1);
                    setChart3((s) => ({
                      ...s,
                      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                    }));
                  } else if (chart3.tu === 'day') {
                    const [y, m] = chart3.month.split('-').map(Number);
                    const d = new Date(y, m, 1);
                    setChart3((s) => ({
                      ...s,
                      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    }));
                  } else {
                    setChart3((s) => ({ ...s, year: s.year + 1 }));
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
                aria-label="다음"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          <RmsLineChart data={flowData3} xKey="time" lines={errorLines} height={260} />
        </div>
      </div>

      {/* 출력 / 자동 발송 — ppa/power 동일 패턴 */}
      <SectionCard title="출력 / 자동 발송" description="기간별 자동 생성, 보고서는 문서 보관함 자동 저장">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exportExcel(
                `리스-발전량-${new Date().toISOString().slice(0, 10)}`,
                '발전량',
                ['시간', '발전량(kWh)', '일사량', '온도(℃)'],
                flowData1.map((d: any) => [d.time, d.gen ?? 0, d.irr ?? 0, d.temp ?? 0]),
              )
            }
          >
            <Download size={14} className="mr-1.5" />
            엑셀 다운로드
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exportPdf(
                `리스-발전량-${new Date().toISOString().slice(0, 10)}`,
                '리스 발전량 보고서',
                ['시간', '발전량(kWh)', '일사량', '온도(℃)'],
                flowData1.map((d: any) => [d.time, d.gen ?? 0, d.irr ?? 0, d.temp ?? 0]),
              )
            }
          >
            <FileText size={14} className="mr-1.5" />
            PDF 다운로드
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEmailModalOpen(true)}>
            <Mail size={14} className="mr-1.5" />
            정기 이메일 발송
          </Button>
        </div>
      </SectionCard>

      <Modal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="정기 이메일 발송 설정" size="md">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">수신 이메일</label>
            <input
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="email@example.com"
              className="w-full h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">발송 주기</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setEmailSchedule(s)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    emailSchedule === s
                      ? 'border-primary/40 bg-primary/[0.10] text-primary font-semibold'
                      : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white',
                  )}
                >
                  {s === 'daily' ? '매일' : s === 'weekly' ? '매주' : '매월'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setEmailModalOpen(false)}>
              취소
            </Button>
            <Button
              disabled={!emailRecipient.trim()}
              onClick={() => {
                useToastStore
                  .getState()
                  .add(
                    'success',
                    `${emailRecipient}으로 ${emailSchedule === 'daily' ? '매일' : emailSchedule === 'weekly' ? '매주' : '매월'} 발송 설정 완료`,
                  );
                setEmailModalOpen(false);
              }}
            >
              설정 저장
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
