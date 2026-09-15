import type { ConsultationDomain } from '@/types/consultation';

export interface RegulationDeadline {
  id: string;
  name: string;
  code: string;
  deadline: string;
  description: string;
  relatedDomain: ConsultationDomain;
}

export const REGULATION_DEADLINES: RegulationDeadline[] = [
  {
    id: 'cbam-2026',
    name: 'EU CBAM 본격 시행',
    code: 'CBAM',
    deadline: '2026-01-01',
    description: 'EU 탄소국경조정메커니즘 본격 시행 — 수출 기업 탄소비용 부과 시작',
    relatedDomain: 'CARBON_REDUCTION',
  },
  {
    id: 're100-2026q2',
    name: 'K-RE100 이행계획 제출',
    code: 'RE100',
    deadline: '2026-06-30',
    description: '2026년 하반기 K-RE100 이행계획서 제출 마감',
    relatedDomain: 'RE100',
  },
  {
    id: 'ets-2026',
    name: '배출권거래제 3기 할당',
    code: 'ETS',
    deadline: '2026-03-31',
    description: '배출권거래제 3기 계획기간 배출권 할당 신청 마감',
    relatedDomain: 'CARBON_REDUCTION',
  },
  {
    id: 'distributed-2026',
    name: '분산에너지 활성화 특별법',
    code: 'DIST',
    deadline: '2026-09-01',
    description: '분산에너지 활성화 특별법 시행 — 소규모 전력 거래 확대',
    relatedDomain: 'DISTRIBUTED_ENERGY',
  },
];

export function getDaysUntilDeadline(deadline: string): number {
  const now = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getRegulationUrgency(daysLeft: number): 'critical' | 'warning' | 'info' {
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 90) return 'warning';
  return 'info';
}

export function getUpcomingRegulations(limit?: number): RegulationDeadline[] {
  const now = new Date().toISOString();
  const upcoming = REGULATION_DEADLINES.filter((r) => r.deadline > now.slice(0, 10)).sort((a, b) =>
    a.deadline.localeCompare(b.deadline),
  );
  return limit ? upcoming.slice(0, limit) : upcoming;
}
