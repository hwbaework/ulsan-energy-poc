import type { ConsultationDomain } from '@/types/consultation';
import type { MaturityGrade } from './maturity';

export interface ConsultantProposal {
  id: number;
  consultantId: number;
  consultantName: string;
  targetDiagnosisId: number;
  domain: ConsultationDomain;
  proposedScope: string[];
  estimatedCost: number;
  estimatedDuration: string;
  coverLetter: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  targetCompanyIndustry?: string;
  targetCompanySize?: string;
  targetMaturityGrade?: MaturityGrade;
  createdAt: string;
  updatedAt: string;
}

export interface AnonymousDiagnosis {
  id: number;
  industry: string;
  companySize: string;
  domain: ConsultationDomain;
  maturityGrade: MaturityGrade;
  currentREPercent: number;
  createdAt: string;
}

export const MOCK_PROPOSALS: ConsultantProposal[] = [
  {
    id: 1,
    consultantId: 1,
    consultantName: '김에너지',
    targetDiagnosisId: 101,
    domain: 'RE100',
    proposedScope: ['RE100 이행 전략 수립', '재생에너지 공급 분석', 'PPA 계약 지원'],
    estimatedCost: 25_000_000,
    estimatedDuration: '8주',
    coverLetter:
      '귀사의 진단 결과를 검토한 결과, RE100 이행을 위한 단계적 접근이 가능합니다. 제조업 분야에서 다수의 RE100 전환 프로젝트를 성공적으로 수행한 경험을 바탕으로 최적의 방안을 제시하겠습니다.',
    status: 'PENDING',
    targetCompanyIndustry: '제조업',
    targetCompanySize: '중견기업',
    targetMaturityGrade: 'D',
    createdAt: '2026-04-28',
    updatedAt: '2026-04-28',
  },
  {
    id: 2,
    consultantId: 4,
    consultantName: '정탄소',
    targetDiagnosisId: 102,
    domain: 'CARBON_REDUCTION',
    proposedScope: ['온실가스 배출 현황 분석', '감축 로드맵 수립', 'CBAM 대응 전략'],
    estimatedCost: 18_000_000,
    estimatedDuration: '6주',
    coverLetter:
      'EU CBAM 시행을 앞두고 수출 기업의 탄소 대응이 시급합니다. 철강/화학 업종 특화 컨설팅 경험을 활용하여 비용 효율적인 감축 방안을 제안드립니다.',
    status: 'PENDING',
    targetCompanyIndustry: '철강업',
    targetCompanySize: '대기업',
    targetMaturityGrade: 'F',
    createdAt: '2026-05-01',
    updatedAt: '2026-05-01',
  },
  {
    id: 3,
    consultantId: 2,
    consultantName: '박그린',
    targetDiagnosisId: 103,
    domain: 'RE100',
    proposedScope: ['RE100 고도화 전략', '녹색 프리미엄 최적화'],
    estimatedCost: 15_000_000,
    estimatedDuration: '4주',
    coverLetter:
      '현재 RE 비율이 양호한 수준이나, 비용 최적화 여지가 있습니다. 녹색 프리미엄과 PPA 포트폴리오 재구성을 통해 연간 비용을 절감할 수 있습니다.',
    status: 'ACCEPTED',
    targetCompanyIndustry: 'IT/통신',
    targetCompanySize: '중소기업',
    targetMaturityGrade: 'B',
    createdAt: '2026-04-15',
    updatedAt: '2026-04-20',
  },
  {
    id: 4,
    consultantId: 1,
    consultantName: '김에너지',
    targetDiagnosisId: 104,
    domain: 'DISTRIBUTED_ENERGY',
    proposedScope: ['분산에너지 활용 방안', '소규모 전력거래 참여 전략'],
    estimatedCost: 12_000_000,
    estimatedDuration: '5주',
    coverLetter:
      '분산에너지 특별법 시행에 앞서, 자가 발전 설비를 활용한 소규모 전력거래 참여 방안을 제안드립니다.',
    status: 'DECLINED',
    targetCompanyIndustry: '식품업',
    targetCompanySize: '중소기업',
    targetMaturityGrade: 'C',
    createdAt: '2026-04-10',
    updatedAt: '2026-04-12',
  },
];

export const MOCK_ANONYMOUS_DIAGNOSES: AnonymousDiagnosis[] = [
  {
    id: 101,
    industry: '제조업',
    companySize: '중견기업(300~999명)',
    domain: 'RE100',
    maturityGrade: 'D',
    currentREPercent: 8,
    createdAt: '2026-04-25',
  },
  {
    id: 102,
    industry: '철강업',
    companySize: '대기업(1000명+)',
    domain: 'CARBON_REDUCTION',
    maturityGrade: 'F',
    currentREPercent: 2,
    createdAt: '2026-04-28',
  },
  {
    id: 103,
    industry: 'IT/통신',
    companySize: '중소기업(50~299명)',
    domain: 'RE100',
    maturityGrade: 'B',
    currentREPercent: 55,
    createdAt: '2026-04-20',
  },
  {
    id: 104,
    industry: '식품업',
    companySize: '중소기업(50~299명)',
    domain: 'DISTRIBUTED_ENERGY',
    maturityGrade: 'C',
    currentREPercent: 22,
    createdAt: '2026-04-18',
  },
  {
    id: 105,
    industry: '화학업',
    companySize: '대기업(1000명+)',
    domain: 'CARBON_REDUCTION',
    maturityGrade: 'F',
    currentREPercent: 1,
    createdAt: '2026-05-02',
  },
  {
    id: 106,
    industry: '자동차',
    companySize: '중견기업(300~999명)',
    domain: 'RE100',
    maturityGrade: 'C',
    currentREPercent: 25,
    createdAt: '2026-05-03',
  },
];
