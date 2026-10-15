import { registerMock } from './registry';

/**
 * 결제 서버 목업 — 실서비스는 우리 서버가 토스페이먼츠 시크릿 키로 아래를 호출한다.
 *  POST /payments/billing/issue  { authKey, customerKey }        → 토스 POST /v1/billing/authorizations/issue
 *  POST /payments/billing/charge { billingKey, customerKey, amount, orderId, orderName } → 토스 POST /v1/billing/{billingKey}
 * POC 는 토스를 부르지 않고 같은 모양의 응답만 돌려준다.
 */
const CARD_COMPANIES = ['신한', 'KB국민', '하나', '삼성', '현대', '롯데', '우리', 'BC'];
const pick = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

registerMock(
  /^\/payments\/billing\/issue$/,
  ({ body }) => {
    const b = (body ?? {}) as { authKey?: string; customerKey?: string };
    if (!b.authKey || !b.customerKey) throw new Error('authKey · customerKey 가 필요합니다');
    const h = pick(b.authKey);
    return {
      billingKey: `bk_${h.toString(36)}${Date.now().toString(36)}`,
      customerKey: b.customerKey,
      cardCompany: CARD_COMPANIES[h % CARD_COMPANIES.length],
      card: { number: `4330********${String(1000 + (h % 9000))}`, cardType: '신용', ownerType: '법인' },
      authenticatedAt: new Date().toISOString(),
    };
  },
  'POST',
);

registerMock(
  /^\/payments\/billing\/charge$/,
  ({ body }) => {
    const b = (body ?? {}) as { billingKey?: string; amount?: number; orderId?: string; orderName?: string };
    if (!b.billingKey) throw new Error('등록된 카드가 없습니다');
    return {
      paymentKey: `pk_${Date.now().toString(36)}`,
      orderId: b.orderId,
      orderName: b.orderName,
      status: 'DONE',
      totalAmount: b.amount,
      approvedAt: new Date().toISOString(),
    };
  },
  'POST',
);
