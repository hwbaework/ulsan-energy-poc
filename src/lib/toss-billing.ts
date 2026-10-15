/**
 * 토스페이먼츠 자동결제(빌링) — 카드 등록 창 띄우기.
 *
 * 흐름(토스페이먼츠 v2 SDK · API 개별 연동):
 *  1. 기업관리자가 [카드 등록] → 토스페이먼츠 결제창(requestBillingAuth). 카드 번호 · 유효기간 · CVC 등은 토스 창에서만 입력한다
 *     — 우리 화면 · 서버는 카드 번호를 받지 않는다(PCI-DSS). CVC 는 토스도 저장하지 않는다.
 *  2. 성공하면 토스가 successUrl 로 돌려보낸다(?authKey=...&customerKey=...).
 *  3. 우리 서버가 시크릿 키로 authKey → 빌링키 발급(POST /v1/billing/authorizations/issue). 빌링키 · 카드사 · 끝자리만 저장.
 *  4. 데이터 신청 · 매달 1일에 서버가 빌링키로 결제(POST /v1/billing/{billingKey}).
 *
 * 클라이언트 키는 NEXT_PUBLIC_TOSS_CLIENT_KEY(토스페이먼츠 개발자센터 › API 키 › 클라이언트 키, 테스트는 test_ck_ 로 시작).
 * 시크릿 키는 서버에만 — 프런트에 두지 않는다. POC 는 서버(3 · 4)를 목업(/payments/billing/*)이 대신한다.
 * 클라이언트 키가 없으면 토스 창 대신 우리 등록 창의 칸으로 받는다(POC, 입력값은 끝 4자리만 남긴다).
 */

import { apiClient } from '@/api/client';

const SDK_URL = 'https://js.tosspayments.com/v2/standard';

export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';
/** 토스 창을 실제로 띄울 수 있는지 — 클라이언트 키가 있을 때만 */
export const tossReady = () => TOSS_CLIENT_KEY.length > 0;

interface TossPaymentInstance {
  requestBillingAuth: (opts: {
    method: 'CARD';
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    customerName?: string;
  }) => Promise<void>;
}
interface TossPaymentsFactory {
  (clientKey: string): { payment: (opts: { customerKey: string }) => TossPaymentInstance };
}
declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

let loading: Promise<TossPaymentsFactory> | null = null;
function loadSdk(): Promise<TossPaymentsFactory> {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저에서만'));
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => (window.TossPayments ? resolve(window.TossPayments) : reject(new Error('토스페이먼츠 SDK 를 불러오지 못했습니다')));
      s.onerror = () => {
        loading = null;
        reject(new Error('토스페이먼츠 SDK 를 불러오지 못했습니다'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** 기업마다 고정 customerKey — 토스 규칙(영문 · 숫자 · -_=.@, 2~300자). 추측하기 어렵게 기업 id 뒤에 무작위 꼬리 */
export function customerKeyOf(companyId: number, salt: string) {
  return `company-${companyId}-${salt}`;
}

/** 카드 등록 창 — 성공하면 토스가 /org/billing/success 로 돌려보낸다(이 함수는 돌아오지 않는다) */
export async function openCardRegistration(opts: { customerKey: string; email?: string; name?: string }) {
  const TossPayments = await loadSdk();
  const origin = window.location.origin;
  await TossPayments(TOSS_CLIENT_KEY)
    .payment({ customerKey: opts.customerKey })
    .requestBillingAuth({
      method: 'CARD',
      successUrl: `${origin}/org/billing/success`,
      failUrl: `${origin}/org/billing/fail`,
      customerEmail: opts.email,
      customerName: opts.name,
    });
}

/* ── 서버 쪽(빌링키 발급 · 결제 승인) — NEXT_PUBLIC_TOSS_SERVER_URL(로컬 결제 서버 npm run toss)이 있으면 실제 토스, 없으면 목업 ── */

export const TOSS_SERVER_URL = process.env.NEXT_PUBLIC_TOSS_SERVER_URL ?? '';

async function server<T>(pathname: string, body: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(TOSS_SERVER_URL + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('로컬 결제 서버가 꺼져 있습니다 — 터미널에서 npm run toss');
  }
  const data = (await r.json().catch(() => ({}))) as T & { message?: string };
  if (!r.ok) throw new Error(data.message ?? `결제 서버 오류 ${r.status}`);
  return data;
}

export interface IssuedBilling {
  billingKey: string;
  cardCompany?: string;
  card?: { number?: string; issuerCode?: string; cardType?: string; ownerType?: string };
}
/** 빌링키 발급 — 토스 창이 돌려준 authKey · customerKey */
export function issueBillingKey(authKey: string, customerKey: string): Promise<IssuedBilling> {
  return TOSS_SERVER_URL ? server<IssuedBilling>('/billing/issue', { authKey, customerKey }) : apiClient.post<IssuedBilling>('/payments/billing/issue', { authKey, customerKey });
}

export interface ChargeResult {
  paymentKey: string;
  orderId?: string;
  status: string;
  approvedAt: string;
}
/** 결제 승인 — 빌링키로. 데모 카드(빌링키 'bk_' — 목업이 만든 것)는 토스에 없으니 목업으로 */
export function chargeBilling(body: { billingKey: string; customerKey: string; amount: number; orderId: string; orderName: string }): Promise<ChargeResult> {
  const real = TOSS_SERVER_URL && !body.billingKey.startsWith('bk_');
  return real ? server<ChargeResult>('/billing/charge', body) : apiClient.post<ChargeResult>('/payments/billing/charge', body);
}
