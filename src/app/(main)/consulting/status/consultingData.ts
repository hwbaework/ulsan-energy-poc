// 내 컨설팅 (수용가 관점) — 공유 타입 및 유틸리티

export interface ConsultingStep {
  title: string;
  actor: '수용가' | '컨설턴트' | '양측';
  state: 'done' | 'action' | 'upcoming';
  date: string;
  desc: string;
  note?: string;
  artifact?: { label: string; url?: string };
}

export interface ConsultingSite {
  name: string;
  address: string;
}

export interface ConsultingItem {
  id: number;
  title: string;
  domain: string;
  consultant: string;
  consultantInitial: string;
  rating: number;
  client: string;
  contractAmount: number;
  duration: string;
  startedAt: string;
  expectedEnd: string;
  sites: ConsultingSite[];
  diagnosis: { grade: number; currentRE: number; targetRE: number };
  steps: ConsultingStep[];
  action: {
    headline: string;
    desc: string;
    kind: 'survey' | 'schedule' | 'site' | 'report' | 'review' | 'settlement' | 'wait' | 'done';
    branchNote: string;
  };
  firstProposal?: {
    source: string;
    receivedAt: string;
    acceptedAt: string;
    cost: number;
    duration: string;
    message: string;
    scope: string[];
  } | null;
  chatSeed: { id: number; from: string; text: string; time: string }[];
}

export const ACTOR_META: Record<string, string> = {
  수용가: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  컨설턴트: 'bg-blue-500/10 text-blue-300 ring-blue-500/30',
  양측: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
};

export const REVIEW_DOCUMENTS = [
  {
    id: 1,
    title: 'RE100 이행 로드맵 보고서',
    pages: 42,
    format: 'PDF',
    desc: '3개년 RE100 이행 전략 및 투자 로드맵',
    file: 'RE100_로드맵_최종.pdf',
    author: '김에너지',
    preview: [
      'RE100 현황 분석 및 목표 설정',
      'PPA·자가발전·인증서 조합 전략',
      '연간 투자 계획 및 ROI 분석',
    ],
  },
  {
    id: 2,
    title: '에너지 절감 분석 스프레드시트',
    pages: 8,
    format: 'XLSX',
    desc: '에너지원별 절감 잠재량 및 비용 분석',
    file: '에너지절감_분석.xlsx',
    author: '김에너지',
    preview: ['전력·가스·열 사용량 분석', '절감 시나리오 3안 비교', '투자 대비 절감 효과 산출'],
  },
  {
    id: 3,
    title: '태양광 설비 투자 제안서',
    pages: 15,
    format: 'PDF',
    desc: '자가 태양광 설비 설치 투자 타당성 분석',
    file: '태양광_투자제안.pdf',
    author: '김에너지',
    preview: ['옥상·부지 일사량 분석', '설비 용량 및 발전량 예측', 'PPA vs 직접투자 비교'],
  },
];

export const CONSULTINGS: ConsultingItem[] = [];

export function isMyTurn(c: ConsultingItem): boolean {
  const current = c.steps.find((s) => s.state === 'action');
  return current != null && (current.actor === '수용가' || current.actor === '양측');
}

export function getCurrentStep(c: ConsultingItem): ConsultingStep | undefined {
  return c.steps.find((s) => s.state === 'action');
}

export function getDoneCount(c: ConsultingItem): number {
  return c.steps.filter((s) => s.state === 'done').length;
}
