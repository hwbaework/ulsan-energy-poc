import type { EduQuizQuestion, EduReport } from '@/types/education';
import { BASIC_GROUP, isPublished } from '@/types/education';

/**
 * RE100 교육 자료 목데이터 — 기본 정보(basic) + 차수별 자료(예전 2026-07 → 1차, 2026-08 → 2차).
 * 백엔드 구현 시 api/education 모듈로 교체하고 이 파일은 제거한다.
 */
export const MOCK_EDU_REPORTS: EduReport[] = [
  {
    id: 'rpt-260731',
    title: 'SMP와 REC 이해하기 — 전력 가격이 결정되는 구조',
    publishedAt: '2026-07-31',
    round: 1,
    sourceName: '기후에너지환경부',
    sections: [
      {
        heading: 'SMP와 REC란',
        body: [
          'SMP(계통한계가격)는 전력시장에서 전기를 사고파는 기준 가격으로, 한계 발전기의 연료비 — 특히 LNG 가격 흐름에 크게 좌우됩니다. REC(재생에너지 공급인증서)는 재생에너지로 전기를 생산했음을 인증하는 증서로, 의무이행 수요와 발급 물량의 균형에 따라 가격이 움직입니다. 두 가격은 결정 구조가 달라 따로 움직일 수 있습니다.',
        ],
      },
      {
        heading: '발전사업자·수요기업 관점',
        body: [
          '재생에너지 발전 수익은 SMP(전력 판매)와 REC(인증서 판매)의 합으로 구성되므로, 고정가격계약과 현물 매도의 유불리는 SMP+REC 합산 가격 기준으로 판단해야 합니다. 수요기업 입장에서는 SMP 상승기에 PPA 고정단가의 상대적 경제성이 부각된다는 점을 이해해 두면 계약 시점 판단에 도움이 됩니다.',
        ],
      },
    ],
    questions: [
      {
        id: 'rpt-260731:1',
        question: 'SMP 가격에 가장 직접적인 영향을 주는 요인은?',
        options: ['REC 의무이행 수요', '연료비(LNG 가격) 흐름', '탄소배출권 가격', '환율'],
        answerIndex: 1,
      },
      {
        id: 'rpt-260731:2',
        question: '고정가격계약과 현물 매도의 유불리를 비교하는 기준으로 옳은 것은?',
        options: ['SMP 단독 가격', 'REC 단독 가격', 'SMP+REC 합산 가격', '탄소배출권 가격'],
        answerIndex: 2,
      },
    ],
  },
  {
    id: 'rpt-260728',
    title: '태양광 이격거리 규제 개편 — 주택 200m 통일, 도로 기준 삭제',
    publishedAt: '2026-07-28',
    round: 1,
    sourceName: '기후에너지환경부',
    sections: [
      {
        heading: '개편 내용',
        body: [
          '기존에는 지자체 조례마다 주거지·도로로부터의 이격거리 기준이 100m에서 1km까지 제각각이어서 태양광 입지 확보의 최대 걸림돌로 지적되어 왔습니다. 이번 개편안은 주택 이격거리를 200m로 통일하고, 도로 이격거리 기준은 삭제하는 것이 골자입니다.',
        ],
      },
      {
        heading: '사업 영향',
        body: [
          '도로변·농지 인접 부지 등 기존에 조례로 막혀 있던 후보지가 대거 개발 가능권에 들어오게 됩니다. 다만 조례 개정은 지자체별로 시차가 있으므로, 신규 부지 검토 시 해당 지자체의 개정 진행 상황을 반드시 확인해야 합니다.',
        ],
      },
    ],
    sources: [
      {
        label: '기후에너지환경부 — 태양광 이격거리 표준 가이드라인 개편안',
        url: 'https://www.mcee.go.kr',
      },
    ],
    questions: [
      {
        id: 'rpt-260728:1',
        question: '이번 이격거리 개편안에서 주택 이격거리 기준은?',
        options: ['100m로 통일', '200m로 통일', '500m로 통일', '지자체 자율 유지'],
        answerIndex: 1,
      },
      {
        id: 'rpt-260728:2',
        question: '개편 이후 신규 부지 검토 시 확인해야 할 사항은?',
        options: [
          '한전 배전 계획',
          '해당 지자체의 조례 개정 진행 상황',
          'REC 가중치 고시',
          '전력거래소 회원 등록',
        ],
        answerIndex: 1,
      },
    ],
  },
  {
    id: 'rpt-260724',
    title: '2026 고정가격계약 상한가 조정과 발전사업자 대응',
    publishedAt: '2026-07-24',
    round: 1,
    sourceName: '한국에너지공단',
    sections: [
      {
        heading: '상한가 조정 배경',
        body: [
          '기자재 가격 하락과 보급 확대 기조 속에 고정가격계약 상한가가 조정되었습니다. 상한가는 입찰 참여자의 투찰 가격 상단을 결정하므로, 신규 사업의 수익성 시뮬레이션 전제를 다시 점검할 필요가 있습니다.',
        ],
      },
      {
        heading: '입찰 전략 포인트',
        body: [
          '소형(100kW 미만) 우선 배정 물량, 탄소검증 등급에 따른 가점 등 평가 기준을 반영한 투찰 전략이 중요합니다. 20년 고정가격의 안정성과 현물시장 대비 기대수익을 비교해 참여 여부를 결정해야 합니다.',
        ],
      },
    ],
    questions: [
      {
        id: 'rpt-260724:1',
        question: '고정가격계약 경쟁입찰에서 상한가의 역할은?',
        options: [
          '낙찰 물량을 결정한다',
          '투찰 가격의 상단을 결정한다',
          'REC 가중치를 결정한다',
          '계약 기간을 결정한다',
        ],
        answerIndex: 1,
      },
      {
        id: 'rpt-260724:2',
        question: '고정가격계약의 일반적인 계약 기간은?',
        options: ['5년', '10년', '20년', '30년'],
        answerIndex: 2,
      },
    ],
  },
  {
    id: 'rpt-260721',
    title: '기업 자가소비형 태양광 초과발전량 처리 방식 정리',
    publishedAt: '2026-07-21',
    round: 1,
    sourceName: '한국에너지공단',
    sections: [
      {
        heading: '초과발전량 처리 옵션',
        body: [
          '자가소비형 태양광에서 사용량을 초과한 발전량은 ① 상계거래(다음 달 사용량에서 차감), ② 한전 판매, ③ ESS 저장 후 자가소비 중 하나로 처리합니다. 설비 규모와 부하 패턴에 따라 유리한 방식이 달라집니다.',
        ],
      },
      {
        heading: 'RE100 실적 인정',
        body: [
          '자가소비분은 그대로 재생에너지 사용 실적으로 인정되지만, 외부에 판매한 초과발전량은 자사 실적에서 제외됩니다. 실적 극대화가 목적이라면 부하 시간대와 발전 시간대의 매칭, ESS 연계를 검토할 필요가 있습니다.',
        ],
      },
    ],
    questions: [
      {
        id: 'rpt-260721:1',
        question: '자가소비형 태양광에서 외부에 판매한 초과발전량의 RE100 실적 처리 방식은?',
        options: [
          '자사 실적으로 인정된다',
          '자사 실적에서 제외된다',
          '2배 가중 인정된다',
          '판매처 실적과 공동 인정된다',
        ],
        answerIndex: 1,
      },
      {
        id: 'rpt-260721:2',
        question: '초과발전량을 다음 달 사용량에서 차감하는 처리 방식은?',
        options: ['상계거래', '현물거래', '차액계약', '보충공급'],
        answerIndex: 0,
      },
    ],
  },
  {
    id: 'rpt-260715',
    title: '2026 상반기 RE100 글로벌 동향과 국내 기업 시사점',
    publishedAt: '2026-07-15',
    round: 1,
    sourceName: '글로벌 RE100',
    sections: [
      {
        heading: '1. RE100 캠페인 개요',
        body: [
          'RE100(Renewable Electricity 100%)은 기업이 사용하는 전력의 100%를 재생에너지로 조달하겠다고 선언하는 글로벌 자발적 캠페인입니다. 2014년 클라이밋 그룹(The Climate Group)과 CDP가 공동으로 출범시켰으며, 참여 기업은 늦어도 2050년까지 재생에너지 100% 전환을 달성해야 합니다.',
          '중간 이행 권고 기준은 2030년 60%, 2040년 90%이며, 매년 이행 실적을 CDP를 통해 보고해야 합니다. 국내에서는 삼성전자, SK하이닉스, LG에너지솔루션 등 40개 이상 기업이 가입해 있습니다.',
        ],
      },
      {
        heading: '2. 2026년 글로벌 동향',
        body: [
          '글로벌 가입 기업 수는 400개를 넘어섰고, 애플·BMW 등 주요 글로벌 기업이 공급망(협력사)에까지 재생에너지 사용을 요구하는 흐름이 강화되고 있습니다. 수출 중심 국내 제조기업에게 RE100은 더 이상 선택이 아닌 거래 조건이 되고 있습니다.',
        ],
      },
      {
        heading: '3. 국내 이행 수단 비교',
        body: [
          '국내 기업이 활용할 수 있는 재생에너지 조달 수단은 크게 5가지입니다. ① 녹색프리미엄, ② REC 구매, ③ 제3자 PPA, ④ 직접 PPA, ⑤ 자가발전입니다. 녹색프리미엄은 진입 장벽이 낮지만 온실가스 감축 실적으로 인정되지 않는 한계가 있고, 직접 PPA는 장기 고정가격으로 전력비 변동성을 줄일 수 있어 대규모 수요 기업 중심으로 확대되고 있습니다.',
        ],
      },
    ],
    questions: [
      {
        id: 'rpt-260715:1',
        question: 'RE100 캠페인에서 참여 기업이 재생에너지 100% 전환을 달성해야 하는 최종 기한은?',
        options: ['2030년', '2040년', '2050년', '2060년'],
        answerIndex: 2,
      },
      {
        id: 'rpt-260715:2',
        question: '다음 중 온실가스 감축 실적으로 인정되지 않는 국내 재생에너지 조달 수단은?',
        options: ['직접 PPA', '녹색프리미엄', 'REC 구매', '자가발전'],
        answerIndex: 1,
      },
      {
        id: 'rpt-260715:3',
        question: 'RE100 참여 기업의 이행 실적 보고는 어느 기관을 통해 이루어지는가?',
        options: ['한국전력공사', 'CDP', '한국에너지공단', 'UN 기후변화협약 사무국'],
        answerIndex: 1,
      },
    ],
  },
  {
    id: 'rpt-260708',
    title: '24/7 CFE 논의 동향 — RE100 다음 단계를 준비하라',
    publishedAt: '2026-07-08',
    round: 1,
    sourceName: '글로벌 RE100',
    sections: [
      {
        heading: '24/7 CFE란',
        body: [
          '24/7 CFE(Carbon Free Energy)는 연간 총량 기준으로 재생에너지 사용을 매칭하는 RE100과 달리, 매 시간 실제 사용 전력을 무탄소 전력으로 매칭하는 개념입니다. 구글·마이크로소프트 등이 선도적으로 도입하고 있으며, 시간대별 매칭을 위해 ESS·계시별 조달 포트폴리오가 중요해집니다.',
        ],
      },
      {
        heading: '국내 기업 시사점',
        body: [
          '당장 의무는 아니지만, 글로벌 고객사의 요구 수준이 총량 매칭에서 시간 매칭으로 높아지는 추세를 고려하면 조달 포트폴리오 설계 단계에서 발전원의 발전 시간대 다양화(태양광+풍력+ESS)를 미리 반영하는 것이 유리합니다.',
        ],
      },
    ],
    questions: [
      {
        id: 'rpt-260708:1',
        question: '24/7 CFE가 RE100과 다른 핵심 차이는?',
        options: [
          '재생에너지 종류 제한',
          '매 시간 단위의 무탄소 전력 매칭',
          '인증서 발급 기관',
          '참여 기업 규모 제한',
        ],
        answerIndex: 1,
      },
      {
        id: 'rpt-260708:2',
        question: '시간대별 매칭 대응을 위해 중요성이 커지는 요소는?',
        options: [
          '녹색프리미엄 확대',
          'ESS 및 발전 시간대 다양화',
          '전력 사용량 축소',
          '해외 REC 구매',
        ],
        answerIndex: 1,
      },
    ],
  },
  /* ── 2026-08 (임시 — 짧은 자료 2건 · 문항 2개씩) ── */
  {
    id: 'rpt-260825',
    title: 'K-RE100 재생에너지 사용확인서 — 발급 절차 요약',
    publishedAt: '2026-08-25',
    round: 2,
    sourceName: '한국에너지공단',
    sections: [
      {
        heading: '사용확인서란',
        body: ['K-RE100 참여 기업이 재생에너지를 사용했음을 확인받는 서류로, 이행수단(PPA·자가발전·REC 등)별 사용량을 근거로 한국에너지공단이 발급합니다.'],
      },
    ],
    questions: [
      {
        id: 'rpt-260825:1',
        question: '재생에너지 사용확인서를 발급하는 기관은?',
        options: ['한국전력공사', '한국에너지공단', '전력거래소', '기후에너지환경부'],
        answerIndex: 1,
      },
      {
        id: 'rpt-260825:2',
        question: '사용확인서 발급의 근거가 되는 것은?',
        options: ['매출액', '직원 수', '이행수단별 재생에너지 사용량', '공장 면적'],
        answerIndex: 2,
      },
    ],
  },
  {
    id: 'rpt-260811',
    title: 'OnSite PPA 한눈에 — 지붕은 빌려주고 전기는 싸게',
    publishedAt: '2026-08-11',
    round: 2,
    sourceName: '직접 작성',
    sections: [
      {
        heading: 'OnSite PPA 구조',
        body: ['사업자가 수요기업 지붕에 태양광을 설치·운영하고, 수요기업은 사용한 전력만큼 PPA 단가로 요금을 냅니다. 초기 투자와 유지보수는 사업자 부담입니다.'],
      },
    ],
    questions: [
      {
        id: 'rpt-260811:1',
        question: 'OnSite PPA에서 설비 투자를 부담하는 쪽은?',
        options: ['수요기업', '사업자', '한국전력공사', '지자체'],
        answerIndex: 1,
      },
      {
        id: 'rpt-260811:2',
        question: 'OnSite PPA에서 수요기업이 내는 요금의 기준은?',
        options: ['설치 용량', '지붕 면적', '사용한 전력량 × PPA 단가', '계약 기간'],
        answerIndex: 2,
      },
    ],
  },
  /* ── 기본 정보 (basic) — 차수에 속하지 않는 상시 자료. 언제든 시험 응시 가능 ── */
  {
    id: 'rpt-basic-01',
    basic: true,
    title: 'RE100이란? — 개념·목표·이행 기준',
    publishedAt: '2026-01-01',
    sourceName: '글로벌 RE100',
    sections: [
      {
        heading: '1. RE100의 정의',
        body: [
          'RE100(Renewable Electricity 100%)은 기업이 사업 활동에 사용하는 전력의 100%를 재생에너지로 조달하겠다고 자발적으로 선언하고 이행하는 글로벌 캠페인입니다. 2014년 다국적 비영리기구인 클라이밋 그룹(The Climate Group)이 탄소정보공개프로젝트(CDP)와 협력하여 출범시켰습니다.',
          'RE100은 2040년까지 탈탄소 전력망(carbon-free grid)으로의 전환을 가속화하는 기업 구매자의 글로벌 리더십 이니셔티브를 표방합니다. 정부 규제가 아니라, 기업이 직접적인 행동과 시장·정책에 보내는 신호를 통해 전력망 탈탄소화에 기여하고자 스스로 실천하는 원칙입니다.',
        ],
      },
      {
        heading: '2. RE100 기술기준(Technical Criteria)이란',
        body: [
          'RE100 회원사가 재생전기를 조달하고 목표 대비 진행 상황을 판단할 때 준수하는 규칙이 「RE100 기술기준」입니다. 이 기준은 ① 어떤 에너지원이 재생에너지원인지, ② 신뢰성 있는 사용 주장을 위한 요건(시장 경계 등), ③ 목표 설정을 위한 조직 경계, ④ 대상이 되는 전력 소비 범위, ⑤ 제3자 검증 요구사항을 정의합니다.',
          '기술기준의 내용 대부분은 「GHG 프로토콜 기업 표준」의 시장기반(Market-based) Scope 2 회계 지침에 근거합니다. 즉 시장기반 온실가스 배출량 주장과 재생전기 사용 주장이 동일한 시장기반 수단(에너지 속성에 대한 소유권)을 근거로 성립한다는 원칙을 따릅니다.',
        ],
      },
      {
        heading: '3. 인정되는 재생에너지원 (6종)',
        body: [
          'RE100은 다음 에너지원에서 생성된 전기를 재생전기로 인정합니다: 풍력, 태양광, 지열, 해양(파력·조력), 지속가능한 방식으로 공급된 바이오매스(바이오가스 포함), 지속가능 수력.',
          '수소는 목록에 포함되지 않습니다. 수소는 에너지원이 아니라 다른 에너지원을 투입해 만드는 에너지 운반체(energy carrier)이기 때문이며, 그 제조에 쓰인 에너지가 재생에너지원일 때만 재생수소로 간주됩니다. 에너지 저장장치(ESS)도 에너지원이 아니므로 포함되지 않습니다.',
          '바이오매스·수력은 지속가능한 방식으로 생산되었음을 보증하는 인증(예: ISO 13065, ISCC EU, Green-e®, EKOenergy 등)을 받은 경우에만 RE100 목표 이행분으로 인정됩니다.',
        ],
      },
      {
        heading: '4. 인정되는 재생전기 조달 유형 (5가지)',
        body: [
          'RE100은 기업의 재생전기 조달을 5가지 유형으로 분류합니다. 각 유형은 계약 상대방, 에너지와 에너지 속성의 연계 여부, 조달의 적극성에서 차이가 있습니다.',
          '① 자가발전(self-generation) — 기업이 자체 발전설비를 소유하고 생산 전력을 직접 소비하며 에너지 속성을 보유.',
          '② 직접 조달(발전사업자와 계약) — 물리적 PPA(실제 전력 공급 계약)와 재무적/가상 PPA(VPPA, 에너지 속성만 취득하는 금융 거래)로 나뉨.',
          '③ 전력 공급자와의 계약 — 프로젝트 특정 전력 계약(제3자 PPA·그린 tariff)과 소매 전력상품 계약(녹색 전력 상품).',
          '④ 에너지속성인증서(EAC) 분리 구매 — REC 등 인증서를 전력과 분리해 단독 구매.',
          '⑤ 수동적 조달 — 전력망 기본 공급분 중 EAC로 추적되는 재생전기, 또는 재생 비중 95% 이상 시장의 전력망 기본 공급분.',
        ],
      },
      {
        heading: '5. 이행 목표와 왜 중요한가',
        body: [
          '참여 기업은 늦어도 2050년까지 사용 전력의 100%를 재생에너지로 전환해야 하며, 중간 권고 기준은 2030년 60%, 2040년 90%입니다. 매년 CDP를 통해 이행 실적을 보고·검증받습니다.',
          '애플·BMW 등 글로벌 기업이 협력사에까지 재생에너지 사용을 요구하면서, RE100은 수출 중심 국내 제조기업에게 사실상 거래 조건이 되고 있습니다. 또한 재생에너지 전환은 온실가스(Scope 2) 감축과 직결되어 ESG·탄소중립 달성의 핵심 수단입니다.',
        ],
      },
    ],
    sources: [
      {
        label: '글로벌 RE100 — Technical Criteria & FAQ',
        url: 'https://www.there100.org/technical-guidance',
      },
    ],
    attachments: [
      {
        name: 'RE100 Technical Criteria (한국어판, 2025.3.24)',
        url: '/reference/re100-technical-criteria-kr-2025.pdf',
      },
      {
        name: 'RE100 Reporting Guidance 2026',
        url: '/reference/re100-reporting-guidance-2026.pdf',
      },
      {
        name: 'RE100 Accountability Guidance 2026',
        url: '/reference/re100-accountability-guidance-2026.pdf',
      },
    ],
    questions: [
      {
        id: 'rpt-basic-01:1',
        question: 'RE100 참여 기업이 재생에너지 100% 전환을 달성해야 하는 최종 기한은?',
        options: ['2030년', '2040년', '2050년', '2060년'],
        answerIndex: 2,
      },
      {
        id: 'rpt-basic-01:2',
        question: 'RE100 캠페인을 출범·운영하는 기관은?',
        options: ['UN과 IEA', '클라이밋 그룹과 CDP', '한국에너지공단과 한전', 'EU 집행위원회'],
        answerIndex: 1,
      },
      {
        id: 'rpt-basic-01:3',
        question: 'RE100이 인정하는 재생에너지원이 아닌 것은?',
        options: ['풍력', '태양광', '수소', '지열'],
        answerIndex: 2,
      },
      {
        id: 'rpt-basic-01:4',
        question: 'RE100 기술기준이 대부분 근거로 삼는 국제 표준은?',
        options: [
          'ISO 9001 품질경영',
          'GHG 프로토콜 기업 표준(시장기반 Scope 2)',
          'IFRS 지속가능성 공시',
          'EU 택소노미',
        ],
        answerIndex: 1,
      },
      {
        id: 'rpt-basic-01:5',
        question: '재무적 PPA(가상 PPA, VPPA)에 대한 설명으로 옳은 것은?',
        options: [
          '실제 전력을 물리적으로 공급받는 계약이다',
          '에너지 속성만 취득하는 금융 거래이며 전력은 별도 조달해야 한다',
          '자가발전 설비를 직접 소유하는 방식이다',
          '전력망 기본 공급분을 수동적으로 인정받는 방식이다',
        ],
        answerIndex: 1,
      },
    ],
  },
  {
    id: 'rpt-basic-02',
    basic: true,
    title: 'K-RE100 이행수단 5가지와 참여절차',
    publishedAt: '2026-01-01',
    sourceName: '한국에너지공단',
    sections: [
      {
        heading: 'K-RE100이란',
        body: [
          '재생에너지 사용 확인(K-RE100)은 국내에 RE100 제도를 도입하여 기업의 자발적인 재생에너지 사용 촉진 및 국내 재생에너지 확대에 기여하기 위해 2021년부터 시행된 제도입니다. 국내 전기소비자가 재생에너지 전기를 사용하고 「재생에너지 사용 확인서」를 발급받아 글로벌 RE100, 기업 마케팅 등에 활용할 수 있습니다.',
        ],
      },
      {
        heading: '이행수단 ① 녹색프리미엄',
        body: [
          '전기소비자가 기존 전기요금과 별도의 녹색 프리미엄을 한전에 납부하여 재생에너지 전기를 구매하는 방식입니다. 입찰은 한전에서 진행하며, 설비나 장기계약 없이 참여할 수 있어 진입 장벽이 가장 낮습니다.',
        ],
        images: [
          {
            url: '/reference/kre100-flow/flow-1-green-premium.png',
            caption: '녹색프리미엄 거래 흐름',
          },
        ],
      },
      {
        heading: '이행수단 ② 인증서(REC) 구매',
        body: [
          '기업 등 전기소비자가 재생에너지 공급인증서(REC)를 직접 구매하는 방식입니다. 예공단 거래 플랫폼을 통해 발전사업자의 REC를 사들이고, 그만큼 재생에너지를 사용한 것으로 인정받습니다.',
        ],
        images: [
          { url: '/reference/kre100-flow/flow-2-rec.png', caption: '인증서(REC) 구매 흐름' },
        ],
      },
      {
        heading: '이행수단 ③ 제3자 PPA',
        body: [
          '한국전력공사를 중개로 재생에너지 발전사업자와 전기소비자가 전력구매계약(PPA)을 체결하는 방식입니다. 한전이 중간에서 전력을 전달하므로 계약 구조가 상대적으로 단순합니다.',
        ],
        images: [
          { url: '/reference/kre100-flow/flow-3-third-party-ppa.png', caption: '제3자 PPA 흐름' },
        ],
      },
      {
        heading: '이행수단 ④ 직접 PPA',
        body: [
          '재생에너지 전기공급사업자와 전기소비자가 한전 중개 없이 직접 전력거래계약(PPA)을 체결하는 방식입니다. 통상 장기 고정가격으로 계약해 전력비 변동 위험을 줄일 수 있으며, 계약 체결은 운영기관인 전력거래소에서 진행합니다.',
        ],
        images: [{ url: '/reference/kre100-flow/flow-4-direct-ppa.png', caption: '직접 PPA 흐름' }],
      },
      {
        heading: '이행수단 ⑤ 자가소비',
        body: [
          '기업 등 전기소비자가 자가용 재생에너지 설비를 직접 설치하고 생산된 전력을 사용하는 방식입니다. 자가소비분은 그대로 재생에너지 사용 실적으로 인정되며, 외부 계약 없이 자립적으로 조달할 수 있습니다.',
          '위 5가지 이행수단은 모두 CDP(한국 CDP)와 협력하여 글로벌 RE100에서도 인정됩니다.',
        ],
        images: [
          { url: '/reference/kre100-flow/flow-5-self-consume.png', caption: '자가소비 흐름' },
        ],
      },
      {
        heading: '참여절차 (5단계)',
        body: [
          '1단계 — 재생e 사용확인 기업등록: 전기소비자가 재생e 사용 관리시스템(K-RE100)에 등록합니다.',
          '2단계 — 재생에너지 전기 사용: 위 이행수단 5가지 중 하나로 재생에너지 전기를 사용합니다.',
          '3단계 — 사용실적 제출: 전기소비자가 에너지공단에 사용 실적을 제출합니다.',
          '4단계 — 재생에너지 사용확인서 발행: 에너지공단이 전기소비자에게 확인서를 발행합니다.',
          '5단계 — RE100·CSR 등 활용: 발급받은 확인서를 RE100 이행, CSR, 기업 마케팅 등에 활용합니다.',
        ],
        images: [
          { url: '/reference/kre100-flow/flow-0-procedure.png', caption: 'K-RE100 참여절차 5단계' },
        ],
      },
    ],
    sources: [
      {
        label: '한국에너지공단 — 재생e 사용 확인(K-RE100) 제도 안내',
        url: 'https://www.knrec.or.kr/biz/introduce/new_policy/intro_kre100.do?gubun=A',
      },
    ],
    attachments: [
      {
        name: '신·재생에너지 설비의 지원 등에 관한 규정 (기후에너지환경부고시 제2025-61호, 2025.12.24)',
        url: '/reference/knrec-newenergy-support-2025-61.hwp',
      },
    ],
    questions: [
      {
        id: 'rpt-basic-02:1',
        question: 'K-RE100 이행수단 중 한전을 중개로 발전사업자와 전력구매계약을 맺는 방식은?',
        options: ['녹색프리미엄', '제3자 PPA', '직접 PPA', '자가소비'],
        answerIndex: 1,
      },
      {
        id: 'rpt-basic-02:2',
        question:
          '기업이 기존 전기요금과 별도의 프리미엄을 한전에 납부해 재생에너지를 구매하는 수단은?',
        options: ['REC 구매', '녹색프리미엄', '자가소비', '직접 PPA'],
        answerIndex: 1,
      },
      {
        id: 'rpt-basic-02:3',
        question: 'K-RE100 참여절차에서 가장 먼저 해야 하는 단계는?',
        options: [
          '재생에너지 전기 사용',
          '재생e 사용확인 기업등록',
          '사용실적 제출',
          '사용확인서 발행',
        ],
        answerIndex: 1,
      },
    ],
  },
];

/** 기본 정보 자료 */
export function getBasicReports(reports: EduReport[]): EduReport[] {
  return reports.filter((r) => r.basic);
}

/** 차수 키 목록 — 최근 차수가 위로 */
export function getEduRounds(reports: EduReport[]): string[] {
  const rounds = new Set(reports.filter((r) => !r.basic).map((r) => r.round ?? 1));
  return [...rounds].sort((a, b) => b - a).map(String);
}

/** 그룹의 자료 — key === BASIC_GROUP 이면 기본 자료, 아니면 그 차수 자료(발행일 최신순) */
export function getReportsByRound(reports: EduReport[], key: string): EduReport[] {
  if (key === BASIC_GROUP) return getBasicReports(reports);
  return reports.filter((r) => !r.basic && String(r.round ?? 1) === key).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** 그룹 쪽지시험 문항 — 발행된 자료의 문항만 */
export function getRoundQuiz(allReports: EduReport[], key: string): EduQuizQuestion[] {
  return getReportsByRound(allReports, key)
    .filter(isPublished)
    .flatMap((r) => r.questions);
}
