// 카본 마켓플레이스 — 기업이 직접 신청 · 신고할 때 쓸 준비 서류.
// 우리는 연동 · 신청 · 거래를 하지 않는다. 우리 데이터(기업명 · 주소 · 설비 용량 · 월 발전량 · 감축량)로 채울 칸만 채우고,
// 나머지는 비워 둔다(기업 작성). 서식 · 근거 · 절차는 docs/카본마켓-조사.md (2026-10-08 조사, 공식 출처) 기준.
// 감축량은 온실가스 인벤토리와 같은 값(lib/ghg-reduction) — 단, 외부사업은 자가소비 설비만(onsite 는 소유권 정리 전이라 뺀다).
import {
  FACILITIES,
  LAST_MONTH,
  fmt,
  monthsBetween,
  pick,
  totalsOf,
  type GhgFactors,
  type ReductionRow,
} from '@/lib/ghg-reduction';

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

/** 적용 방법론 — GIR 상쇄등록부 승인 방법론(2026-10-08 확인) */
export const METHOD = {
  code: '01B-011-Ver02',
  name: '재생에너지를 통해 생산한 전력을 자가 사용 및/또는 계통 연계하는 사업의 방법론',
  from: '2026-09-02',
  field: '01 에너지산업 / 1-B 신재생에너지로부터의 에너지 생산',
};

/** 규모 — 지침 제9조제2항(연 감축량) */
export const scaleOf = (t: number) => (t > 3000 ? '일반' : t > 100 ? '소규모' : '극소규모');

export interface DocCompany {
  id: number;
  name: string;
  address: string;
}

/** 서류 한 칸 — 값이 없으면 기업이 쓴다 */
export interface DocField {
  label: string;
  value?: string;
}
export type DocSection =
  | { kind: 'fields'; title: string; fields: DocField[] }
  | { kind: 'table'; title: string; head: string[]; body: string[][]; foot?: string[] };

export interface DocSpec {
  key: string;
  /** 서식 이름 */
  title: string;
  /** 별지 번호 */
  form: string;
  basis: string;
  submitTo: string;
  deadline: string;
  /** 서식 원본(법제처) */
  original: string;
  sections: DocSection[];
  notes: string[];
}

/** 자가소비 설비 · 줄 — 외부사업 대상 */
export const selfFacilities = (companyId: number) =>
  FACILITIES.filter((f) => f.companyId === companyId && f.kind === '자가소비');
const selfRows = (rows: ReductionRow[], companyId: number) =>
  rows.filter((r) => r.facility.companyId === companyId && r.facility.kind === '자가소비');

/** 최근 12개월 — 연 감축량(예상) 기준 */
export const LAST12: [string, string] = (() => {
  const all = monthsBetween('2025-01', LAST_MONTH);
  return [all[all.length - 12] ?? all[0] ?? LAST_MONTH, LAST_MONTH];
})();

export function annualOf(rows: ReductionRow[], companyId: number) {
  return totalsOf(pick(selfRows(rows, companyId), LAST12[0], LAST12[1]));
}

const kwOf = (companyId: number) => selfFacilities(companyId).reduce((a, f) => a + f.kw, 0);
const projectName = (c: DocCompany) => `${c.name} 태양광 자가사용 온실가스 감축사업`;
const t2 = (v: number) => fmt(v, 2);
const t3 = (v: number) => fmt(v, 3);

/** 공통 주의 — 조사에서 확인 못 한 것 · 중복 */
const COMMON_NOTES = [
  '이 문서는 신청 준비용 초안입니다. 빈 칸은 기업이 작성하고, 제출은 기업이 직접 상쇄등록부(ors.gir.go.kr)에 합니다.',
  `감축량은 국가 전력 배출계수로 계산한 값입니다. 적용 방법론(${METHOD.code})이 정한 계수 · 산식으로 다시 산정될 수 있습니다.`,
  '할당대상업체는 자기 조직경계 안 감축을 외부사업으로 신청할 수 없습니다 — 신청 전 할당대상업체 현황을 확인하세요.',
  'REC 발급 · RE100 이행 등 다른 제도에 같은 감축량을 쓰면 중복으로 인증이 취소될 수 있습니다(시행령 제49조제5항제2호).',
];

/** 월별 표 — 월 · 발전량 · 감축량 */
function monthTable(rows: ReductionRow[], from: string, to: string, title: string): DocSection {
  const ms = monthsBetween(from, to);
  const body = ms.map((m) => {
    const t = totalsOf(rows.filter((r) => r.month === m));
    return [m, fmt(t.kwh), t3(t.mwh), t3(t.tco2)];
  });
  const s = totalsOf(rows.filter((r) => r.month >= from && r.month <= to));
  return {
    kind: 'table',
    title,
    head: ['월', '발전량 (kWh)', '발전량 (MWh)', '감축량 (tCO2eq)'],
    body,
    foot: ['합계', fmt(s.kwh), t3(s.mwh), t3(s.tco2)],
  };
}

/* ── 외부감축사업 정보 ── */

/** ① 외부사업 사업계획서 — 지침 별지 제1호 */
export function planDoc(c: DocCompany, rows: ReductionRow[], fx: GhgFactors): DocSpec {
  const a = annualOf(rows, c.id);
  const kw = kwOf(c.id);
  const mine = selfRows(rows, c.id);
  return {
    key: 'plan',
    title: '외부사업 사업계획서',
    form: '별지 제1호서식',
    basis: `${LAW.offset} 제12조제1항제2호 · 작성지침 별표 4`,
    submitTo: '부문별 관장기관의 장 (상쇄등록부 전자 제출)',
    deadline: '승인 신청 시',
    original: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=161238011',
    sections: [
      {
        kind: 'fields',
        title: '1. 사업 개요',
        fields: [
          { label: '1.1 사업명', value: projectName(c) },
          { label: '1.1 사업 목적 · 내용', value: `태양광 발전설비 ${t2(kw)} kW로 생산한 전력을 기업이 직접 사용해 계통 전력을 대체` },
          { label: '1.2 사업 위치', value: c.address },
          { label: '1.3 사업자', value: c.name },
          { label: '1.3 감축량 소유권 (%)' },
          { label: '1.4 사업 시작일 (계약일 · 최초 지출일 · 설치 시작일 중 가장 빠른 날)' },
          { label: '1.4 인증유효기간 (갱신형 5년 / 고정형 10년)' },
          { label: '1.5 중복성 평가 (REC · RPS · RE100 등)' },
          { label: '1.6 디번들링 평가' },
          { label: '사업 규모 (지침 제9조)', value: `${scaleOf(a.tco2)} (연 ${t2(a.tco2)} tCO2eq)` },
        ],
      },
      {
        kind: 'fields',
        title: '2. 방법론 · 사업경계',
        fields: [
          { label: '2.1 적용 방법론', value: `${METHOD.code} ${METHOD.name}` },
          { label: '사업 분야', value: METHOD.field },
          { label: '2.2 방법론 선정 타당성' },
          { label: '2.3 사업경계 · 배출원', value: '태양광 발전설비 → 기업 전력 사용(계통 전력 대체)' },
          { label: '2.4 베이스라인 시나리오' },
          { label: '2.5 추가성 (연 60,000 t 이하 — 법적 · 제도적 추가성)' },
        ],
      },
      {
        kind: 'fields',
        title: '3. 감축량 산정',
        fields: [
          { label: '3.1 산정식', value: '감축량(tCO2eq) = 자가사용 발전량(MWh) × 전력 배출계수' },
          { label: '3.5 고정 인자 — 전력 배출계수', value: `${fx.co2} tCO2eq/MWh (${fx.year}년 국가 전력 배출계수, ${fx.published} 공표)` },
          { label: '3.6 예상 연간 발전량', value: `${t3(a.mwh)} MWh (${LAST12[0]} ~ ${LAST12[1]} 실적)` },
          { label: '3.6 예상 연간 감축량', value: `${t3(a.tco2)} tCO2eq` },
        ],
      },
      monthTable(mine, LAST12[0], LAST12[1], '3.7 연간 감축량 근거 (최근 12개월 실적)'),
      {
        kind: 'fields',
        title: '4. 모니터링 계획',
        fields: [
          { label: '변동 데이터', value: '태양광 발전량 (kWh) — 월 1회 집계' },
          { label: '측정 장비 · 계량기 정보' },
          { label: 'QA/QC 절차' },
        ],
      },
      {
        kind: 'fields',
        title: '6. 사업자 정보',
        fields: [
          { label: '사업자명', value: c.name },
          { label: '주소', value: c.address },
          { label: '전화 · 팩스 · 홈페이지' },
          { label: '담당자 (성명 · 부서 · 직위 · 연락처)' },
        ],
      },
    ],
    notes: [
      ...COMMON_NOTES,
      '극소규모 사업은 관장기관이 상쇄등록부에 등록한 별도 양식(방법론 이력 화면의 극소규모 양식)으로 제출할 수 있습니다.',
    ],
  };
}

/** ② 외부사업 승인 신청서 — 지침 별지 제5호 */
export function approvalDoc(c: DocCompany, rows: ReductionRow[]): DocSpec {
  const a = annualOf(rows, c.id);
  return {
    key: 'approval',
    title: '외부사업 승인 신청서',
    form: '별지 제5호서식',
    basis: `${LAW.offset} 제12조`,
    submitTo: '부문별 관장기관의 장 (상쇄등록부 전자 제출)',
    deadline: '승인 신청 시 — 타당성 평가 30일(30일 연장 가능), 보완 3회까지',
    original: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=161238065',
    sections: [
      {
        kind: 'fields',
        title: '사업',
        fields: [
          { label: '사업명', value: projectName(c) },
          { label: '사업 구분', value: `단일 ${scaleOf(a.tco2)} 사업 (연 ${t2(a.tco2)} tCO2eq)` },
          { label: '적용 방법론', value: METHOD.code },
        ],
      },
      {
        kind: 'fields',
        title: '사업자',
        fields: [
          { label: '사업자명', value: c.name },
          { label: '사업시행 장소', value: c.address },
          { label: '사업자등록번호' },
          { label: '담당자 성명 · 부서 · 직위' },
          { label: '전화 · E-mail' },
        ],
      },
      {
        kind: 'fields',
        title: '타 감축제도 등록 여부',
        fields: [{ label: '제도명 · 사업명 · 등록일 · 등록번호' }],
      },
      {
        kind: 'fields',
        title: '제출서류',
        fields: [
          { label: '외부사업 사업계획서 (별지 제1호)', value: '첨부' },
          { label: '신청일 · 서명' },
        ],
      },
    ],
    notes: COMMON_NOTES,
  };
}

/* ── 외부감축사업 보고서 ── */

/** ③ 외부사업 모니터링 보고서 — 지침 별지 제17호 */
export function monitoringDoc(c: DocCompany, rows: ReductionRow[], fx: GhgFactors, from: string, to: string): DocSpec {
  const mine = selfRows(rows, c.id);
  const s = totalsOf(mine.filter((r) => r.month >= from && r.month <= to));
  const kw = kwOf(c.id);
  return {
    key: 'monitoring',
    title: '외부사업 모니터링 보고서',
    form: '별지 제17호서식',
    basis: `${LAW.offset} 제28조 · 작성지침 별표 7`,
    submitTo: '부문별 관장기관의 장 (검증보고서와 함께)',
    deadline: '모니터링 기간 종료 후 12개월 이내 (극소규모는 최대 인증유효기간 단위)',
    original: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=161238157',
    sections: [
      {
        kind: 'fields',
        title: '표지',
        fields: [
          { label: '사업명', value: projectName(c) },
          { label: '등록고유번호 · 등록일' },
          { label: '사업자', value: c.name },
          { label: '인증유효기간' },
          { label: '모니터링 기간', value: `${from} ~ ${to}` },
          { label: '분야 · 방법론', value: `${METHOD.field} · ${METHOD.code}` },
          { label: '계획서상 감축량 (tCO2eq)' },
          { label: '실제 감축량 (tCO2eq)', value: t3(s.tco2) },
        ],
      },
      {
        kind: 'fields',
        title: '1. 사업 개요',
        fields: [
          { label: '1.2 위치', value: c.address },
          { label: '설비', value: `태양광 발전설비 ${t2(kw)} kW (자가소비)` },
          { label: '1.3 감축량 소유권' },
          { label: '1.6 인증실적 중복성 평가' },
        ],
      },
      {
        kind: 'fields',
        title: '4. 모니터링 데이터',
        fields: [
          { label: '4.1 고정 데이터 — 전력 배출계수', value: `${fx.co2} tCO2eq/MWh (${fx.year}년 기준)` },
          { label: '4.2 변동 데이터', value: '태양광 발전량 (kWh) — 월별 집계' },
          { label: '측정 장비 · 주기 · QA/QC' },
        ],
      },
      monthTable(mine, from, to, '4.2 · 5.4 월별 발전량 · 감축량'),
      {
        kind: 'fields',
        title: '5. 감축량',
        fields: [
          { label: '5.4 감축량', value: `${t3(s.tco2)} tCO2eq (발전량 ${t3(s.mwh)} MWh × ${fx.co2})` },
          { label: '5.3 누출' },
          { label: '5.5 계획 대비 실제 비교' },
        ],
      },
    ],
    notes: [...COMMON_NOTES, '계량 증빙(계량기 기록 · 한전 고지서 등)을 6. 참고자료로 첨부하세요.'],
  };
}

/** ④ 외부사업 온실가스 감축량 인증신청서 — 지침 별지 제18호 */
export function certifyDoc(c: DocCompany, rows: ReductionRow[], from: string, to: string): DocSpec {
  const s = totalsOf(selfRows(rows, c.id).filter((r) => r.month >= from && r.month <= to));
  return {
    key: 'certify',
    title: '외부사업 온실가스 감축량 인증신청서',
    form: '별지 제18호서식',
    basis: `${LAW.offset} 제31조`,
    submitTo: '부문별 관장기관의 장 (상쇄등록부 전자 제출)',
    deadline: '검증 결과 적합 이후 — 1 tCO2eq 이상, 정수 단위',
    original: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=161238185',
    sections: [
      {
        kind: 'fields',
        title: '사업',
        fields: [
          { label: '사업명', value: projectName(c) },
          { label: '등록고유번호' },
          { label: '모니터링 기간 (차수)', value: `${from} ~ ${to}` },
          { label: '인증유효기간' },
        ],
      },
      {
        kind: 'fields',
        title: '사업자',
        fields: [
          { label: '사업자명', value: c.name },
          { label: '사업시행 장소', value: c.address },
          { label: '사업자등록번호' },
          { label: '담당자 성명 · 부서 · 직책 · 전화 · E-mail' },
        ],
      },
      {
        kind: 'fields',
        title: '인증 신청',
        fields: [
          { label: '인증신청량 (tCO2eq, 정수)', value: `${fmt(Math.floor(s.tco2))} (산정값 ${t3(s.tco2)} — 검증 결과로 확정)` },
          { label: '검증기관명' },
          { label: '타 감축제도 인증 여부 (제도명 · 인증일 · 인증번호)' },
        ],
      },
      {
        kind: 'fields',
        title: '제출서류',
        fields: [
          { label: '모니터링 보고서 (별지 제17호)', value: '첨부' },
          { label: '검증보고서' },
          { label: '신청일 · 서명' },
        ],
      },
    ],
    notes: [...COMMON_NOTES, '인증되면 KOC가 발행되고(소수점 버림), 인증일부터 5년 안에 상쇄배출권으로 전환 · 판매할 수 있습니다.'],
  };
}

/* ── 장외거래 · 계약관리 ── */

/** ⑤ 외부사업 인증실적(KOC) 이전 신청서 — 지침 별지 제22호 */
export function transferDoc(c: DocCompany): DocSpec {
  return {
    key: 'transfer',
    title: '외부사업 인증실적 이전 신청서',
    form: '별지 제22호서식',
    basis: `${LAW.offset} 제37조`,
    submitTo: '부문별 관장기관의 장 (상쇄등록부 전자 제출, 양도인이 신청)',
    deadline: '거래 후 신청 (기한 규정 없음)',
    original: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=161238209',
    sections: [
      {
        kind: 'fields',
        title: '양도인',
        fields: [
          { label: '법인명 (사업자명)', value: c.name },
          { label: '사업자등록번호' },
          { label: '이전 신청량 (tCO2eq)' },
        ],
      },
      {
        kind: 'fields',
        title: '양수인',
        fields: [{ label: '법인명' }, { label: '사업자등록번호' }, { label: '대표자명' }],
      },
      {
        kind: 'fields',
        title: '담당자',
        fields: [{ label: '성명 · 부서 · 직위' }, { label: '전화 · E-mail' }],
      },
      {
        kind: 'fields',
        title: '제출서류',
        fields: [{ label: '계약사항을 확인할 수 있는 증빙자료' }, { label: '신청일 · 서명' }],
      },
    ],
    notes: [
      '이 문서는 신청 준비용 초안입니다. 빈 칸은 기업이 작성하고, 제출은 양도인이 상쇄등록부(ors.gir.go.kr)에 직접 합니다.',
      '인증받은 KOC만 이전할 수 있습니다. 양수인도 상쇄등록부 보유계정이 있어야 합니다.',
      '양수인이 할당대상업체면 그 업체의 관장기관이 승인합니다(지침 제37조제5항).',
    ],
  };
}

/** ⑥ 배출권 장외 거래 신고서 — 거래 고시 별지 제7호 (할당대상업체 · 중개회사 · 신탁업자만) */
export function otcReportDoc(c: DocCompany): DocSpec {
  return {
    key: 'otc',
    title: '장외 거래 신고서',
    form: '별지 제7호서식',
    basis: `${LAW.trade} 제27조 · 시행령 제33조제1항`,
    submitTo: '기후에너지환경부장관 (배출권등록부 ETRS 전자 제출)',
    deadline: '거래 후 지체 없이 (양도인 신고)',
    original: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=158017653',
    sections: [
      {
        kind: 'fields',
        title: '거래',
        fields: [
          { label: '거래 일시' },
          { label: '해당 이행연도' },
          { label: '거래 구분 (매매 / 기타)' },
          { label: '배출권 종류 (배출권 / 상쇄배출권)' },
          { label: '수량 (tCO2eq)' },
          { label: '가격 (원)' },
        ],
      },
      {
        kind: 'fields',
        title: '거래자 (양도인)',
        fields: [
          { label: '법인명', value: c.name },
          { label: '주소', value: c.address },
          { label: '법인등록번호 · 계정대표자명' },
          { label: '전화 · E-mail' },
        ],
      },
      {
        kind: 'fields',
        title: '거래자 (양수인)',
        fields: [{ label: '법인명 · 법인등록번호' }, { label: '계정대표자명 · 주소' }, { label: '전화 · E-mail' }],
      },
      {
        kind: 'fields',
        title: '구비서류',
        fields: [{ label: '양도인 · 양수인 거래 합의 공증서류' }, { label: '신청인 서명' }],
      },
    ],
    notes: [
      '배출권(KAU · KCU) 장외거래는 할당대상업체 · 배출권거래중개회사 · 신탁업자만 할 수 있습니다(거래 고시 제26조의2).',
      '할당대상업체가 아니면 KOC 이전 신청서(별지 제22호)를 쓰세요.',
      '법령상 신고에 들어가야 하는 것: 배출권 종류 · 수량 · 가격 · 거래 일시 · 거래자 정보 · 합의 공증. 공식 표준 계약서 서식은 없습니다.',
    ],
  };
}
