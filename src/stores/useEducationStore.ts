import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import type { EduCertificate, EduQuizProgress } from '@/types/education';
import { roundCourseTitle } from '@/types/education';
import { MOCK_EDU_REPORTS, getRoundQuiz } from '@/lib/mock-education';

interface GradeRoundInput {
  round: string;
  /** 이번 라운드에서 새로 맞힌 문항 id */
  correctQuestionIds: string[];
  /** 해당 차수 시험의 현재 전체 문항 id — 자료 수정/삭제로 사라진 문항의 기록은 걸러낸다 */
  allQuestionIds: string[];
  userName: string;
  companyName?: string;
}

interface EducationState {
  readReportIds: string[];
  progressByRound: Record<string, EduQuizProgress>;
  certificates: EduCertificate[];
  /** 데모 — 1차를 이미 이수한 상태로 시작했는지 */
  demoSeeded: boolean;
  seedDemo: (userName: string, companyName?: string) => void;
  markRead: (reportId: string) => void;
  /**
   * 라운드 채점 반영. 맞힌 문항은 누적되고, 전 문항을 맞히면 이수 처리 후
   * 수료증을 발급해 반환한다 (이미 발급된 차수면 null). 관리자 대리 발급은 없다.
   */
  gradeRound: (input: GradeRoundInput) => {
    progress: EduQuizProgress;
    completed: boolean;
    certificate: EduCertificate | null;
  };
}

let counter = 0;
/** 다음 수료증 일련번호 — 이미 있는 번호 중 가장 큰 번호 + 1 (데모 1차 등과 겹치지 않게) */
const nextCertNo = (certs: EduCertificate[], year: number) => {
  const max = certs.reduce((m, c) => Math.max(m, Number(c.certificateNo.slice(-4)) || 0), 0);
  return `RE100-EDU-${year}-${String(max + 1).padStart(4, '0')}`;
};
// 로컬 시각(한국) 기준 날짜 — toISOString 은 UTC 라 자정 무렵 하루 어긋난다
const localIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

// POC — 브라우저(localStorage)에 저장해 새로고침해도 이수·수료증이 남는다. 백엔드 구현 시 서버 저장으로 교체
export const useEducationStore = create<EducationState>()(
  persist(
    (set, get) => ({
      readReportIds: [],
      progressByRound: {},
      certificates: [],
      demoSeeded: false,

      // 데모 — 발전사업자·전기사용자는 1차를 이미 이수(전 문항 정답 · 수료증 발급)한 상태로 시작한다. 한 번만
      seedDemo: (userName, companyName) => {
        if (get().demoSeeded) return;
        const ids = getRoundQuiz(MOCK_EDU_REPORTS, '1').map((q) => q.id);
        const progress: EduQuizProgress = { round: '1', correctQuestionIds: ids, attemptCount: 1, completedAt: '2026-08-05T10:00:00' };
        const certificate: EduCertificate = {
          id: 'cert-demo-1',
          certificateNo: nextCertNo(get().certificates, 2026),
          round: '1',
          courseTitle: roundCourseTitle('1'),
          userName,
          companyName,
          issuedAt: '2026-08-05',
        };
        set((s) => ({
          demoSeeded: true,
          progressByRound: { ...s.progressByRound, '1': progress },
          certificates: s.certificates.some((c) => c.round === '1') ? s.certificates : [certificate, ...s.certificates],
        }));
      },

      markRead: (reportId) =>
        set((s) => (s.readReportIds.includes(reportId) ? s : { readReportIds: [...s.readReportIds, reportId] })),

      gradeRound: ({ round, correctQuestionIds, allQuestionIds, userName, companyName }) => {
        const valid = new Set(allQuestionIds);
        const prev = get().progressByRound[round];
        const merged = new Set([...(prev?.correctQuestionIds ?? []), ...correctQuestionIds].filter((id) => valid.has(id)));
        const completed = valid.size > 0 && merged.size >= valid.size;
        const now = new Date();

        const progress: EduQuizProgress = {
          round,
          correctQuestionIds: [...merged],
          attemptCount: (prev?.attemptCount ?? 0) + 1,
          completedAt: prev?.completedAt ?? (completed ? localIso(now) : undefined),
        };

        let certificate: EduCertificate | null = null;
        const alreadyIssued = get().certificates.some((c) => c.round === round);
        if (completed && !alreadyIssued) {
          certificate = {
            id: `cert-${Date.now()}-${++counter}`,
            certificateNo: nextCertNo(get().certificates, now.getFullYear()),
            round,
            courseTitle: roundCourseTitle(round),
            userName,
            companyName,
            issuedAt: localIso(now).slice(0, 10),
          };
        }

        set((s) => ({
          progressByRound: { ...s.progressByRound, [round]: progress },
          certificates: certificate ? [certificate, ...s.certificates] : s.certificates,
        }));

        return { progress, completed, certificate };
      },
    }),
    {
      name: 'ulsan-education-poc-v3', // v3 — 수료증 번호 겹침(데모 1차 · 기본 둘 다 0001) 정리. v2 — 월별 → 차수별
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

/** 데모 시작 상태 — 저장본을 올린 뒤에 1차 이수를 채운다(관리자는 제외) */
export function useSeedEducationDemo(userName: string | undefined, companyName: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !userName) return;
    const run = () => useEducationStore.getState().seedDemo(userName, companyName);
    if (useEducationStore.persist.hasHydrated()) {
      run();
      return;
    }
    return useEducationStore.persist.onFinishHydration(run);
  }, [userName, companyName, enabled]);
}
