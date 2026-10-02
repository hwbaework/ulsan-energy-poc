import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import type { EduCertificate, EduQuizProgress } from '@/types/education';
import { monthCourseTitle } from '@/types/education';

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
  certificates: EduCertificate[];
  markRead: (reportId: string) => void;
  /**
   * 라운드 채점 반영. 맞힌 문항은 누적되고, 전 문항을 맞히면 이수 처리 후
   * 수료증을 발급해 반환한다 (이미 발급된 월이면 null). 관리자 대리 발급은 없다.
   */
  gradeRound: (input: GradeRoundInput) => {
    progress: EduQuizProgress;
    completed: boolean;
    certificate: EduCertificate | null;
  };
}

let counter = 0;
// 로컬 시각(한국) 기준 날짜 — toISOString 은 UTC 라 자정 무렵 하루 어긋난다
const localIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

// POC — 브라우저(localStorage)에 저장해 새로고침해도 이수·수료증이 남는다. 백엔드 구현 시 서버 저장으로 교체
export const useEducationStore = create<EducationState>()(
  persist(
    (set, get) => ({
      readReportIds: [],
      progressByMonth: {},
      certificates: [],

      markRead: (reportId) =>
        set((s) => (s.readReportIds.includes(reportId) ? s : { readReportIds: [...s.readReportIds, reportId] })),

      gradeRound: ({ month, correctQuestionIds, allQuestionIds, userName, companyName }) => {
        const valid = new Set(allQuestionIds);
        const prev = get().progressByMonth[month];
        const merged = new Set([...(prev?.correctQuestionIds ?? []), ...correctQuestionIds].filter((id) => valid.has(id)));
        const completed = valid.size > 0 && merged.size >= valid.size;
        const now = new Date();

        const progress: EduQuizProgress = {
          month,
          correctQuestionIds: [...merged],
          attemptCount: (prev?.attemptCount ?? 0) + 1,
          completedAt: prev?.completedAt ?? (completed ? localIso(now) : undefined),
        };

        let certificate: EduCertificate | null = null;
        const alreadyIssued = get().certificates.some((c) => c.month === month);
        if (completed && !alreadyIssued) {
          const seq = String(get().certificates.length + 1).padStart(4, '0');
          certificate = {
            id: `cert-${Date.now()}-${++counter}`,
            certificateNo: `RE100-EDU-${now.getFullYear()}-${seq}`,
            month,
            courseTitle: monthCourseTitle(month),
            userName,
            companyName,
            issuedAt: localIso(now).slice(0, 10),
          };
        }

        set((s) => ({
          progressByMonth: { ...s.progressByMonth, [month]: progress },
          certificates: certificate ? [certificate, ...s.certificates] : s.certificates,
        }));

        return { progress, completed, certificate };
      },
    }),
    {
      name: 'ulsan-education-poc',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
    },
  ),
);

/** 브라우저에서 저장본을 올린다 — 교육 화면 최상단에서 호출 */
export function useHydrateEducation() {
  useEffect(() => {
    void useEducationStore.persist.rehydrate();
  }, []);
}
