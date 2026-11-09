/**
 * 정산 계좌 예금주 조회 — 저장 전에 은행 · 계좌번호로 예금주를 확인하고, 기업명과 같을 때만 저장한다.
 * SPC(관리자)가 매달 15일 이 계좌로 송금하므로 적어 둔 번호가 진짜 그 기업 계좌인지 봐야 한다.
 *
 * 실제 연동: 예금주 실명 조회 API(금융결제원 오픈뱅킹 · 팝빌 · 토스페이먼츠 지급대행 셀러 등록 가운데 하나)로 바꾼다.
 *  - 키는 서버에만 두고 화면은 서버 라우트를 부른다(세금계산서 ASP 와 같은 자리)
 *  - 응답의 예금주를 그대로 돌려주면 아래 비교 · 확인창은 그대로 쓴다
 * POC: 조회 응답이 없으니 데모로 기업명을 돌려준다.
 */
export async function lookupAccountHolder(_bank: string, _number: string, demoHolder: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 600)); // 조회 중 표시가 보이도록
  return demoHolder;
}

/** 은행 예금주와 기업명 비교 — '(주)' · '㈜' · '주식회사' · 띄어쓰기는 빼고 본다 */
export function sameHolder(holder: string, companyName: string) {
  const norm = (s: string) => s.replace(/\(주\)|㈜|주식회사|\s/g, '');
  return norm(holder) === norm(companyName);
}
