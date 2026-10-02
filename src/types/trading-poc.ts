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

export interface TradeEvent {
  at: string; // ISO
  by: Party;
  label: string; // 신청 접수 · 검토 시작 · 승인 · 전자서명 · 체결 · 반려 · 취소
  note?: string;
}

export interface TradeRequest {
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
  /** 컨설팅 › 무료진단 검토번호(SR-YYYY-NNNN) — 진단 결과를 불러와 신청했을 때 */
  reviewNo?: string;
  status: TradeRequestStatus;
  submittedAt: string;
  updatedAt: string;
  rejectReason?: string;
  /** 승인 시 생성되는 계약 */
  contractId?: number;
  events: TradeEvent[];
}

export type ContractStatus = 'PENDING_SIGN' | 'ACTIVE' | 'TERMINATED';

export interface Contract {
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
  /** 변경 전·후 — 단가 ₩/kWh, 용량 kW, 기간 종료일 */
  before?: string;
  after?: string;
  /** TERMINATE — 희망 해지일 */
  effectiveDate?: string;
  status: ChangeStatus;
  decidedAt?: string;
  decisionNote?: string;
}

export type DocCategory = 'CONTRACT' | 'SIGNED' | 'INVOICE' | 'TAX' | 'CHANGE' | 'REPORT';

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
