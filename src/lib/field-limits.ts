/**
 * 입력 글자 수 제한 — 같은 뜻의 칸은 어느 화면이든 같은 값(2026-11-09 사용자: "글자 수 제한 없는 데 있으면 넣어라").
 * 회원가입 · 기업 정보 · 내 계정 · 관리자 기업 관리 · 회원 관리 · 정산 계좌가 같이 쓴다.
 * 기업명 50 · 주소 100 은 무료진단(solar-sim NAME_MAX · ADDRESS_MAX)과 같은 값. 사유 · 메모는 trading-poc TEXT_MAX(500).
 */
export const LIMIT = {
  /** 기업명 */
  companyName: 50,
  /** 사업자등록번호 000-00-00000 */
  bizNumber: 12,
  /** 대표자명 · 사용자 이름 · 예금주 */
  personName: 20,
  /** 업태 */
  bizType: 30,
  /** 종목 */
  bizCategory: 50,
  /** 연락처(기업 · 개인) */
  phone: 20,
  /** 기업 주소 */
  address: 100,
  /** 부서 */
  department: 30,
  /** 아이디(이메일) */
  email: 100,
  /** 비밀번호 */
  password: 64,
  /** 계좌번호(숫자 · -) */
  account: 20,
  /** 역할 이름 */
  roleName: 20,
  /** 설명(역할 등 한 줄 설명) */
  description: 100,
} as const;
