import { create } from 'zustand';

/**
 * 교육 자료 데이터 소스 등록부 — "어디서 가져오는지"의 목록.
 * POC 인메모리(새로고침 시 시드로 리셋). 실제 수집은 백엔드 스케줄러가 이 목록 기준으로 수행.
 * 시드는 RE100_데이터소스_확정본.xlsx 기준.
 */

export type SourceMethod = 'API' | '크롤링' | 'RSS' | '원전';

export interface EduDataSource {
  id: string;
  org: string; // 기관 (예: 기후에너지환경부)
  name: string; // 소스명 (예: 보도자료)
  method: SourceMethod;
  url: string;
  keywords?: string;
  /** 수집 커넥터 라우트 — 없으면 아직 백엔드 연동 전 (등록만 된 상태) */
  endpoint?: string;
  /** API 인증키 (등록만 — 실제 사용은 백엔드 커넥터 연결 시) */
  apiKey?: string;
  /** 원전/참고 자료 — 일일 수집 피드에서 제외 */
  reference?: boolean;
  /** 인증키가 있어야 동작하는 소스 — 키 등록 전에는 "키 필요" 상태 */
  requiresKey?: boolean;
}

const SEED_SOURCES: EduDataSource[] = [
  {
    id: 'src-mcee-press',
    org: '기후에너지환경부',
    name: '보도자료',
    method: '크롤링',
    url: 'https://www.mcee.go.kr/home/web/board/list.do?menuId=10598&boardMasterId=939',
    keywords: 'RE100, PPA, 재생에너지, 녹색프리미엄, 분산에너지',
    endpoint: '/api/collect/mcee',
  },
  {
    id: 'src-law-leg',
    org: '국민참여입법센터',
    name: '입법예고',
    method: 'API',
    url: 'https://www.lawmaking.go.kr/rest/ogLmPp.xml',
    keywords: '산업통상자원부 소관 · 재생에너지, 전기사업법, 분산에너지',
    endpoint: '/api/collect/legislation?type=leg',
  },
  {
    id: 'src-law-admin',
    org: '국민참여입법센터',
    name: '행정예고',
    method: 'API',
    url: 'https://www.lawmaking.go.kr/rest/ptcpAdmPp.xml',
    keywords: '산업통상자원부 소관 · 재생에너지, RE100, 고시·훈령',
    endpoint: '/api/collect/legislation?type=admin',
  },
  {
    id: 'src-law-admrul',
    org: '기후에너지환경부',
    name: '고시·훈령·예규',
    method: 'API',
    url: 'https://open.law.go.kr',
    keywords: '재생에너지, 전기사업, 사용 확인',
    endpoint: '/api/collect/admrul',
  },
  {
    id: 'src-knrec-guide',
    org: '한국에너지공단',
    name: 'K-RE100 제도 안내',
    method: '원전',
    url: 'https://www.knrec.or.kr/biz/introduce/new_policy/intro_kre100.do?gubun=A',
    keywords: '이행수단 5종 정의·절차·FAQ',
    reference: true,
  },
  {
    id: 'src-knrec-notice',
    org: '한국에너지공단',
    name: '공지사항·사업공고',
    method: '크롤링',
    url: 'https://www.knrec.or.kr/biz/pds/notice/list.do',
    keywords: 'RE100, 사용확인, 서식, 모집',
    endpoint: '/api/collect/knrec',
  },
  {
    id: 'src-re100-global',
    org: '글로벌 RE100',
    name: 'Tech guidance & FAQ',
    method: '크롤링',
    url: 'https://www.there100.org/technical-guidance',
    keywords: 'Technical Criteria, Reporting·Accountability Guidance',
    endpoint: '/api/collect/re100-global',
    reference: true,
  },
];

let counter = 0;

interface EducationSourceState {
  sources: EduDataSource[];
  /** 이미 확인한 수집 항목 링크 — "마지막 수집 이후 새 글만" 판별용 */
  seenLinks: string[];
  addSource: (source: Omit<EduDataSource, 'id'>) => void;
  updateSource: (id: string, patch: Partial<Omit<EduDataSource, 'id'>>) => void;
  markSeen: (links: string[]) => void;
}

export const useEducationSourceStore = create<EducationSourceState>()((set) => ({
  sources: SEED_SOURCES,
  seenLinks: [],

  addSource: (source) =>
    set((s) => ({ sources: [...s.sources, { ...source, id: `src-${Date.now()}-${++counter}` }] })),

  updateSource: (id, patch) =>
    set((s) => ({ sources: s.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

  markSeen: (links) => set((s) => ({ seenLinks: [...new Set([...s.seenLinks, ...links])] })),
}));
