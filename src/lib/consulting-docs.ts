/**
 * 컨설팅 › 문서관리 — 컨설팅을 받고 나온 진짜 결과물, RE100 컨설팅 결과보고서(실제 PDF)만.
 * 보고서는 기업당 하나(발전소 하나). 보고서 안에 계약번호가 없으면 빈칸, 발행일은 표지에 있는 데까지(일 없으면 YYYY-MM).
 * 전기사용자는 우리 회사 보고서만, 관리자는 모든 회사. 무료진단 검토서는 내 컨설팅, 계약서·청구서는 전력거래 문서관리에.
 */
export interface ConsultingDoc {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  category: '결과보고서';
  contractNo: string; // 보고서에 적힌 계약번호 — 없으면 빈칸
  plantName: string;
  issuedAt: string; // 2025-11 (일자 모르면 비움)
  plantIds: number[]; // 보고서가 다루는 발전소(관제 ID) — 그 발전소에 연결된 계정도 본다
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
    contractNo: '', // 보고서 안에 계약번호 없음
    plantName: '한일튜브',
    issuedAt: '2025-11', // 표지 '2025. 11.' — 일자 없음
    plantIds: [17514], // 한일튜브
    pages: 53,
    pdf: '/docs/hanil-re100-report-v2.0.pdf',
  },
];
