// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  _Calendar,
  Calculator,
  ClipboardCheck,
  ShieldCheck,
  Receipt,
  CreditCard,
  CheckCircle2,
  _AlertTriangle,
  AlertCircle,
  Clock,
  _Lock,
  _Unlock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  _Wallet,
  Database,
  Shield,
  _Award,
  _Leaf,
  _Zap,
  FileText,
  FileSpreadsheet,
  Download,
  ChevronRight,
  ChevronLeft,
  Eye,
  Filter,
  _Search,
  ChevronDown,
  _History,
  _Cpu,
  Settings,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn, exportPdf, exportExcel } from '@/lib/utils';
import { useToastStore as _useToastStore } from '@/stores/useToastStore';
import { downloadPdf } from '@/lib/downloadPdf';
import { ENDPOINTS } from '@/api/endpoints';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { calculateSettlement } from '@/lib/settlement/calculator';
import type { PpaKind } from '@/lib/settlement/calculator';
import { DEFAULT_FEES, DEFAULT_SPC_FEES } from '@/lib/settlement/defaults';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';
// demoTradingSession 제거 — 인라인 stub (실 API 연결 전까지 빈 상태)
type PendingRequest = Record<string, any>;
type FeeAdjustment = Record<string, any>;
type _AdjustmentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type _ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
const useDemoRequests = () => ({
  requests: [] as PendingRequest[],
  addRequest: (_r: PendingRequest) => {},
  advanceRequestById: (_id: string) => {},
  removeRequest: (_id: string) => {},
  updateRequest: (_id: string, _patch: Partial<PendingRequest>) => {},
});
// 요금 조정 — 동작하는 로컬 state mock (TODO(API): 정산 조정 API 로 교체)
// 초기 status 'editing' = SPC 가 바로 입력 가능. 저장 → saved, 검토 완료 → reviewed(잠금)
const useDemoAdjustments = () => {
  const [adjustments, setAdjustments] = useState<Record<string, FeeAdjustment>>({});
  const getAdjustment = (id: string): FeeAdjustment =>
    adjustments[id] ?? ({ amount: 0, vat: 0, reason: '', status: 'editing' } as any);
  const updateAdjustment = (id: string, patch: Partial<FeeAdjustment>) =>
    setAdjustments((prev) => ({ ...prev, [id]: { ...getAdjustment(id), ...patch } }));
  return { adjustments, getAdjustment, addAdjustment: (_a: FeeAdjustment) => {}, updateAdjustment };
};
const DEMO_SAVED_FEES = { tradeFeeKpx: 0.1034, surchargeRate: 5, fundRate: 3.7 };
const DEMO_NOOP_UPDATE = (_id: string, _patch: Record<string, any>) => {};
const DEMO_NOOP_SAVE = (_f: { tradeFeeKpx: number; surchargeRate: number; fundRate: number }) => {};
const useDemoCommonFees = () => ({
  fees: [] as Array<Record<string, any>>,
  update: DEMO_NOOP_UPDATE,
  savedFees: DEMO_SAVED_FEES,
  saveFees: DEMO_NOOP_SAVE,
});
// 검토 상태 — 동작하는 로컬 state mock (TODO(API): 정산 승인 API 로 교체)
const useDemoApprovals = () => {
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  return {
    approvals,
    approve: (_id: string) => {},
    reject: (_id: string) => {},
    getApproval: (id: string) => approvals[id] ?? '',
    setApproval: (id: string, status: string) => setApprovals((prev) => ({ ...prev, [id]: status })),
  };
};

/* ─────────────────────────────────────────────
   Tabs
   ───────────────────────────────────────────── */
export type Tab = 'settlement' | 'payment' | 'history';

/* ─────────────────────────────────────────────
   정산 사이클 단계
   ───────────────────────────────────────────── */
const CYCLE_STAGES = [
  {
    key: 'collect',
    label: 'KPX·한전 계량 수집',
    desc: '매월 1~5일 (자동)',
    icon: Database,
    auto: true,
    done: true,
    date: '2026-05-01~05',
  },
  {
    key: 'compute',
    label: '산식 실행',
    desc: '매월 6~7일 (자동)',
    icon: Calculator,
    auto: true,
    done: true,
    date: '2026-05-06',
  },
  {
    key: 'review',
    label: '운영자 검토',
    desc: '매월 8~10일',
    icon: ClipboardCheck,
    auto: false,
    done: false,
    date: '2026-05-08~10',
    current: true,
  },
  {
    key: 'approve',
    label: '책임자 승인',
    desc: '매월 11~12일 (이중 검증)',
    icon: ShieldCheck,
    auto: false,
    done: false,
    date: '2026-05-11~12',
  },
  {
    key: 'invoice',
    label: '세금계산서 발행',
    desc: '승인 직후 (자동·매입 + 매출)',
    icon: Receipt,
    auto: true,
    done: false,
    date: '2026-05-13',
  },
  {
    key: 'payment',
    label: '결제 마감',
    desc: '발행 후 7일',
    icon: CreditCard,
    auto: true,
    done: false,
    date: '2026-05-20',
  },
];

/* ─────────────────────────────────────────────
   자동 검증 데이터
   ───────────────────────────────────────────── */
const _VALIDATION = {
  spcVsKpx: { spc: 614_400_000, kpx: 612_840_000, diffPct: 0.25, passed: true },
  inOut: { spcIn: 614_400_000, spcOut: 412_800_000, balance: 201_600_000, passed: true },
  threshold: 1.0, // ±1% 이상 차이 시 알림
};

const _VALIDATION_FLAGS: {
  id: string;
  plant: string;
  issue: string;
  amount: number;
  severity: string;
  requiresReview: boolean;
}[] = [];

/* ─────────────────────────────────────────────
   결제 실행 데이터
   ───────────────────────────────────────────── */
type PayState = 'pending' | 'paid' | 'overdue';
const _PAY_STATE_META: Record<PayState, { label: string; tone: string; bg: string; ring: string }> = {
  pending: { label: '대기', tone: 'text-amber-300', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  paid: { label: '완료', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.10]', ring: 'ring-emerald-500/30' },
  overdue: { label: '연체', tone: 'text-rose-300', bg: 'bg-rose-500/[0.10]', ring: 'ring-rose-500/30' },
};

type PayRow = {
  id: string;
  direction: 'in' | 'out';
  party: string;
  amount: number;
  due: string;
  paid: string | null;
  state: PayState;
  method: '가상계좌' | 'CMS' | '계좌이체';
  daysLeft: number;
};

const PAY_ROWS: PayRow[] = [];

// 현금흐름 — 실 계약 규모 기준 (단위: 백만원)
const _CASHFLOW = [
  { month: '1월', 입금: 0, 지급: 0 },
  { month: '2월', 입금: 8.2, 지급: 6.1 },
  { month: '3월', 입금: 13.4, 지급: 10.2 },
  { month: '4월', 입금: 16.5, 지급: 12.6 },
  { month: '5월', 입금: 29.1, 지급: 22.1 },
  { month: '6월', 입금: 29.1, 지급: 22.1 },
  { month: '7월', 입금: 26.8, 지급: 20.4 },
  { month: '8월', 입금: 25.9, 지급: 19.7 },
  { month: '9월', 입금: 23.5, 지급: 17.9 },
  { month: '10월', 입금: 21.5, 지급: 16.4 },
  { month: '11월', 입금: 16.8, 지급: 12.8 },
  { month: '12월', 입금: 14.6, 지급: 11.1 },
];

/* ─────────────────────────────────────────────
   REC 데이터 — 실측 기준
   ───────────────────────────────────────────── */
const _REC_POOL = {
  monthIssued: 24, // 5월 직접 PPA 발전량 ~24 MWh → 24 REC
  monthTransferred: 22, // 직접 PPA REC 이전
  poolBalance: 102, // 2~5월 누적 잔고
  blocked: 0,
};

const _REC_TRIGGERS: { id: string; plantName: string; amount: number; date: string; state: string; method: string }[] =
  [
    { id: 'rt-2', plantName: '울산 용인금속1+2', amount: 16, date: '2026-06-02', state: '발급완료', method: '자동' },
    { id: 'rt-3', plantName: '울산 한길', amount: 6, date: '2026-06-02', state: '발급완료', method: '자동' },
    { id: 'rt-4', plantName: '울산 건호이엔씨', amount: 2, date: '2026-06-02', state: '발급완료', method: '자동' },
  ];

const _REC_TRANSFERS: {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  cycle: string;
  note?: string;
}[] = [
  { id: 'rx-2', from: '용인금속', to: '알엠에스플랫폼', amount: 16, date: '2026-06-03', cycle: '2026-05' },
  { id: 'rx-3', from: '한길', to: '(주)카프로', amount: 6, date: '2026-06-03', cycle: '2026-05' },
];

/* ─────────────────────────────────────────────
   정산 이력
   ───────────────────────────────────────────── */
type HistoryRow = {
  id: string;
  cycle: string; // '2026-04'
  finalAmount: number;
  state: 'tentative' | 'confirmed' | 'recalculated';
  invoices: { sale: number; purchase: number; matched: boolean };
  payments: { complete: number; total: number };
  rec: number;
};

const HISTORY: HistoryRow[] = [];

/* 감사 로그 */
const AUDIT_LOGS: { id: string; datetime: string; actor: string; action: string; target: string; type: string }[] = [];

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
function fmtKrw(n: number) {
  if (Math.abs(n) >= 100_000_000) return `₩ ${(n / 100_000_000).toFixed(2)}억`;
  if (Math.abs(n) >= 10_000) return `₩ ${(n / 10_000).toFixed(0)}만`;
  return `₩ ${n.toLocaleString()}`;
}

const HISTORY_STATE = {
  tentative: { label: '잠정', tone: 'text-amber-300', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  confirmed: { label: '확정', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.10]', ring: 'ring-emerald-500/30' },
  recalculated: { label: '재정산', tone: 'text-violet-300', bg: 'bg-violet-500/[0.10]', ring: 'ring-violet-500/30' },
};

/* ─────────────────────────────────────────────
   정산 record 데이터 (발전사 페이지와 동일 구조)
   ───────────────────────────────────────────── */
type MatchType = '1:1' | '1:N' | 'N:1';
type SettlementPlant = {
  id: string;
  name: string;
  counterparty: string; // 발전사업자
  consumers: string[]; // 수용가 (N:1·1:N 표현)
  matchType: MatchType;
  monthlyKwh: number;
  ppaPriceKwh: number;
  contractStart: string;
  contractEnd: string;
};
// 직접 PPA 하위 유형(Onsite/Offsite) + Lease — 유형 컬럼 표시용 메타 (trading/contracts 색 체계)
const PLANT_KIND_META: Record<string, { label: string; cls: string }> = {
  offsite: { label: 'Offsite PPA', cls: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30' },
  onsite: { label: 'Onsite PPA', cls: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30' },
  lease: { label: '직접 PPA', cls: 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30' },
};

// 정산 3건 — Offsite/Onsite/Lease 각 1건 (trading/contracts showcase 정합)
// contractStart 5/1 — 5월 정산 1행씩 생성
const SETTLEMENT_PLANTS: SettlementPlant[] = [];

// 이의 제기 — 발전사/수용가가 동의 대기 단계에서 거절(이의)하면 SPC settlement 에 사유 노출
// key = record id (`${plant.id}-${period.key}`)
// 데모: Lease 한일튜브 5월 정산에 대한 수용가 이의 제기 1건 (mock)
type ObjectionFrom = 'generator' | 'consumer';
type Objection = {
  from: ObjectionFrom;
  partyName: string; // 이의 제기 주체 (발전사명·수용가명)
  reason: string; // 이의 사유
  createdAt: string; // 'YYYY-MM-DD HH:mm'
  status: 'open' | 'resolved';
};
const OBJECTIONS_SEED: Record<string, Objection> = {};

// DEMO-MOCK: 세션에 저장된 PendingRequest(체결된 PPA)를 SettlementPlant 배열로 변환
// 매칭된 후보 1개당 1개의 settlement 행 생성
//   - 매칭 1건 → 1행 (1:1)
//   - 매칭 N건 → N행 (N:1, 동일 수용가에 다발 공급)
function pendingPpaToSettlementPlants(r: PendingRequest): SettlementPlant[] {
  if (r.dealType !== 'ppa') return [];
  if (r.step < r.totalSteps) return [];
  if (!r.contract) return [];
  if (!r.matchedCandidates || r.matchedCandidates.length === 0) return [];

  // 계약 종료일 = signedAt + durationYears
  const [sy, sm, sd] = r.contract.signedAt.split('-').map(Number);
  const endYear = sy + (r.durationYears || 5);
  const contractEnd = `${endYear}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;

  const totalCands = r.matchedCandidates.length;
  const matchType: MatchType = totalCands === 1 ? '1:1' : 'N:1';

  // 자원별 capacity factor
  const cfByResource: Record<string, number> = {
    태양광: 0.16,
    풍력: 0.28,
    ESS: 0.22,
    바이오: 0.55,
  };

  return r.matchedCandidates.map((cand) => {
    const capacityKw = cand.capacityKw || parseInt(String(r.capacity).replace(/[^0-9]/g, ''), 10) || 100;
    const cf = cfByResource[cand.resource] ?? 0.18;
    const monthlyKwh = Math.round(capacityKw * 720 * cf);

    return {
      id: `ses-${r.id}-${cand.id}`,
      name: cand.plantName,
      counterparty: cand.generator,
      consumers: [r.site],
      matchType,
      monthlyKwh,
      // 단가는 매칭된 발전소의 제안 단가가 우선 (수용가 희망 단가는 제안일 뿐)
      ppaPriceKwh: cand.proposedPriceKrw ?? r.unitPrice ?? 140,
      contractStart: r.contract.effectiveFrom,
      contractEnd,
    };
  });
}
// 매칭 cardinality — Offsite PPA 변형 (PPT 분석서 slide 2 기준)
//   1:1 — 발전소 1곳 → 수용가 1곳
//   1:N — 발전소 1곳 → 수용가 N곳 (비례 공급)
//   N:1 — 동일 발전사업자의 발전소 N곳 → 수용가 1곳 (비례 공급)
const MATCH_TYPE_META: Record<MatchType, { tone: string; bg: string; ring: string; desc: string }> = {
  '1:1': { tone: 'text-blue-300', bg: 'bg-blue-500/[0.10]', ring: 'ring-blue-500/30', desc: '발전소 1 → 수용가 1' },
  '1:N': {
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ring: 'ring-violet-500/30',
    desc: '발전소 1 → 수용가 N',
  },
  'N:1': {
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
    desc: '발전소 N → 수용가 1',
  },
};
const SETTLEMENT_PERIODS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'].map((key) => {
  const [y, m] = key.split('-').map(Number);
  return { key, year: y, month: m, status: key === '2026-05' ? 'current' : ('past' as 'current' | 'past') };
});
const SEASONAL_FACTOR: Record<number, number> = {
  1: 0.55,
  2: 0.65,
  3: 0.85,
  4: 1.0,
  5: 1.05,
  6: 1.1,
  7: 1.05,
  8: 1.0,
  9: 0.95,
  10: 0.85,
  11: 0.7,
  12: 0.55,
};

function buildSettlementRecord(
  plant: SettlementPlant,
  period: (typeof SETTLEMENT_PERIODS)[number],
  feesOverride?: { tradeFeeKpx: number; surchargeRate: number; fundRate: number },
) {
  const partial = period.status === 'current' ? 4 / 30 : 1;
  const f = SEASONAL_FACTOR[period.month] * partial;
  const generation = Math.round(plant.monthlyKwh * f);
  const ppaRevenue = generation * plant.ppaPriceKwh;

  const kind: PpaKind = (plant as any).kind ?? 'offsite';
  const fees = {
    ...DEFAULT_FEES,
    ...(feesOverride
      ? {
          tradeFeePerKwh: feesOverride.tradeFeeKpx,
          surchargeRate: feesOverride.surchargeRate,
          fundRate: feesOverride.fundRate,
        }
      : {}),
  };

  const result = calculateSettlement({
    kind,
    generationKwh: generation,
    unitPrice: plant.ppaPriceKwh,
    fees,
    spcFees: DEFAULT_SPC_FEES,
  });

  const netRevenue = result.generatorReceivable;
  const status: 'paid' | 'issued' | 'pending' =
    period.status === 'current' ? 'pending' : period.year === 2026 && period.month === 4 ? 'issued' : 'paid';
  return {
    generation,
    ppaRevenue,
    tradeFee: result.tradeFee,
    supplyFee: result.supplyFee,
    manageFee: result.manageFee,
    adjust: result.surcharge,
    network: result.networkFee,
    transmissionLoss: result.transmissionLoss,
    welfareCost: result.welfareCost,
    fund: result.fund,
    vat: result.vat,
    netRevenue,
    status,
  };
}

// AdjustmentStatus·FeeAdjustment 타입은 demoTradingSession에서 import

/* SPC 정산 일정 — M월 (청구월) Day 1~21 */
type ScheduleCell = { col: number; span?: number; text: string; tone?: 'system' | 'kpx' | 'kepco' | 'spc' };
const _SCHEDULE_ROWS: { actor: string; cells: ScheduleCell[] }[] = [
  { actor: '시스템', cells: [{ col: 12, text: '청구서 생성·세금계산서 원시 데이터 생성', tone: 'system' }] },
  {
    actor: '전력거래소',
    cells: [
      { col: 10, text: '공급량 확정 (M-1월)', tone: 'kpx' },
      { col: 20, text: '부가정산금·거래수수료 확정 (M-1월)', tone: 'kpx' },
    ],
  },
  {
    actor: '한전',
    cells: [
      { col: 5, text: '전력산업기반기금 확정 (M-2월)', tone: 'kepco' },
      { col: 18, text: '망이용요금 확정 (M-1월)', tone: 'kepco' },
    ],
  },
  {
    actor: 'SPC',
    cells: [
      {
        col: 6,
        text: '전력산업기반기금 확인/등록 · 전월 부가정산금/KPX거래수수료 차액 확인 (차액 발생 시 요금조정사항 등록)',
        tone: 'spc',
      },
      { col: 11, text: '공급량 확인/등록 · 요금조정 사항 반영 · 미수금 확인/반영', tone: 'spc' },
      { col: 13, text: '청구서 내용 검증', tone: 'spc' },
      { col: 14, text: '청구서 발송 & 세금계산서 발행', tone: 'spc' },
    ],
  },
];

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   부호 입력 가능한 숫자 인풋
   `-` 만 입력한 중간 상태를 허용 → 마이너스 값 자유 입력
   ───────────────────────────────────────────── */
function SignedNumberInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [local, setLocal] = useState<string>(String(value));
  // 외부 값 변경 시 로컬 동기화 (단, 사용자가 `-` 입력 중이면 덮어쓰지 않음)
  useEffect(() => {
    if (local !== '-' && Number(local) !== value) {
      setLocal(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={local}
      disabled={disabled}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        // 허용: 빈 문자열, `-`, 숫자, `-숫자` 만
        if (!/^-?\d*$/.test(v)) return;
        setLocal(v);
        if (v === '' || v === '-') {
          onChange(0);
        } else {
          const n = Number(v);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      onBlur={() => {
        // 포커스 아웃 시 `-`만 남아 있으면 0으로 정리
        if (local === '-' || local === '') setLocal('0');
      }}
    />
  );
}

export function PlatformPpaSettlementContent({ defaultTab = 'settlement' }: { defaultTab?: Tab }) {
  const _router = useRouter();
  const [tab, _setTab] = useState<Tab>(defaultTab);
  const [direction, _setDirection] = useState<'all' | 'in' | 'out'>('all');
  // 수금·지급 문서 보기 (세금계산서 형태) — 행의 문서 버튼으로 오픈
  const [payDoc, setPayDoc] = useState<PayRow | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  // DEMO-MOCK: 체결된 Offsite PPA(세션 저장)를 정산 발전소로 흡수
  // 매칭된 후보 수만큼 행 생성 (1:1 → 1행 / N:1 → N행)
  // 같은 이름의 발전소가 세션에 있으면 정적 발전소를 숨김 (중복 제거)
  const { requests: sessionRequests } = useDemoRequests();
  const sessionPlants = useMemo<SettlementPlant[]>(() => {
    return sessionRequests.flatMap(pendingPpaToSettlementPlants);
  }, [sessionRequests]);
  const ALL_PLANTS = useMemo<SettlementPlant[]>(() => {
    const sessionNames = new Set(sessionPlants.map((p) => p.name));
    const filteredStatic = SETTLEMENT_PLANTS.filter((p) => !sessionNames.has(p.name));
    return [...sessionPlants, ...filteredStatic];
  }, [sessionPlants]);

  // 공통 항목 (전사 기준 단가·요율) — demoTradingSession 세션에 저장
  // 거래수수료(전력공급거래)는 계약 단위라 공통이 아닌 발전소별 필드로 분리 관리
  const { savedFees, saveFees } = useDemoCommonFees();
  const [commonFees, setCommonFees] = useState(savedFees);
  // 세션 hydration 이후 한 번 동기화
  useEffect(() => {
    setCommonFees(savedFees);
  }, [savedFees]);
  const isFeesDirty =
    commonFees.tradeFeeKpx !== savedFees.tradeFeeKpx ||
    commonFees.surchargeRate !== savedFees.surchargeRate ||
    commonFees.fundRate !== savedFees.fundRate;
  const saveCommonFees = () => saveFees(commonFees);

  // 공통 항목 변경 시 영향 미리보기 — 저장 전 / 후 차이를 누적 계산
  // (계약 기간 안에 포함된 모든 정산 record 기준)
  // ALL_PLANTS는 아래에서 정의되므로 함수 끝에서 다시 묶어 계산

  // 정산 record 선택 + 요금 조정 워크플로우 (SPC 전용 편집 권한)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  // 통지서/청구서 미리보기 모달 — recipient: 발전사(지급통지) | 수용가(청구서)
  const [noticePreview, setNoticePreview] = useState<{ recordId: string; recipient: 'generator' | 'consumer' } | null>(
    null,
  );
  // 연/월 필터 (정산 record 한정)
  const [filterYear, setFilterYear] = useState<number>(2026);
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');
  const currentYear = new Date().getFullYear();
  const filterYears = useMemo(() => {
    const years = Array.from(new Set([currentYear, currentYear - 1, currentYear - 2]));
    return years.sort();
  }, [currentYear]);
  // API 기반 정산 데이터 조회 (filterMonths보다 먼저 선언해야 TDZ 회피)
  const { data: apiSettlements } = usePpaSettlements({ year: filterYear, size: 100 });
  const apiRecords = useMemo(() => {
    const raw = apiSettlements?.content ?? [];
    if (raw.length === 0) return null;
    return raw
      .filter((s: any) => {
        if (filterMonth === 'all') return true;
        const m = parseInt(s.period?.split('-')[1] ?? '0', 10);
        return m === filterMonth;
      })
      .map((s: any) => {
        const [y, m] = (s.period ?? '').split('-').map(Number);
        const period = {
          key: s.period,
          year: y,
          month: m,
          status: s.status === 'PENDING' ? 'current' : ('past' as 'current' | 'past'),
        };
        const kind = s.ppaKind ?? 'offsite';
        const plant: SettlementPlant = {
          id: `api-${s.plantId}`,
          kind,
          name: s.plantName ?? '발전소',
          counterparty: s.contractNumber ?? '',
          consumers: [],
          matchType: '1:1',
          monthlyKwh: 0,
          ppaPriceKwh: Number(s.smpUnitPrice ?? 0),
          contractStart: '2020-01-01',
          contractEnd: '2050-12-31',
        };
        const statusMap: Record<string, 'paid' | 'issued' | 'pending'> = {
          CONFIRMED: 'paid',
          PENDING: 'pending',
          SPC_REVIEWING: 'issued',
          DISPUTED: 'pending',
          ADJUSTED: 'issued',
        };
        return {
          id: String(s.id),
          plant,
          period,
          generation: Number(s.generationKwh ?? 0),
          ppaRevenue: Number(s.supplyAmount ?? 0),
          tradeFee: Number(s.tradeFee ?? 0),
          supplyFee: Number(s.supplyFee ?? 0),
          manageFee: Number(s.manageFee ?? 0),
          adjust: Number(s.adjustAmount ?? 0),
          network: Number(s.networkFee ?? 0),
          transmissionLoss: Number(s.transmissionLoss ?? 0),
          welfareCost: Number(s.welfareCost ?? 0),
          fund: Number(s.fundAmount ?? 0),
          vat: Number(s.vat ?? 0),
          netRevenue: Number(s.total ?? 0) - Number(s.vat ?? 0),
          status: statusMap[s.status] ?? 'pending',
        };
      });
  }, [apiSettlements, filterMonth]);

  const yearMinFilter = filterYears[0];
  const yearMaxFilter = filterYears[filterYears.length - 1];
  const shiftFilterYear = (delta: number) => {
    const next = Math.max(yearMinFilter, Math.min(yearMaxFilter, filterYear + delta));
    if (next === filterYear) return;
    setFilterYear(next);
    const monthsAvail = SETTLEMENT_PERIODS.filter((p) => p.year === next).map((p) => p.month);
    if (filterMonth !== 'all' && !monthsAvail.includes(filterMonth as number)) setFilterMonth('all');
  };
  // 요금 조정 — demoTradingSession 세션에 저장
  const { adjustments, getAdjustment, updateAdjustment } = useDemoAdjustments();
  // record 검토 상태 — 발전사 화면에 값 노출 여부 결정
  const { getApproval, setApproval } = useDemoApprovals();
  // 이의 제기 — 발전사/수용가가 동의 대기 단계에서 거절(이의)하면 record 에 사유 매핑
  // 데모: seed 한 건만 우선 로드, SPC 가 사유 반영 → '해결 처리'로 status='resolved'
  const [objections, setObjections] = useState<Record<string, Objection>>(OBJECTIONS_SEED);
  const getObjection = (id: string): Objection | undefined => objections[id];
  const resolveObjection = (id: string) =>
    setObjections((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: 'resolved' } } : prev));
  const hasAdjustment = (id: string) => {
    const a = adjustments[id];
    return a && (a.amount !== 0 || a.vat !== 0 || (a.reason && a.reason.trim().length > 0));
  };

  const settlementRecords = apiRecords ?? [];
  const filterMonths = useMemo(() => {
    const records = settlementRecords ?? [];
    return Array.from(new Set(records.map((r: any) => r.period?.month ?? 0)))
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [settlementRecords]);
  const selectedRecord = settlementRecords.find((r) => r.id === selectedRecordId) ?? settlementRecords[0];

  // 공통 항목 변경 시 영향 계산 — 저장 전 vs 후 (모든 활성 record 기준)
  const feeImpact = useMemo(() => {
    if (!isFeesDirty) return null;
    let dTradeFee = 0;
    let dAdjust = 0;
    let dFund = 0;
    let dNetRevenue = 0;
    let recordCount = 0;
    ALL_PLANTS.forEach((p) => {
      const contractStart = new Date(p.contractStart);
      const contractEnd = new Date(p.contractEnd);
      SETTLEMENT_PERIODS.forEach((per) => {
        const periodStart = new Date(per.year, per.month - 1, 1);
        const periodEnd = new Date(per.year, per.month, 0);
        if (periodEnd < contractStart || periodStart > contractEnd) return;
        const old = buildSettlementRecord(p, per, savedFees);
        const nw = buildSettlementRecord(p, per, commonFees);
        dTradeFee += nw.tradeFee - old.tradeFee;
        dAdjust += nw.adjust - old.adjust;
        dFund += nw.fund - old.fund;
        dNetRevenue += nw.netRevenue - old.netRevenue;
        recordCount += 1;
      });
    });
    return { dTradeFee, dAdjust, dFund, dNetRevenue, recordCount };
  }, [isFeesDirty, ALL_PLANTS, commonFees, savedFees]);

  const _currentStage = CYCLE_STAGES.find((s) => s.current) ?? CYCLE_STAGES[0];
  const today = new Date('2026-05-05');
  const dueDate = new Date('2026-05-17');
  const dDay = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const _visiblePay = useMemo(() => {
    return PAY_ROWS.filter((p) => direction === 'all' || p.direction === direction);
  }, [direction]);

  const inSummary = useMemo(() => {
    const rows = PAY_ROWS.filter((p) => p.direction === 'in');
    const pending = rows.filter((p) => p.state !== 'paid').reduce((s, r) => s + r.amount, 0);
    const overdue = rows.filter((p) => p.state === 'overdue').reduce((s, r) => s + r.amount, 0);
    return { pending, overdue, count: rows.filter((p) => p.state !== 'paid').length };
  }, []);

  const outSummary = useMemo(() => {
    const rows = PAY_ROWS.filter((p) => p.direction === 'out');
    const pending = rows.filter((p) => p.state !== 'paid').reduce((s, r) => s + r.amount, 0);
    return { pending, count: rows.filter((p) => p.state !== 'paid').length };
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '정산' }]}
      />

      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">정산</h1>
          <p className="mt-1 text-sm text-slate-400">정산 사이클 관리 · 자동 검증 · 결제 실행 · REC 인증 · 감사 추적</p>
        </div>
        <div className="rounded-lg border border-amber-500/[0.20] bg-amber-500/[0.04] px-3 py-2 text-xs flex items-center gap-2">
          <Clock size={12} className="text-amber-300" />
          <span className="text-slate-400">정산 마감</span>
          <span className="text-amber-300 font-semibold tabular-nums">D-{dDay}</span>
          <span className="text-slate-500 tabular-nums">(2026-05-17)</span>
        </div>
      </div>

      {/* ─────────────── 정산 ─────────────── */}
      {tab === 'settlement' && (
        <div className="space-y-6">
          {/* 공통 항목 — 전사 기준 단가·요율 (모든 정산 record에 일괄 적용) */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-slate-400" />
                <h3 className="text-md font-semibold text-white">공통 항목</h3>
              </div>
              {isFeesDirty && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.10] px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
                  <AlertCircle size={10} />
                  미저장 변경
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 px-5 py-4 items-end">
              {/* 거래수수료 (전력거래소) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  거래 수수료 <span className="text-slate-500">(전력거래소)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.0001"
                    min={0}
                    value={commonFees.tradeFeeKpx}
                    onChange={(e) => setCommonFees((f) => ({ ...f, tradeFeeKpx: Number(e.target.value) }))}
                    className="flex-1 h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-right text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs text-slate-400 shrink-0 w-12">원/kWh</span>
                </div>
              </div>

              {/* 부가정산금 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">부가정산금</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={commonFees.surchargeRate}
                    onChange={(e) =>
                      setCommonFees((f) => ({ ...f, surchargeRate: Math.round(Number(e.target.value) * 10) / 10 }))
                    }
                    className="flex-1 h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-right text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs text-slate-400 shrink-0 w-12">%</span>
                </div>
              </div>

              {/* 전력산업기반기금 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">전력산업기반기금</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={commonFees.fundRate}
                    onChange={(e) =>
                      setCommonFees((f) => ({ ...f, fundRate: Math.round(Number(e.target.value) * 10) / 10 }))
                    }
                    className="flex-1 h-10 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-right text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs text-slate-400 shrink-0 w-12">%</span>
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-transparent select-none">저장</label>
                <button
                  type="button"
                  onClick={saveCommonFees}
                  disabled={!isFeesDirty}
                  className={cn(
                    'w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-semibold transition-colors',
                    isFeesDirty
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.06] cursor-not-allowed',
                  )}
                >
                  <Save size={13} />
                  저장
                </button>
              </div>
            </div>

            {/* 변경 영향 미리보기 — isFeesDirty 일 때만 노출 */}
            {feeImpact && (
              <div className="border-t border-amber-500/20 bg-amber-500/[0.04] px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={12} className="text-amber-300" />
                  <p className="text-xs font-semibold text-amber-200">변경 미리보기 — 저장 시 영향</p>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    ({feeImpact.recordCount}건 정산 record 기준)
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                    <p className="text-slate-500 mb-0.5">거래수수료 (전력거래소)</p>
                    <p
                      className={cn(
                        'tabular-nums font-semibold',
                        feeImpact.dTradeFee > 0
                          ? 'text-rose-300'
                          : feeImpact.dTradeFee < 0
                            ? 'text-emerald-300'
                            : 'text-slate-400',
                      )}
                    >
                      {feeImpact.dTradeFee > 0 ? '+' : ''}₩{feeImpact.dTradeFee.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                    <p className="text-slate-500 mb-0.5">부가정산금</p>
                    <p
                      className={cn(
                        'tabular-nums font-semibold',
                        feeImpact.dAdjust > 0
                          ? 'text-rose-300'
                          : feeImpact.dAdjust < 0
                            ? 'text-emerald-300'
                            : 'text-slate-400',
                      )}
                    >
                      {feeImpact.dAdjust > 0 ? '+' : ''}₩{feeImpact.dAdjust.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2">
                    <p className="text-slate-500 mb-0.5">전력산업기반기금</p>
                    <p
                      className={cn(
                        'tabular-nums font-semibold',
                        feeImpact.dFund > 0
                          ? 'text-rose-300'
                          : feeImpact.dFund < 0
                            ? 'text-emerald-300'
                            : 'text-slate-400',
                      )}
                    >
                      {feeImpact.dFund > 0 ? '+' : ''}₩{feeImpact.dFund.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-3 py-2">
                    <p className="text-rose-200 mb-0.5 font-medium">발전사 지급액 (순영향)</p>
                    <p
                      className={cn(
                        'tabular-nums font-bold text-base',
                        feeImpact.dNetRevenue > 0
                          ? 'text-emerald-300'
                          : feeImpact.dNetRevenue < 0
                            ? 'text-rose-300'
                            : 'text-slate-400',
                      )}
                    >
                      {feeImpact.dNetRevenue > 0 ? '+' : ''}₩{feeImpact.dNetRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  ※ 양수(빨강) = 발전사 부담 증가 · 음수(녹색) = 발전사 부담 감소 / 순영향은 발전사 지급액 변동분
                </p>
              </div>
            )}
          </div>

          {/* 연/월 필터 */}
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#0d1520] px-4 py-3 flex-wrap">
            <span className="text-xs text-slate-500 shrink-0">연도</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftFilterYear(-1)}
                disabled={filterYear <= yearMinFilter}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
                aria-label="이전 연도"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-base font-semibold text-white tabular-nums min-w-[72px] text-center">
                {filterYear}년
              </span>
              <button
                type="button"
                onClick={() => shiftFilterYear(1)}
                disabled={filterYear >= yearMaxFilter}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
                aria-label="다음 연도"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <span className="text-xs text-slate-500 shrink-0 ml-2">월</span>
            <Dropdown
              align="left"
              trigger={
                <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer min-w-[100px]">
                  <span className="font-semibold tabular-nums">
                    {filterMonth === 'all' ? '전체' : `${String(filterMonth).padStart(2, '0')}월`}
                  </span>
                  <ChevronDown size={12} className="ml-auto text-slate-500" />
                </div>
              }
            >
              <div className="max-h-72 overflow-y-auto min-w-[140px]">
                <DropdownItem onClick={() => setFilterMonth('all')}>
                  <span
                    className={cn('text-sm', filterMonth === 'all' ? 'text-primary font-semibold' : 'text-slate-200')}
                  >
                    전체
                  </span>
                </DropdownItem>
                {filterMonths.map((m) => {
                  const p = SETTLEMENT_PERIODS.find((x) => x.year === filterYear && x.month === m)!;
                  return (
                    <DropdownItem key={m} onClick={() => setFilterMonth(m)}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span
                          className={cn(
                            'text-sm tabular-nums',
                            m === filterMonth ? 'text-primary font-semibold' : 'text-slate-200',
                          )}
                        >
                          {String(m).padStart(2, '0')}월
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full ring-1',
                            p.status === 'past'
                              ? 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30'
                              : 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
                          )}
                        >
                          {p.status === 'past' ? '확정' : '집계 중'}
                        </span>
                      </div>
                    </DropdownItem>
                  );
                })}
              </div>
            </Dropdown>
            <span className="ml-auto text-xs text-slate-500 tabular-nums">
              {filterMonth === 'all' ? `${filterYear}년 전체` : `${filterYear}-${String(filterMonth).padStart(2, '0')}`}
            </span>
          </div>

          {/* 정산 record 표 + 우측 상세 — 발전사 페이지와 동일 구조 (그룹 헤더 + 풀 컬럼) */}
          {settlementRecords.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <Calculator size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">정산 데이터가 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">PPA 계약 체결 후 월별 정산 데이터가 생성됩니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="border-b border-white/[0.06] px-5 py-3">
                  <h3 className="text-md font-semibold text-white">전체 {settlementRecords.length}건</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    SPC가 작성 · 검토 후 발전사·수용가 동시 통보 · 행 클릭 시 우측에서 편집
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1750px]">
                    <thead className="text-left">
                      {/* 그룹 헤더 */}
                      <tr className="border-b border-white/[0.04] text-[10px] text-slate-400 bg-white/[0.04]">
                        <th
                          colSpan={5}
                          className="px-3.5 text-left font-medium whitespace-nowrap border-r border-white/[0.04]"
                        >
                          기본 · 계약
                        </th>
                        <th colSpan={6} className="px-3.5 font-medium whitespace-nowrap border-r border-white/[0.04]">
                          과세
                        </th>
                        <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap border-r border-white/[0.04]">
                          부가세
                        </th>
                        <th
                          colSpan={1}
                          className="px-3.5 font-medium whitespace-nowrap text-slate-500 border-r border-white/[0.04]"
                        >
                          비과세
                        </th>
                        <th
                          colSpan={1}
                          className="px-3.5 font-medium whitespace-nowrap text-amber-300 border-r border-white/[0.04]"
                        >
                          요금 조정
                        </th>
                        <th
                          colSpan={1}
                          className="px-3.5 font-medium whitespace-nowrap text-rose-300 border-r border-white/[0.04]"
                        >
                          실 지급액
                        </th>
                        <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap"></th>
                      </tr>
                      {/* 개별 컬럼 */}
                      <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap">기간</th>
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap">유형</th>
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          계약 당사자
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">발전사업자 → 수용가</span>
                        </th>
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap">발전소</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">공급량</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04]">
                          단가
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">₩/kWh</span>
                        </th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap text-emerald-400">전력량 대금</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">부가정산금</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">망이용요금</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap text-amber-400">
                          거래수수료
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">전력거래소</span>
                        </th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap text-amber-400">
                          거래수수료
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">전력공급거래</span>
                        </th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-amber-400">
                          관리 수수료
                        </th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04]">부가세</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-slate-500">
                          전력산업
                          <br />
                          기반기금
                        </th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-amber-300">
                          조정 금액
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">SPC 작성</span>
                        </th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-rose-300">
                          실 지급액
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">발전사 지급</span>
                        </th>
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementRecords.map((r) => {
                        const a = getAdjustment(r.id);
                        const adjTotal = a.amount + a.vat;
                        const finalAmount = r.netRevenue + adjTotal;
                        const isSelected = r.id === selectedRecord?.id;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedRecordId(r.id)}
                            className={cn(
                              'border-b border-white/[0.04] cursor-pointer transition-colors',
                              isSelected ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                            )}
                          >
                            <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap text-xs">
                              {(() => {
                                const lastDay = new Date(r.period.year, r.period.month, 0).getDate();
                                const mm = String(r.period.month).padStart(2, '0');
                                return `${r.period.year}.${mm}.01 ~ ${r.period.year}.${mm}.${String(lastDay).padStart(2, '0')}`;
                              })()}
                            </td>
                            {/* 유형 — Offsite/Onsite/Lease */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                  (PLANT_KIND_META[r.plant.kind] ?? PLANT_KIND_META.offsite).cls,
                                )}
                              >
                                {(PLANT_KIND_META[r.plant.kind] ?? PLANT_KIND_META.offsite).label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs text-white font-medium">{r.plant.counterparty}</p>
                                  <p className="text-[10px] text-slate-500">발전사업자</p>
                                </div>
                                <ChevronRight size={12} className="text-slate-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-white font-medium">{r.plant.consumers[0]}</p>
                                  {r.plant.consumers.length > 1 ? (
                                    <p className="text-[10px] text-slate-500">
                                      +{r.plant.consumers.length - 1}개 ({r.plant.consumers.slice(1).join(', ')})
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-slate-500">수용가</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <p className="text-xs text-white">{r.plant.name}</p>
                              <p className="text-[10px] text-slate-500">{r.plant.matchType}</p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 tabular-nums text-xs whitespace-nowrap">
                              {r.generation.toLocaleString()} kWh
                            </td>
                            <td className="px-3 py-2.5 text-slate-300 tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                              ₩{r.plant.ppaPriceKwh}
                            </td>
                            {/* 과세 */}
                            <td className="px-3 py-2.5 text-emerald-300 tabular-nums text-xs font-semibold whitespace-nowrap">
                              ₩{r.ppaRevenue.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-slate-300 tabular-nums text-xs whitespace-nowrap">
                              ₩{r.adjust.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-slate-300 tabular-nums text-xs whitespace-nowrap">
                              ₩{r.network.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-amber-300 tabular-nums text-xs whitespace-nowrap">
                              −₩{r.tradeFee.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-amber-300 tabular-nums text-xs whitespace-nowrap">
                              −₩{r.supplyFee.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-amber-300 tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                              −₩{r.manageFee.toLocaleString()}
                            </td>
                            {/* 부가세 */}
                            <td className="px-3 py-2.5 text-slate-300 tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                              ₩{r.vat.toLocaleString()}
                            </td>
                            {/* 비과세 */}
                            <td className="px-3 py-2.5 text-slate-500 tabular-nums text-xs whitespace-nowrap border-r border-white/[0.04]">
                              ₩{r.fund.toLocaleString()}
                            </td>
                            {/* 요금 조정 */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-white/[0.04]">
                              {hasAdjustment(r.id) ? (
                                <div className="inline-flex flex-col items-end gap-0.5">
                                  <span
                                    className={cn(
                                      'tabular-nums text-xs font-semibold',
                                      adjTotal >= 0 ? 'text-amber-300' : 'text-rose-300',
                                    )}
                                  >
                                    {adjTotal >= 0 ? '+' : ''}₩{adjTotal.toLocaleString()}
                                  </span>
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1',
                                      a.status === 'reviewed'
                                        ? 'bg-emerald-500/[0.15] text-emerald-300 ring-emerald-500/40'
                                        : a.status === 'saved'
                                          ? 'bg-blue-500/[0.15] text-blue-300 ring-blue-500/40'
                                          : 'bg-amber-500/[0.15] text-amber-300 ring-amber-500/40',
                                    )}
                                  >
                                    {a.status === 'reviewed'
                                      ? '검토 완료'
                                      : a.status === 'saved'
                                        ? '저장됨'
                                        : '편집 중'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </td>
                            {/* 실 지급액 */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-white/[0.04]">
                              <span className="text-rose-300 font-bold tabular-nums text-xs">
                                ₩{finalAmount.toLocaleString()}
                              </span>
                            </td>
                            {/* 상태 — 이의 제기(open) 시 우선 표시 */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {(() => {
                                const obj = getObjection(r.id);
                                if (obj && obj.status === 'open') {
                                  return (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-rose-500/[0.10] text-rose-300 ring-rose-500/30">
                                      <AlertCircle size={10} />
                                      이의 제기
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                      r.status === 'paid'
                                        ? 'bg-emerald-500/[0.08] text-emerald-300 ring-emerald-500/30'
                                        : r.status === 'issued'
                                          ? 'bg-amber-500/[0.08] text-amber-300 ring-amber-500/30'
                                          : 'bg-white/[0.04] text-slate-400 ring-white/[0.08]',
                                    )}
                                  >
                                    {r.status === 'paid'
                                      ? '지급 완료'
                                      : r.status === 'issued'
                                        ? '발행·미지급'
                                        : '확정 대기'}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 우측 상세 + 요금 조정 편집 (SPC 전용 권한) */}
              <div className="xl:col-span-4 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden h-fit sticky top-6">
                {selectedRecord &&
                  (() => {
                    const r = selectedRecord;
                    const [py, pm] = r.period.key.split('-').map(Number);
                    const lastDay = new Date(py, pm, 0).getDate();
                    const mm = String(pm).padStart(2, '0');
                    const adj = getAdjustment(r.id);
                    const adjTotal = adj.amount + adj.vat;
                    const finalAmount = r.netRevenue + adjTotal;
                    const hasAdj = hasAdjustment(r.id);
                    // 저장 후 또는 검토 완료 시 잠금 (수정 버튼으로 다시 편집 모드로)
                    const isLocked = adj.status === 'saved' || getApproval(r.id) === 'reviewed';
                    const statusMeta = {
                      editing: {
                        label: '편집 중',
                        tone: 'text-amber-300',
                        bg: 'bg-amber-500/[0.15]',
                        ring: 'ring-amber-500/30',
                      },
                      saved: {
                        label: '저장됨 · 검토 대기',
                        tone: 'text-blue-300',
                        bg: 'bg-blue-500/[0.15]',
                        ring: 'ring-blue-500/30',
                      },
                      reviewed: {
                        label: '검토 완료 · 확정',
                        tone: 'text-emerald-300',
                        bg: 'bg-emerald-500/[0.15]',
                        ring: 'ring-emerald-500/30',
                      },
                    }[adj.status];
                    return (
                      <>
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-white/[0.06]">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-base font-bold text-white tabular-nums whitespace-nowrap">
                                {py}.{mm}.01 ~ {py}.{mm}.{String(lastDay).padStart(2, '0')}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                정산 기간 · {r.generation.toLocaleString()} kWh 발전
                              </p>
                            </div>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 tabular-nums shrink-0',
                                MATCH_TYPE_META[r.plant.matchType].bg,
                                MATCH_TYPE_META[r.plant.matchType].tone,
                                MATCH_TYPE_META[r.plant.matchType].ring,
                              )}
                              title={MATCH_TYPE_META[r.plant.matchType].desc}
                            >
                              {r.plant.matchType}
                            </span>
                          </div>
                          <div className="mt-2 rounded-md bg-white/[0.03] ring-1 ring-white/[0.06] px-3 py-2 text-[11px] space-y-1">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">발전사업자</span>
                              <span className="text-white">
                                {r.plant.counterparty} · {r.plant.name}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">수용가</span>
                              <span className="text-white text-right">{r.plant.consumers.join(', ')}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">매칭 유형</span>
                              <span className="text-slate-400 text-[10px]">
                                {MATCH_TYPE_META[r.plant.matchType].desc}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 정산 분해 */}
                        <div className="px-5 py-3 border-b border-white/[0.06]">
                          <p className="text-xs font-semibold text-slate-300 mb-2">정산 분해 (발전사)</p>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1 mb-1">과세</p>
                          <div className="space-y-0.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">전력량 대금 (매출)</span>
                              <span className="text-emerald-300 font-semibold tabular-nums">
                                ₩{r.ppaRevenue.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">부가정산금</span>
                              <span className="text-slate-300 tabular-nums">₩{r.adjust.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">망이용요금</span>
                              <span className="text-slate-300 tabular-nums">₩{r.network.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">거래수수료 (거래소, 차감)</span>
                              <span className="text-amber-300 tabular-nums">−₩{r.tradeFee.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">거래수수료 (공급, 차감)</span>
                              <span className="text-amber-300 tabular-nums">−₩{r.supplyFee.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">관리 수수료 (차감)</span>
                              <span className="text-amber-300 tabular-nums">−₩{r.manageFee.toLocaleString()}</span>
                            </div>
                          </div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">부가세</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">부가세 (+10%)</span>
                            <span className="text-slate-300 tabular-nums">+₩{r.vat.toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">비과세</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">전력산업기반기금</span>
                            <span className="text-slate-500 tabular-nums">₩{r.fund.toLocaleString()}</span>
                          </div>
                          {hasAdj && (
                            <div className="flex justify-between text-xs mt-2">
                              <span className="text-slate-500">요금 조정 (반영)</span>
                              <span className={cn('tabular-nums', adjTotal >= 0 ? 'text-amber-300' : 'text-rose-300')}>
                                {adjTotal >= 0 ? '+' : ''}₩{adjTotal.toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="my-2 rounded-md bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-3 py-2 flex items-baseline justify-between">
                            <span className="text-xs font-semibold text-rose-200">실 지급액 (발전사 지급)</span>
                            <span className="text-base font-bold text-rose-300 tabular-nums">
                              ₩{finalAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* 이의 제기 사유 — open 상태일 때만 노출, SPC 가 사유 보고 요금 조정에 반영 */}
                        {(() => {
                          const obj = getObjection(r.id);
                          if (!obj) return null;
                          const isOpen = obj.status === 'open';
                          return (
                            <div
                              className={cn(
                                'px-5 py-3 border-b border-white/[0.06]',
                                isOpen ? 'bg-rose-500/[0.06]' : 'bg-emerald-500/[0.04]',
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p
                                  className={cn(
                                    'text-xs font-semibold flex items-center gap-1.5',
                                    isOpen ? 'text-rose-200' : 'text-emerald-200',
                                  )}
                                >
                                  <AlertCircle size={12} />
                                  {isOpen ? '이의 제기 (조치 필요)' : '이의 제기 (해결됨)'}
                                </p>
                                <span className="text-[10px] text-slate-500 tabular-nums">{obj.createdAt}</span>
                              </div>
                              <div className="rounded-md ring-1 ring-white/[0.06] bg-white/[0.03] px-3 py-2 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1',
                                      obj.from === 'consumer'
                                        ? 'bg-blue-500/[0.15] text-blue-300 ring-blue-500/30'
                                        : 'bg-violet-500/[0.15] text-violet-300 ring-violet-500/30',
                                    )}
                                  >
                                    {obj.from === 'consumer' ? '수용가' : '발전사'}
                                  </span>
                                  <span className="text-xs text-white font-medium">{obj.partyName}</span>
                                </div>
                                <p className="text-[11px] text-slate-300 leading-relaxed">{obj.reason}</p>
                              </div>
                              {isOpen && (
                                <div className="flex items-center gap-1.5 pt-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flex-1 justify-center"
                                    onClick={() => {
                                      // 사유를 요금 조정 입력으로 prefill → SPC 가 금액만 보정 후 검토 완료
                                      updateAdjustment(r.id, {
                                        reason: `[이의 반영] ${obj.partyName} — ${obj.reason.slice(0, 40)}${obj.reason.length > 40 ? '…' : ''}`,
                                        status: 'editing',
                                      });
                                    }}
                                  >
                                    사유 반영해 조정 작성
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    className="flex-1 justify-center"
                                    onClick={() => resolveObjection(r.id)}
                                  >
                                    <CheckCircle2 size={11} className="mr-1.5" />
                                    해결 처리
                                  </Button>
                                </div>
                              )}
                              <p className="text-[10px] text-slate-500 mt-2">
                                ※ 요금 조정에 반영 후 <span className="text-amber-300">검토 완료</span> 시 양 당사자에게
                                재통보됩니다
                              </p>
                            </div>
                          );
                        })()}

                        {/* 요금 조정 편집 — SPC 전용 권한 */}
                        <div className={cn('px-5 py-3', hasAdj && 'bg-amber-500/[0.04]')}>
                          <div className="flex items-center justify-between mb-2">
                            <p className={cn('text-xs font-semibold', hasAdj ? 'text-amber-200' : 'text-slate-300')}>
                              요금 조정 (SPC 작성)
                            </p>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                statusMeta.bg,
                                statusMeta.tone,
                                statusMeta.ring,
                              )}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1">조정 사유</label>
                              <input
                                type="text"
                                value={adj.reason}
                                onChange={(e) => updateAdjustment(r.id, { reason: e.target.value })}
                                placeholder="예: 소급 단가 조정, 계량기 오차 보정 등"
                                disabled={isLocked}
                                className={cn(
                                  'w-full h-8 rounded ring-1 px-2 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-primary',
                                  isLocked
                                    ? 'bg-white/[0.02] ring-white/[0.04] text-slate-400 cursor-not-allowed'
                                    : 'bg-white/[0.04] ring-white/[0.06] text-white',
                                )}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">조정 금액 (₩)</label>
                                <SignedNumberInput
                                  value={adj.amount}
                                  onChange={(n) => updateAdjustment(r.id, { amount: n })}
                                  disabled={isLocked}
                                  className={cn(
                                    'w-full h-8 rounded ring-1 px-2 text-xs tabular-nums text-right placeholder:text-slate-600 focus:outline-none focus:ring-primary',
                                    isLocked
                                      ? 'bg-white/[0.02] ring-white/[0.04] text-slate-400 cursor-not-allowed'
                                      : 'bg-white/[0.04] ring-white/[0.06] text-white',
                                  )}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">조정 부가세 (₩)</label>
                                <SignedNumberInput
                                  value={adj.vat}
                                  onChange={(n) => updateAdjustment(r.id, { vat: n })}
                                  disabled={isLocked}
                                  className={cn(
                                    'w-full h-8 rounded ring-1 px-2 text-xs tabular-nums text-right placeholder:text-slate-600 focus:outline-none focus:ring-primary',
                                    isLocked
                                      ? 'bg-white/[0.02] ring-white/[0.04] text-slate-400 cursor-not-allowed'
                                      : 'bg-white/[0.04] ring-white/[0.06] text-white',
                                  )}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              ※ 검토 완료 시 발전사·수용가에 값과 조정사항이 동시 통보됩니다
                            </p>
                            <div className="flex items-center gap-1.5 pt-1">
                              {(() => {
                                const isReviewed = getApproval(r.id) === 'reviewed';
                                // 검토 완료된 상태 — 변동 불가
                                if (isReviewed) {
                                  return (
                                    <div className="flex-1 text-[10px] text-emerald-300/80 text-center py-1.5 rounded bg-emerald-500/[0.06] ring-1 ring-emerald-500/20">
                                      ✓ 검토 완료 — 발전사·수용가에 통보됨 (변동 불가)
                                    </div>
                                  );
                                }
                                // editing 상태 — 저장 버튼
                                if (adj.status === 'editing') {
                                  return (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      className="flex-1 justify-center"
                                      onClick={() => updateAdjustment(r.id, { status: 'saved' })}
                                    >
                                      저장
                                    </Button>
                                  );
                                }
                                // saved 상태 — 수정 / 검토 완료 두 버튼
                                return (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="flex-1 justify-center"
                                      onClick={() => updateAdjustment(r.id, { status: 'editing' })}
                                    >
                                      수정
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      className="flex-1 justify-center"
                                      onClick={() => {
                                        // 검토 완료 = 요금 조정 잠금 + record approval (발전사·수용가에 값 통보)
                                        updateAdjustment(r.id, { status: 'reviewed' });
                                        setApproval(r.id, 'reviewed');
                                      }}
                                    >
                                      <ShieldCheck size={11} className="mr-1.5" />
                                      검토 완료
                                    </Button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* 통지서 출력 */}
                        <div className="px-5 py-3 border-t border-white/[0.06]">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="justify-center"
                              onClick={() => setNoticePreview({ recordId: r.id, recipient: 'generator' })}
                            >
                              <FileText size={11} className="mr-1.5" />
                              통지서 미리보기
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              className="justify-center"
                              onClick={() =>
                                downloadPdf(ENDPOINTS.ppa.invoicePdf(r.id), `세금계산서_${r.period}.pdf`).catch(() =>
                                  exportPdf(
                                    `정산서-${r.period}`,
                                    `PPA 정산서 — ${r.period}`,
                                    ['항목', '값'],
                                    [
                                      ['기간', r.period],
                                      ['발전사', r.generator],
                                      ['수용가', r.consumer],
                                      ['발전량', `${r.genKwh?.toLocaleString()} kWh`],
                                      ['단가', `₩${r.unitPrice}/kWh`],
                                    ],
                                  ),
                                )
                              }
                            >
                              <Download size={11} className="mr-1.5" />
                              정산서 다운로드
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────── 결제 실행 ─────────────── */}
      {tab === 'payment' && (
        <div className="space-y-6">
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard
              label="미수금 (입금)"
              value={fmtKrw(inSummary.pending)}
              sub={`${inSummary.count}건 · 연체 ${fmtKrw(inSummary.overdue)}`}
              icon={TrendingDown}
              tone="amber"
            />
            <KpiCard
              label="미지급 (출금)"
              value={fmtKrw(outSummary.pending)}
              sub={`${outSummary.count}건`}
              icon={TrendingUp}
              tone="blue"
            />
            <KpiCard
              label="결제 마감"
              value={`D-${dDay}`}
              sub="2026-05-17"
              icon={Clock}
              tone={dDay <= 7 ? 'rose' : 'amber'}
            />
          </div>

          {/* 연/월 필터 — 정산 탭과 동일 패턴 (매달 수금·지급 조회) */}
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#0d1520] px-4 py-3 flex-wrap">
            <span className="text-xs text-slate-500 shrink-0">연도</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftFilterYear(-1)}
                disabled={filterYear <= yearMinFilter}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
                aria-label="이전 연도"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-base font-semibold text-white tabular-nums min-w-[72px] text-center">
                {filterYear}년
              </span>
              <button
                type="button"
                onClick={() => shiftFilterYear(1)}
                disabled={filterYear >= yearMaxFilter}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06] disabled:opacity-30"
                aria-label="다음 연도"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <span className="text-xs text-slate-500 shrink-0 ml-2">월</span>
            <Dropdown
              align="left"
              trigger={
                <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white hover:bg-white/[0.08] cursor-pointer min-w-[100px]">
                  <span className="font-semibold tabular-nums">
                    {filterMonth === 'all' ? '전체' : `${String(filterMonth).padStart(2, '0')}월`}
                  </span>
                  <ChevronDown size={12} className="ml-auto text-slate-500" />
                </div>
              }
            >
              <div className="max-h-72 overflow-y-auto min-w-[140px]">
                <DropdownItem onClick={() => setFilterMonth('all')}>
                  <span
                    className={cn('text-sm', filterMonth === 'all' ? 'text-primary font-semibold' : 'text-slate-200')}
                  >
                    전체
                  </span>
                </DropdownItem>
                {filterMonths.map((m) => (
                  <DropdownItem key={m} onClick={() => setFilterMonth(m)}>
                    <span
                      className={cn(
                        'text-sm tabular-nums',
                        m === filterMonth ? 'text-primary font-semibold' : 'text-slate-200',
                      )}
                    >
                      {String(m).padStart(2, '0')}월
                    </span>
                  </DropdownItem>
                ))}
              </div>
            </Dropdown>
            <p className="text-xs text-slate-500 ml-auto tabular-nums">
              {filterYear}년 {filterMonth === 'all' ? '전체' : `${filterMonth}월`}
            </p>
          </div>

          {/* 수금 → 지급 연계 테이블 — 받은 돈이 어디로 지급되는지 계약 단위로 한 행에 */}
          {PAY_ROWS.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <CreditCard size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">결제 데이터가 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">정산 확정 후 수금·지급 흐름이 표시됩니다</p>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-md font-semibold text-white">수금 → 지급 흐름</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  계약 단위 연계 — 수용가에서 받아 발전사에 지급, 차액 = SPC 마진
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                      <th className="text-left font-medium px-4 py-3">정산월</th>
                      <th className="text-left font-medium px-4 py-3">유형</th>
                      <th className="text-left font-medium px-4 py-3 text-emerald-300">수금 (수용가)</th>
                      <th className="text-left font-medium px-2 py-3"></th>
                      <th className="text-left font-medium px-4 py-3 text-amber-300">지급 (발전사)</th>
                      <th className="text-left font-medium px-4 py-3">SPC 마진</th>
                      <th className="text-left font-medium px-4 py-3">문서</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(['offsite', 'onsite', 'lease'] as const).map((kind) => {
                      const inflow = PAY_ROWS.find((p) => p.direction === 'in' && p.kind === kind);
                      const outflow = PAY_ROWS.find((p) => p.direction === 'out' && p.kind === kind);
                      if (!inflow || !outflow) return null;
                      const kindMeta = PLANT_KIND_META[kind]!;
                      const margin = inflow.amount - outflow.amount;
                      const flowCell = (p: PayRow, tone: string) => (
                        <div className="space-y-0.5">
                          <p className="text-sm text-white font-medium">{p.party}</p>
                          <p className={cn('text-sm font-semibold tabular-nums', tone)}>{fmtKrw(p.amount)}</p>
                          <p className="text-[11px] tabular-nums">
                            <span
                              className={
                                p.daysLeft <= 3 && p.state !== 'paid'
                                  ? 'text-amber-300 font-semibold'
                                  : 'text-slate-400'
                              }
                            >
                              {p.due} ·{' '}
                              {p.state === 'paid'
                                ? '완료'
                                : p.daysLeft < 0
                                  ? `${p.daysLeft}일 연체`
                                  : `D-${p.daysLeft}`}
                            </span>
                            <span className="text-slate-600 ml-1.5">{p.method}</span>
                          </p>
                        </div>
                      );
                      return (
                        <tr key={kind} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-300 tabular-nums align-top">
                            {inflow.month ?? '2026.05'}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                kindMeta.cls,
                              )}
                            >
                              {kindMeta.label}
                            </span>
                          </td>
                          {/* 수금 — 수용가에서 받는 돈 */}
                          <td className="px-4 py-3 align-top">{flowCell(inflow, 'text-emerald-300')}</td>
                          {/* 흐름 화살표 */}
                          <td className="px-2 py-3 align-middle text-center">
                            <ArrowRightLeft size={14} className="text-slate-600 inline" />
                          </td>
                          {/* 지급 — 발전사로 나가는 돈 */}
                          <td className="px-4 py-3 align-top">{flowCell(outflow, 'text-amber-300')}</td>
                          {/* SPC 마진 = 수금 - 지급 */}
                          <td className="px-4 py-3 align-top">
                            <p className="text-sm font-bold text-white tabular-nums">{fmtKrw(margin)}</p>
                            <p className="text-[11px] text-slate-500">{((margin / inflow.amount) * 100).toFixed(1)}%</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setPayDoc(inflow)}>
                                <FileText size={11} className="mr-1" />
                                수금 문서
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPayDoc(outflow)}>
                                <FileText size={11} className="mr-1" />
                                지급 문서
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* 합계 행 */}
                    {(() => {
                      const totalIn = PAY_ROWS.filter((p) => p.direction === 'in').reduce((s, p) => s + p.amount, 0);
                      const totalOut = PAY_ROWS.filter((p) => p.direction === 'out').reduce((s, p) => s + p.amount, 0);
                      return (
                        <tr className="bg-white/[0.04] font-bold">
                          <td className="px-4 py-3 text-white" colSpan={2}>
                            합계
                          </td>
                          <td className="px-4 py-3 text-emerald-300 tabular-nums">{fmtKrw(totalIn)}</td>
                          <td />
                          <td className="px-4 py-3 text-amber-300 tabular-nums">{fmtKrw(totalOut)}</td>
                          <td className="px-4 py-3 text-white tabular-nums">{fmtKrw(totalIn - totalOut)}</td>
                          <td />
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────── 수금·지급 문서 모달 — 세금계산서 형태 ─────────── */}
          {payDoc &&
            (() => {
              const supply = Math.round(payDoc.amount / 1.1);
              const vat = payDoc.amount - supply;
              const isIn = payDoc.direction === 'in';
              const kindMeta = PLANT_KIND_META[payDoc.kind] ?? PLANT_KIND_META.offsite;
              return (
                <Modal
                  open={!!payDoc}
                  onClose={() => setPayDoc(null)}
                  title={isIn ? '매출 세금계산서 — SPC → 수용가' : '매입 세금계산서 — 발전사 → SPC'}
                  size="md"
                  footer={
                    <>
                      <Button variant="ghost" onClick={() => setPayDoc(null)}>
                        닫기
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() =>
                          downloadPdf(
                            ENDPOINTS.ppa.invoicePdf(payDoc?.id ?? 0),
                            `세금계산서_${payDoc?.month ?? ''}.pdf`,
                          ).catch(() =>
                            exportPdf(
                              `세금계산서-${payDoc?.month ?? ''}`,
                              isIn ? '매출 세금계산서 — SPC → 수용가' : '매입 세금계산서 — 발전사 → SPC',
                              ['항목', '값'],
                              [
                                ['월', payDoc?.month ?? ''],
                                ['유형', isIn ? '매출' : '매입'],
                                ['공급가액', `₩${(payDoc?.supply ?? 0).toLocaleString()}`],
                                ['VAT', `₩${(payDoc?.vat ?? 0).toLocaleString()}`],
                                ['합계', `₩${(payDoc?.total ?? 0).toLocaleString()}`],
                              ],
                            ),
                          )
                        }
                      >
                        <Download size={13} className="mr-1.5" />
                        다운로드
                      </Button>
                    </>
                  }
                >
                  <div className="space-y-4">
                    {/* 문서 헤더 */}
                    <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {isIn ? '전자 세금계산서 (매출)' : '전자 세금계산서 (매입)'}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          문서번호 {isIn ? 'TX-OUT' : 'TX-IN'}-{(payDoc.month ?? '2026.05').replace('.', '')}-
                          {payDoc.id.slice(-1).toUpperCase()}01 · 정산월 {payDoc.month ?? '2026.05'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                          kindMeta.cls,
                        )}
                      >
                        {kindMeta.label}
                      </span>
                    </div>

                    {/* 공급자/공급받는자 */}
                    <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">공급자</span>
                        <span className="text-sm text-white font-medium">
                          {isIn ? '울산에너지(SPC)' : payDoc.party}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">공급받는자</span>
                        <span className="text-sm text-white font-medium">
                          {isIn ? payDoc.party : '울산에너지(SPC)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">품목</span>
                        <span className="text-sm text-slate-300">PPA 전력 대금 ({kindMeta.label})</span>
                      </div>
                    </div>

                    {/* 금액 */}
                    <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">공급가액</span>
                        <span className="text-sm text-white tabular-nums">₩{supply.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">세액 (10%)</span>
                        <span className="text-sm text-slate-300 tabular-nums">₩{vat.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02]">
                        <span className="text-xs font-semibold text-white">합계</span>
                        <span
                          className={cn(
                            'text-base font-bold tabular-nums',
                            isIn ? 'text-emerald-300' : 'text-amber-300',
                          )}
                        >
                          ₩{payDoc.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* 결제 정보 — 기한 포커스 */}
                    <div
                      className={cn(
                        'rounded-lg px-4 py-3 ring-1',
                        payDoc.daysLeft <= 3
                          ? 'bg-amber-500/[0.06] ring-amber-500/30'
                          : 'bg-white/[0.02] ring-white/[0.06]',
                      )}
                    >
                      <p className="text-xs text-slate-300">
                        {isIn ? '수금' : '지급'} 기한{' '}
                        <span className="text-white font-semibold tabular-nums">{payDoc.due}</span>
                        <span
                          className={cn(
                            'ml-2 font-semibold tabular-nums',
                            payDoc.daysLeft <= 3 ? 'text-amber-300' : 'text-slate-400',
                          )}
                        >
                          D-{payDoc.daysLeft}
                        </span>
                        <span className="ml-2 text-slate-500">· {payDoc.method}</span>
                      </p>
                    </div>
                  </div>
                </Modal>
              );
            })()}
        </div>
      )}

      {/* ─────────────── 이력·감사 ─────────────── */}
      {tab === 'history' && (
        <div className="space-y-6">
          {/* 정산 이력 통합 조회 */}
          {HISTORY.length === 0 && AUDIT_LOGS.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <Shield size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">정산 이력이 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">정산 처리 완료 후 이력 및 감사 로그가 표시됩니다</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-md font-semibold text-white">월별 정산건 통합 조회</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      정산서 · 매입세금계산서 · 매출세금계산서 · 결제증빙 · REC 발급증 한 화면
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dropdown
                      align="right"
                      trigger={
                        <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-xs text-slate-400 hover:text-white">
                          <Filter size={11} />
                          회계연도
                          <ChevronDown size={11} />
                        </button>
                      }
                    >
                      <DropdownItem onClick={() => setFilterYear(2026)}>2026 회계연도</DropdownItem>
                      <DropdownItem onClick={() => setFilterYear(2025)}>2025 회계연도</DropdownItem>
                      <DropdownItem onClick={() => setFilterYear(2024)}>2024 회계연도</DropdownItem>
                    </Dropdown>
                    <Dropdown
                      align="right"
                      trigger={
                        <button className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 text-xs text-emerald-200 hover:bg-emerald-500/[0.12]">
                          <Download size={11} />
                          추출
                          <ChevronDown size={11} />
                        </button>
                      }
                    >
                      <DropdownItem
                        onClick={() => {
                          const headers = ['사이클', '최종금액', '상태', '매입계산서', '매출계산서', '결제완료', 'REC'];
                          const rows = HISTORY.map((h) => [
                            h.cycle,
                            h.finalAmount,
                            h.state,
                            h.invoices.purchase,
                            h.invoices.sale,
                            `${h.payments.complete}/${h.payments.total}`,
                            h.rec,
                          ]);
                          const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `정산이력-${filterYear}.csv`;
                          a.click();
                        }}
                      >
                        <FileText size={12} className="mr-2 inline" />
                        CSV
                      </DropdownItem>
                      <DropdownItem
                        onClick={() =>
                          exportExcel(
                            `정산이력-${filterYear}`,
                            '정산이력',
                            ['사이클', '최종금액', '상태', '결제완료', 'REC'],
                            HISTORY.map((h) => [
                              h.cycle,
                              h.finalAmount,
                              h.state,
                              `${h.payments.complete}/${h.payments.total}`,
                              h.rec,
                            ]),
                          )
                        }
                      >
                        <FileSpreadsheet size={12} className="mr-2 inline" />
                        Excel
                      </DropdownItem>
                      <DropdownItem
                        onClick={() =>
                          exportPdf(
                            `감사보고서-${filterYear}`,
                            `${filterYear} 정산 감사 보고서`,
                            ['사이클', '최종금액(₩)', '상태', '결제', 'REC'],
                            HISTORY.map((h) => [
                              h.cycle,
                              `₩${h.finalAmount.toLocaleString()}`,
                              h.state === 'confirmed' ? '확정' : h.state === 'tentative' ? '잠정' : '재정산',
                              `${h.payments.complete}/${h.payments.total}`,
                              h.rec,
                            ]),
                          )
                        }
                      >
                        <FileText size={12} className="mr-2 inline" />
                        PDF (감사 보고서)
                      </DropdownItem>
                    </Dropdown>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="text-left font-medium px-4 py-3">정산 사이클</th>
                        <th className="font-medium px-3 py-3">최종 금액</th>
                        <th className="font-medium px-3 py-3">상태</th>
                        <th className="font-medium px-3 py-3">세금계산서 (매입/매출)</th>
                        <th className="font-medium px-3 py-3">결제 완료</th>
                        <th className="font-medium px-3 py-3">REC 발급</th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {HISTORY.map((h) => {
                        const st = HISTORY_STATE[h.state];
                        return (
                          <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-medium text-white tabular-nums">{h.cycle}</td>
                            <td className="px-3 py-3 tabular-nums text-white font-semibold">{fmtKrw(h.finalAmount)}</td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1',
                                  st.bg,
                                  st.tone,
                                  st.ring,
                                )}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1 text-xs">
                                <span className="tabular-nums text-slate-300">{h.invoices.purchase}</span>
                                <span className="text-slate-700">/</span>
                                <span className="tabular-nums text-slate-300">{h.invoices.sale}</span>
                                {h.invoices.matched && (
                                  <CheckCircle2 size={11} className="ml-1 text-emerald-400" title="1:1 매핑 검증" />
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <span className="tabular-nums text-emerald-300">{h.payments.complete}</span>
                              <span className="text-slate-700">/</span>
                              <span className="tabular-nums text-slate-400">{h.payments.total}</span>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-emerald-300">{h.rec.toLocaleString()}</td>
                            <td className="px-3 py-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  exportPdf(
                                    `정산문서-${h.cycle}`,
                                    `${h.cycle} 정산 문서`,
                                    ['항목', '값'],
                                    [
                                      ['최종금액', `₩${h.finalAmount.toLocaleString()}`],
                                      ['상태', h.state === 'confirmed' ? '확정' : '잠정'],
                                      ['REC', `${h.rec}`],
                                    ],
                                  )
                                }
                              >
                                <Eye size={11} className="mr-1" />
                                문서
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 감사 로그 */}
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-md font-semibold text-white flex items-center gap-2">
                      <Shield size={14} className="text-violet-300" />
                      감사 로그
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      정산서 수정 · 결제 실행 · 권한 접근 — 회계 감사·국세청 조사 대비
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setAuditOpen(true)}>
                    전체 보기
                  </Button>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {AUDIT_LOGS.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-[11px] text-slate-500 tabular-nums w-32 shrink-0 pt-0.5">{a.datetime}</span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 shrink-0',
                          a.type === 'approval'
                            ? 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30'
                            : a.type === 'auto'
                              ? 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30'
                              : a.type === 'recalc'
                                ? 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30'
                                : 'bg-slate-500/[0.10] text-slate-300 ring-slate-500/30',
                        )}
                      >
                        {a.actor}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{a.action}</p>
                        <p className="text-[11px] text-slate-500 truncate">{a.target}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 감사 로그 전체 모달 */}
      {auditOpen && (
        <Modal
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          size="xl"
          title="감사 로그 — 전체 이력"
          footer={
            <Button variant="ghost" onClick={() => setAuditOpen(false)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {AUDIT_LOGS.concat(AUDIT_LOGS).map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <span className="text-[11px] text-slate-500 tabular-nums w-32 shrink-0 pt-0.5">{a.datetime}</span>
                <span className="text-xs text-violet-300 shrink-0">{a.actor}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{a.action}</p>
                  <p className="text-[11px] text-slate-500 truncate">{a.target}</p>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ─────────── 통지서·청구서 미리보기 모달 ─────────── */}
      {noticePreview &&
        (() => {
          const r = settlementRecords.find((x) => x.id === noticePreview.recordId);
          if (!r) return null;
          const [py, pm] = r.period.key.split('-').map(Number);
          const lastDay = new Date(py, pm, 0).getDate();
          const mm = String(pm).padStart(2, '0');
          const periodStart = `${py}.${mm}.01`;
          const periodEnd = `${py}.${mm}.${String(lastDay).padStart(2, '0')}`;
          const nextMonth = pm === 12 ? 1 : pm + 1;
          const nextYear = pm === 12 ? py + 1 : py;
          const issueDate = `${nextYear}.${String(nextMonth).padStart(2, '0')}.10`;
          const dueDate = `${nextYear}.${String(nextMonth).padStart(2, '0')}.25`;
          const adj = getAdjustment(r.id);
          const adjTotal = adj.amount + adj.vat;
          const isGen = noticePreview.recipient === 'generator';
          // 발전사 통지서 = 지급금 합계 (실 지급액 + 조정) · 수용가 청구서 = 청구금 합계
          const total = isGen
            ? r.ppaRevenue + r.adjust + r.network - r.tradeFee - r.supplyFee - r.manageFee + r.vat + adjTotal
            : r.ppaRevenue + r.adjust + r.network + r.tradeFee + r.supplyFee + r.manageFee + r.vat + r.fund + adjTotal;
          const toKoreanAmount = (n: number) => {
            const units = ['', '만', '억', '조'];
            const num = Math.abs(n);
            if (num === 0) return '영원';
            let result = '';
            let chunkIdx = 0;
            let rem = num;
            while (rem > 0) {
              const chunk = rem % 10000;
              if (chunk > 0) result = `${chunk.toLocaleString()}${units[chunkIdx]} ${result}`;
              rem = Math.floor(rem / 10000);
              chunkIdx++;
            }
            return `${n < 0 ? '음 ' : ''}${result.trim()}원`;
          };
          return (
            <Modal
              open={!!noticePreview}
              onClose={() => setNoticePreview(null)}
              title="통지서 미리보기"
              size="lg"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setNoticePreview(null)}>
                    닫기
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      exportPdf(
                        `통지서-${noticePreview?.recordId}`,
                        '정산 통지서',
                        ['항목', '값'],
                        [
                          ['정산 ID', String(noticePreview?.recordId ?? '')],
                          ['수신자', noticePreview?.recipient ?? ''],
                        ],
                      )
                    }
                  >
                    <Download size={12} className="mr-1.5" />
                    PDF 다운로드
                  </Button>
                </>
              }
            >
              {/* 수신자 토글 */}
              <div className="mb-4 flex items-center gap-2">
                <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06] text-xs">
                  {[
                    { v: 'generator' as const, l: '발전사 통지서', sub: '지급금 통지' },
                    { v: 'consumer' as const, l: '수용가 청구서', sub: 'PPA 사용대금' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setNoticePreview({ recordId: r.id, recipient: opt.v })}
                      className={cn(
                        'rounded px-3.5 transition-colors flex flex-col items-start',
                        noticePreview.recipient === opt.v ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                      )}
                    >
                      <span className="font-medium">{opt.l}</span>
                      <span
                        className={cn(
                          'text-[10px]',
                          noticePreview.recipient === opt.v ? 'text-white/70' : 'text-slate-500',
                        )}
                      >
                        {opt.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="bg-white text-slate-900 rounded-lg p-8 shadow-inner font-serif"
                style={{ fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' }}
              >
                <div className="text-right text-[10px] text-slate-500 mb-2">
                  {isGen ? '[별지 제39호서식]' : '[PPA 청구서 양식]'}
                </div>
                <h1 className="text-center text-2xl font-bold tracking-widest mb-1">
                  {isGen ? '정산금 통지서' : 'PPA 사용대금 청구서'}
                </h1>
                <p className="text-center text-xs text-slate-500 mb-6">
                  {isGen ? 'Settlement Notice (Generator)' : 'PPA Invoice (Consumer)'}
                </p>

                <div className="text-xs grid grid-cols-2 gap-x-6 gap-y-1 mb-6 border-y border-slate-300 py-3">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">문서 번호</span>
                    <span className="font-medium">
                      {isGen ? 'SN' : 'IV'}-{r.period.key}-{r.plant.id.slice(-3).toUpperCase()}-01
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">발행일자</span>
                    <span className="font-medium">{issueDate}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">정산 기간</span>
                    <span className="font-medium">
                      {periodStart} ~ {periodEnd}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">{isGen ? '지급기한' : '납부기한'}</span>
                    <span className="font-semibold text-rose-700">{dueDate}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                  <div className="border border-slate-300 rounded">
                    <div className="bg-slate-100 px-3.5 font-semibold border-b border-slate-300">발신자 (정산기관)</div>
                    <div className="px-3 py-2 space-y-1">
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">상호</span>
                        <span>(주)울산E-SPC</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">사업자번호</span>
                        <span className="tabular-nums">215-87-44210</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">대표자</span>
                        <span>김에너</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-20 shrink-0">주소</span>
                        <span>울산광역시 남구 ...</span>
                      </div>
                    </div>
                  </div>
                  <div className="border border-slate-300 rounded">
                    <div className="bg-slate-100 px-3.5 font-semibold border-b border-slate-300">
                      {isGen ? '수신자 (발전사업자)' : '수신자 (수용가)'}
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {isGen ? (
                        <>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">발전사업자</span>
                            <span>{r.plant.counterparty}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">발전소</span>
                            <span>{r.plant.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">PPA 단가</span>
                            <span className="tabular-nums">₩{r.plant.ppaPriceKwh}/kWh</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">계약 기간</span>
                            <span className="tabular-nums text-[11px]">
                              {r.plant.contractStart} ~ {r.plant.contractEnd}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">수용가</span>
                            <span>{r.plant.consumers.join(', ')}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">공급 발전소</span>
                            <span>{r.plant.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">매칭 유형</span>
                            <span>
                              {r.plant.matchType} · {MATCH_TYPE_META[r.plant.matchType].desc}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20 shrink-0">PPA 단가</span>
                            <span className="tabular-nums">₩{r.plant.ppaPriceKwh}/kWh</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm font-semibold mb-2">
                  ■ {isGen ? '정산 내역 (발전사 지급분)' : '청구 내역 (수용가 부담분)'}
                </p>
                <table className="w-full text-xs border border-slate-300 mb-2">
                  <thead className="text-left">
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="px-3 py-2 text-left">항목</th>
                      <th className="px-3 py-2">금액 (원)</th>
                      <th className="px-3 py-2 text-left">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">전력량 대금</td>
                      <td className="px-3.5 tabular-nums font-semibold">{r.ppaRevenue.toLocaleString()}</td>
                      <td className="px-3.5 text-slate-500">
                        {r.generation.toLocaleString()} kWh × ₩{r.plant.ppaPriceKwh}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">부가정산금</td>
                      <td className="px-3.5 tabular-nums">{r.adjust.toLocaleString()}</td>
                      <td className="px-3.5 text-slate-500">KPX 정산정정분</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">망이용요금</td>
                      <td className="px-3.5 tabular-nums">{r.network.toLocaleString()}</td>
                      <td className="px-3.5 text-slate-500">한전 단가표</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">거래수수료 (전력거래소)</td>
                      <td className={cn('px-3.5 tabular-nums', isGen && 'text-rose-700')}>
                        {isGen ? '−' : ''}
                        {r.tradeFee.toLocaleString()}
                      </td>
                      <td className="px-3.5 text-slate-500">{isGen ? '차감' : '청구'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">거래수수료 (전력공급거래)</td>
                      <td className={cn('px-3.5 tabular-nums', isGen && 'text-rose-700')}>
                        {isGen ? '−' : ''}
                        {r.supplyFee.toLocaleString()}
                      </td>
                      <td className="px-3.5 text-slate-500">{isGen ? '차감' : '청구'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">관리 수수료</td>
                      <td className={cn('px-3.5 tabular-nums', isGen && 'text-rose-700')}>
                        {isGen ? '−' : ''}
                        {r.manageFee.toLocaleString()}
                      </td>
                      <td className="px-3.5 text-slate-500">{isGen ? '차감' : '청구'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3.5">부가세 (10%)</td>
                      <td className="px-3.5 tabular-nums">{r.vat.toLocaleString()}</td>
                      <td className="px-3.5 text-slate-500">+ 10%</td>
                    </tr>
                    {!isGen && (
                      <tr className="border-b border-slate-200">
                        <td className="px-3.5">전력산업기반기금</td>
                        <td className="px-3.5 tabular-nums">{r.fund.toLocaleString()}</td>
                        <td className="px-3.5 text-slate-500">비과세 · 3.7%</td>
                      </tr>
                    )}
                    {adjTotal !== 0 && (
                      <tr className="border-b border-slate-200 bg-amber-50">
                        <td className="px-3.5">요금 조정</td>
                        <td className="px-3.5 tabular-nums">
                          {adjTotal >= 0 ? '+' : ''}
                          {adjTotal.toLocaleString()}
                        </td>
                        <td className="px-3.5 text-slate-500">{adj.reason || '—'}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <td className="px-3 py-2">{isGen ? '지급 합계' : '청구 합계'}</td>
                      <td className="px-3 py-2 tabular-nums text-base">₩ {total.toLocaleString()}</td>
                      <td className="px-3 py-2 text-[10px] text-slate-600">{toKoreanAmount(total)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="border border-slate-300 rounded p-3 text-xs mb-6">
                  <p className="font-semibold mb-1">■ {isGen ? '지급 정보' : '납부 정보'}</p>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">{isGen ? '지급 방식' : '납부 방식'}</span>
                    <span>{isGen ? '계좌이체' : '가상계좌·CMS'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">{isGen ? '입금 계좌' : '납부 계좌'}</span>
                    <span className="tabular-nums">기업 481-021726-97144 ((주)울산E-SPC)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">{isGen ? '지급 기한' : '납부 기한'}</span>
                    <span className="font-semibold text-rose-700">{dueDate}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  본 {isGen ? '통지서' : '청구서'}는 「전기사업법」 제16조 및 「전력거래 정산 운영규정」에 의거하여 위
                  정산 기간에 대한 {isGen ? '정산금' : 'PPA 사용대금'}을 {isGen ? '통지' : '청구'}하는 문서입니다.
                  이의가 있으시면 발행일로부터 7일 이내 서면으로 신청해 주시기 바랍니다.
                </p>

                <div className="text-center text-sm font-semibold mt-8">
                  <p className="mb-1">{issueDate}</p>
                  <p className="text-base mt-3">
                    (주)울산E-SPC 대표 김에너{' '}
                    <span className="inline-block ml-2 px-3 py-2 ring-1 ring-rose-300 rounded-full text-rose-600 text-[10px]">
                      (인)
                    </span>
                  </p>
                </div>
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Reusable bits
   ───────────────────────────────────────────── */
function _ValidationCard({
  title,
  a,
  b,
  diff,
  passed,
  threshold,
}: {
  title: string;
  a: { label: string; value: string };
  b: { label: string; value: string };
  diff: string;
  passed: boolean;
  threshold: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        passed ? 'border-emerald-500/[0.20] bg-emerald-500/[0.04]' : 'border-rose-500/[0.20] bg-rose-500/[0.04]',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        {passed ? (
          <span className="inline-flex items-center gap-1 text-emerald-300 text-[11px]">
            <CheckCircle2 size={11} />
            통과
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-rose-300 text-[11px]">
            <AlertCircle size={11} />
            실패
          </span>
        )}
      </div>
      <div className="space-y-1 mb-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">{a.label}</span>
          <span className="text-white tabular-nums">{a.value}</span>
        </div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">{b.label}</span>
          <span className="text-white tabular-nums">{b.value}</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <span className="text-[11px] text-slate-500">{threshold}</span>
        <span className={cn('text-sm font-bold tabular-nums', passed ? 'text-emerald-300' : 'text-rose-300')}>
          {diff}
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
}) {
  const map = {
    emerald: 'text-emerald-300 bg-emerald-500/[0.10]',
    amber: 'text-amber-300 bg-amber-500/[0.10]',
    rose: 'text-rose-300 bg-rose-500/[0.10]',
    blue: 'text-blue-300 bg-blue-500/[0.10]',
    violet: 'text-violet-300 bg-violet-500/[0.10]',
  };
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', map[tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white tabular-nums truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}
