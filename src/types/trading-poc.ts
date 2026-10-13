/**
 * 전력거래(RE100 2.1) — 울산 에자자 POC 도메인.
 * 계약 유형은 자가소비 · onsite 두 가지뿐이고, 발전소 1 ↔ 전기사용자 사업장 1 이다 (매칭 바스켓·Offsite·Lease 없음).
 *
 * 흐름(두 유형 공통, 2026-10-13): 신청 접수 → 미팅(오프라인 협의 · 관리자 조건 입력 · 계약서 작성) → 전자서명(양쪽, 계약서 보고 확인) → 승인(둘 다 서명) → 월 정산
 *  - onsite  : 발전사업자가 전기사용자 사업장에 설비를 두고 전력을 공급. 계약 단가(₩/kWh) × 공급량 으로 월 청구
 *  - 자가소비 : 전기사용자 소유 설비를 발전사업자가 설치·운영 관리. 운영관리 단가(₩/kWh) × 발전량 으로 월 청구
 */
import type { PlantContractKind } from './monitoring';

export type Party = 'generator' | 'consumer' | 'spc';

export type TradeRequestStatus =
  | 'SUBMITTED' // 접수
  | 'REVIEW' // 미팅 — 미팅 완료 · 조건 입력(승인 전)
  | 'APPROVED' // 계약서 작성 — 서명 대기
  | 'SIGNED' // 승인 (양측 서명 완료)
  | 'REJECTED' // 반려
  | 'CANCELLED'; // 신청 취소

/** 계약 현황의 소통 — 신청자(기업·발전사업자) ↔ SPC */
export interface TradeMessage {
  at: string;
  by: Party;
  byName: string;
  text: string;
}

export interface TradeEvent {
  at: string; // ISO
  by: Party;
  label: string; // 신청 접수 · 검토 시작 · 승인 · 전자서명 · 체결 · 반려 · 취소
  note?: string;
}

/**
 * 계약 조건 — 신청 때는 의향(미팅 희망일 · 담당자)만, 나머지는 미팅 뒤 관리자가 넣는다(컨설팅 문서에 있는 값 그대로).
 *  - 자가소비: 설치 단가(원/kW) × 용량 = 설치비(기업 부담), SPC 에 연간 O&M(설치비 대비 %) 지급 → 월 요금 = 설치비 × O&M% ÷ 12
 *  - PPA: PPA 단가(unitPrice ₩/kWh) × 사용량. 요금제 · 요금 기준 · 구간 단가는 없다(2026-10-12)
 */
export interface ContractTerms {
  /** 자가소비 설치 단가(원/kW) — 얼마에 설치할지 */
  installUnit?: number;
  /** 자가소비 추가 시공비(원) — 있으면 */
  extraCost?: number;
  /** 연간 O&M 금액(원/년) — 미팅 뒤 관리자가 금액으로 넣는다 */
  omAnnual?: number;
  /** 한전 요금제 — 고압A 선택Ⅰ · Ⅱ */
  tariffPlan?: string;
  /** O&M 포함 — 필수 */
  omIncluded?: boolean;
  /** 미팅 희망일 */
  surveyDate?: string;
  /** 기업 담당자 — 로그인 계정에서 자동 */
  contact?: { name: string; phone: string; email?: string };
}

export interface TradeRequest extends ContractTerms {
  id: number;
  no: string; // TR-2026-0001
  kind: PlantContractKind;
  /** 신청자 — onsite 는 발전사업자, 자가소비는 발전사업자(설치·운영) 또는 전기사용자 */
  applicant: Party;
  applicantCompanyId: number;
  applicantCompanyName: string;
  /** 공급·운영을 맡는 발전사업자 */
  generatorCompanyId: number;
  generatorCompanyName: string;
  /** 발전소(기존 설비) 또는 설치 예정 설비명 */
  plantId?: number;
  plantName: string;
  /** 공급·설치 대상 전기사용자 사업장 */
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
  /** 계약 현황 — 소통 · 미팅 완료일 · 조건 동의(신청한 쪽이 관리자가 넣은 조건에 동의한 때) */
  messages?: TradeMessage[];
  surveyDoneAt?: string;
  /** 관리자가 조건을 확정한 때 — 이때부터 신청한 쪽이 동의 / 반려. 값을 다시 고치면 풀린다 */
  termsConfirmedAt?: string;
}

export type ContractStatus = 'PENDING_SIGN' | 'ACTIVE' | 'TERMINATED';

/** 전자서명 한 쪽 — 직접 서명(그림) 또는 이름 입력 */
export interface SignMark {
  method: 'draw' | 'type';
  image?: string; // 직접 서명 PNG(data URL)
  typedName?: string; // 이름 입력
  at: string;
}

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
  /** 실제 서명 — 그린 서명(이미지) 또는 입력한 이름. 화면에 그대로 보여 준다 */
  signMarkGenerator?: SignMark;
  signMarkConsumer?: SignMark;
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
  /** 변경 전·후 — PPA 단가 ₩/kWh · 자가소비 연간 O&M %, 용량 kW, 기간 종료일 */
  before?: string;
  after?: string;
  /** TERMINATE — 희망 해지일 */
  effectiveDate?: string;
  status: ChangeStatus;
  decidedAt?: string;
  decisionNote?: string;
  /** 진행 단계(요청 접수 다음) — 관리자 검토 → 협의 → 합의서 서명. 둘 다 서명하면 APPROVED(계약 반영) */
  stage?: ChangeStage;
  events?: TradeEvent[];
  messages?: TradeMessage[];
  /** 합의서 서명 — 서로 확인했다는 서명. SPC(관리자)와 기업이 각자 */
  spcSign?: ChangeSign;
  companySign?: ChangeSign;
}

/** 승인되면 서명 단계(SIGN). 그 전은 승인 대기 */
export type ChangeStage = 'SIGN';
export interface ChangeSign {
  at: string;
  /** 서명한 사람(기업명 · SPC) */
  name: string;
  /** 손으로 그린 서명 이미지(data URL). 없으면 이름을 서명체로 */
  image?: string;
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
  /**
   * 올린 원본 — 전자세금계산서 업체(ASP)에서 발행해 내려받은 파일을 사용자가 직접 올린다.
   * (나중에 ASP API 로 바로 가져오는 건 고도화. 지금은 파일 원본을 그대로 보관)
   */
  original?: { name: string; url: string; sizeKb: number; by: string; at: string };
}
