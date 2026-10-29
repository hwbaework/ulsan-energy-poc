// 카본 마켓플레이스 — 근거 · 공식 사이트 · 서식.
// 우리는 연동 · 신청 · 거래를 하지 않는다. 서식은 법제처 원본 그대로 보여주고 받게 한다(다시 그리거나 채우지 않음).
// 법령이 바뀌면 관리자가 새 서식을 올린다(stores/useCarbonFormStore). 근거 · 절차는 docs/카본마켓-조사.md 기준.

/** 근거 법령 · 고시 */
export const LAW = {
  act: '온실가스 배출권의 할당 및 거래에 관한 법률',
  offset: '외부사업 타당성 평가 및 감축량 인증에 관한 지침',
  trade: '온실가스 배출권의 거래에 관한 고시',
} as const;

/** 공식 사이트 — 화면은 링크로만 보낸다(KRX 시세는 사전 동의 없이 재게시 금지) */
export const LINKS = {
  krxPrice: 'https://ets.krx.co.kr/contents/ETS/03/03010000/ETS03010000.jsp',
  krxItems: 'https://ets.krx.co.kr/contents/RGL/04/04030201/RGL04030201.jsp',
  krxHours: 'https://ets.krx.co.kr/contents/RGL/04/04030203/RGL04030203.jsp',
  krxMember: 'https://ets.krx.co.kr/contents/RGL/08/08020100/RGL08020100.jsp',
  krxBoard: 'https://ets.krx.co.kr/board/ETS01030000/bbs',
  etrs: 'https://etrs.gir.go.kr',
  ors: 'https://ors.gir.go.kr',
  orsMethod: 'https://ors.gir.go.kr/home/orme010/activeList.do',
  energyOffset: 'https://offset.energy.or.kr',
  lawAct: 'https://www.law.go.kr/법령/온실가스배출권의할당및거래에관한법률',
  lawOffset: 'https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2100000267466',
  lawTrade: 'https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2100000267472',
  allocList: 'https://www.me.go.kr/home/web/public_info/read.do?menuId=10357&publicInfoId=337',
} as const;

/** 서식 · 참고 문서 — 기본은 공식 원본(public/docs), 관리자가 올리면 그 파일로 바뀐다 */
export interface CarbonForm {
  key: string;
  title: string;
  /** 별지 번호 (참고 문서는 고유번호) */
  form: string;
  /** 근거 법령 · 고시 */
  basis: string;
  /** 원본 시행일 */
  from: string;
  pdf: string;
  /** 원본이 PDF 로만 있으면 없음 */
  hwp?: string;
  /** 참고 문서 — 서식이 아니라 읽어 보는 문서 */
  ref?: boolean;
  /** 원본이 있는 공식 사이트 — 문서 버튼 옆에 */
  site?: { href: string; label: string };
}

const form = (key: string, title: string, no: string, basis: string, file: string): CarbonForm => ({
  key,
  title,
  form: `별지 제${no}호서식`,
  basis,
  from: '2025-10-07',
  pdf: `/docs/${file}.pdf`,
  hwp: `/docs/${file}.hwpx`,
});

/** 원본 — 서식은 법제처 현행(2025-10-07 시행) 별지, 방법론은 GIR 상쇄등록부에서 받은 파일 */
export const CARBON_FORMS = {
  plan: form('plan', '외부사업 사업계획서', '1', LAW.offset, 'offset-plan-form-1'),
  approval: form('approval', '외부사업 승인/사업계획 변경 신청서', '5', LAW.offset, 'offset-approval-form-5'),
  monitoring: form('monitoring', '외부사업 모니터링 보고서', '17', LAW.offset, 'offset-monitoring-form-17'),
  certify: form('certify', '외부사업 온실가스 감축량 인증신청서', '18', LAW.offset, 'offset-certify-form-18'),
  transfer: form('transfer', '외부사업 인증실적 이전 신청서', '22', LAW.offset, 'koc-transfer-form-22'),
  otcReport: form('otcReport', '장외 거래 신고서', '7', LAW.trade, 'otc-report-form-7'),
  /** 참고 문서 — 태양광 자가소비 사업에 적용하는 승인 방법론(GIR 상쇄등록부 원문, PDF 만 있음) */
  method: {
    key: 'method',
    title: '재생에너지를 통해 생산한 전력을 자가 사용 및/또는 계통 연계하는 사업의 방법론',
    form: '01B-011-Ver02',
    basis: 'GIR 상쇄등록부 승인 방법론',
    from: '2026-09-02',
    pdf: '/docs/offset-method-01b-011.pdf',
    ref: true,
    site: { href: LINKS.orsMethod, label: '방법론 현황' },
  },
} as const satisfies Record<string, CarbonForm>;
