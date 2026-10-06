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
  /** 마감한 차수 — 마감하면 그 차수 쪽지시험이 열리고, 그 차수 자료는 더 바꾸지 않는다 */
  closedRounds: number[];
  closeRound: (round: number) => void;
}

export const useEducationContentStore = create<EducationContentState>()((set) => ({
  reports: MOCK_EDU_REPORTS,
  // 시드 — 예전 2026-07(1차) · 2026-08(2차)은 이미 끝난 달이라 마감 상태
  closedRounds: [1, 2],

  upsertReport: (report) =>
    set((s) => {
      const exists = s.reports.some((r) => r.id === report.id);
      const reports = exists
        ? s.reports.map((r) => (r.id === report.id ? report : r))
        : [report, ...s.reports];
      // 차수 내림차순 → 발행일 내림차순 유지
      reports.sort((a, b) => (b.round ?? 0) - (a.round ?? 0) || b.publishedAt.localeCompare(a.publishedAt));
      return { reports };
    }),

  deleteReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

  setStatus: (id, status) =>
    set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)) })),

  closeRound: (round) => set((s) => (s.closedRounds.includes(round) ? s : { closedRounds: [...s.closedRounds, round] })),
}));
