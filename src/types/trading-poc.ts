/**
 * 전력거래(RE100 2.1) — 울산 에자자 POC 도메인.
 * 계약 유형은 자가소비 · onsite 두 가지뿐이고, 발전소 1 ↔ 수용가 사업장 1 이다 (매칭 바스켓·Offsite·Lease 없음).
 *
 * 흐름(두 유형 공통): 신청 접수 → SPC 검토 → 승인(계약 생성) → 전자서명(발전사업자·수용가) → 체결 → 월 정산
 *  - onsite  : 발전사업자가 수용가 사업장에 설비를 두고 전력을 공급. 계약 단가(₩/kWh) × 공급량 으로 월 청구
 *  - 자가소비 : 수용가 소유 설비를 발전사업자가 설치·운영 관리. 운영관리 단가(₩/kWh) × 발전량 으로 월 청구
 */
import type { PlantContractKind } from './monitoring';

export type Party = 'generator' | 'consumer' | 'spc';

export type TradeRequestStatus =
  | 'SUBMITTED' // 접수
  | 'REVIEW' // SPC 검토 중
  | 'APPROVED' // 승인 — 계약 생성, 서명 대기
  | 'SIGNED' // 체결 (양측 서명 완료)
  | 'REJECTED' // 반려
  | 'CANCELLED'; // 신청 취소

/** 계약 현황의 소통 — 신청자(기업·발전사업자) ↔ SPC */
export interface TradeMessage {
  at: string;
  by: Party;
  byName: string;
  text: string;
}

/** SPC 조건 제안 — 실측 뒤 조건을 고쳐 제안하고 신청자가 수락하거나 수정 요청. 수락되면 승인 때 계약 조건이 된다 */
export interface TermsProposal {
  at: string;
  terms: Partial<ContractTerms> & { capacityKw?: number; termYears?: number };
  note?: string;
  status: 'OPEN' | 'ACCEPTED' | 'REVISE';
  respondedAt?: string;
  responseNote?: string;
}

export interface TradeEvent {
  at: string; // ISO
  by: Party;
  label: string; // 신청 접수 · 검토 시작 · 승인 · 전자서명 · 체결 · 반려 · 취소
  note?: string;
}

/**
 * 계약 조건 — 거래 신청에서 넣고, 승인되면 계약(내 계약)이 같은 값을 갖는다.
 *  - 자가소비: 기업이 설치비 부담(설치 용량 × 설치 가능 단가 + 추가 시공비), SPC 에 연간 O&M(총사업비 대비 %) 지급
 *  - onsite : EPC 가 설치비 부담, 기업은 사용분을 PPA 단가(1구간 · 2구간)로 지급
 */
export interface ContractTerms {
  /** 컨설팅 › 무료진단 검토번호(SR-YYYY-NNNN) */
  reviewNo?: string;
  /** 요금제 · 요금 기준 — 한전 산업용(을) 고압A */
  tariffPlan?: string;
  tariffBasis?: string;
  /** 자가소비 설치단가 (원/kW) — 무료진단 예상 · 제시한 설치 가능 단가 */
  estInstallUnit?: number;
  installUnit?: number;
  /** 자가소비 추가 시공비(원) */
  extraCost?: number;
  /** 자가소비 연간 O&M — 총사업비(예상 설치비) 대비 % */
  omRatePct?: number;
  /** O&M 포함 — 필수 */
  omIncluded?: boolean;
  /** 현장 실측 */
  surveyRequested?: boolean;
  surveyDate?: string;
  /** onsite 구간 단가 — 1구간 · 2구간 (₩/kWh) */
  segments?: { from: number; to: number; price: number }[];
  /** 기업 담당자 */
  contact?: { name: string; phone: string; email?: string };
}

export interface TradeRequest extends ContractTerms {
  id: number;
  no: string; // TR-2026-0001
  kind: PlantContractKind;
  /** 신청자 — onsite 는 발전사업자, 자가소비는 발전사업자(설치·운영) 또는 수용가 */
  applicant: Party;
  applicantCompanyId: number;
  applicantCompanyName: string;
  /** 공급·운영을 맡는 발전사업자 */
  generatorCompanyId: number;
  generatorCompanyName: string;
  /** 발전소(기존 설비) 또는 설치 예정 설비명 */
  plantId?: number;
  plantName: string;
  /** 공급·설치 대상 수용가 사업장 */
  consumerCompanyId: number;
  consumerCompanyName: string;
  siteName: string;
  address: string;
  capacityKw: number;
  /** onsite 계약 단가 · 자가소비 운영관리 단가 (₩/kWh) */
  unitPrice: number;
  termYears: number;
  note?: string;
  status: TradeRequestStatus;
  submittedAt: string;
  updatedAt: string;
  rejectReason?: string;
  /** 승인 시 생성되는 계약 */
  contractId?: number;
  events: TradeEvent[];
  /** 계약 현황 — 소통 · 조건 제안 · 현장 실측 완료일 */
  messages?: TradeMessage[];
  proposal?: TermsProposal;
  surveyDoneAt?: string;
}

export type ContractStatus = 'PENDING_SIGN' | 'ACTIVE' | 'TERMINATED';

export interface Contract extends ContractTerms {
  id: number;
  no: string; // CT-2026-0001
  requestId?: number;
  kind: PlantContractKind;
  plantId?: number;
  plantName: string;
  generatorCompanyId: number;
  generatorCompanyName: string;
  consumerCompanyId: number;
  consumerCompanyName: string;
  siteName: string;
  address: string;
  capacityKw: number;
  unitPrice: number;
  termYears: number;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  signedByGenerator: boolean;
  signedByConsumer: boolean;
  signedAt?: string;
  terminatedAt?: string;
  createdAt: string;
}

export type ChangeType = 'PRICE' | 'CAPACITY' | 'TERM' | 'TERMINATE';
export type ChangeStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ContractChange {
  id: number;
  no: string; // CH-2026-0001
  contractId: number;
  type: ChangeType;
  requestedBy: Party;
  requestedByName: string;
  requestedAt: string;
  reason: string;
  /** onsite 단가 변경 — 몇 구간(1 · 2) */
  segment?: number;
  /** 변경 전·후 — onsite 단가 ₩/kWh · 자가소비 연간 O&M %, 용량 kW, 기간 종료일 */
  before?: string;
  after?: string;
  /** TERMINATE — 희망 해지일 */
  effectiveDate?: string;
  status: ChangeStatus;
  decidedAt?: string;
  decisionNote?: string;
}

/** 전력거래 문서 — 계약서(초안) · 계약서(서명본) · 청구서 · 세금계산서 · 변경·해지 합의서 */
export type DocCategory = 'CONTRACT' | 'SIGNED' | 'INVOICE' | 'TAX' | 'CHANGE';

export interface TradeDocument {
  id: number;
  category: DocCategory;
  title: string;
  fileName: string;
  contractId?: number;
  contractNo?: string;
  plantName?: string;
  /** 열람 가능한 회사 — SPC 는 전부 */
  partyCompanyIds: number[];
  issuedAt: string;
  fileType: 'PDF' | 'XLSX';
  sizeKb: number;
  uploadedBy?: string;
}
