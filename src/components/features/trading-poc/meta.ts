/**
 * 전력거래 화면 공통 — 라벨·톤·포맷. 계약 유형 라벨은 통합관제와 같은 CONTRACT_KIND(자가소비 · onsite)를 쓴다.
 */
import type { PlantContractKind } from '@/types/monitoring';
import type { StatusTone } from '@/components/ui/Design';
import { CONTRACT_KIND } from '@/lib/design';
import type {
  ChangeStatus,
  ChangeType,
  ContractStatus,
  Party,
  TradeRequestStatus,
} from '@/types/trading-poc';

export const KIND_OPTIONS: { value: PlantContractKind; label: string }[] = [
  { value: 'SELF_CONSUMPTION', label: CONTRACT_KIND.SELF_CONSUMPTION.label },
  { value: 'ONSITE', label: CONTRACT_KIND.ONSITE.label },
];
export const kindLabel = (k: PlantContractKind) => CONTRACT_KIND[k].label;
/** 단가 이름 — onsite 계약 단가 · 자가소비 운영관리 단가 (둘 다 ₩/kWh) */
export const priceLabel = (k: PlantContractKind) =>
  k === 'ONSITE' ? '계약 단가' : '운영관리 단가';
/** 월 금액 이름 — onsite PPA 요금 · 자가소비 운영관리비 */
export const amountLabel = (k: PlantContractKind) => (k === 'ONSITE' ? 'PPA 요금' : '운영관리비');

export const REQUEST_STATUS: Record<TradeRequestStatus, { label: string; tone: StatusTone }> = {
  SUBMITTED: { label: '접수', tone: 'muted' },
  REVIEW: { label: '미팅', tone: 'warning' },
  APPROVED: { label: '서명 대기', tone: 'warning' },
  SIGNED: { label: '승인', tone: 'normal' },
  REJECTED: { label: '반려', tone: 'danger' },
  CANCELLED: { label: '취소', tone: 'muted' },
};
export const IN_PROGRESS: TradeRequestStatus[] = ['SUBMITTED', 'REVIEW', 'APPROVED'];
export const FINISHED: TradeRequestStatus[] = ['SIGNED', 'REJECTED', 'CANCELLED'];

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; tone: StatusTone }> = {
  PENDING_SIGN: { label: '서명 대기', tone: 'warning' },
  ACTIVE: { label: '운영 중', tone: 'normal' },
  TERMINATED: { label: '해지', tone: 'muted' },
};

export const CHANGE_TYPE: Record<ChangeType, string> = {
  PRICE: '단가 변경',
  CAPACITY: '용량 변경',
  TERM: '기간 변경',
  TERMINATE: '해지',
};
export const CHANGE_STATUS: Record<ChangeStatus, { label: string; tone: StatusTone }> = {
  REQUESTED: { label: '처리 대기', tone: 'warning' },
  APPROVED: { label: '승인', tone: 'normal' },
  REJECTED: { label: '반려', tone: 'danger' },
  CANCELLED: { label: '취소', tone: 'muted' },
};

/** 변경·해지 한 건의 상태 — 신청 → 변경 동의 → 조건 입력(관리자) → 조건 동의(상대) → 전자서명 → 승인. 해지는 동의 뒤 바로 전자서명. 멈춤은 반려 · 취소 */
export type ChangeState = '신청' | '조건 입력' | '조건 동의' | '전자서명' | '승인' | '해지' | '반려' | '취소';
export const CHANGE_STATES: ChangeState[] = ['신청', '조건 입력', '조건 동의', '전자서명', '승인', '해지', '반려', '취소'];
export const changeStateOf = (ch: {
  status: ChangeStatus;
  type: ChangeType;
  stage?: string;
  spcSign?: unknown;
  companySign?: unknown;
}): ChangeState => {
  if (ch.status === 'REJECTED') return '반려';
  if (ch.status === 'CANCELLED') return '취소';
  if (ch.status === 'APPROVED') return ch.type === 'TERMINATE' ? '해지' : '승인'; // 해지는 양측 서명이 곧 끝
  if (ch.stage === 'TERMS') return '조건 입력';
  if (ch.stage === 'AGREE') return '조건 동의';
  // 해지는 신청하면 서명 칸이 바로 열리지만, 아무도 서명 안 했으면 아직 '신청'
  if (ch.type === 'TERMINATE' && ch.stage === 'SIGN' && !ch.spcSign && !ch.companySign) return '신청';
  return ch.stage === 'SIGN' ? '전자서명' : '신청';
};
export const CHANGE_STATE_TONE: Record<ChangeState, StatusTone> = {
  신청: 'muted',
  '조건 입력': 'warning',
  '조건 동의': 'warning',
  전자서명: 'warning',
  승인: 'normal',
  해지: 'normal', // 해지도 양측 서명으로 끝난 것 — 반려(빨강)와 구분
  반려: 'danger',
  취소: 'muted',
};

export const PARTY_LABEL: Record<Party, string> = {
  generator: '발전사업자',
  consumer: '기업',
  spc: '관리자',
};

/* ── 포맷 ── */
export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
export const fmtKw = (n: number) => `${fmtNum(n, 2)} kW`;
export const fmtKwh = (n: number) => `${fmtNum(n)} kWh`;
export const fmtKrw = (n: number) => `₩${fmtNum(Math.round(n))}`;
export const fmtPrice = (n: number) => `₩${fmtNum(n, 1)}/kWh`;
export const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : '-');
export const fmtDateTime = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '-');
export const fmtTerm = (start: string, end: string) => `${start} ~ ${end}`;
export const daysLeft = (end: string) =>
  Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);

/** 월 평균 발전량 근사 — 울산 태양광 연 1,385 kWh/kW ÷ 12 */
export const MONTHLY_KWH_PER_KW = 115;
export const estimateMonthlyKwh = (capacityKw: number) =>
  Math.round(capacityKw * MONTHLY_KWH_PER_KW);
export const estimateMonthlyAmount = (capacityKw: number, unitPrice: number) =>
  Math.round(capacityKw * MONTHLY_KWH_PER_KW * unitPrice);

/** 계약 조건 한 줄 — 자가소비: 설치 ₩1,350,000/kW · O&M ₩1,347,840/년 / PPA: ₩138/kWh */
export const termsText = (t: { kind: PlantContractKind; unitPrice: number; installUnit?: number; omAnnual?: number }) =>
  t.kind === 'SELF_CONSUMPTION' && (t.installUnit || t.omAnnual)
    ? [t.installUnit ? `설치 ₩${fmtNum(t.installUnit)}/kW` : '', t.omAnnual ? `O&M ₩${fmtNum(t.omAnnual)}/년` : ''].filter(Boolean).join(' · ')
    : fmtPrice(t.unitPrice);
/** 예상 설치비 — 자가소비: 용량 × 설치 단가 + 추가 시공비 */
export const totalCostOf = (t: { capacityKw: number; installUnit?: number; extraCost?: number }) =>
  t.installUnit ? t.capacityKw * t.installUnit + (t.extraCost ?? 0) : 0;
/** 변경 유형 이름 — 단가 변경은 자가소비면 O&M 변경 */
export const changeTypeLabel = (type: ChangeType, kind?: PlantContractKind) =>
  type === 'PRICE' && kind === 'SELF_CONSUMPTION' ? 'O&M 변경' : CHANGE_TYPE[type];

/** 한전 산업용 단가(₩/kWh) — 관리자 설정 › 에너지 설정 KEPCO_UNIT_PRICE 와 같은 값. onsite 할인 = 한전 요금 − PPA 요금 */
export const KEPCO_UNIT_PRICE = 152.3;
/** onsite 한 달 — 한전으로 냈을 요금 · 절감액 · 할인율 */
export const savingOf = (kwh: number, price: number) => {
  const kepco = Math.round(kwh * KEPCO_UNIT_PRICE);
  const saving = kepco - Math.round(kwh * price);
  return { kepco, saving, rate: kepco ? (saving / kepco) * 100 : 0 };
};

/** 계약 조건 칸 범위 — [최소, 최대, 소수 자리]. 거래 미팅 조건 · 변경 조건이 같이 쓴다. 추가 설치비용만 0 허용(선택) */
export const TERM_LIM = {
  capacityKw: [1, 10_000, 2], // kW — 거래 신청 · 무료진단과 같은 최대
  termYears: [1, 25, 0], // 년
  price: [0.1, 1_000, 1], // ₩/kWh — 무료진단 구간 단가와 같은 최대
  installUnit: [1, 10_000_000, 0], // 원/kW — 무료진단 설치단가와 같은 최대
  extraCost: [0, 10_000_000_000, 0], // 원
  omAnnual: [1, 1_000_000_000, 0], // 원/년
} as const;
export type TermLimKey = keyof typeof TERM_LIM;
/** 숫자 칸 — 숫자와 점 하나, 정해진 소수 자리까지, 최대를 넘으면 최대 */
export const numIn = (raw: string, [, hi, dec]: readonly [number, number, number]) => {
  let v = raw.replace(dec ? /[^0-9.]/g : /[^0-9]/g, '');
  const dot = v.indexOf('.');
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, dec);
  return Number(v) > hi ? String(hi) : v;
};
export const inLim = (v: number, [lo, hi]: readonly [number, number, number]) => v >= lo && v <= hi;

/** 변경 조건 한 줄씩 — 항목 · 현재 · 변경(같으면 바뀌지 않음). PPA 단가는 PPA 만 */
export function termRows(kind: PlantContractKind, before: ChangeTermsLike, after: ChangeTermsLike) {
  const w = (n?: number) => (n == null ? '-' : `₩${fmtNum(Math.round(n))}`);
  const rows: [string, string, string][] = [
    ['설치 용량', fmtKw(before.capacityKw), fmtKw(after.capacityKw)],
    ['계약 기간', `${before.termYears}년`, `${after.termYears}년`],
    ...(kind === 'ONSITE' ? ([['PPA 단가', fmtPrice(before.unitPrice), fmtPrice(after.unitPrice)]] as [string, string, string][]) : []),
    ['설치 단가', `${w(before.installUnit)}/kW`, `${w(after.installUnit)}/kW`],
    ['추가 설치비용', w(before.extraCost ?? 0), w(after.extraCost ?? 0)],
    ['연간 O&M', `${w(before.omAnnual)}/년`, `${w(after.omAnnual)}/년`],
    ['요금제', before.tariffPlan ?? '-', after.tariffPlan ?? '-'],
  ];
  return rows.map(([label, b, a]) => ({ label, before: b, after: a, changed: b !== a }));
}
type ChangeTermsLike = { capacityKw: number; termYears: number; unitPrice: number; installUnit?: number; extraCost?: number; omAnnual?: number; tariffPlan?: string };
