import { create } from 'zustand';
import type { EduReport, EduReportStatus } from '@/types/education';
import { MOCK_EDU_REPORTS } from '@/lib/mock-education';

/**
 * 교육 자료 콘텐츠 저장소 (관리자 추가/수정/삭제).
 * POC 단계 — 인메모리(새로고침 시 시드로 리셋). 백엔드 구현 시 api/education 모듈로 교체한다.
 */
interface EducationContentState {
  reports: EduReport[];
  upsertReport: (report: EduReport) => void;
  deleteReport: (id: string) => void;
  /** 발행/발행취소 — draft ↔ published */
  setStatus: (id: string, status: EduReportStatus) => void;
}

export const useEducationContentStore = create<EducationContentState>()((set) => ({
  reports: MOCK_EDU_REPORTS,

  upsertReport: (report) =>
    set((s) => {
      const exists = s.reports.some((r) => r.id === report.id);
      const reports = exists
        ? s.reports.map((r) => (r.id === report.id ? report : r))
        : [report, ...s.reports];
      // 발행일 내림차순 유지
      reports.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      return { reports };
    }),

  deleteReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

  setStatus: (id, status) =>
    set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)) })),
}));
