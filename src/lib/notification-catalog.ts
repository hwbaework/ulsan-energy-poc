/**
 * 알림 항목표 — "어떤 사건을 누구에게 알리는가". 알림 설정(관리 › 알림 설정)과 종 알림 목업이 같은 표를 쓴다.
 *
 * 이름은 두 가지 — name 은 화면에 보이는 짧은 이름("RTU 전원 꺼짐"), label 은 위치 그대로(메뉴 › 구역 › 항목).
 * 화면은 name 을 보여 주고 label · 발생 조건은 툴팁으로, 설계서 · 개발 문서는 label 을 쓴다(2026-11-11 사용자).
 * 근거: 개발팀 "울산에너지 알림 기획 확인·수정 요청"(2026-11-06)과 답변(2026-11-09, 000. 개발팀 소통 폴더)
 *  - DT 팝업을 빼고 알림은 플랫폼 종 하나로 모은다. DT 는 플랫폼 배경이다.
 *  - 알림은 종(웹 알림)과 이메일 두 가지뿐. 팝업 · 토스트 같은 다른 표시는 없다(2026-11-09 사용자).
 *  - 알림 설정은 계정마다(관리자 · 발전사업자 · 전기사용자 모두 설정 › 시스템 › 알림 설정). 관리자만 받는 항목(adminOnly)은 기업 계정에 안 보인다.
 *  - 클릭 이동: 이상감지 목록 항목은 이상감지 관리, 전기안전지수는 안전. DT 는 플랫폼 배경(energy-v4)이라 위치로 쓰지 않는다
 *  - 해소 알림: 표의 '해소' 칸대로. 문구는 '복구 완료'가 아니라 '해소', 태풍만 기상청 용어대로 '해제'
 *  - 같은 대상 · 같은 알림은 해소 전까지 한 번만, 등급이 오를 때(주의 → 경고 → 위험)만 새로
 *  - 발전소 기준 = 관리자 전체, 소유 기업의 발전사업자, 계약 기업의 전기사용자(활성 계정만)
 *  - 전력거래(RE100) 알림은 RE100 설계서에서 따로 확정한다 — 아래 RE100 항목은 지금 화면 흐름에서 뽑은 초안(자가소비 · PPA 따로, 단계마다 하나)
 *  - 데이터 근거 없는 알림은 만들지 않는다(2026-11-09 사용자). 근거: 아이티공간 「울산에자자_예지보전_데이터_연계_정리_v1.1」(전류 · 전압 · 누설 · 고조파 · 온도 · 역률 · 아크 · 통신 품질, 등급 위험/경고/주의/관찰/정상),
 *    LASEE 통신 상태(NORMAL / COMM_ERROR), 기상청 기상특보, 전력거래 · 데이터 마켓 · 회원 스토어의 실제 상태값
 *  - 사업계획서에 있는 알림은 데이터가 아직 없어도 항목으로 둔다(화재 징후). 지진은 사업계획서에 없음(0건).
 *  - 기상특보는 네 가지(2026-11-11 사용자 결정): 태풍 warnVar 7, 강풍 1, 호우 2, 대설 8. 경보(warnStress 1) 이상, cancel 0 인 행만.
 *    침수 · 홍수는 특보 종류가 아니다 — 침수는 호우경보의 결과, 홍수는 환경부 홍수통제소 별도 경보. 한파 · 건조 · 폭풍해일 · 풍랑 · 황사 · 폭염은 공단 지붕 설비에 직접 영향이 적어 뺀다.
 *  - 알림 없는 것: 출력 저하(자연히 생길 수 있음), 일사량 대비 발전량 편차(일사량 데이터 · 기준 없음), RTU 통신 지연(어느 스펙에도 없음), 문서 관리 자료 등록(올리기 동작 없음), 자동결제 실패(결과 데이터 없음),
 *    API 허브 이용 취소(거래 현황 이용 취소와 같은 일), 보고서(들어가면 보인다), 컨설팅, 카드 등록 · API 토큰 재발급(본인이 한 일), 카본 마켓(문서만)
 */

export type NotifDomain = '통합관제' | 'RE100' | 'E-데이터마켓' | '관리';

export interface NotifEvent {
  key: string;
  /** 화면에 보이는 이름 — 짧게(2026-11-11 사용자: "RTU 전원 꺼짐 이렇게만, 설명은 툴팁으로") */
  name: string;
  /** 위치 그대로 — 메뉴 › 구역 › 항목. 화면에서는 툴팁 · 설계서 · 개발 문서에 쓴다 */
  label: string;
  domain: NotifDomain;
  /** 발생 조건 */
  condition: string;
  /** 받는 사람 */
  receivers: string;
  /** 클릭 시 이동 */
  go: string;
  /** 해소 알림 — 보냄 / 보내지 않음 / 해당 없음 / 해제 보냄(태풍) */
  resolve: string;
  /** 이메일 기본 켬 */
  emailDefault?: boolean;
  /** 관리자만 받는 알림 — 기업 계정의 알림 설정에는 안 보인다 */
  adminOnly?: boolean;
}

const PLANT = '관리자, 발전소 소유 발전사업자, 계약 전기사용자';

export const NOTIFICATION_CATALOG: NotifEvent[] = [
  // ── 통합관제 — 이상감지 관리 › 이상 감지 목록에 들어오는 종류 그대로(출력 저하는 자연히 생길 수 있어 알림 아님, 2026-11-09 사용자).
  //    RTU 전원 꺼짐 · 태풍경보(DT EV01 · EV04)도 DT 가 플랫폼 배경이 된 뒤로는 이 목록으로 들어온다 ──
  { key: 'RTU_POWER_OFF', name: 'RTU 전원 꺼짐', label: '이상감지 관리 › 이상 감지 목록 › RTU 전원 꺼짐', domain: '통합관제', condition: 'RTU 전원 신호가 꺼짐', receivers: PLANT, go: '이상감지 관리', resolve: '보냄', emailDefault: true },
  { key: 'ANOMALY_RTU_COMM', name: 'RTU 통신 끊김', label: '이상감지 관리 › 이상 감지 목록 › RTU 통신 끊김', domain: '통합관제', condition: 'RTU 폴링 응답 없음, 또는 전체 인버터 측정시각이 20분 이상 멈춤, 주간만 판정', receivers: PLANT, go: '이상감지 관리', resolve: '보냄' },
  { key: 'ANOMALY_INVERTER_COMM', name: '인버터 통신 끊김', label: '이상감지 관리 › 이상 감지 목록 › 인버터 통신 끊김', domain: '통합관제', condition: '일부 인버터 응답 없음, 측정시각이 20분 이상 멈춤, 주간만 판정', receivers: PLANT, go: '이상감지 관리', resolve: '보냄' },
  { key: 'TYPHOON_WARNING', name: '태풍경보', label: '이상감지 관리 › 이상 감지 목록 › 태풍경보', domain: '통합관제', condition: '울산동부, 울산서부에 태풍경보 이상 발효', receivers: '발전소를 볼 수 있는 활성 사용자 전체', go: '이상감지 관리', resolve: '해제 보냄', emailDefault: true },
  { key: 'WIND_WARNING', name: '강풍경보', label: '이상감지 관리 › 이상 감지 목록 › 강풍경보', domain: '통합관제', condition: '울산동부, 울산서부에 강풍경보 발효 — 모듈 탈락 · 구조물 피해(사업계획서 p134)', receivers: '발전소를 볼 수 있는 활성 사용자 전체', go: '이상감지 관리', resolve: '해제 보냄', emailDefault: true },
  { key: 'HEAVY_RAIN_WARNING', name: '호우경보', label: '이상감지 관리 › 이상 감지 목록 › 호우경보', domain: '통합관제', condition: '울산동부, 울산서부에 호우경보 발효 — 침수 · 누전', receivers: '발전소를 볼 수 있는 활성 사용자 전체', go: '이상감지 관리', resolve: '해제 보냄', emailDefault: true },
  { key: 'HEAVY_SNOW_WARNING', name: '대설경보', label: '이상감지 관리 › 이상 감지 목록 › 대설경보', domain: '통합관제', condition: '울산동부, 울산서부에 대설경보 발효 — 적설 하중 · 발전 중단', receivers: '발전소를 볼 수 있는 활성 사용자 전체', go: '이상감지 관리', resolve: '해제 보냄', emailDefault: true },
  { key: 'SAFETY_DANGER', name: '전기안전지수 위험', label: '안전 › 발전소별 안전 현황 › 전기안전지수 › 위험', domain: '통합관제', condition: 'ITS 전기안전지수 등급이 위험이거나 위험으로 상향', receivers: PLANT, go: '안전', resolve: '보냄, 등급이 내려가 30분 이어지면', emailDefault: true },
  { key: 'SAFETY_WARNING', name: '전기안전지수 경고', label: '안전 › 발전소별 안전 현황 › 전기안전지수 › 경고', domain: '통합관제', condition: 'ITS 전기안전지수 등급이 경고', receivers: PLANT, go: '안전', resolve: '보내지 않음' },
  { key: 'SAFETY_FIRE', name: '화재 징후', label: '안전 › 발전소별 안전 현황 › 화재 징후', domain: '통합관제', condition: '사업계획서(3차년도) p81 · p160 · p161 · p167 — 화재 · 폭발 위험 감지, 화재 징후 예측, 연기 감지. 판정 데이터(온도 임계값 · 아크 지수 · 연기 센서)는 아이티공간 · 현장 연동 뒤 정한다', receivers: PLANT, go: '안전', resolve: '보냄', emailDefault: true },
  { key: 'SAFETY_CAUTION', name: '전기안전지수 주의', label: '안전 › 발전소별 안전 현황 › 전기안전지수 › 주의', domain: '통합관제', condition: 'ITS 전기안전지수 등급이 주의, 주간만 판정', receivers: PLANT, go: '안전', resolve: '보내지 않음' },
  // ── RE100(전력거래) — 자가소비 · PPA 따로, 거래 4단계(신청 접수 → 미팅 조건 확정 → 전자서명 → 승인)마다 하나, 변경 · 해지도 단계마다 하나.
  //    승인은 끝났다는 알림이라 양측에 간다. RE100 설계서에서 확정 전 초안 ──
  { key: 'TRADING_SELF_RECEIVED', name: '자가소비 신청 접수', label: '거래 신청 › 자가소비 › 신청 접수', domain: 'RE100', condition: '기업이 자가소비 거래를 신청함', receivers: '관리자', go: '거래 신청', resolve: '해당 없음', emailDefault: true, adminOnly: true },
  { key: 'TRADING_SELF_TERMS', name: '자가소비 조건 확정', label: '거래 신청 › 자가소비 › 미팅 › 조건 확정', domain: 'RE100', condition: '관리자가 미팅 조건을 확정함, 신청한 쪽이 조건 동의할 차례', receivers: '신청한 기업', go: '거래 신청 상세', resolve: '해당 없음' },
  { key: 'TRADING_SELF_SIGN', name: '자가소비 서명 요청', label: '거래 신청 › 자가소비 › 전자서명 › 서명 요청', domain: 'RE100', condition: '조건 동의 뒤 서명할 차례가 됨', receivers: '서명할 쪽', go: '거래 신청 상세', resolve: '해당 없음' },
  { key: 'TRADING_SELF_APPROVED', name: '자가소비 승인', label: '거래 신청 › 자가소비 › 승인', domain: 'RE100', condition: '양측 전자서명 뒤 관리자가 승인함', receivers: '신청 기업, 관리자', go: '내 계약', resolve: '해당 없음' },
  { key: 'TRADING_PPA_RECEIVED', name: 'PPA 신청 접수', label: '거래 신청 › PPA › 신청 접수', domain: 'RE100', condition: '기업이 PPA 거래를 신청함', receivers: '관리자', go: '거래 신청', resolve: '해당 없음', emailDefault: true, adminOnly: true },
  { key: 'TRADING_PPA_TERMS', name: 'PPA 조건 확정', label: '거래 신청 › PPA › 미팅 › 조건 확정', domain: 'RE100', condition: '관리자가 미팅 조건(PPA 단가 포함)을 확정함, 신청한 쪽이 조건 동의할 차례', receivers: '신청한 기업', go: '거래 신청 상세', resolve: '해당 없음' },
  { key: 'TRADING_PPA_SIGN', name: 'PPA 서명 요청', label: '거래 신청 › PPA › 전자서명 › 서명 요청', domain: 'RE100', condition: '조건 동의 뒤 서명할 차례가 됨', receivers: '서명할 쪽', go: '거래 신청 상세', resolve: '해당 없음' },
  { key: 'TRADING_PPA_APPROVED', name: 'PPA 승인', label: '거래 신청 › PPA › 승인', domain: 'RE100', condition: '양측 전자서명 뒤 관리자가 승인함', receivers: '신청 기업, 발전사업자, 관리자', go: '내 계약', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_CHANGE_REQUEST', name: '변경 요청', label: '변경 · 해지 › 변경 › 요청', domain: 'RE100', condition: '계약 변경을 신청함, 받는 쪽이 변경 동의할 차례', receivers: '상대 기업, 관리자', go: '변경 · 해지', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_CHANGE_AGREED', name: '변경 동의', label: '변경 · 해지 › 변경 › 변경 동의', domain: 'RE100', condition: '받는 쪽이 변경 동의함', receivers: '신청한 기업, 관리자', go: '변경 · 해지', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_CHANGE_SIGN', name: '변경 서명 요청', label: '변경 · 해지 › 변경 › 전자서명 › 서명 요청', domain: 'RE100', condition: '변경 동의 뒤 서명할 차례가 됨', receivers: '서명할 쪽', go: '변경 · 해지', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_CHANGE_APPROVED', name: '변경 승인', label: '변경 · 해지 › 변경 › 승인', domain: 'RE100', condition: '양측 전자서명 뒤 승인함', receivers: '양측 기업', go: '내 계약', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_TERMINATION_REQUEST', name: '해지 요청', label: '변경 · 해지 › 해지 › 요청', domain: 'RE100', condition: '계약 해지를 신청함, 받는 쪽이 해지 동의할 차례', receivers: '상대 기업, 관리자', go: '변경 · 해지', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_TERMINATION_AGREED', name: '해지 동의', label: '변경 · 해지 › 해지 › 해지 동의', domain: 'RE100', condition: '받는 쪽이 해지 동의함', receivers: '신청한 기업, 관리자', go: '변경 · 해지', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_TERMINATION_SIGN', name: '해지 서명 요청', label: '변경 · 해지 › 해지 › 전자서명 › 서명 요청', domain: 'RE100', condition: '해지 동의 뒤 서명할 차례가 됨', receivers: '서명할 쪽', go: '변경 · 해지', resolve: '해당 없음' },
  { key: 'PPA_CONTRACT_TERMINATION_APPROVED', name: '해지 승인', label: '변경 · 해지 › 해지 › 해지 승인', domain: 'RE100', condition: '양측 전자서명 뒤 해지 승인함, 상태 해지', receivers: '양측 기업', go: '내 계약', resolve: '해당 없음' },
  { key: 'INVOICE', name: '청구서 발행', label: '수익 · 정산 › 청구서 › 발행', domain: 'RE100', condition: '달마다 청구서가 발행됨', receivers: '전기사용자', go: '수익 · 정산 › 청구서', resolve: '해당 없음' },
  { key: 'TAX_INVOICE', name: '세금계산서 발행', label: '수익 · 정산 › 세금계산서 › 발행', domain: 'RE100', condition: '세금계산서 원본이 올라옴', receivers: '상대 기업', go: '수익 · 정산 › 세금계산서', resolve: '해당 없음' },
  { key: 'SETTLEMENT', name: '정산 확정', label: '수익 · 정산 › 정산 › 확정', domain: 'RE100', condition: '달 정산이 확정됨', receivers: '당사자 기업', go: '수익 · 정산 › 정산', resolve: '해당 없음' },
  // ── E-데이터마켓 — 순서: 판매 동의 · 판매 종료(파는 쪽이 한 일) → 이용 신청 · 이용 취소(사는 쪽이 한 일) → 대금 지급.
  //    판매 종료는 이용 기업과 관리자가 받는다 — 판매 동의 하나로 묶으면 중지했을 때도 '판매 동의'로 온다(2026-11-16 사용자) ──
  { key: 'EDATA_CONSENT', name: '판매 동의', label: '데이터 등록/신청 › 판매 동의', domain: 'E-데이터마켓', condition: '기업이 판매 동의(데이터 등록)를 누름', receivers: '관리자', go: '데이터 등록/신청', resolve: '해당 없음', adminOnly: true },
  { key: 'EDATA_SALE_END', name: '판매 종료', label: '데이터 등록/신청 › 판매 종료', domain: 'E-데이터마켓', condition: '기업이 판매 중지를 예약함, 이용 중인 기업은 금월 말일까지 이용', receivers: '이용 기업 활성 사용자, 관리자', go: '데이터 등록/신청', resolve: '해당 없음' },
  { key: 'EDATA_REQUEST', name: '이용 신청', label: '거래 현황 › 이용 신청', domain: 'E-데이터마켓', condition: '내 데이터에 이용 신청이 들어옴', receivers: '판매 기업 활성 사용자, 관리자', go: '거래 현황', resolve: '해당 없음' },
  { key: 'EDATA_CANCEL', name: '이용 취소', label: '거래 현황 › 이용 취소', domain: 'E-데이터마켓', condition: '이용 기업이 이용을 취소함, 금월 말일까지 이용', receivers: '판매 기업 활성 사용자, 관리자', go: '거래 현황', resolve: '해당 없음' },
  { key: 'EDATA_PAYOUT', name: '대금 지급', label: '정산 › 대금 지급', domain: 'E-데이터마켓', condition: '매달 15일 정산 계좌로 지급됨', receivers: '판매 기업 활성 사용자', go: '정산', resolve: '해당 없음' },
  // ── 관리 ──
  { key: 'SIGNUP_COMPANY', name: '기업 가입 신청', label: '기업 관리 › 기업 목록 › 가입 신청', domain: '관리', condition: '새 기업이 기업 관리자 계정으로 가입을 신청함, 상태 대기', receivers: '관리자', go: '기업 관리', resolve: '해당 없음', emailDefault: true, adminOnly: true },
  { key: 'SIGNUP_MEMBER', name: '회원 가입 신청', label: '회원 관리 › 회원 목록 › 가입 신청', domain: '관리', condition: '기존 기업에 회원이 가입을 신청함, 상태 대기', receivers: '관리자', go: '회원 관리', resolve: '해당 없음', emailDefault: true, adminOnly: true },
  { key: 'COMPANY_CHANGE', name: '기업 정보 변경 요청', label: '기업 관리 › 기업 목록 › 기업 정보 변경 요청', domain: '관리', condition: '기업관리자가 새 등록증과 함께 변경을 요청함', receivers: '관리자', go: '기업 관리', resolve: '해당 없음', adminOnly: true },
];

export const NOTIFICATION_DOMAINS: NotifDomain[] = ['통합관제', 'RE100', 'E-데이터마켓', '관리'];

/** 알림을 받는 계정 종류 — 메뉴가 계정마다 달라 이동 주소도 다르다 */
export type NotifAccount = 'admin' | 'generator' | 'consumer';

/** 전력거래 메뉴 — 관리자 /platform, 발전사업자 /generator, 전기사용자는 전력거래 메뉴가 없다(컨설팅만) */
const tradeMenu = (a: NotifAccount) =>
  a === 'admin'
    ? { request: '/platform/trading', history: '/platform/trading/history', approvals: '/platform/trading/approvals', contracts: '/platform/ppa/contracts', changes: '/platform/trading/changes', invoices: '/platform/ppa/billing/invoices', tax: '/platform/ppa/billing/tax-invoice' }
    : a === 'generator'
      ? { request: '/generator/trading', history: '/generator/trading/history', approvals: '/generator/trading/approvals', contracts: '/generator/ppa/contracts', changes: '/generator/trading/changes', invoices: '/generator/ppa/direct/revenue/invoices', tax: '/generator/ppa/direct/revenue/tax-invoice' }
      : null;

/**
 * 알림을 누르면 가는 화면 주소 — 항목표의 '클릭 시 이동'(go)을 계정별 메뉴 주소로 옮긴 것. 그 계정에 화면이 없으면 null(종에도 안 보인다).
 *  - 조건 확정은 조건을 보는 거래 이력, 서명 요청은 서명하는 거래 승인으로 간다
 *  - 정산 확정은 수익 · 정산의 첫 화면(세금계산서)
 */
export function notifPathOf(key: string, account: NotifAccount): string | null {
  const e = NOTIFICATION_CATALOG.find((x) => x.key === key);
  if (!e) return null;
  if (e.adminOnly && account !== 'admin') return null;
  if (e.domain === '통합관제') return key.startsWith('SAFETY_') ? '/control/safety' : '/monitoring/anomalies';
  if (e.domain === 'E-데이터마켓') {
    // 판매 동의 · 판매 종료는 같은 데이터 카드의 일 — 종료 예정일이 보이는 데이터 등록/신청으로(2026-11-16 사용자)
    if (key === 'EDATA_CONSENT' || key === 'EDATA_SALE_END') return '/e-data/catalog';
    if (key === 'EDATA_PAYOUT') return '/e-data/trading/settlement';
    return '/e-data/trading';
  }
  if (e.domain === '관리') return key === 'SIGNUP_MEMBER' ? '/platform/users' : '/platform/companies';
  const t = tradeMenu(account);
  if (!t) return null;
  if (key.endsWith('_RECEIVED')) return t.request;
  if (key.endsWith('_TERMS')) return t.history;
  if (key === 'TRADING_SELF_SIGN' || key === 'TRADING_PPA_SIGN') return t.approvals;
  if (key.endsWith('_APPROVED')) return t.contracts;
  if (key.startsWith('PPA_CONTRACT_')) return t.changes;
  if (key === 'INVOICE') return t.invoices;
  return t.tax; // TAX_INVOICE · SETTLEMENT
}

export const notifLabelOf = (type: string) => NOTIFICATION_CATALOG.find((e) => e.key === type)?.label ?? type;
export const notifNameOf = (type: string) => NOTIFICATION_CATALOG.find((e) => e.key === type)?.name ?? type;
