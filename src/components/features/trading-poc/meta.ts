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
  REVIEW: { label: '검토 중', tone: 'warning' },
  APPROVED: { label: '서명 대기', tone: 'warning' },
  SIGNED: { label: '체결', tone: 'normal' },
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

export const PARTY_LABEL: Record<Party, string> = {
  generator: '발전사업자',
  consumer: '기업',
  spc: 'SPC',
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

/* ── 계약 조건 한 줄 — 신청 · 승인 · 내 계약 · 계약 현황이 같은 말로 ── */
type TermsLike = {
  kind: PlantContractKind;
  unitPrice: number;
  segments?: { from: number; to: number; price: number }[];
  installUnit?: number;
  omRatePct?: number;
};
/** 자가소비: 설치 ₩1,350,000/kW · O&M 1% / onsite: 1~3년 ₩138 · 4~20년 ₩140 */
export const termsText = (t: TermsLike) => {
  if (t.kind === 'SELF_CONSUMPTION' && (t.installUnit || t.omRatePct)) {
    return [
      t.installUnit ? `설치 ₩${fmtNum(t.installUnit)}/kW` : '',
      t.omRatePct ? `O&M ${t.omRatePct}%` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (t.kind === 'ONSITE' && t.segments?.length)
    return t.segments.map((g) => `${g.from}~${g.to}년 ₩${fmtNum(g.price, 1)}`).join(' · ');
  return fmtPrice(t.unitPrice);
};
/** 예상 설치비(총사업비) — 자가소비 */
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
