import type { BaseEntity } from './common';

export type ConsultationStatus =
  | 'APPLIED'
  | 'ASSIGNED'
  | 'SURVEYING'
  | 'VISITING'
  | 'DRAFTING'
  | 'REVIEWING'
  | 'COMPLETED'
  | 'CANCELLED';

export type ConsultationOrigin = 'outsource' | 'marketplace' | 'referral';
export type ConsultationDomain = 'RE100' | 'CARBON_REDUCTION' | 'DISTRIBUTED_ENERGY';

export type ReportType =
  | 'DIRECTION'
  | 'STRATEGY'
  | 'FINAL'
  | 'REPORT'
  | 'SITE_REPORT'
  | 'PROPOSAL'
  | 'CONTRACT'
  | 'INSPECTION'
  | 'CONTRACT_DRAFT'
  | 'CONTRACT_FINAL';
export type ReportStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'SPC_REVIEW';

export const STATUS_TRANSITIONS: Record<
  ConsultationOrigin,
  Partial<Record<ConsultationStatus, ConsultationStatus[]>>
> = {
  outsource: {
    APPLIED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['SURVEYING', 'CANCELLED'],
    SURVEYING: ['VISITING', 'CANCELLED'],
    VISITING: ['DRAFTING', 'CANCELLED'],
    DRAFTING: ['REVIEWING', 'CANCELLED'],
    REVIEWING: ['COMPLETED', 'DRAFTING', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  },
  marketplace: {
    APPLIED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['SURVEYING', 'CANCELLED'],
    SURVEYING: ['VISITING', 'CANCELLED'],
    VISITING: ['DRAFTING', 'CANCELLED'],
    DRAFTING: ['REVIEWING', 'CANCELLED'],
    REVIEWING: ['COMPLETED', 'DRAFTING', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  },
  referral: {
    APPLIED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['SURVEYING', 'CANCELLED'],
    SURVEYING: ['VISITING', 'CANCELLED'],
    VISITING: ['DRAFTING', 'CANCELLED'],
    DRAFTING: ['REVIEWING', 'CANCELLED'],
    REVIEWING: ['COMPLETED', 'DRAFTING', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  },
};

export interface Diagnosis {
  id: number;
  companyId: number;
  companyName: string;
  domain: ConsultationDomain;
  industry?: string;
  companySize?: string;
  currentRePercent?: number;
  targetTimeline?: string;
  maturityGrade?: string;
  annualEnergyUsage?: number;
  currentElecCost?: number;
  annualGhgEmission?: number;
  budgetRange?: string;
  currentReMethods?: string;
  consultingDrivers?: string;
  exportCountries?: string;
  siteCount?: number;
  siteRegions?: string;
  annualRevenue?: number;
  employeeCount?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
}

export interface Consultation extends BaseEntity {
  status: ConsultationStatus;
  origin: ConsultationOrigin;
  domain: ConsultationDomain;
  clientCompanyId: number;
  clientCompanyName: string;
  consultantId?: number;
  consultantName?: string;
  targetRegion?: string;
  industry?: string;
  maturityGrade?: string;
  includePpaSupport?: boolean;
  companySize?: string;
  currentRePercent?: number;
  targetTimeline?: string;
  annualEnergyUsage?: number;
  currentElecCost?: number;
  annualGhgEmission?: number;
  budgetRange?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  currentReMethods?: string;
  consultingDrivers?: string;
  exportCountries?: string;
  siteCount?: number;
  siteRegions?: string;
  annualRevenue?: number;
  employeeCount?: number;
  diagnosisId?: number;
  appliedAt?: string;
  assignedAt?: string;
  completedAt?: string;
}

export interface ConsultantCertification {
  certType: string;
  certNumber?: string;
  issuer: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface Consultant extends BaseEntity {
  userId?: number;
  userName: string;
  bio: string;
  maxConcurrent?: number;
  available?: boolean;
  experienceYears?: number;
  region: string;
  rating: number;
  reviewCount: number;
  completedProjects: number;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
}

export interface ConsultationReport extends BaseEntity {
  consultationId: number;
  reportType: ReportType;
  fileId?: number;
  authorName?: string;
  status: ReportStatus;
  version: number;
}

export interface ReportComment extends BaseEntity {
  authorName: string;
  authorRole: 'CLIENT' | 'CONSULTANT' | 'SPC' | 'ASSIGNEE';
  content: string;
}

export interface Milestone extends BaseEntity {
  consultationId: number;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  completedDate?: string;
  sortOrder: number;
}

export interface Review extends BaseEntity {
  consultationId: number;
  expertise: number;
  communication: number;
  timeliness: number;
  quality: number;
  recommendation: number;
  comment: string;
}

export interface DiagnosisForm {
  domain: ConsultationDomain | null;
  companySize: string;
  industry: string;
  currentREPercent: number;
  targetTimeline: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  annualEnergyUsage?: number; // MWh (전체)
  annualElectricityUsage?: number; // MWh (전력)
  annualGasUsage?: number; // TJ (가스)
  annualGhgEmission?: number; // tCO2eq (Scope 1+2)
  currentElecCost?: number; // 원/kWh
  employeeCount?: number;
  annualRevenue?: number; // 억원
  siteCount?: number;
  siteRegions?: string;
  currentREMethods?: string[]; // 자가발전, PPA, REC, 녹색프리미엄
  exportCountries?: string;
  consultingDrivers?: string[]; // 규제대응, 고객요구, ESG경영, 비용절감, 자발적
  budgetRange?: string;
  referralCode?: string;
  // 탄소감축 전용
  scope1Emission?: number; // tCO2eq (직접배출)
  scope2Emission?: number; // tCO2eq (간접배출)
  scope3Emission?: number; // tCO2eq (기타간접)
  carbonTargetPercent?: number; // 감축 목표 (%)
  carbonMethods?: string[]; // 현재 감축 수단
  etsParticipant?: boolean; // 배출권거래제 참여
  cdpParticipant?: boolean; // CDP 참여
  sbtiCommitted?: boolean; // SBTi 가입
  // 분산에너지 전용
  rooftopArea?: number; // m2 (옥상/부지 면적)
  peakDemand?: number; // kW (최대 수요)
  monthlyPeakCost?: number; // 원 (월 피크요금)
  existingDER?: string[]; // 기존 분산자원
  gridType?: string; // 수전 형태
  essInterest?: boolean; // ESS 관심
  evChargerInterest?: boolean; // EV 충전 관심
}

// DB consultation_sites 기반
export type SiteType = 'HEAD' | 'BRANCH';

export interface ConsultationSite {
  id: number;
  siteType: SiteType;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  buildingType?: string;
  floorArea?: number; // m2
}

// DB surveys + survey_sites + survey_site_yearly 기반
export interface SurveySiteYearly {
  year: number;
  energyUsage: number; // MWh
  ghgEmission: number; // tCO2eq
  electricityUsage: number; // MWh
  gasUsage: number; // TJ
}

export interface SurveySite {
  siteId: number;
  siteName: string;
  energyUsage: number; // MWh
  ghgEmission: number; // tCO2eq
  yearly: SurveySiteYearly[];
}

export interface SurveyData {
  totalEnergyUsage: number; // MWh
  totalGhgEmission: number; // tCO2eq
  exportCountries?: string;
  regulations: { type: string; code: string }[];
  sites: SurveySite[];
}

export type ConsultingSettlementStatus = 'PENDING' | 'APPROVED' | 'INVOICED' | 'PAID';

export interface ConsultingSettlement extends BaseEntity {
  consultationId: number;
  milestoneId: number;
  milestoneTitle?: string;
  amount: number;
  status: ConsultingSettlementStatus;
  invoiceNumber?: string;
}

export type MilestoneActionType =
  | 'schedule'
  | 'survey'
  | 'documents'
  | 'review'
  | 'navigate'
  | 'prospect'
  | 'proposal'
  | 'contract';

export interface MilestoneTemplate {
  title: string;
  description: string;
  actionLabel?: string;
  actionType?: MilestoneActionType;
  weight: number;
}

export const MILESTONE_TEMPLATES: Record<
  ConsultationOrigin | 'marketplace_with_ppa',
  MilestoneTemplate[]
> = {
  outsource: [
    {
      title: '수용가 발굴',
      description: '대상 수용가를 발굴하고 접촉합니다',
      actionLabel: '수용가 등록',
      actionType: 'prospect',
      weight: 15,
    },
    {
      title: '현장 방문',
      description: '수용가 현장을 방문하여 현황을 파악합니다',
      actionLabel: '일정 잡기',
      actionType: 'schedule',
      weight: 15,
    },
    {
      title: '설문 조사',
      description: '에너지 사용 현황 설문을 수행합니다',
      actionLabel: '설문 작성',
      actionType: 'survey',
      weight: 10,
    },
    {
      title: 'PPA 계약',
      description: 'PPA 계약서 초안 작성 및 협상을 지원합니다',
      actionLabel: '계약서 관리',
      actionType: 'contract',
      weight: 20,
    },
    {
      title: '보고서 작성',
      description: '현황 분석 및 전략 보고서를 작성합니다',
      actionLabel: '문서 작업실',
      actionType: 'documents',
      weight: 20,
    },
    {
      title: '검수/완료',
      description: '최종 산출물 검수 및 프로젝트를 완료합니다',
      actionLabel: '검수 평가',
      actionType: 'review',
      weight: 10,
    },
  ],
  marketplace: [
    { title: '계약 체결', description: '컨설턴트와 계약을 체결합니다', weight: 5 },
    {
      title: '설문 조사',
      description: '에너지 사용 현황 설문을 수행합니다',
      actionLabel: '설문 작성',
      actionType: 'survey',
      weight: 10,
    },
    {
      title: '현장 방문',
      description: '사업장을 방문하여 현황을 파악합니다',
      actionLabel: '일정 잡기',
      actionType: 'schedule',
      weight: 15,
    },
    {
      title: '초안 작성',
      description: '방향/전략 보고서 초안을 작성합니다',
      actionLabel: '문서 작업실',
      actionType: 'documents',
      weight: 25,
    },
    {
      title: '최종 보고',
      description: '최종 보고서를 작성하고 검토합니다',
      actionLabel: '문서 작업실',
      actionType: 'documents',
      weight: 35,
    },
    {
      title: '완료',
      description: '컨설팅을 완료하고 리뷰를 작성합니다',
      actionLabel: '리뷰 작성',
      actionType: 'review',
      weight: 10,
    },
  ],
  referral: [
    { title: '초대 수락', description: '수용가가 진단 초대를 수락합니다', weight: 5 },
    {
      title: '설문 조사',
      description: '에너지 사용 현황 설문을 수행합니다',
      actionLabel: '설문 작성',
      actionType: 'survey',
      weight: 10,
    },
    {
      title: '현장 방문',
      description: '사업장을 방문하여 현황을 파악합니다',
      actionLabel: '일정 잡기',
      actionType: 'schedule',
      weight: 15,
    },
    {
      title: 'PPA 계약',
      description: 'PPA 계약서 초안 작성 및 협상을 지원합니다',
      actionLabel: '계약서 관리',
      actionType: 'contract',
      weight: 20,
    },
    {
      title: '보고서 작성',
      description: '현황 분석 및 전략 보고서를 작성합니다',
      actionLabel: '문서 작업실',
      actionType: 'documents',
      weight: 20,
    },
    {
      title: '검수/완료',
      description: '최종 산출물 검수 및 프로젝트를 완료합니다',
      actionLabel: '검수 평가',
      actionType: 'review',
      weight: 10,
    },
  ],
  marketplace_with_ppa: [
    { title: '계약 체결', description: '컨설턴트와 계약을 체결합니다', weight: 5 },
    {
      title: '설문 조사',
      description: '에너지 사용 현황 설문을 수행합니다',
      actionLabel: '설문 작성',
      actionType: 'survey',
      weight: 10,
    },
    {
      title: '현장 방문',
      description: '사업장을 방문하여 현황을 파악합니다',
      actionLabel: '일정 잡기',
      actionType: 'schedule',
      weight: 10,
    },
    {
      title: '초안 작성',
      description: '방향/전략 보고서 초안을 작성합니다',
      actionLabel: '문서 작업실',
      actionType: 'documents',
      weight: 15,
    },
    {
      title: '최종 보고',
      description: '최종 보고서를 작성하고 검토합니다',
      actionLabel: '문서 작업실',
      actionType: 'documents',
      weight: 20,
    },
    {
      title: 'PPA 계약',
      description: 'PPA 계약서 초안 작성 및 협상을 지원합니다',
      actionLabel: '계약서 관리',
      actionType: 'contract',
      weight: 25,
    },
    {
      title: '검수/완료',
      description: '최종 산출물 검수 및 프로젝트를 완료합니다',
      actionLabel: '검수 평가',
      actionType: 'review',
      weight: 10,
    },
  ],
};

export interface ConsultantProposal extends BaseEntity {
  profileId: number;
  consultantName?: string;
  consultationId?: number;
  domain: ConsultationDomain;
  proposedScope: string;
  estimatedCost: number;
  estimatedDuration?: string;
  coverLetter?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
}
