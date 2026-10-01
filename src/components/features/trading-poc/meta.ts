/**
 * 전력거래 화면 공통 — 라벨·톤·포맷. 계약 유형 라벨은 통합관제와 같은 CONTRACT_KIND(자가소비 · onsite)를 쓴다.
 */
import type { PlantContractKind } from '@/types/monitoring';
import type { StatusTone } from '@/components/ui/Design';
import { CONTRACT_KIND } from '@/lib/design';
import type { ChangeStatus, ChangeType, ContractStatus, Party, TradeRequestStatus } from '@/types/trading-poc';

export const KIND_OPTIONS: { value: PlantContractKind; label: string }[] = [
  { value: 'SELF_CONSUMPTION', label: CONTRACT_KIND.SELF_CONSUMPTION.label },
  { value: 'ONSITE', label: CONTRACT_KIND.ONSITE.label },
];
export const kindLabel = (k: PlantContractKind) => CONTRACT_KIND[k].label;
/** 단가 이름 — onsite 계약 단가 · 자가소비 운영관리 단가 (둘 다 ₩/kWh) */
export const priceLabel = (k: PlantContractKind) => (k === 'ONSITE' ? '계약 단가' : '운영관리 단가');
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

export const PARTY_LABEL: Record<Party, string> = { generator: '발전사업자', consumer: '수용가', spc: 'SPC' };

/* ── 포맷 ── */
export const fmtNum = (n: number, digits = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
export const fmtKw = (n: number) => `${fmtNum(n, 2)} kW`;
export const fmtKwh = (n: number) => `${fmtNum(n)} kWh`;
export const fmtKrw = (n: number) => `₩${fmtNum(Math.round(n))}`;
export const fmtPrice = (n: number) => `₩${fmtNum(n, 1)}/kWh`;
export const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : '-');
export const fmtDateTime = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '-');
export const fmtTerm = (start: string, end: string) => `${start} ~ ${end}`;
export const daysLeft = (end: string) => Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);

/** 월 평균 발전량 근사 — 울산 태양광 연 1,385 kWh/kW ÷ 12 */
export const MONTHLY_KWH_PER_KW = 115;
export const estimateMonthlyKwh = (capacityKw: number) => Math.round(capacityKw * MONTHLY_KWH_PER_KW);
export const estimateMonthlyAmount = (capacityKw: number, unitPrice: number) => Math.round(capacityKw * MONTHLY_KWH_PER_KW * unitPrice);
