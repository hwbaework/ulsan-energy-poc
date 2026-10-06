/* RE100 교육 — 교육 자료(차수별) / 차수 쪽지시험(전 문항 정복형) / 수료증. 자료 수집만 월별 */

export interface EduReportSection {
  heading: string;
  body: string[];
  /** 본문에 함께 표시할 이미지 (흐름도 등) — url + 설명 */
  images?: { url: string; caption?: string }[];
}

export interface EduQuizQuestion {
  id: string; // `${reportId}:${n}` — 차수 시험에서 레포트 간 중복 방지
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
  /** 기본 정보 — 차수에 속하지 않는 상시 자료. "기본" 그룹으로 묶이고 시험은 항상 응시 가능 */
  basic?: boolean;
  /** 차수 — 1차, 2차… 관리자가 자료를 묶는 단위. 기본 정보는 없음 */
  round?: number;
}

/** "기본" 그룹을 차수 키처럼 다루기 위한 특수 식별자 */
export const BASIC_GROUP = 'basic';

export function isPublished(report: EduReport): boolean {
  return report.status !== 'draft';
}

/**
 * 차수 쪽지시험 진행 상태.
 * 합격 점수 개념 없음 — 틀린 문항만 계속 다시 풀어 전 문항을 맞히면 이수(완료).
 */
export interface EduQuizProgress {
  round: string; // 차수 키 '1' · '2' … · 기본 정보는 BASIC_GROUP
  correctQuestionIds: string[];
  attemptCount: number; // 채점 횟수
  completedAt?: string; // 전 문항 정답 달성 시각 (ISO)
}

/** 수료증 — 쪽지시험 전 문항을 맞히면 자동 발급(관리자 대리 발급 없음). 사업계획서 p.142 */
export interface EduCertificate {
  id: string;
  certificateNo: string; // RE100-EDU-YYYY-NNNN
  round: string; // 차수 키 · 기본 정보는 BASIC_GROUP
  courseTitle: string; // 예: 1차 RE100 교육
  userName: string;
  companyName?: string;
  issuedAt: string; // YYYY-MM-DD
}

/** 월 라벨 — 자료 수집(월별)에서 쓴다. 날짜 양식은 하이픈(2026-07) */
export function formatMonthKo(month: string): string {
  if (month === BASIC_GROUP) return '기본 정보';
  return month;
}

/** 자료의 그룹 키 — 기본 정보는 BASIC_GROUP, 그 외 차수 '1' · '2' … */
export function roundKey(report: Pick<EduReport, 'basic' | 'round'>): string {
  return report.basic ? BASIC_GROUP : String(report.round ?? 1);
}

/** 차수 라벨 — 1차 · 2차 … 기본 그룹은 '기본 정보' */
export function formatRound(key: string): string {
  if (key === BASIC_GROUP) return '기본 정보';
  return `${key}차`;
}

/** 쪽지시험 이름 — 기본 쪽지시험 · n차 쪽지시험 */
export function quizTitle(key: string): string {
  return key === BASIC_GROUP ? '기본 쪽지시험' : `${formatRound(key)} 쪽지시험`;
}

export function roundCourseTitle(key: string): string {
  if (key === BASIC_GROUP) return 'RE100 기본 교육';
  return `${formatRound(key)} RE100 교육`;
}

/**
 * 쪽지시험 응시 가능 여부.
 * - 기본 그룹: 언제든 응시 가능
 * - 차수: 관리자가 그 차수를 마감한 뒤부터 (마감 전에는 자료 열람만)
 */
export function isQuizOpen(key: string, closedRounds: number[]): boolean {
  if (key === BASIC_GROUP) return true;
  return closedRounds.includes(Number(key));
}

/** 마감한 차수인지 — 마감한 차수는 쪽지시험이 열려 있으니 그 차수 문항·초안 발행을 바꾸지 않는다(기본 정보 제외) */
export function isRoundClosed(key: string, closedRounds: number[]): boolean {
  return key !== BASIC_GROUP && closedRounds.includes(Number(key));
}
