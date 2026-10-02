/* RE100 교육 — 동향 레포트 피드(월별) / 월간 쪽지시험(전 문항 정복형) / 수료증 */

export interface EduReportSection {
  heading: string;
  body: string[];
  /** 본문에 함께 표시할 이미지 (흐름도 등) — url + 설명 */
  images?: { url: string; caption?: string }[];
}

export interface EduQuizQuestion {
  id: string; // `${reportId}:${n}` — 월간 시험에서 레포트 간 중복 방지
  question: string;
  options: string[];
  answerIndex: number;
}

/** 자료 출처 (원문 근거) */
export interface EduSource {
  label: string;
  url?: string;
}

/** 별첨 파일 — url이 있으면 사이트에서 열람/다운로드, 없으면 파일명만(원문에서 받기) */
export interface EduAttachment {
  name: string;
  url?: string;
}

/** 초안: 관리자만 열람, 발행 전 검토 상태. 미지정은 published로 간주(하위 호환). */
export type EduReportStatus = 'draft' | 'published';

export interface EduReport {
  id: string;
  title: string;
  publishedAt: string; // YYYY-MM-DD
  sections: EduReportSection[];
  questions: EduQuizQuestion[];
  sources?: EduSource[];
  status?: EduReportStatus;
  /** 출처 기관 칩 (예: 기후에너지환경부, 한국에너지공단) — 없으면 "직접 작성" */
  sourceName?: string;
  /** 별첨 파일 (url 있으면 사이트에서 열람, 없으면 파일명만 — 원문에서 받기) */
  attachments?: EduAttachment[];
  /** 기본 정보 — 월에 속하지 않는 상시 자료. "기본" 그룹으로 묶이고 시험은 항상 응시 가능 */
  basic?: boolean;
}

/** "기본" 그룹을 월 키처럼 다루기 위한 특수 식별자 */
export const BASIC_GROUP = 'basic';

export function isPublished(report: EduReport): boolean {
  return report.status !== 'draft';
}

/**
 * 월간 쪽지시험 진행 상태.
 * 합격 점수 개념 없음 — 틀린 문항만 계속 다시 풀어 전 문항을 맞히면 이수(완료).
 */
export interface EduQuizProgress {
  month: string; // YYYY-MM
  correctQuestionIds: string[];
  attemptCount: number; // 채점 횟수
  completedAt?: string; // 전 문항 정답 달성 시각 (ISO)
}

/** 월 단위 수료증 — 해당 월 시험 전 문항 이수 시 발급 */
export interface EduCertificate {
  id: string;
  certificateNo: string; // RE100-EDU-YYYY-NNNN
  month: string; // YYYY-MM
  courseTitle: string; // 예: 2026년 7월 RE100 동향 교육
  userName: string;
  companyName?: string;
  issuedAt: string; // YYYY-MM-DD
}

/** 월 라벨 — 날짜 양식은 하이픈(2026-07), 기본 그룹은 '기본 정보' */
export function formatMonthKo(month: string): string {
  if (month === BASIC_GROUP) return '기본 정보';
  return month;
}

export function monthCourseTitle(month: string): string {
  if (month === BASIC_GROUP) return 'RE100 기본 교육';
  return `${formatMonthKo(month)} RE100 교육`;
}

/**
 * 쪽지시험 응시 가능 여부.
 * - 기본 그룹: 언제든 응시 가능
 * - 월 그룹: 해당 월이 끝난 뒤부터 (진행 중인 달은 자료 열람만)
 */
export function isQuizOpen(month: string, now: Date = new Date()): boolean {
  if (month === BASIC_GROUP) return true;
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return month < current;
}
