/**
 * RE100 교육 — 자료 수집 목업.
 * 실제로는 백엔드 수집기가 아래 소스(API·크롤링)에서 글을 모은다. POC 는 수집 결과를 고정 목업으로 보여 주고,
 * [초안 만들기] → 편집기에서 원문 본문(목업)을 채운다. 서버 라우트(/api/collect)는 가져오지 않았다.
 */

export interface CollectedItem {
  id: string;
  org: string; // 출처 기관
  dept?: string; // 세부 부서·게시판
  title: string;
  link: string;
  pubDate: string; // YYYY-MM-DD
  summary?: string;
}

/** 원문 본문 — [초안 만들기]·[본문 불러오기] 가 채우는 값 */
export interface CollectedArticle {
  title: string;
  body: string;
  attachments?: string[];
}

const KNREC_7167 = 'https://www.knrec.or.kr/biz/pds/notice/view.do?no=7167';
const MCEE_PRESS = 'https://www.mcee.go.kr/home/web/board/list.do?menuId=10598&boardMasterId=939';
const LAW_LEG = 'https://www.lawmaking.go.kr/lmSts/ogLmPp';
const LAW_ADMIN = 'https://www.lawmaking.go.kr/lmSts/ptcpAdmPp';
const LAW_ADMRUL = 'https://open.law.go.kr';

export const MOCK_COLLECTED: CollectedItem[] = [
  { id: 'col-knrec-7167', org: '한국에너지공단', title: '2027년도 재생에너지 금융지원사업 사전 수요조사 안내', link: KNREC_7167, pubDate: '2026-10-01', summary: '공지사항' },
  { id: 'col-mcee-0926', org: '기후에너지환경부', dept: '재생에너지정책과', title: '재생에너지 직접 PPA 활성화를 위한 제도 개선방안 발표', link: `${MCEE_PRESS}#0926`, pubDate: '2026-09-26', summary: '보도자료' },
  { id: 'col-leg-0918', org: '국민참여입법센터', title: '전기사업법 시행령 일부개정령안 입법예고', link: `${LAW_LEG}#0918`, pubDate: '2026-09-18', summary: '입법예고 · 산업통상자원부' },
  { id: 'col-admin-0910', org: '국민참여입법센터', title: '신·재생에너지 공급인증서 발급 및 거래시장 운영에 관한 규칙 개정 행정예고', link: `${LAW_ADMIN}#0910`, pubDate: '2026-09-10', summary: '행정예고' },
  { id: 'col-admrul-0903', org: '기후에너지환경부', title: '한국형 RE100(K-RE100) 제도 운영지침 일부개정 고시', link: `${LAW_ADMRUL}#0903`, pubDate: '2026-09-03', summary: '고시·훈령·예규' },
];

const ARTICLES: Record<string, CollectedArticle> = {
  [KNREC_7167]: {
    title: '[안내] 2027년도 재생에너지 금융지원사업 사전 수요조사 안내',
    body: [
      '안녕하십니까, 한국에너지공단 재생지원사업처입니다.',
      '우리 공단은 재생에너지 보급촉진을 위해 장기·저리 융자 혜택을 제공하는 재생에너지 금융지원 사업을 운영하고 있습니다.',
      "이와 관련하여, '27년 사업 추진방향 설정 및 예산책정 등을 위해 다음과 같이 사전 수요조사를 실시하오니 참여를 희망하는 발전사업자 등께서는 회신하여 주시기 바랍니다.",
      "ㅇ 조사대상 : 내년('27년) 금융지원 사업 신청(예정) 수요자",
      "ㅇ 조사기간 : '26.10.16. 까지 (기한 이후 제출 희망시 사전 유선연락 요망)",
      "ㅇ 조사방법 : '27년 융자희망자는 첨부의 수요조사서 양식 작성하여 이메일 회신",
      'ㅇ 접 수 처 : kaesco@energy.or.kr',
    ].join('\n\n'),
    attachments: ['2027년도 재생에너지 금융지원사업 수요조사서.hwp'],
  },
  [`${MCEE_PRESS}#0926`]: {
    title: '재생에너지 직접 PPA 활성화를 위한 제도 개선방안 발표',
    body: [
      '기후에너지환경부는 기업의 재생에너지 조달 수단을 넓히기 위해 직접 PPA 제도 개선방안을 발표했습니다.',
      '주요 내용은 직접 PPA 참여 가능 수요기업의 계약전력 기준 완화, 부족전력 거래 절차 간소화, 망 이용요금 산정 기준 명확화입니다.',
      '개선안은 관계 고시 개정을 거쳐 2027년 상반기부터 단계적으로 시행될 예정입니다.',
    ].join('\n\n'),
  },
  [`${LAW_LEG}#0918`]: {
    title: '전기사업법 시행령 일부개정령안 입법예고',
    body: [
      '분산에너지 활성화와 재생에너지 전력거래 다양화를 위해 전기사업법 시행령 일부를 개정하고자 그 취지와 주요 내용을 국민에게 미리 알려 의견을 듣고자 합니다.',
      '주요 내용: 재생에너지 전기공급사업자의 등록 요건 정비, 전력거래 정산 절차 보완',
      '의견 제출 기한: 2026-10-28',
    ].join('\n\n'),
  },
  [`${LAW_ADMIN}#0910`]: {
    title: '신·재생에너지 공급인증서 발급 및 거래시장 운영에 관한 규칙 개정 행정예고',
    body: [
      'REC 발급 및 거래 절차를 개선하기 위해 관련 규칙 개정안을 행정예고합니다.',
      '주요 내용: 자가소비형 설비의 REC 발급 기준 명확화, 거래시장 매매 단위 조정',
    ].join('\n\n'),
  },
  [`${LAW_ADMRUL}#0903`]: {
    title: '한국형 RE100(K-RE100) 제도 운영지침 일부개정 고시',
    body: [
      'K-RE100 이행수단별 사용 확인 절차와 제출 서류를 정비하는 운영지침 개정 사항을 고시합니다.',
      '주요 내용: 자가발전 이행 실적 확인서 서식 변경, 제3자 PPA 실적 인정 기준 보완',
    ].join('\n\n'),
  },
};

/** 원문 URL → 본문 (목업). 없으면 null — 편집기에서 직접 입력 안내 */
export function getCollectedArticle(url: string): CollectedArticle | null {
  return ARTICLES[url.trim()] ?? null;
}
