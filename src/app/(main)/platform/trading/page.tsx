// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Building2,
  Factory,
  Handshake,
  AlertCircle,
  Search,
  ChevronRight,
  ChevronLeft,
  Mail,
  Clock,
  CheckCircle2,
  RotateCcw,
  Zap,
  Percent,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import {
  useTradingRequests,
  useAllTradingMatches,
  useUpdateRequestStatus,
  useCreateMatch,
} from '@/hooks/trading/useTrading';
import { useAvailableEquipments } from '@/hooks/lease/useLease';

/* ─────────────────────────────────────────────
   Tabs — 수용가 / 발전사업자
   ───────────────────────────────────────────── */
type Tab = 'consumer-req' | 'generator-req';

/* ─────────────────────────────────────────────
   거래 유형 (수용가 신청에 적용)
   PPA / 절감 셰어 (Lease) / 정액제 (Lease)
   ───────────────────────────────────────────── */
type DealType = 'offsite-ppa' | 'onsite-ppa' | 'savings-share';

const DEAL_TYPE_META: Record<DealType, { label: string; icon: any; tone: string; bg: string; ring: string }> = {
  'offsite-ppa': {
    label: '직접 PPA - Offsite PPA',
    icon: Zap,
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
    ring: 'ring-blue-500/30',
  },
  'onsite-ppa': {
    label: '직접 PPA - Onsite PPA',
    icon: Percent,
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
  },
  'savings-share': {
    label: '직접 PPA',
    icon: Sun,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ring: 'ring-violet-500/30',
  },
};

/* ─────────────────────────────────────────────
   발전사 등록 PPA 설비 카탈로그 — Lease 제안 작성 시 설치 설비 선택
   - Lease 보상 = 수익 분배율(%) — 단가(₩) 개념 없음
   - 설비 선택 → 해당 발전사 자동 배정 (단일 발전사 — 타 발전사 설비는 잠김)
   - 발전사가 자원관리에서 등록한 항목 (generator/ppa/resources/register 정합)
   TODO(API): 등록 PPA 설비 전체 조회 API 연결
   ───────────────────────────────────────────── */
const STATIC_LEASE_EQUIPMENT: {
  id: string;
  generator: string;
  kind: string;
  model: string;
  sharePct: number;
  negotiable: boolean;
  priceSub: string;
  installPeriod: string;
  photo: string | null;
  note: string;
}[] = [];

/* ─────────────────────────────────────────────
   백엔드 status enum — 모든 신청(수용가·발전사업자) 공통
   흐름: SUBMITTED → MATCHING → MATCHED (또는 CANCELLED)
   ───────────────────────────────────────────── */
// APPROVED: 자원 승인 완료·희망가 미기입 (mock — TODO(API): 백엔드 enum 협의)
type Status = 'SUBMITTED' | 'APPROVED' | 'MATCHING' | 'MATCHED' | 'CANCELLED';

// 백엔드 status → 한국어 라벨 + 색상 (badge·progress bar 양쪽 공용)
const STATUS_META: Record<Status, { label: string; bg: string; tone: string; ring: string }> = {
  SUBMITTED: { label: '신청 접수', bg: 'bg-rose-500/[0.10]', tone: 'text-rose-300', ring: 'ring-rose-500/30' },
  APPROVED: { label: '승인 완료', bg: 'bg-blue-500/[0.10]', tone: 'text-blue-300', ring: 'ring-blue-500/30' },
  MATCHING: { label: '매칭 중', bg: 'bg-amber-500/[0.10]', tone: 'text-amber-300', ring: 'ring-amber-500/30' },
  MATCHED: { label: '매칭 완료', bg: 'bg-emerald-500/[0.10]', tone: 'text-emerald-300', ring: 'ring-emerald-500/30' },
  CANCELLED: { label: '취소', bg: 'bg-slate-500/[0.10]', tone: 'text-slate-300', ring: 'ring-slate-500/30' },
};
// 진행 표시용 순서 (CANCELLED 제외)
const STATUSES: Status[] = ['SUBMITTED', 'MATCHING', 'MATCHED'];

// 발전사 자원 — notes 직렬화("자원: 태양광 / ...")에서 추출 (발전사 페이지 encodeResourceNotes 와 쌍)
const parseResourceFromNotes = (notes?: string): string => {
  const m = notes?.match(/자원:\s*([^/]+)/);
  return m?.[1]?.trim() ?? '태양광';
};

/* ─────────────────────────────────────────────
   수용가 신청 — 백엔드 TradingRequest 그대로 사용
   ───────────────────────────────────────────── */
interface ConsumerRequest {
  // ── 백엔드 TradingRequest 필드 (순서 동일) ──
  id: string;
  // requesterType: 미사용 (수용가 페이지라 'CONSUMER' 단일값으로 고정)
  // companyId:    미사용 (id로 충분)
  companyName: string;
  dealType: DealType;
  status: Status; // SUBMITTED, MATCHING, MATCHED, CANCELLED
  capacityKw: number;
  durationYears: number;
  desiredUnitPrice: number;
  region?: string; // 소재 지역 — Onsite 매칭 거리 기준점 (수용가 사업장 위치)
  // currentStep:  미사용 (status 로 충분)
  submittedAt: string;
  // createdAt:    submittedAt 의 fallback로만 사용
  // ── 매칭/제안 결과 (별도 API 필요) ──
  candidateCount?: number; // TODO: useTradingMatches 로 채울 예정
  confirmedCount?: number; // TODO: useTradingMatches 로 채울 예정
  notes?: string; // TODO: 매칭 결과 메모
}

/* ─────────────────────────────────────────────
   발전사업자 신청 — 백엔드 TradingRequest 그대로 (requesterType='GENERATOR')
   ConsumerRequest 와 동일 shape (백엔드가 같은 entity 로 주기 때문)
   TODO: useTradingRequests({ requesterType: 'GENERATOR' }) 로 연결 예정
   ───────────────────────────────────────────── */
interface GeneratorRequest {
  // ── 백엔드 TradingRequest 필드 (순서 동일) ──
  id: string;
  // requesterType: 미사용 (탭에서 'GENERATOR' 로 필터링 후 들어옴)
  companyId: number; // 매칭 생성(CreateTradingMatch.generatorCompanyId) 시 필요
  companyName: string; // 발전사 이름
  plantName?: string; // 공급 발전소 — 승인 검토 시 표시
  region?: string; // 소재 지역 — 승인 검토 시 표시
  dealType: DealType;
  status: Status;
  capacityKw: number;
  durationYears: number;
  desiredUnitPrice: number;
  // region:       미사용 (화면에 지역 컬럼 없음)
  // currentStep:  미사용 (status 로 충분)
  submittedAt: string;
  // createdAt:    submittedAt 의 fallback로만 사용
  // ── 매칭 결과 (별도 API 필요) ──
  candidateCount?: number;
  confirmedCount?: number;
  notes?: string;
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export default function PlatformTradingPage() {
  const router = useRouter();
  // 경로 분리 — /platform/ppa/resources = 자원관리(발전사업자), 그 외 = 거래관리(수용가)
  const pathname = usePathname();
  const mode: 'trading' | 'resources' = pathname.includes('/resources') ? 'resources' : 'trading';
  const [tab, setTab] = useState<Tab>(mode === 'resources' ? 'generator-req' : 'consumer-req');

  const { data: tradingData } = useTradingRequests({ page: 0, size: 200 });
  const storeRequests = ((tradingData as any)?.content ?? []) as any[];
  const { data: matchData } = useAllTradingMatches();
  const storeMatches = (matchData as any[]) ?? [];

  const { data: apiEquipments } = useAvailableEquipments();
  const GENERATOR_LEASE_EQUIPMENT = useMemo(() => {
    const raw = (apiEquipments as any[]) ?? [];
    if (raw.length > 0) {
      return raw.map((e: any) => ({
        id: String(e.id),
        generator: e.generatorCompanyName ?? '발전사',
        kind: e.equipmentType ?? '태양광 모듈',
        model: e.equipmentName ?? '',
        sharePct: e.sharePct ?? 30,
        negotiable: true,
        priceSub: '',
        installPeriod: '',
        photo: null as string | null,
        note: e.notes ?? '',
      }));
    }
    return STATIC_LEASE_EQUIPMENT;
  }, [apiEquipments]);

  // 백엔드 dealType enum → 프론트 DealType 매핑 (수요/발전 공통)
  // 백엔드는 Onsite/Offsite 구분 필드 없어 PPA → offsite-ppa 단일 매핑
  const dealTypeMap: Record<string, DealType> = {
    PPA: 'offsite-ppa',
    SAVINGS_SHARE: 'savings-share',
  };

  // 수용가 신청 — requesterType === 'CONSUMER'
  const apiRequests: ConsumerRequest[] = useMemo(() => {
    return (
      storeRequests
        // 체결 완료(FINALIZED·COMPLETED)·취소(CANCELLED) 건은 '거래 완료'로 이동 → 거래관리 목록에서 제외
        .filter(
          (r) =>
            r.status !== 'CANCELLED' &&
            r.status !== 'FINALIZED' &&
            r.status !== 'COMPLETED' &&
            r.requesterType !== 'GENERATOR',
        )
        .map(
          (r): ConsumerRequest => ({
            // 백엔드 TradingRequest 필드 순서 그대로 — 미사용 필드는 주석으로 자리 표시
            id: `api-${r.id}`,
            // r.requesterType — 미사용 (위에서 필터링)
            // r.companyId    — 미사용 (id로 충분)
            companyName: r.companyName,
            // 직접 PPA 는 mock 확장 ppaSubType 으로 Onsite/Offsite 분기
            dealType:
              r.dealType === 'PPA'
                ? r.ppaSubType === 'onsite'
                  ? 'onsite-ppa'
                  : 'offsite-ppa'
                : (dealTypeMap[r.dealType] ?? 'offsite-ppa'),
            status: r.status as Status,
            capacityKw: r.capacityKw,
            durationYears: r.durationYears,
            desiredUnitPrice: r.desiredUnitPrice ?? 0,
            region: r.region, // 소재 지역 — Onsite 매칭 거리 기준점
            // r.currentStep  — 미사용 (status 로 충분)
            submittedAt: (r.submittedAt ?? r.createdAt).slice(0, 10),
            // r.createdAt    — submittedAt 의 fallback로만 위에서 사용
            // ── 매칭 카운트 — 스토어 매칭에서 파생 (TODO(API): 별도 매칭 API 로 교체) ──
            candidateCount: storeMatches.filter((m) => m.requestId === r.id && m.status !== 'DECLINED').length,
            confirmedCount: storeMatches.filter((m) => m.requestId === r.id && m.status === 'ACCEPTED').length,
          }),
        )
    );
  }, [storeRequests, storeMatches]);

  // 발전사 신청 — requesterType === 'GENERATOR'
  // /generator/trading 페이지에서 SPC 로 보낸 공급 신청이 여기로 들어옴
  const apiGenRequests: GeneratorRequest[] = useMemo(() => {
    return storeRequests
      .filter((r) => r.status !== 'CANCELLED' && r.requesterType === 'GENERATOR')
      .map(
        (r): GeneratorRequest => ({
          // 백엔드 TradingRequest 필드 순서 그대로 — 미사용 필드는 주석으로 자리 표시
          id: `api-${r.id}`,
          // r.requesterType — 미사용 (위에서 필터링)
          companyId: r.companyId, // 매칭 생성 시 generatorCompanyId 로 사용
          companyName: r.companyName,
          plantName: r.plantName, // 공급 발전소 — 승인 검토 시 표시
          region: r.region, // 소재 지역 — 승인 검토 시 표시
          dealType: dealTypeMap[r.dealType] ?? 'offsite-ppa',
          status: r.status as Status,
          capacityKw: r.capacityKw,
          durationYears: r.durationYears,
          desiredUnitPrice: r.desiredUnitPrice ?? 0,
          // r.region       — 미사용
          // r.currentStep  — 미사용 (status 로 충분)
          submittedAt: (r.submittedAt ?? r.createdAt).slice(0, 10),
          // r.createdAt    — submittedAt 의 fallback로만 위에서 사용
          notes: r.notes, // 자원/사업자번호 직렬화 정보 (발전사 페이지에서 encodeResourceNotes 로 저장)
        }),
      );
  }, [storeRequests]);

  const REQUESTS: ConsumerRequest[] = apiRequests;
  const ALL_GEN_REQUESTS: GeneratorRequest[] = apiGenRequests;

  // 매칭 모달
  const [matchOpen, setMatchOpen] = useState<{ kind: 'consumer' | 'generator'; id: string } | null>(null);
  const [selectedCands, setSelectedCands] = useState<Set<string>>(new Set());
  const [candSearch, setCandSearch] = useState('');
  // SPC가 매칭 시점에 발전사업자별로 입력하는 거래수수료(전력공급거래) ₩/kWh
  const [candTradeFees, setCandTradeFees] = useState<Record<string, string>>({});
  const getCandFee = (id: string) => candTradeFees[id] ?? '1.0';
  const setCandFee = (id: string, v: string) => setCandTradeFees((prev) => ({ ...prev, [id]: v }));
  // SPC 가 협상 시점에 후보별로 입력하는 제안 단가 (₩/kWh)
  // 기본값 = 양측 희망 단가의 중간값. SPC 가 수정 가능. 매칭 누르면 발전사로 먼저 전달.
  const [candProposedPrices, setCandProposedPrices] = useState<Record<string, string>>({});
  const getCandProposedPrice = (candId: string, candPrice: number, reqPrice: number) => {
    if (candProposedPrices[candId] != null) return candProposedPrices[candId];
    if (candPrice && reqPrice) return String(Math.round(((candPrice + reqPrice) / 2) * 10) / 10);
    return String(candPrice || reqPrice || '');
  };
  const setCandProposedPrice = (id: string, v: string) => setCandProposedPrices((prev) => ({ ...prev, [id]: v }));
  // SPC 협상 메모 — 양측에 함께 전달 (예: "단가 조율 사유, 부지 조건 등")
  const [matchNote, setMatchNote] = useState('');

  // 공급 신청 승인 모달 — 자원/조건 점검 후 승인 확정 또는 반려(사유 필수)
  const [approvalTarget, setApprovalTarget] = useState<GeneratorRequest | null>(null);
  const [approvalRejectReason, setApprovalRejectReason] = useState('');
  const updateRequestStatusMut = useUpdateRequestStatus();
  const createMatchMut = useCreateMatch();
  // GeneratorRequest.id 는 'api-${원본 id}' 형태 — 실 API 호출용 숫자 id 복원
  const toRequestId = (id: string) => Number(String(id).replace(/^api-/, ''));
  const closeApproval = () => {
    setApprovalTarget(null);
    setApprovalRejectReason('');
  };

  // 재제안 모달 — 거절된 매칭에 SPC가 새 단가/메모로 재제안
  const [resubmitTarget, setResubmitTarget] = useState<{ request: any; declinedMatch: any } | null>(null);
  const [resubmitPrice, setResubmitPrice] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');
  const closeResubmit = () => {
    setResubmitTarget(null);
    setResubmitPrice('');
    setResubmitNote('');
  };

  // 신규 신청 알림 모달 (페이지 진입 시 자동 표시)
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const newRequests = useMemo(() => {
    const consumerNew = REQUESTS.filter((r) => r.status === 'SUBMITTED').map((r) => ({
      id: r.id,
      kind: 'consumer' as const,
      party: r.companyName,
      dealType: r.dealType,
      capacity: `${r.capacityKw} kW`,
      submittedAt: r.submittedAt,
    }));
    const generatorNew = ALL_GEN_REQUESTS.filter((g) => g.status === 'SUBMITTED').map((g) => ({
      id: g.id,
      kind: 'generator' as const,
      party: g.companyName,
      dealType: 'offsite-ppa' as DealType,
      capacity: `${g.capacityKw.toLocaleString()} kW`,
      submittedAt: g.submittedAt,
    }));
    return [...consumerNew, ...generatorNew].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [REQUESTS, ALL_GEN_REQUESTS]);

  useEffect(() => {
    // 신규 신청 알림 자동 표시 비활성화 (편의상 처리 완료 상태)
  }, [newRequests.length]);

  // 직접 PPA(수익 셰어) — 제안 작성 모달 (2단계: ①설비 선택 → ②계약 항목)
  const [shareEditing, setShareEditing] = useState<ConsumerRequest | null>(null);
  const [shareStep, setShareStep] = useState<1 | 2>(1);
  // 설비/용량 기반 월 발전 수익 자동 산정 — 용량 × 3.6h/day × 30일 × 회피단가(185원)
  const estimateMonthlyRevenue = (capacityKw: number) => Math.round(capacityKw * 3.6 * 30 * 185);
  const [shareForm, setShareForm] = useState({
    assignedGenerator: '',
    equipIds: [] as string[], // 설치 설비 — 발전사 등록 PPA 설비에서 선택 (발전사 자동 배정)
    installCapacityKw: '',
    installCostKrw: '', // 발전사 부담 설치 비용 (참고)
    sharePct: 30, // 발전사 받는 셰어 % (0~100)
    contractYears: '15',
    estSavingsPerMonth: '6000000', // 예상 월 절감액 (SPC가 부지 평가 후 산정)
    tradeFeeSupplyKwh: '1.0', // 거래수수료(전력공급거래) ₩/kWh — SPC 입력
  });
  const resetShareForm = () =>
    setShareForm({
      assignedGenerator: '',
      equipIds: [],
      installCapacityKw: '',
      installCostKrw: '',
      sharePct: 30,
      contractYears: '15',
      estSavingsPerMonth: '', // step2 진입 시 용량 기반 자동 산정
      tradeFeeSupplyKwh: '1.0',
    });
  // 설비 토글 — 설비를 고르면 해당 발전사 자동 배정, 분배율도 설비 희망값으로 제안 (전부 해제 시 초기화)
  const toggleShareEquip = (id: string) => {
    setShareForm((f) => {
      const has = f.equipIds.includes(id);
      const nextIds = has ? f.equipIds.filter((x) => x !== id) : [...f.equipIds, id];
      const firstEq = GENERATOR_LEASE_EQUIPMENT.find((e) => e.id === nextIds[0]);
      return {
        ...f,
        equipIds: nextIds,
        assignedGenerator: firstEq?.generator ?? '',
        sharePct: firstEq ? firstEq.sharePct : f.sharePct,
      };
    });
  };
  // 현재 선택으로 배정된 발전사 — 타 발전사 설비 잠금 (Lease = 단일 발전사)
  const shareSelectedGenerator =
    shareForm.equipIds.length > 0
      ? (GENERATOR_LEASE_EQUIPMENT.find((e) => e.id === shareForm.equipIds[0])?.generator ?? null)
      : null;
  const sharePreview = useMemo(() => {
    const saved = Number(shareForm.estSavingsPerMonth) || 0;
    const share = Math.round((saved * shareForm.sharePct) / 100);
    const net = saved - share;
    return { saved, share, net };
  }, [shareForm.estSavingsPerMonth, shareForm.sharePct]);
  const shareValid =
    !!shareForm.assignedGenerator &&
    shareForm.equipIds.length > 0 &&
    Number(shareForm.installCapacityKw) > 0 &&
    Number(shareForm.installCostKrw) > 0 &&
    Number(shareForm.estSavingsPerMonth) > 0;

  // 정액제 — 제안 작성 (별첨) 모달
  const [annexEditing, setAnnexEditing] = useState<ConsumerRequest | null>(null);
  const [annexForm, setAnnexForm] = useState({
    assignedGenerator: '',
    capacityKw: '',
    warrantyHours: '3.6', // 일 평균 발전보증시간 (h/day)
    degradationPct: '0.5', // 매년 효율 감소율 (%)
    equipIds: [] as string[], // 설치 설비 — 발전사 등록 PPA 설비에서 선택 (다중)
    yearlyRates: Array(20).fill('110') as string[], // 연도별 단가 (index 0 = 1년차)
    year1DamageKrw: '60000000', // 1년차 손해금액 (₩)
    annualDamageDecrease: '2000000', // 연 손해액 감소액 (₩)
    contractYears: '20',
    tradeFeeSupplyKwh: '1.0', // 거래수수료(전력공급거래) ₩/kWh — SPC 입력
  });
  const resetAnnexForm = () =>
    setAnnexForm({
      assignedGenerator: '',
      capacityKw: '',
      warrantyHours: '3.6',
      degradationPct: '0.5',
      equipIds: [],
      yearlyRates: Array(20).fill('110'),
      year1DamageKrw: '60000000',
      annualDamageDecrease: '2000000',
      contractYears: '20',
      tradeFeeSupplyKwh: '1.0',
    });
  // 설비 토글 — 설비를 선택하면 해당 발전사가 자동 배정 (전부 해제하면 배정 해제)
  // 단일 발전사 원칙: 이미 선택된 설비와 다른 발전사의 설비는 카드에서 잠김 처리
  const toggleAnnexEquip = (id: string) => {
    setAnnexForm((f) => {
      const has = f.equipIds.includes(id);
      const nextIds = has ? f.equipIds.filter((x) => x !== id) : [...f.equipIds, id];
      const nextGen =
        nextIds.length > 0 ? (GENERATOR_LEASE_EQUIPMENT.find((e) => e.id === nextIds[0])?.generator ?? '') : '';
      return { ...f, equipIds: nextIds, assignedGenerator: nextGen };
    });
  };
  // 현재 선택으로 배정된 발전사 — 타 발전사 설비 잠금 판단용
  const annexSelectedGenerator =
    annexForm.equipIds.length > 0
      ? (GENERATOR_LEASE_EQUIPMENT.find((e) => e.id === annexForm.equipIds[0])?.generator ?? null)
      : null;

  // 연도별 단가 그리드 접기/펴기
  const [yearlyRatesExpanded, setYearlyRatesExpanded] = useState(false);
  // 연도별 단가 — 빠른 채우기: 1년차 값으로 전체 동일
  const fillYearlyRatesEqual = () => {
    setAnnexForm((f) => ({ ...f, yearlyRates: f.yearlyRates.map(() => f.yearlyRates[0] || '110') }));
  };
  const updateYearlyRate = (idx: number, value: string) => {
    setAnnexForm((f) => {
      const next = [...f.yearlyRates];
      next[idx] = value;
      return { ...f, yearlyRates: next };
    });
  };
  // contractYears 변경 시 yearlyRates 배열 길이 동기화
  const setContractYears = (val: string) => {
    setAnnexForm((f) => {
      const n = Math.max(1, Math.min(40, Number(val) || 0));
      const cur = f.yearlyRates;
      let next = cur;
      if (n > cur.length) next = [...cur, ...Array(n - cur.length).fill(cur[cur.length - 1] || '110')];
      else if (n < cur.length) next = cur.slice(0, n);
      return { ...f, contractYears: val, yearlyRates: next };
    });
  };

  // 별첨 자동 계산 미리보기
  const annexPreview = useMemo(() => {
    const cap = Number(annexForm.capacityKw) || 0;
    const hours = Number(annexForm.warrantyHours) || 0;
    const deg = Number(annexForm.degradationPct) || 0;
    const year1Damage = Number(annexForm.year1DamageKrw) || 0;
    const damageDec = Number(annexForm.annualDamageDecrease) || 0;
    const totalYears = Number(annexForm.contractYears) || 20;
    const year1Rate = Number(annexForm.yearlyRates[0]) || 0;

    // 월 발전량 = 용량 × 일 발전보증시간 × 365 ÷ 12
    const year1MonthlyKwh = Math.round((cap * hours * 365) / 12);
    const year1MonthlyRent = Math.round(year1MonthlyKwh * year1Rate);

    const yearly: { year: number; kwhPerMonth: number; rate: number; rent: number; damage: number }[] = [];
    for (let y = 1; y <= Math.min(40, totalYears); y++) {
      const degFactor = Math.pow(1 - deg / 100, y - 1);
      const kwh = Math.round(((cap * hours * 365) / 12) * degFactor);
      const rate = Number(annexForm.yearlyRates[y - 1]) || year1Rate;
      const rent = Math.round(kwh * rate);
      const damage = Math.max(0, year1Damage - damageDec * (y - 1));
      yearly.push({ year: y, kwhPerMonth: kwh, rate, rent, damage });
    }
    return { year1MonthlyKwh, year1MonthlyRent, yearly };
  }, [annexForm]);

  const annexValid =
    !!annexForm.assignedGenerator &&
    Number(annexForm.capacityKw) > 0 &&
    annexForm.equipIds.length > 0 &&
    Number(annexForm.yearlyRates[0]) > 0 &&
    Number(annexForm.year1DamageKrw) > 0;

  const matchedConsumerReq = matchOpen?.kind === 'consumer' ? REQUESTS.find((r) => r.id === matchOpen.id) : null;
  const matchedGenReq = matchOpen?.kind === 'generator' ? ALL_GEN_REQUESTS.find((g) => g.id === matchOpen.id) : null;

  // 후보 — 추천/필터 없이 전체 풀, 검색만 지원
  const matchCandidates = useMemo(() => {
    const q = candSearch.trim().toLowerCase();
    if (matchedConsumerReq) {
      // 발전사 후보 풀 — SPC 승인(APPROVED) 또는 희망가 기입 완료(MATCHING)된 발전소
      return ALL_GEN_REQUESTS.filter((g) => g.status === 'MATCHING' || g.status === 'APPROVED')
        .map((g) => ({
          id: g.id,
          generatorCompanyId: g.companyId, // 매칭 생성 시 필요
          capacityKw: g.capacityKw, // 매칭 생성 시 필요 (raw number)
          title: g.companyName,
          capacity: `${g.capacityKw.toLocaleString()} kW`,
          price: g.desiredUnitPrice,
          duration: g.durationYears,
          submittedAt: g.submittedAt,
          // 위치·거리 — Onsite 매칭 판단용 (한전 망 미사용 → 인접 필수)
          // TODO(API): 발전소 좌표 ↔ 수용가 사업장 좌표 실거리 계산으로 교체
          region: g.region || '울산 울주군',
          distanceKm: Math.round(((Number(String(g.id).replace(/\D/g, '') || 3) % 7) * 0.8 + 0.4) * 10) / 10,
        }))
        .filter((c) => !q || c.title.toLowerCase().includes(q));
    }
    if (matchedGenReq) {
      return REQUESTS.map((r) => ({
        id: r.id,
        title: r.companyName,
        region: '',
        capacity: `${r.capacityKw.toLocaleString()} kW`,
        annualKwh: '',
        price: r.desiredUnitPrice,
        rec: undefined as boolean | undefined,
        submittedAt: r.submittedAt,
        duration: r.durationYears,
        dealType: r.dealType,
      })).filter((c) => !q || c.title.toLowerCase().includes(q));
    }
    return [];
  }, [matchedConsumerReq, matchedGenReq, candSearch]);

  // 매칭 모달 액션 — 현재 status 기준 (백엔드 status enum)
  const currentStatus: Status | undefined = matchedConsumerReq?.status ?? matchedGenReq?.status;
  const isLeaseFlow = matchedConsumerReq?.dealType === 'savings-share';
  // Onsite 매칭 — 한전 망 미사용: 인접 발전소만 가능 → 위치·거리 표시
  const isOnsiteMatch = matchedConsumerReq?.dealType === 'onsite-ppa';
  const matchActionLabel = currentStatus === 'SUBMITTED' ? (isLeaseFlow ? '평가 시작' : '매칭') : '';
  const matchActionDisabled = !!matchActionLabel && selectedCands.size === 0;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: mode === 'resources' ? '자원 관리' : '거래 현황' }]} />

      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{mode === 'resources' ? '자원 관리' : '거래 현황'}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'resources' ? (
              <>발전사업자 공급 자원 등록 승인 · 매칭 풀 관리 — 승인된 자원은 수용가 매칭에 사용됩니다</>
            ) : (
              <>
                수용가 신청 매칭 처리 — 매칭 완료 후 계약은{' '}
                <button
                  onClick={() => router.push('/platform/ppa/status')}
                  className="text-primary hover:text-primary/80 underline-offset-2 hover:underline"
                >
                  거래현황
                </button>
                으로 이동
              </>
            )}
          </p>
        </div>
      </div>

      {/* ─────────────────── 수용가 (거래관리) ─────────────────── */}
      {mode === 'trading' && (
        <div className="space-y-5">
          {/* 거래 유형별 단계 카운트 — 톤 통일 (배경 neutral, 아이콘만 컬러) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {(['offsite-ppa', 'onsite-ppa', 'savings-share'] as DealType[]).map((dt) => {
              const meta = DEAL_TYPE_META[dt];
              const Icon = meta.icon;
              const dtRequests = REQUESTS.filter((r) => r.dealType === dt);
              return (
                <div key={dt} className="rounded-xl border border-white/[0.06] bg-surface-card px-4 py-3">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', meta.bg)}>
                        <Icon size={12} className={meta.tone} />
                      </span>
                      <p className="text-sm font-semibold text-white">{meta.label}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      <span className="text-white font-bold tabular-nums">{dtRequests.length}</span>건
                    </p>
                  </div>
                  {/* 단계 — 백엔드 status 기준 (SUBMITTED → MATCHING → MATCHED) */}
                  <div className="flex items-stretch gap-1">
                    {STATUSES.map((s, i) => {
                      const sMeta = STATUS_META[s];
                      const cnt = dtRequests.filter((r) => r.status === s).length;
                      const active = cnt > 0;
                      return (
                        <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
                          <div
                            className={cn(
                              'rounded-md px-2 py-2 flex-1 min-w-0 text-center ring-1',
                              active ? 'bg-white/[0.04] ring-white/[0.08]' : 'bg-transparent ring-white/[0.04]',
                            )}
                          >
                            <p className={cn('text-[10px] truncate', active ? 'text-slate-400' : 'text-slate-600')}>
                              {sMeta.label}
                            </p>
                            <p
                              className={cn(
                                'text-lg font-bold tabular-nums leading-tight mt-0.5',
                                active ? 'text-white' : 'text-slate-700',
                              )}
                            >
                              {cnt}
                            </p>
                          </div>
                          {i < STATUSES.length - 1 && <ChevronRight size={10} className="text-slate-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 안내 */}
          <div className="rounded-lg bg-violet-500/[0.06] ring-1 ring-violet-500/30 px-4 py-3 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-violet-300" />
            <div className="text-xs text-slate-300">
              <p className="text-violet-200 font-medium">
                PPA: 신청 → SPC 매칭 → 승인 대기 → 매칭 완료 (다대다 후보 선정)
              </p>
              <p className="text-violet-200 font-medium mt-0.5">
                Lease: 신청 → 부지·시설 평가 → 계약 체결 (단일 발전사 배정)
              </p>
            </div>
          </div>

          {/* 요청 리스트 — 유형 컬럼 추가 */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-md font-semibold text-white">요청 목록 ({REQUESTS.length}건)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-4 py-2 text-left font-medium">거래번호</th>
                    <th className="px-4 py-2 text-left font-medium">접수일</th>
                    <th className="px-4 py-2 text-left font-medium">수용가</th>
                    <th className="px-4 py-2 text-left font-medium">유형</th>
                    <th className="px-4 py-2 font-medium">용량</th>
                    <th className="px-4 py-2 font-medium">희망 단가</th>
                    <th className="px-4 py-2 font-medium">기간</th>
                    <th className="px-4 py-2 text-left font-medium">상태</th>
                    <th className="px-4 py-2 font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {REQUESTS.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                        등록된 거래 요청이 없습니다
                      </td>
                    </tr>
                  )}
                  {[...REQUESTS]
                    .sort((a, b) => {
                      // 정렬: 거절(재매칭) → 신청 접수 → 매칭 중 → 매칭 완료
                      const ord = (r: any) => {
                        const id = Number(String(r.id).replace('api-', ''));
                        if (storeMatches.some((m) => m.requestId === id && m.status === 'DECLINED')) return 0;
                        if (r.status === 'SUBMITTED') return 1;
                        if (r.status === 'MATCHING') return 2;
                        return 3;
                      };
                      return ord(a) - ord(b);
                    })
                    .map((r) => {
                      const typeMeta = DEAL_TYPE_META[r.dealType];
                      const TypeIcon = typeMeta.icon;
                      // Offsite/Onsite PPA = 매칭 흐름 (Onsite 는 한전 망 미사용 — 인접 발전소 매칭), Lease = 제안 작성(수익 셰어) 흐름
                      const isPpa = r.dealType !== 'savings-share';
                      // 거절된 매칭 — 재매칭 필요 (SPC 액션 필요)
                      const reqBackendId = Number(String(r.id).replace('api-', ''));
                      const declinedMatch = storeMatches.find(
                        (m) => m.requestId === reqBackendId && m.status === 'DECLINED',
                      );
                      return (
                        <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-xs text-slate-300 tabular-nums font-medium">{reqBackendId}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                            {r.submittedAt?.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium text-sm">{r.companyName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 w-fit',
                                typeMeta.bg,
                                typeMeta.tone,
                                typeMeta.ring,
                              )}
                            >
                              <TypeIcon size={10} className="mr-1" />
                              {typeMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">{r.capacityKw} kW</td>
                          <td className="px-4 py-3 text-slate-300 tabular-nums">
                            {r.dealType === 'savings-share' ? (
                              <span className="text-slate-500 text-xs">분배율 — 제안 시 결정</span>
                            ) : r.desiredUnitPrice ? (
                              <>₩{r.desiredUnitPrice}/kWh</>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 tabular-nums">{r.durationYears}년</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5 max-w-[260px]">
                              {declinedMatch ? (
                                <>
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 w-fit bg-rose-500/[0.10] text-rose-300 ring-rose-500/30">
                                    거절 — 재매칭 필요
                                  </span>
                                  <span className="text-[10px] text-rose-200/80">
                                    {declinedMatch.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'} ·{' '}
                                    {declinedMatch.generatorCompanyName}
                                  </span>
                                  <span
                                    className="text-[10px] text-slate-400 leading-snug"
                                    title={declinedMatch.declineReason}
                                  >
                                    사유: {declinedMatch.declineReason}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 w-fit',
                                      STATUS_META[r.status]
                                        ? cn(
                                            STATUS_META[r.status].bg,
                                            STATUS_META[r.status].tone,
                                            STATUS_META[r.status].ring,
                                          )
                                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.06]',
                                    )}
                                  >
                                    {STATUS_META[r.status]?.label ?? r.status}
                                  </span>
                                  {r.candidateCount !== undefined && (
                                    <span className="text-[10px] text-slate-500">
                                      후보 {r.candidateCount}곳
                                      {r.confirmedCount !== undefined && ` · 확정 ${r.confirmedCount}곳`}
                                    </span>
                                  )}
                                  {r.notes && <span className="text-[10px] text-amber-300">{r.notes}</span>}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-end gap-1">
                              {/* 매칭 진입 일원화 — 모달 폐기, 모두 거래 상세(/trading/deal)에서 매칭/진행 */}
                              {isPpa && (r.status === 'SUBMITTED' || declinedMatch) ? (
                                <Button
                                  size="sm"
                                  variant={declinedMatch ? 'danger' : 'primary'}
                                  onClick={() => router.push(`/trading/deal/${toRequestId(r.id)}`)}
                                >
                                  {declinedMatch ? '재매칭' : '매칭하기'}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => router.push(`/trading/deal/${toRequestId(r.id)}`)}
                                >
                                  거래 진행하기
                                </Button>
                              )}
                              {isPpa && r.status === 'MATCHING' && !declinedMatch && (
                                <span className="text-[11px] text-amber-300">대기 중</span>
                              )}
                              {isPpa && r.status === 'MATCHED' && (
                                <span className="text-[11px] text-emerald-300">완료</span>
                              )}
                              {/* 직접 PPA 제안서 작성은 거래 상세(/trading/deal)의 '내 액션'에서 진행 — 별도 모달 폐기 */}
                              {r.dealType === 'savings-share' && declinedMatch && (
                                <span className="text-[11px] text-rose-300">재제안 필요</span>
                              )}
                              {!isPpa && r.status === 'MATCHING' && !declinedMatch && (
                                <span className="text-[11px] text-amber-300">대기 중</span>
                              )}
                              {!isPpa && r.status === 'MATCHED' && (
                                <span className="text-[11px] text-emerald-300">체결 완료</span>
                              )}
                              {r.status === 'CANCELLED' && <span className="text-[11px] text-slate-500">취소됨</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── 발전사업자 (자원관리) ─────────────────── */}
      {mode === 'resources' && (
        <div className="space-y-5">
          {/* 단계 카운트 카드들 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* 자원 등록 승인 — SPC 액션 필요 (강조) */}
            {(() => {
              const pendingApprovalCount = ALL_GEN_REQUESTS.filter((g) => g.status === 'SUBMITTED').length;
              return (
                <div
                  className={cn(
                    'rounded-xl px-4 py-3 ring-1',
                    pendingApprovalCount > 0
                      ? 'border border-amber-500/30 bg-amber-500/[0.06] ring-amber-500/30'
                      : 'border border-white/[0.06] bg-surface-card ring-white/[0.06]',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-md',
                          pendingApprovalCount > 0 ? 'bg-amber-500/[0.15]' : 'bg-white/[0.04]',
                        )}
                      >
                        <AlertCircle
                          size={12}
                          className={pendingApprovalCount > 0 ? 'text-amber-300' : 'text-slate-500'}
                        />
                      </span>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          pendingApprovalCount > 0 ? 'text-white' : 'text-slate-400',
                        )}
                      >
                        자원 등록 승인
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      pendingApprovalCount > 0 ? 'text-amber-300' : 'text-slate-600',
                    )}
                  >
                    {pendingApprovalCount}
                    <span className="text-xs font-normal ml-0.5">건</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {pendingApprovalCount > 0 ? 'SPC 검토 필요' : '신규 등록 없음'}
                  </p>
                </div>
              );
            })()}

            {/* PPA 카드 */}
            <div className="rounded-xl border border-white/[0.06] bg-surface-card px-4 py-3 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md',
                      DEAL_TYPE_META['offsite-ppa'].bg,
                    )}
                  >
                    <Zap size={12} className={DEAL_TYPE_META['offsite-ppa'].tone} />
                  </span>
                  <p className="text-sm font-semibold text-white">PPA 공급</p>
                </div>
                <p className="text-xs text-slate-400">
                  <span className="text-white font-bold tabular-nums">{ALL_GEN_REQUESTS.length}</span>건
                </p>
              </div>
              <div className="flex items-stretch gap-1">
                {STATUSES.map((s, i) => {
                  const sMeta = STATUS_META[s];
                  const cnt = ALL_GEN_REQUESTS.filter((g) => g.status === s).length;
                  const active = cnt > 0;
                  return (
                    <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
                      <div
                        className={cn(
                          'rounded-md px-2 py-2 flex-1 min-w-0 text-center ring-1',
                          active ? 'bg-white/[0.04] ring-white/[0.08]' : 'bg-transparent ring-white/[0.04]',
                        )}
                      >
                        <p className={cn('text-[10px] truncate', active ? 'text-slate-400' : 'text-slate-600')}>
                          {sMeta.label}
                        </p>
                        <p
                          className={cn(
                            'text-lg font-bold tabular-nums leading-tight mt-0.5',
                            active ? 'text-white' : 'text-slate-700',
                          )}
                        >
                          {cnt}
                        </p>
                      </div>
                      {i < STATUSES.length - 1 && <ChevronRight size={10} className="text-slate-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lease 비활성 안내 */}
            <div className="rounded-xl border border-white/[0.06] bg-surface-card px-4 py-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                <Sun size={14} className="text-slate-500" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-400">Lease는 수용가 주도</p>
                <p className="mt-0.5 text-xs text-slate-400">발전사는 PPA만 신청 가능</p>
              </div>
            </div>
          </div>

          {/* 안내 — 공급 신청은 매칭이 아니라 승인 프로세스 */}
          <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/30 px-4 py-3 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="text-xs text-slate-300">
              <p className="text-amber-200 font-medium">
                ① 자원 등록 → ② SPC 승인 → ③ 희망가격 기입(발전사) → 매칭 풀 → 수용가 매칭 → 계약
              </p>
              <p className="text-slate-400 mt-0.5">
                승인 + 희망가격 기입 완료된 발전소만 매칭 후보 풀에 등록됩니다. 매칭은 거래관리에서 진행.
              </p>
            </div>
          </div>

          {/* ───── 1) 자원 등록 승인 — SPC 액션 영역 (SUBMITTED만) ───── */}
          {(() => {
            const pendingList = ALL_GEN_REQUESTS.filter((g) => g.status === 'SUBMITTED');
            return (
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                  <h3 className="text-md font-semibold text-white">자원 등록 승인 ({pendingList.length}건)</h3>
                  <p className="text-[11px] text-slate-500">SPC 검토가 필요한 신규 등록</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                        <th className="px-4 py-2 text-left font-medium">등록일</th>
                        <th className="px-4 py-2 text-left font-medium">발전사</th>
                        <th className="px-4 py-2 text-left font-medium">용량</th>
                        <th className="px-4 py-2 text-left font-medium">승인</th>
                        <th className="px-4 py-2 text-left font-medium">처리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                            승인 대기 중인 자원 등록이 없습니다
                          </td>
                        </tr>
                      ) : (
                        pendingList.map((g) => (
                          <tr key={g.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                              {g.submittedAt?.slice(0, 10)}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white font-medium text-sm">{g.companyName}</p>
                              <p className="text-[11px] text-slate-500">
                                {g.plantName ?? '—'} · {parseResourceFromNotes(g.notes)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                              {g.capacityKw.toLocaleString()} kW
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-amber-500/[0.10] text-amber-300 ring-amber-500/30">
                                승인 대기
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  setApprovalTarget(g);
                                  setApprovalRejectReason('');
                                }}
                              >
                                승인 검토
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ───── 2) 매칭 풀·거래 진행 — 모니터링 영역 (APPROVED/MATCHING/MATCHED) ───── */}
          {(() => {
            const tradeList = ALL_GEN_REQUESTS.filter((g) => g.status !== 'SUBMITTED' && g.status !== 'CANCELLED');
            return (
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                  <h3 className="text-md font-semibold text-white">매칭 풀·거래 진행 ({tradeList.length}건)</h3>
                  <p className="text-[11px] text-slate-500">승인된 자원의 매칭/거래 모니터링</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                        <th className="px-4 py-2 text-left font-medium">등록일</th>
                        <th className="px-4 py-2 text-left font-medium">발전사</th>
                        <th className="px-4 py-2 text-left font-medium">용량</th>
                        <th className="px-4 py-2 text-left font-medium">희망 단가</th>
                        <th className="px-4 py-2 text-left font-medium">거래</th>
                        <th className="px-4 py-2 text-left font-medium">처리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                            매칭 풀에 등록된 자원이 없습니다
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          // 정렬: 거절(재매칭 필요) → 매칭 진행 → 매칭 대기/희망가 기입 → 체결 완료
                          const orderOf = (g: any) => {
                            const ms = storeMatches.filter(
                              (m) => m.generatorRequestId === Number(String(g.id).replace('api-', '')),
                            );
                            if (ms.some((m) => m.status === 'DECLINED')) return 0;
                            if (ms.some((m) => m.status === 'PROPOSED' || m.status === 'GEN_ACCEPTED')) return 1;
                            if (g.status === 'MATCHED' || ms.some((m) => m.status === 'ACCEPTED')) return 3;
                            return 2;
                          };
                          const sorted = [...tradeList].sort((a, b) => orderOf(a) - orderOf(b));
                          return sorted.map((g) => {
                            const gMatches = storeMatches.filter(
                              (m) => m.generatorRequestId === Number(String(g.id).replace('api-', '')),
                            );
                            const hasAccepted = gMatches.some((m) => m.status === 'ACCEPTED');
                            const declined = gMatches.find((m) => m.status === 'DECLINED');
                            const inProgress = gMatches.filter(
                              (m) => m.status === 'PROPOSED' || m.status === 'GEN_ACCEPTED',
                            ).length;
                            // 매칭의 직접 PPA 하위 유형 (Onsite/Offsite) — 표시용
                            const activeMatch =
                              gMatches.find((m) => m.status === 'PROPOSED' || m.status === 'GEN_ACCEPTED') ??
                              gMatches.find((m) => m.status === 'ACCEPTED') ??
                              declined;
                            const subTypeLabel =
                              activeMatch?.ppaSubType === 'onsite'
                                ? 'Onsite PPA'
                                : activeMatch?.ppaSubType === 'offsite'
                                  ? 'Offsite PPA'
                                  : null;
                            const subTypeBadge = subTypeLabel && (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 w-fit',
                                  activeMatch?.ppaSubType === 'onsite'
                                    ? 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30'
                                    : 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30',
                                )}
                              >
                                {subTypeLabel}
                              </span>
                            );
                            return (
                              <tr key={g.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                                  {g.submittedAt?.slice(0, 10)}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-white font-medium text-sm">{g.companyName}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {g.plantName ?? '—'} · {parseResourceFromNotes(g.notes)}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                                  {g.capacityKw.toLocaleString()} kW
                                </td>
                                <td className="px-4 py-3 text-slate-300 tabular-nums">
                                  {g.desiredUnitPrice > 0 ? (
                                    <>₩{g.desiredUnitPrice}/kWh</>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {declined ? (
                                    <div className="flex flex-col gap-0.5 max-w-[260px]">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 w-fit bg-rose-500/[0.10] text-rose-300 ring-rose-500/30">
                                          거절 — 재매칭 필요
                                        </span>
                                        {subTypeBadge}
                                      </div>
                                      <span className="text-[10px] text-rose-200/80">
                                        {declined.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'}
                                      </span>
                                      <span className="text-[10px] text-slate-400 leading-snug">
                                        사유: {declined.declineReason}
                                      </span>
                                    </div>
                                  ) : g.status === 'APPROVED' ? (
                                    <span className="text-slate-400">희망가 기입 대기</span>
                                  ) : hasAccepted || g.status === 'MATCHED' ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-emerald-300">계약 체결</span>
                                      {subTypeBadge}
                                    </div>
                                  ) : inProgress > 0 ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-amber-300">매칭 진행 {inProgress}건</span>
                                      {subTypeBadge}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">매칭 대기</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {declined ? (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => {
                                        setResubmitTarget({ request: g, declinedMatch: declined });
                                        setResubmitPrice(String(declined.proposedPriceKrw ?? ''));
                                        setResubmitNote('');
                                      }}
                                    >
                                      재제안
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-slate-500">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─────────────────── 매칭 모달 ─────────────────── */}
      {matchOpen && (matchedConsumerReq || matchedGenReq) && (
        <Modal
          open={!!matchOpen}
          onClose={() => {
            setMatchOpen(null);
            setSelectedCands(new Set());
            setCandSearch('');
            setCandTradeFees({});
          }}
          title={
            matchOpen.kind === 'consumer'
              ? `${DEAL_TYPE_META[matchedConsumerReq!.dealType].label} 매칭 — ${matchedConsumerReq!.companyName}`
              : `PPA 공급 매칭 — ${matchedGenReq!.companyName}`
          }
          size="xl"
        >
          {/* 이전 거절 정보 — 재매칭인 경우 표시 */}
          {matchedConsumerReq &&
            (() => {
              const prevDeclined = storeMatches.find(
                (m) =>
                  m.requestId === Number(String(matchedConsumerReq.id).replace('api-', '')) && m.status === 'DECLINED',
              );
              if (!prevDeclined) return null;
              return (
                <div className="rounded-lg ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-4 py-3 mb-4">
                  <p className="text-xs text-rose-200 font-medium mb-1">
                    이전 매칭 거절 — {prevDeclined.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'} (
                    {prevDeclined.generatorCompanyName} · ₩{prevDeclined.proposedPriceKrw}/kWh)
                  </p>
                  <p className="text-xs text-slate-300">사유: {prevDeclined.declineReason}</p>
                </div>
              );
            })()}

          {/* 신청 요약 */}
          <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4 mb-4">
            <p className="text-xs font-semibold text-slate-300 mb-3">
              {matchOpen.kind === 'consumer' ? '수용가 신청 요약' : '발전사업자 신청 요약'}
            </p>
            {matchOpen.kind === 'consumer' &&
              matchedConsumerReq &&
              (() => {
                const tm = DEAL_TYPE_META[matchedConsumerReq.dealType];
                const Tcn = tm.icon;
                const isLease = matchedConsumerReq.dealType === 'savings-share';
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-[10px] text-slate-500">수용가</p>
                        <p className="text-sm text-white">{matchedConsumerReq.companyName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">거래 유형</p>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 mt-0.5',
                            tm.bg,
                            tm.tone,
                            tm.ring,
                          )}
                        >
                          <Tcn size={10} className="mr-1" />
                          {tm.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">{isLease ? '설치희망 용량' : '희망 용량'}</p>
                        <p className="text-sm text-white tabular-nums">{matchedConsumerReq.capacityKw} kW</p>
                      </div>
                      {!isLease && (
                        <>
                          <div>
                            <p className="text-[10px] text-slate-500">기간</p>
                            <p className="text-sm text-emerald-300 tabular-nums">
                              {matchedConsumerReq.durationYears}년
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">희망 단가</p>
                            <p className="text-sm text-white tabular-nums">
                              ₩{matchedConsumerReq.desiredUnitPrice}/kWh
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Onsite — 한전 망 미사용: 인접 발전소 매칭 필수 안내 + 수용가 사업장 위치 (거리 기준점) */}
                    {isOnsiteMatch && (
                      <div className="mt-3 rounded-md bg-amber-500/[0.06] ring-1 ring-amber-500/30 px-3 py-2 space-y-1">
                        <p className="text-[11px] text-amber-200">
                          Onsite PPA — 한전 망 미사용 · 수용가 부지 내/인접 발전소만 매칭 가능합니다.
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span className="text-slate-500">수용가 사업장</span>
                          <span className="text-white">{matchedConsumerReq.region || '울산 울주군'}</span>
                          <span className="text-slate-600">
                            — 아래 거리는 이 위치 기준 자동 산정 (도로명 좌표 기반)
                          </span>
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            {matchOpen.kind === 'generator' && matchedGenReq && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[10px] text-slate-500">발전사</p>
                  <p className="text-sm text-white">{matchedGenReq.companyName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">설비 용량</p>
                  <p className="text-sm text-white tabular-nums">{matchedGenReq.capacityKw.toLocaleString()} kW</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">희망 단가</p>
                  <p className="text-sm text-white tabular-nums">₩{matchedGenReq.desiredUnitPrice}/kWh</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">기간</p>
                  <p className="text-sm text-white tabular-nums">{matchedGenReq.durationYears}년</p>
                </div>
              </div>
            )}
          </div>

          {/* 후보 리스트 */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-slate-300">
                {matchOpen.kind === 'consumer' ? '발전사 풀 전체' : '수용가 풀 전체'} ({matchCandidates.length}곳)
              </p>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={candSearch}
                  onChange={(e) => setCandSearch(e.target.value)}
                  placeholder={matchOpen.kind === 'consumer' ? '발전사 검색' : '수용가 검색'}
                  className="h-7 w-72 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] pl-7 pr-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-primary"
                />
              </div>
            </div>
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full text-sm">
                  <thead className="text-left sticky top-0 bg-[#0d1520] z-10">
                    <tr className="border-b border-white/[0.06] text-[11px] text-slate-500">
                      <th className="px-3 py-2 font-medium w-10">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary"
                          checked={matchCandidates.length > 0 && matchCandidates.every((c) => selectedCands.has(c.id))}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCands(new Set(matchCandidates.map((c) => c.id)));
                            else setSelectedCands(new Set());
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {matchOpen.kind === 'consumer' ? '발전사' : '수용가'}
                      </th>
                      {isOnsiteMatch && (
                        <th className="px-3 py-2 text-left font-medium">
                          위치 · 거리
                          <br />
                          <span className="text-[10px] font-normal text-slate-500">수용가 사업장 기준</span>
                        </th>
                      )}
                      {matchOpen.kind === 'generator' && <th className="px-3 py-2 text-left font-medium">유형</th>}
                      <th className="px-3 py-2 font-medium">용량</th>
                      <th className="px-3 py-2 font-medium">단가</th>
                      {matchOpen.kind === 'consumer' && (
                        <>
                          <th className="px-3 py-2 text-left font-medium text-emerald-300">
                            SPC 제안 단가
                            <br />
                            <span className="text-[10px] font-normal text-slate-500">발전사로 전달 ₩/kWh</span>
                          </th>
                          <th className="px-3 py-2 font-medium text-amber-300">
                            거래수수료
                            <br />
                            <span className="text-[10px] font-normal text-slate-500">전력공급거래 ₩/kWh</span>
                          </th>
                        </>
                      )}
                      <th className="px-3 py-2 font-medium">기간</th>
                      <th className="px-3 py-2 text-left font-medium">접수일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchCandidates.map((c: any) => {
                      const checked = selectedCands.has(c.id);
                      const candTypeMeta = c.dealType ? DEAL_TYPE_META[c.dealType as DealType] : null;
                      const CandTypeIcon = candTypeMeta?.icon;
                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            'border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer',
                            checked && 'bg-emerald-500/[0.05]',
                          )}
                          onClick={() => {
                            const next = new Set(selectedCands);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            setSelectedCands(next);
                          }}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedCands);
                                if (e.target.checked) next.add(c.id);
                                else next.delete(c.id);
                                setSelectedCands(next);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-white text-sm">{c.title}</p>
                          </td>
                          {/* Onsite — 한전 망 미사용: 위치·거리가 매칭 판단 기준 */}
                          {isOnsiteMatch && (
                            <td className="px-3 py-2 whitespace-nowrap">
                              <p className="text-xs text-slate-300">{c.region}</p>
                              <p
                                className={cn(
                                  'text-[11px] tabular-nums font-medium',
                                  c.distanceKm <= 2 ? 'text-emerald-300' : 'text-amber-300',
                                )}
                              >
                                ~{c.distanceKm} km {c.distanceKm <= 2 ? '· 인접' : '· 거리 확인 필요'}
                              </p>
                            </td>
                          )}
                          {matchOpen.kind === 'generator' && candTypeMeta && (
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1',
                                  candTypeMeta.bg,
                                  candTypeMeta.tone,
                                  candTypeMeta.ring,
                                )}
                              >
                                {CandTypeIcon && <CandTypeIcon size={9} className="mr-0.5" />}
                                {candTypeMeta.label}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-2 text-slate-300 tabular-nums text-xs">{c.capacity}</td>
                          <td className="px-3 py-2 text-slate-300 tabular-nums text-xs">
                            {c.price ? <>₩{c.price}/kWh</> : <span className="text-slate-600">—</span>}
                          </td>
                          {matchOpen.kind === 'consumer' && (
                            <>
                              {/* SPC 제안 단가 — 양측 중간값 기본, SPC 수정 가능 */}
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  value={getCandProposedPrice(
                                    c.id,
                                    c.price ?? 0,
                                    matchedConsumerReq?.desiredUnitPrice ?? 0,
                                  )}
                                  onChange={(e) => setCandProposedPrice(c.id, e.target.value)}
                                  disabled={!checked}
                                  className={cn(
                                    'h-9 w-28 rounded-md ring-1 px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2',
                                    checked
                                      ? 'bg-white/[0.06] ring-emerald-500/30 text-emerald-200 focus:ring-emerald-500/40'
                                      : 'bg-white/[0.02] ring-white/[0.06] text-slate-600 cursor-not-allowed',
                                  )}
                                />
                                {checked && c.price && matchedConsumerReq?.desiredUnitPrice && (
                                  <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
                                    중간값 ₩
                                    {Math.round(((c.price + matchedConsumerReq.desiredUnitPrice) / 2) * 10) / 10}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={getCandFee(c.id)}
                                  onChange={(e) => setCandFee(c.id, e.target.value)}
                                  disabled={!checked}
                                  className={cn(
                                    'h-9 w-24 rounded-md ring-1 px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2',
                                    checked
                                      ? 'bg-white/[0.06] ring-amber-500/30 text-amber-200 focus:ring-amber-500/40'
                                      : 'bg-white/[0.02] ring-white/[0.06] text-slate-600 cursor-not-allowed',
                                  )}
                                />
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2 text-slate-400 tabular-nums text-xs">{c.duration}년</td>
                          <td className="px-3 py-2 text-slate-500 tabular-nums text-[11px]">{c.submittedAt}</td>
                        </tr>
                      );
                    })}
                    {matchCandidates.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-slate-500 text-xs">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {selectedCands.size > 0
                ? `${selectedCands.size}곳 선택됨`
                : '운영자가 직접 선택 — 행 클릭 또는 체크박스로 다중 선택 가능'}
            </p>
          </div>

          {/* SPC 협상 메모 — 발전사 측에 함께 전달 */}
          {matchOpen.kind === 'consumer' && selectedCands.size > 0 && (
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                협상 내용 · 메모
                <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                  발전사 측에 매칭 제안과 함께 전달됨
                </span>
              </label>
              <textarea
                value={matchNote}
                onChange={(e) => setMatchNote(e.target.value)}
                placeholder={`예: 수용가 희망 ₩${matchedConsumerReq?.desiredUnitPrice}/kWh, SPC 중재가로 제안합니다. 부지 조건·REC 분리 등 협의 가능.`}
                className="w-full min-h-[88px] rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary"
              />
            </div>
          )}

          {/* 액션 */}
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              onClick={() => {
                setMatchOpen(null);
                setSelectedCands(new Set());
                setCandSearch('');
                setCandTradeFees({});
                setCandProposedPrices({});
                setMatchNote('');
              }}
            >
              닫기
            </Button>
            {matchActionLabel && (
              <Button
                variant="primary"
                disabled={matchActionDisabled || createMatchMut.isPending}
                onClick={async () => {
                  if (!matchedConsumerReq) return;
                  const requestId = toRequestId(matchedConsumerReq.id);
                  const picked = matchCandidates.filter((c) => selectedCands.has(c.id));
                  try {
                    for (const c of picked) {
                      await createMatchMut.mutateAsync({
                        requestId,
                        generatorCompanyId: (c as any).generatorCompanyId,
                        plantName: (c as any).title,
                        capacityKw: (c as any).capacityKw,
                        proposedPriceKrw: Number(
                          getCandProposedPrice(c.id, (c as any).price ?? 0, matchedConsumerReq.desiredUnitPrice ?? 0),
                        ),
                      } as any);
                    }
                    useToastStore
                      .getState()
                      .add('success', `발전사 ${picked.length}곳에 매칭 제안 전달 — 발전사 수락 대기 중`);
                    setMatchOpen(null);
                    setSelectedCands(new Set());
                    setCandSearch('');
                    setCandTradeFees({});
                    setCandProposedPrices({});
                    setMatchNote('');
                  } catch {
                    useToastStore.getState().add('error', '매칭 제안 전송에 실패했습니다');
                  }
                }}
              >
                {createMatchMut.isPending ? '전송 중...' : matchActionLabel}
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* ─────────────────── 공급 신청 승인 모달 — 점검 후 승인/반려 ─────────────────── */}
      {approvalTarget && (
        <Modal
          open={!!approvalTarget}
          onClose={closeApproval}
          title={`공급 신청 승인 검토 — ${approvalTarget.companyName}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={closeApproval}>
                닫기
              </Button>
              <Button
                variant="danger"
                disabled={!approvalRejectReason.trim() || updateRequestStatusMut.isPending}
                onClick={async () => {
                  const t = approvalTarget;
                  try {
                    await updateRequestStatusMut.mutateAsync({ id: toRequestId(t.id), status: 'CANCELLED' });
                    useToastStore
                      .getState()
                      .add('warning', `${t.plantName ?? '공급 신청'} 반려 — 사유: ${approvalRejectReason.trim()}`);
                    closeApproval();
                  } catch {
                    useToastStore.getState().add('error', '공급 신청 반려에 실패했습니다');
                  }
                }}
              >
                반려
              </Button>
              <Button
                variant="primary"
                disabled={updateRequestStatusMut.isPending}
                onClick={async () => {
                  const t = approvalTarget;
                  try {
                    await updateRequestStatusMut.mutateAsync({ id: toRequestId(t.id), status: 'APPROVED' });
                    useToastStore
                      .getState()
                      .add('success', `${t.plantName ?? '공급 신청'} 승인 완료 — 수용가 매칭 풀에 등록됩니다`);
                    closeApproval();
                  } catch {
                    useToastStore.getState().add('error', '공급 신청 승인에 실패했습니다');
                  }
                }}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {updateRequestStatusMut.isPending ? '처리 중...' : '승인 확정'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              아래 공급 신청 내용을 검토해주세요. 승인 시 수용가 매칭 후보 풀에 등록됩니다.
            </p>

            {/* 항목 점검 */}
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전사</span>
                <span className="text-sm text-white font-medium">{approvalTarget.companyName}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전소 · 자원</span>
                <span className="text-sm text-white">
                  {approvalTarget.plantName ?? '—'} · {parseResourceFromNotes(approvalTarget.notes)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">설비 용량</span>
                <span className="text-sm text-white tabular-nums">{approvalTarget.capacityKw.toLocaleString()} kW</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">소재 지역</span>
                <span className="text-sm text-white">{approvalTarget.region ?? '—'}</span>
              </div>
            </div>

            <p className="text-[11px] text-accent/70">
              희망 단가는 승인 후 발전사가 직접 기입합니다 — 기입 완료 시 매칭 풀에 등록됩니다.
            </p>

            {/* 반려 사유 — 반려 시 필수 */}
            <div>
              <label className="text-xs text-accent block mb-1.5">
                반려 사유 <span className="text-slate-500">(반려 시 필수)</span>
              </label>
              <Textarea
                value={approvalRejectReason}
                onChange={(e) => setApprovalRejectReason(e.target.value)}
                placeholder="예: 설비 인증 서류 미비 — REC 발급 자격 증빙 후 재신청 바랍니다."
              />
              <p className="text-[11px] text-accent/70 mt-1">반려 사유는 발전사에 전달됩니다.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────── 재제안 모달 — 거절된 매칭에 새 단가/메모로 재제안 ─────────────────── */}
      {resubmitTarget && (
        <Modal
          open={!!resubmitTarget}
          onClose={closeResubmit}
          title={`재제안 — ${resubmitTarget.request.plantName ?? resubmitTarget.request.companyName}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={closeResubmit}>
                닫기
              </Button>
              <Button
                variant="primary"
                disabled={!resubmitPrice || !resubmitNote.trim()}
                onClick={() => {
                  useToastStore
                    .getState()
                    .add(
                      'success',
                      `${resubmitTarget.request.plantName ?? '재제안'} — ₩${resubmitPrice}/kWh 로 재제안 전송됨 (TODO(API): 재매칭 mutation 연결)`,
                    );
                  closeResubmit();
                }}
              >
                재제안 전송
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* 거절 정보 */}
            <div className="rounded-lg ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-4 py-3">
              <p className="text-xs text-rose-200 font-medium mb-1">
                이전 제안 거절 —{' '}
                {resubmitTarget.declinedMatch.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'}
              </p>
              <p className="text-xs text-slate-300">
                이전 단가:{' '}
                <span className="text-white tabular-nums">₩{resubmitTarget.declinedMatch.proposedPriceKrw}/kWh</span>
              </p>
              <p className="text-xs text-slate-300 mt-1">사유: {resubmitTarget.declinedMatch.declineReason}</p>
            </div>

            {/* 신청 요약 */}
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전사</span>
                <span className="text-sm text-white font-medium">{resubmitTarget.request.companyName}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전소</span>
                <span className="text-sm text-white">{resubmitTarget.request.plantName ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-accent/70">발전사 희망 단가</span>
                <span className="text-sm text-emerald-300 font-bold tabular-nums">
                  ₩{resubmitTarget.request.desiredUnitPrice}/kWh
                </span>
              </div>
            </div>

            {/* 새 제안 단가 */}
            <div>
              <label className="text-xs text-accent block mb-1.5">새 제안 단가 (₩/kWh) *</label>
              <input
                type="number"
                step="0.1"
                value={resubmitPrice}
                onChange={(e) => setResubmitPrice(e.target.value)}
                placeholder="예: 154"
                className="w-full h-10 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* 협상 메모 */}
            <div>
              <label className="text-xs text-accent block mb-1.5">협상 내용 *</label>
              <Textarea
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                placeholder="예: 거절 사유 반영하여 단가 조정했습니다. 재검토 부탁드립니다."
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────── 신규 신청 알림 모달 ─────────────────── */}
      {newAlertOpen && newRequests.length > 0 && (
        <Modal
          open={newAlertOpen}
          onClose={() => setNewAlertOpen(false)}
          title="신규 신청 도착"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setNewAlertOpen(false)}>
                나중에
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setNewAlertOpen(false);
                  setTab(newRequests[0].kind === 'consumer' ? 'consumer-req' : 'generator-req');
                }}
              >
                처리하기
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/[0.08] ring-1 ring-rose-500/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-rose-300 shrink-0" />
              <p className="text-sm text-rose-100">
                <span className="font-bold">{newRequests.length}건</span>의 신청이 처리 대기 중입니다.
              </p>
            </div>

            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] max-h-[280px] overflow-y-auto">
              {newRequests.map((r) => {
                const meta = r.kind === 'consumer' ? DEAL_TYPE_META[r.dealType] : DEAL_TYPE_META['offsite-ppa'];
                const Icon = meta.icon;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-md shrink-0', meta.bg)}>
                      <Icon size={12} className={meta.tone} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-white truncate">{r.party}</p>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1',
                            meta.bg,
                            meta.tone,
                            meta.ring,
                          )}
                        >
                          {r.kind === 'consumer' ? meta.label : 'PPA 공급'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {r.capacity} · {r.kind === 'consumer' ? '수용가' : '발전사업자'}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{r.submittedAt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────── 제안 작성 모달 (직접 PPA — 수익 셰어) ─────────────────── */}
      {shareEditing && (
        <Modal
          open={!!shareEditing}
          onClose={() => {
            setShareEditing(null);
            resetShareForm();
          }}
          title={`직접 PPA — 제안 작성 · ${shareEditing.companyName} · ${shareStep}/2단계`}
          size="lg"
          footer={
            shareStep === 1 ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShareEditing(null);
                    resetShareForm();
                  }}
                >
                  닫기
                </Button>
                <Button
                  variant="primary"
                  disabled={shareForm.equipIds.length === 0}
                  onClick={() => {
                    // 2단계 진입 — 용량 기반 월 발전 수익 자동 산정 (미입력 시)
                    setShareForm((f) => ({
                      ...f,
                      estSavingsPerMonth:
                        f.estSavingsPerMonth || String(estimateMonthlyRevenue(Number(f.installCapacityKw) || 0)),
                    }));
                    setShareStep(2);
                  }}
                >
                  다음 — 계약 항목
                  <ChevronRight size={14} className="ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShareStep(1)}>
                  <ChevronLeft size={14} className="mr-1" />
                  이전 — 설비 선택
                </Button>
                <Button
                  variant="primary"
                  disabled={!shareValid}
                  onClick={() => {
                    // TODO: 셰어 제안을 백엔드에 저장 — 매칭/제안 API 연결 예정 (재매칭이면 이전 DECLINED 매칭 폐기 + 신규 매칭 생성)
                    // 현재는 토스트만 표시 (서버 반영 없음)
                    const isRematch = storeMatches.some(
                      (m) =>
                        m.requestId === Number(String(shareEditing.id).replace('api-', '')) && m.status === 'DECLINED',
                    );
                    useToastStore
                      .getState()
                      .add(
                        'success',
                        isRematch
                          ? `${shareEditing.companyName} 직접 PPA 재제안이 작성되었습니다. 이전 제안은 폐기되고 수용가 검토 단계로 이동합니다.`
                          : `${shareEditing.companyName} 직접 PPA 제안이 작성되었습니다. 수용가 검토 단계로 이동합니다.`,
                      );
                    setShareEditing(null);
                    resetShareForm();
                  }}
                >
                  작성 완료
                </Button>
              </>
            )
          }
        >
          <div className="space-y-5">
            {/* 이전 거절 정보 — 재매칭인 경우 표시 (Lease = 분배율 기준) */}
            {(() => {
              const prevDeclined = storeMatches.find(
                (m) => m.requestId === Number(String(shareEditing.id).replace('api-', '')) && m.status === 'DECLINED',
              );
              if (!prevDeclined) return null;
              return (
                <div className="rounded-lg ring-1 ring-rose-500/30 bg-rose-500/[0.06] px-4 py-3">
                  <p className="text-xs text-rose-200 font-medium mb-1">
                    이전 제안 거절 — {prevDeclined.declinedBy === 'GENERATOR' ? '발전사 거절' : '수용가 거절'} (
                    {prevDeclined.generatorCompanyName} · 분배율 {prevDeclined.sharePct ?? '—'}%)
                  </p>
                  <p className="text-xs text-slate-300">사유: {prevDeclined.declineReason}</p>
                  <p className="text-[11px] text-rose-200/70 mt-1.5">
                    ※ 새 제안을 작성하면 이전 제안은 폐기되고 양측에 재제안이 전달됩니다.
                  </p>
                </div>
              );
            })()}

            {/* 신청 정보 */}
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[11px] text-slate-500 mb-2">수용가 신청 정보</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-500">수용가: </span>
                  <span className="text-white">{shareEditing.companyName}</span>
                </div>
                <div>
                  <span className="text-slate-500">설치희망 용량: </span>
                  <span className="text-white tabular-nums">{shareEditing.capacityKw} kW</span>
                </div>
              </div>
            </div>

            {/* ───── STEP 1: 설치 설비 선택 ───── */}
            {shareStep === 1 && (
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">
                  STEP 1 · 설치 설비 선택 *
                  <span className="text-[10px] text-slate-500 ml-1.5 font-normal">
                    발전사 등록 PPA 설비 — {shareForm.equipIds.length}건 선택
                  </span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {GENERATOR_LEASE_EQUIPMENT.map((eq) => {
                    const isSelected = shareForm.equipIds.includes(eq.id);
                    // 단일 발전사 원칙 — 다른 발전사 설비는 잠금
                    const locked = !!shareSelectedGenerator && eq.generator !== shareSelectedGenerator;
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        disabled={locked}
                        onClick={() => toggleShareEquip(eq.id)}
                        className={cn(
                          'flex items-stretch gap-3 rounded-lg ring-1 overflow-hidden text-left transition-all',
                          isSelected
                            ? 'bg-violet-500/[0.08] ring-violet-400/50'
                            : locked
                              ? 'bg-white/[0.01] ring-white/[0.04] opacity-40 cursor-not-allowed'
                              : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.16]',
                        )}
                      >
                        <div className="relative w-24 shrink-0 bg-gradient-to-br from-white/[0.06] to-white/[0.01] flex items-center justify-center">
                          {eq.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={eq.photo} alt={eq.kind} className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <Sun size={22} className="text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 py-2.5 pr-3 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-violet-500/[0.10] text-violet-300 ring-violet-500/30 shrink-0">
                                {eq.kind}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">{eq.generator}</span>
                            </span>
                            {isSelected && <CheckCircle2 size={15} className="text-violet-300 shrink-0" />}
                          </div>
                          <p className="mt-1 text-sm text-white font-medium truncate">{eq.model}</p>
                          <p className="text-[11px] flex items-center flex-wrap gap-1.5">
                            <span className="text-slate-500">희망 분배율</span>
                            <span className="text-emerald-300 tabular-nums font-medium">{eq.sharePct}%</span>
                            {eq.negotiable && (
                              <span className="inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ring-1 bg-blue-500/[0.10] text-blue-300 ring-blue-500/30">
                                협의 가능
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {eq.priceSub} · {eq.installPeriod}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  ※ 설비를 선택하면 해당 발전사가 자동 배정되고 다음 단계의 분배율에 희망값이 반영됩니다 — Lease 는 단일
                  발전사 배정
                </p>
              </div>
            )}

            {/* ───── STEP 2: 계약 항목 (설비 선택 결과 자동 반영) ───── */}
            {shareStep === 2 && (
              <>
                {/* 선택한 설비 요약 — step 1 결과 */}
                <div className="rounded-lg ring-1 ring-violet-500/30 bg-violet-500/[0.05] px-4 py-3">
                  <p className="text-[11px] text-violet-200 font-medium mb-1.5">
                    선택한 설비 · {shareForm.equipIds.length}건 — {shareForm.assignedGenerator}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {shareForm.equipIds.map((id) => {
                      const eq = GENERATOR_LEASE_EQUIPMENT.find((e) => e.id === id);
                      if (!eq) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] ring-1 ring-white/[0.10] px-2 py-0.5 text-[11px] text-slate-200"
                        >
                          {eq.kind} · {eq.model.split(' · ')[0]}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 발전사 배정(자동) + 설치 정보 */}
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">① 발전사 배정 · 설치 정보</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400">
                        배정 발전사 * <span className="text-slate-600">(설비 선택 시 자동)</span>
                      </label>
                      <input
                        placeholder="설비를 먼저 선택하세요"
                        value={shareForm.assignedGenerator}
                        readOnly
                        className="mt-1 w-full h-9 rounded-md bg-white/[0.02] ring-1 ring-white/[0.06] px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none cursor-default"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">설치 용량 (kW) *</label>
                      <input
                        type="number"
                        value={shareForm.installCapacityKw}
                        onChange={(e) => setShareForm({ ...shareForm, installCapacityKw: e.target.value })}
                        className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">설치 비용 (₩) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="예: 600,000,000"
                        value={shareForm.installCostKrw ? Number(shareForm.installCostKrw).toLocaleString() : ''}
                        onChange={(e) =>
                          setShareForm({ ...shareForm, installCostKrw: e.target.value.replace(/[^0-9]/g, '') })
                        }
                        className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">발전사 부담 (수용가는 0원)</p>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">계약 기간 (년)</label>
                      <input
                        type="number"
                        value={shareForm.contractYears}
                        onChange={(e) => setShareForm({ ...shareForm, contractYears: e.target.value })}
                        className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-300">
                        거래수수료 (전력공급거래) <span className="text-slate-500">₩/kWh</span> *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={shareForm.tradeFeeSupplyKwh}
                        onChange={(e) => setShareForm({ ...shareForm, tradeFeeSupplyKwh: e.target.value })}
                        className="mt-1 w-full h-9 rounded-md bg-amber-500/[0.06] ring-1 ring-amber-500/30 px-3 text-sm text-amber-200 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">SPC가 발전사업자로부터 수취</p>
                    </div>
                  </div>
                </div>

                {/* 발전사 분배율 슬라이더 (0~100%) */}
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">
                    ② 발전사 분배율 — 월 발전 수익 중 발전사 몫{' '}
                    <span className="text-[10px] text-slate-500 font-normal">(설비 희망값 자동 반영 · 조정 가능)</span>
                  </p>
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-4 mb-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={shareForm.sharePct}
                        onChange={(e) => setShareForm({ ...shareForm, sharePct: Number(e.target.value) })}
                        className="flex-1 accent-primary"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={shareForm.sharePct}
                          onChange={(e) =>
                            setShareForm({ ...shareForm, sharePct: Math.max(0, Math.min(100, Number(e.target.value))) })
                          }
                          className="w-16 h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-2 text-sm text-white text-right tabular-nums focus:outline-none focus:ring-primary"
                        />
                        <span className="text-sm text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>0% (전부 수용가)</span>
                      <span>시장 평균 25~35%</span>
                      <span>100% (전부 발전사)</span>
                    </div>
                  </div>
                </div>

                {/* 월 발전 수익 입력 */}
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">
                    ③ 월 발전 수익 — 예상 총액 (SPC 부지 평가){' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      (설치 용량 기반 자동 산정 · 조정 가능)
                    </span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="예: 6,000,000"
                    value={shareForm.estSavingsPerMonth ? Number(shareForm.estSavingsPerMonth).toLocaleString() : ''}
                    onChange={(e) =>
                      setShareForm({ ...shareForm, estSavingsPerMonth: e.target.value.replace(/[^0-9]/g, '') })
                    }
                    className="w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    자가소비 + KEPCO 회피 단가 기준 추정 · 설치 용량 {shareForm.installCapacityKw || 0} kW 기준
                  </p>
                </div>

                {/* 자동 미리보기 */}
                <div className="rounded-lg ring-1 ring-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-200 mb-2">자동 계산 — 월 정산 흐름</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500">월 발전 수익 (총액)</p>
                      <p className="text-base font-bold text-violet-300 tabular-nums">
                        ₩{sharePreview.saved.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">발전사 분배 ({shareForm.sharePct}%)</p>
                      <p className="text-base font-bold text-rose-300 tabular-nums">
                        ₩{sharePreview.share.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">수용가 순이익 ({100 - shareForm.sharePct}%)</p>
                      <p className="text-base font-bold text-emerald-300 tabular-nums">
                        ₩{sharePreview.net.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-violet-300 tabular-nums">총 수익 ₩{sharePreview.saved.toLocaleString()}</span>
                    <ChevronRight size={11} className="text-slate-600" />
                    <span className="text-rose-300 tabular-nums">
                      발전사 분배 ₩{sharePreview.share.toLocaleString()} ({shareForm.sharePct}%)
                    </span>
                    <ChevronRight size={11} className="text-slate-600" />
                    <span className="text-emerald-300 font-bold tabular-nums">
                      수용가 순이익 ₩{sharePreview.net.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ─────────────────── 제안 작성 모달 (정액제) ─────────────────── */}
      {annexEditing && (
        <Modal
          open={!!annexEditing}
          onClose={() => {
            setAnnexEditing(null);
            resetAnnexForm();
          }}
          title={`직접 PPA — 제안 작성 · ${annexEditing.companyName}`}
          size="xl"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setAnnexEditing(null);
                  resetAnnexForm();
                }}
              >
                닫기
              </Button>
              <Button
                variant="primary"
                disabled={!annexValid}
                onClick={() => {
                  // TODO: 별첨(직접 PPA 제안)을 백엔드에 저장 — 매칭/제안 API 연결 예정
                  // 현재는 토스트만 표시 (서버 반영 없음)
                  useToastStore
                    .getState()
                    .add('success', `${annexEditing.companyName} 별첨이 작성되었습니다. 계약 체결 단계로 이동합니다.`);
                  setAnnexEditing(null);
                  resetAnnexForm();
                }}
              >
                작성 완료
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* 신청 정보 — 한 줄 */}
            <div className="text-xs text-slate-400 px-1">
              <span className="text-slate-500">신청: </span>
              <span className="text-white">{annexEditing.companyName}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300 tabular-nums">설치희망 {annexEditing.capacityKw} kW</span>
            </div>

            {/* ① 설치 설비 선택 — 설비를 고르면 발전사 자동 배정 (설비 우선 흐름) */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                ① 설치 설비 선택 *
                <span className="text-[10px] text-slate-500 ml-1.5 font-normal">
                  발전사 등록 PPA 설비 — {annexForm.equipIds.length}건 선택
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {GENERATOR_LEASE_EQUIPMENT.map((eq) => {
                  const isSelected = annexForm.equipIds.includes(eq.id);
                  // 단일 발전사 원칙 — 다른 발전사 설비는 잠금
                  const locked = !!annexSelectedGenerator && eq.generator !== annexSelectedGenerator;
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleAnnexEquip(eq.id)}
                      className={cn(
                        'flex items-stretch gap-3 rounded-lg ring-1 overflow-hidden text-left transition-all',
                        isSelected
                          ? 'bg-violet-500/[0.08] ring-violet-400/50'
                          : locked
                            ? 'bg-white/[0.01] ring-white/[0.04] opacity-40 cursor-not-allowed'
                            : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.16]',
                      )}
                    >
                      {/* 사진 — 카탈로그 등록 사진 (없으면 placeholder) */}
                      <div className="relative w-24 shrink-0 bg-gradient-to-br from-white/[0.06] to-white/[0.01] flex items-center justify-center">
                        {eq.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={eq.photo} alt={eq.kind} className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <Sun size={22} className="text-slate-600" />
                        )}
                      </div>
                      <div className="flex-1 py-2.5 pr-3 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-violet-500/[0.10] text-violet-300 ring-violet-500/30 shrink-0">
                              {eq.kind}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">{eq.generator}</span>
                          </span>
                          {isSelected && <CheckCircle2 size={15} className="text-violet-300 shrink-0" />}
                        </div>
                        <p className="mt-1 text-sm text-white font-medium truncate">{eq.model}</p>
                        <p className="text-[11px] flex items-center flex-wrap gap-1.5">
                          <span className="text-slate-500">희망 분배율</span>
                          <span className="text-emerald-300 tabular-nums font-medium">{eq.sharePct}%</span>
                          {eq.negotiable && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ring-1 bg-blue-500/[0.10] text-blue-300 ring-blue-500/30">
                              협의 가능
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {eq.priceSub} · {eq.installPeriod}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                ※ 설비를 선택하면 해당 발전사가 자동 배정됩니다 — Lease 는 단일 발전사 배정이라 다른 발전사 설비는
                잠깁니다 · 분배율은 발전사 희망값 (매칭 협상에서 확정)
              </p>
            </div>

            {/* ② 발전사 배정(자동) + 설비 사양 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">② 발전사 배정 · 설비 사양</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">
                    배정 발전사 * <span className="text-slate-600">(설비 선택 시 자동)</span>
                  </label>
                  <input
                    placeholder="설비를 먼저 선택하세요"
                    value={annexForm.assignedGenerator}
                    readOnly
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.02] ring-1 ring-white/[0.06] px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">설비 용량 (kW) *</label>
                  <input
                    type="number"
                    value={annexForm.capacityKw}
                    onChange={(e) => setAnnexForm({ ...annexForm, capacityKw: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">일 발전보증시간 (h/day)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={annexForm.warrantyHours}
                    onChange={(e) => setAnnexForm({ ...annexForm, warrantyHours: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">표준 3.6 h/day (조정 가능)</p>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">효율 감소율 (%/년)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={annexForm.degradationPct}
                    onChange={(e) => setAnnexForm({ ...annexForm, degradationPct: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-300">
                    거래수수료 (전력공급거래) <span className="text-slate-500">₩/kWh</span> *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={annexForm.tradeFeeSupplyKwh}
                    onChange={(e) => setAnnexForm({ ...annexForm, tradeFeeSupplyKwh: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-amber-500/[0.06] ring-1 ring-amber-500/30 px-3 text-sm text-amber-200 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">SPC가 발전사업자로부터 수취</p>
                </div>
              </div>
            </div>

            {/* ③ 손해금액 (별첨1) — 별첨 순서대로 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                ③ 손해금액 (보증보험)
                <span className="text-[10px] text-slate-500 ml-1.5 font-normal">별첨1</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">1년차 손해액 (₩) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="예: 60,000,000"
                    value={annexForm.year1DamageKrw ? Number(annexForm.year1DamageKrw).toLocaleString() : ''}
                    onChange={(e) =>
                      setAnnexForm({ ...annexForm, year1DamageKrw: e.target.value.replace(/[^0-9]/g, '') })
                    }
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">연 감소액 (₩)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="예: 2,000,000"
                    value={
                      annexForm.annualDamageDecrease ? Number(annexForm.annualDamageDecrease).toLocaleString() : ''
                    }
                    onChange={(e) =>
                      setAnnexForm({ ...annexForm, annualDamageDecrease: e.target.value.replace(/[^0-9]/g, '') })
                    }
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">계약 기간 (년)</label>
                  <select
                    value={annexForm.contractYears}
                    onChange={(e) => setContractYears(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                  >
                    {[5, 10, 15, 20].map((y) => (
                      <option key={y} value={y} className="bg-[#0d1520]">
                        {y}년
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ④ 월 PPA 요금 단가 (별첨2.2) — 연도별 입력 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setYearlyRatesExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  <ChevronRight size={12} className={cn('transition-transform', yearlyRatesExpanded && 'rotate-90')} />④
                  연도별 단가 (₩/kWh) *
                  <span className="text-[10px] text-slate-500 ml-1 font-normal">
                    {(() => {
                      const rates = annexForm.yearlyRates
                        .slice(0, Number(annexForm.contractYears) || 20)
                        .map((r) => Number(r) || 0);
                      const min = Math.min(...rates);
                      const max = Math.max(...rates);
                      return min === max ? `전 기간 ${min} ₩/kWh` : `${min} ~ ${max} ₩/kWh (연차별)`;
                    })()}
                  </span>
                </button>
                {yearlyRatesExpanded && (
                  <button
                    type="button"
                    onClick={fillYearlyRatesEqual}
                    className="text-[10px] px-2 rounded bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.08] text-slate-300"
                  >
                    1년차로 모두 동일
                  </button>
                )}
              </div>
              {yearlyRatesExpanded && (
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                  <div className="grid grid-cols-5 gap-2">
                    {annexForm.yearlyRates.slice(0, Number(annexForm.contractYears) || 20).map((rate, i) => (
                      <div key={i}>
                        <label className="text-[10px] text-slate-500">{i + 1}년차</label>
                        <input
                          type="number"
                          value={rate}
                          onChange={(e) => updateYearlyRate(i, e.target.value)}
                          className="mt-0.5 w-full h-8 rounded bg-white/[0.04] ring-1 ring-white/[0.06] px-2 text-xs text-white tabular-nums focus:outline-none focus:ring-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 산식 — 한 줄 컴팩트 */}
            <div className="rounded-md ring-1 ring-blue-500/30 bg-blue-500/[0.06] px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-blue-300 shrink-0">산식</span>
              <span className="text-[11px] text-slate-300">
                <span className="text-rose-300 font-semibold">월 PPA 요금</span>
                <span className="text-slate-500"> = </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white">용량</span>
                <span className="text-slate-500"> × </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white">
                  발전보증시간
                </span>
                <span className="text-slate-500"> × </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white tabular-nums">
                  365
                </span>
                <span className="text-slate-500"> ÷ </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white tabular-nums">
                  12
                </span>
                <span className="text-slate-500"> × </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white">단가</span>
              </span>
            </div>

            {/* 6. 자동 계산 미리보기 */}
            <div className="rounded-lg ring-1 ring-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3">
              <p className="text-xs font-semibold text-emerald-200 mb-2">자동 계산 — 1년차 기준</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500">월 발전량</p>
                  <p className="text-base font-bold text-emerald-300 tabular-nums">
                    {annexPreview.year1MonthlyKwh.toLocaleString()} kWh
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">1년차 단가</p>
                  <p className="text-base font-bold text-white tabular-nums">₩{annexForm.yearlyRates[0]}/kWh</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">약정 월 PPA 요금</p>
                  <p className="text-base font-bold text-rose-300 tabular-nums">
                    ₩{annexPreview.year1MonthlyRent.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* 6. 20년 미리보기 표 (스크롤) */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">⑤ 운영 연차별 자동 산정 미리보기</p>
              <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-xs">
                    <thead className="text-left sticky top-0 bg-[#0d1520] z-10">
                      <tr className="border-b border-white/[0.06] text-[10px] text-slate-500">
                        <th className="px-3 py-2 text-left font-medium">연차</th>
                        <th className="px-3 py-2 font-medium">월 발전량 (kWh)</th>
                        <th className="px-3 py-2 font-medium">단가 (₩/kWh)</th>
                        <th className="px-3 py-2 font-medium">월 PPA 요금</th>
                        <th className="px-3 py-2 font-medium">손해금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annexPreview.yearly.map((y) => (
                        <tr key={y.year} className="border-b border-white/[0.04]">
                          <td className="px-3 py-2 text-slate-300 tabular-nums">{y.year}년차</td>
                          <td className="px-3 py-2 text-emerald-300 tabular-nums">{y.kwhPerMonth.toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-300 tabular-nums">₩{y.rate}</td>
                          <td className="px-3 py-2 text-rose-300 font-semibold tabular-nums">
                            ₩{y.rent.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-slate-400 tabular-nums">₩{y.damage.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
