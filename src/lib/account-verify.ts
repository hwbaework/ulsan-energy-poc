/**
 * 정산 계좌 예금주 조회 — 저장 전에 은행 · 계좌번호 · 사업자등록번호로 예금주를 확인하고, 기업명과 같을 때만 저장한다.
 * SPC(관리자)가 매달 15일 이 계좌로 송금하므로 적어 둔 번호가 진짜 그 기업 계좌인지 봐야 한다.
 *
 * 연동: 유스비(useB) [오픈뱅킹]계좌실명조회(2026-11-16 사용자 결정) — https://doc.useb.co.kr
 *  - 키(client_id · client_secret)는 서버에만 둔다. 화면은 로컬 결제 서버(npm run toss)의 POST /account/holder 를 부른다
 *  - 사업자등록번호를 같이 보내 은행이 계좌 주인까지 확인한다(다르면 RN004)
 *  - 실서비스는 백엔드가 같은 주소를 맡는다
 * 서버가 없거나(배포 사이트 · 서버 꺼짐) 유스비 키가 없으면 데모로 기업명을 돌려준다(POC 는 흐름이 보여야 한다).
 */
import { TOSS_SERVER_URL } from '@/lib/toss-billing';

/** 은행 이름(정산 계좌 셀렉트) → 금융기관 코드(유스비 bank_code, 금융결제원 표준 3자리) */
export const BANK_CODE: Record<string, string> = {
  KB국민: '004',
  신한: '088',
  우리: '020',
  하나: '081',
  IBK기업: '003',
  NH농협: '011',
  BNK경남: '039',
  BNK부산: '032',
  SC제일: '023',
  카카오뱅크: '090',
  토스뱅크: '092',
};

/** 조회는 됐지만 은행이 거절한 경우 — 화면이 이 글자를 그대로 알림으로 띄운다 */
export class AccountLookupError extends Error {}

/** 유스비 오류 코드 → 알림 글자 */
const LOOKUP_MESSAGE: Record<string, string> = {
  RN004: '계좌번호 또는 사업자등록번호가 은행 정보와 다릅니다',
  RN013: '은행 점검 시간이라 예금주를 조회하지 못했습니다',
};

export async function lookupAccountHolder(bank: string, number: string, businessNumber: string, demoHolder: string): Promise<string> {
  const demo = async () => {
    await new Promise((r) => setTimeout(r, 600)); // 조회 중 표시가 보이도록
    return demoHolder;
  };
  const bankCode = BANK_CODE[bank];
  if (!TOSS_SERVER_URL || !bankCode) return demo();
  let r: Response;
  try {
    r = await fetch(`${TOSS_SERVER_URL}/account/holder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankCode, accountNumber: number, businessNumber }),
    });
  } catch {
    return demo(); // 서버가 없다(배포 사이트 · npm run toss 안 켬)
  }
  const data = (await r.json().catch(() => ({}))) as { holder?: string; code?: string; message?: string };
  if (r.status === 501) return demo(); // 유스비 키가 아직 없다
  if (!r.ok || !data.holder) throw new AccountLookupError(LOOKUP_MESSAGE[data.code ?? ''] ?? '예금주를 조회하지 못했습니다');
  return data.holder;
}

/** 은행 예금주와 기업명 비교 — '(주)' · '㈜' · '주식회사' · 띄어쓰기는 빼고 본다 */
export function sameHolder(holder: string, companyName: string) {
  const norm = (s: string) => s.replace(/\(주\)|㈜|주식회사|\s/g, '');
  return norm(holder) === norm(companyName);
}
