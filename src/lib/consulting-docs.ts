/**
 * 컨설팅 › 문서관리 — 컨설팅을 받고 나온 진짜 결과물, RE100 컨설팅 결과보고서(실제 PDF)만.
 * 보고서는 기업당 하나 — onsite · 자가소비 계약을 한 보고서에서 함께 다룬다.
 * 전기사용자는 우리 회사 보고서만, 관리자는 모든 회사. 무료진단 검토서는 내 컨설팅, 계약서·청구서는 전력거래 문서관리에.
 */
export interface ConsultingDoc {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  category: '결과보고서';
  contracts: { no: string; plant: string }[];
  issuedAt: string; // 2025-11 (일자 모르면 비움)
  pages: number;
  pdf: string; // public 경로
}

export const CONSULTING_DOCS: ConsultingDoc[] = [
  {
    id: 1,
    companyId: 4,
    companyName: '한일튜브(주)',
    title: '(한일튜브) RE100 컨설팅 결과보고서 v2.0',
    category: '결과보고서',
    contracts: [
      { no: 'CT-2025-0001', plant: '한일튜브(onsite)' },
      { no: 'CT-2025-0002', plant: '한일튜브(자가소비)' },
    ],
    issuedAt: '2025-11',
    pages: 53,
    pdf: '/docs/hanil-re100-report-v2.0.pdf',
  },
];
