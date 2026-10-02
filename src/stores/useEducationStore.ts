import { create } from 'zustand';
import type { EduQuizProgress } from '@/types/education';

interface GradeRoundInput {
  month: string;
  /** 이번 라운드에서 새로 맞힌 문항 id */
  correctQuestionIds: string[];
  /** 해당 월 시험의 현재 전체 문항 id — 자료 수정/삭제로 사라진 문항의 기록은 걸러낸다 */
  allQuestionIds: string[];
  userName: string;
  companyName?: string;
}

interface EducationState {
  readReportIds: string[];
  progressByMonth: Record<string, EduQuizProgress>;
  markRead: (reportId: string) => void;
  /** 라운드 채점 반영. 맞힌 문항은 누적되고, 전 문항을 맞히면 이수(완료) 처리 */
  gradeRound: (input: GradeRoundInput) => {
    progress: EduQuizProgress;
    completed: boolean;
  };
}

// POC 단계 — 인메모리(새로고침 시 초기화). 백엔드 구현 시 서버 저장으로 교체한다.
export const useEducationStore = create<EducationState>()((set, get) => ({
  readReportIds: [],
  progressByMonth: {},

  markRead: (reportId) =>
    set((s) =>
      s.readReportIds.includes(reportId) ? s : { readReportIds: [...s.readReportIds, reportId] },
    ),

  gradeRound: ({ month, correctQuestionIds, allQuestionIds }) => {
    const valid = new Set(allQuestionIds);
    const prev = get().progressByMonth[month];
    const merged = new Set(
      [...(prev?.correctQuestionIds ?? []), ...correctQuestionIds].filter((id) => valid.has(id)),
    );
    const completed = valid.size > 0 && merged.size >= valid.size;
    const now = new Date();

    const progress: EduQuizProgress = {
      month,
      correctQuestionIds: [...merged],
      attemptCount: (prev?.attemptCount ?? 0) + 1,
      completedAt: prev?.completedAt ?? (completed ? now.toISOString() : undefined),
    };


    set((s) => ({
      progressByMonth: { ...s.progressByMonth, [month]: progress },
    }));

    return { progress, completed };
  },
}));
