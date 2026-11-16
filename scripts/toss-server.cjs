/**
 * 로컬 결제 서버 — 토스페이먼츠 자동결제(빌링)의 서버 쪽 두 가지를 실제로 부른다. 시크릿 키는 여기서만 읽는다(브라우저로 보내지 않는다).
 *   POST /billing/issue   { authKey, customerKey }                              → 토스 POST /v1/billing/authorizations/issue (빌링키 발급)
 *   POST /billing/charge  { billingKey, customerKey, amount, orderId, orderName } → 토스 POST /v1/billing/{billingKey} (결제 승인)
 *   POST /account/holder  { bankCode, accountNumber, businessNumber }           → 유스비 POST https://openapi.useb.co.kr/realname ([오픈뱅킹]계좌실명조회)
 *       정산 계좌 저장 전에 은행 · 계좌번호 · 사업자등록번호로 예금주를 조회한다. 유스비 키가 없으면 501(화면은 데모 조회로)
 *
 * 실행: npm run toss   (기본 포트 4010)
 * 설정(.env.local):
 *   TOSS_SECRET_KEY=test_sk_...                       ← 토스 개발자센터 › API 키 › API 개별 연동 키의 시크릿 키(채팅 · 깃에 올리지 않는다)
 *   NEXT_PUBLIC_TOSS_SERVER_URL=http://localhost:4010  ← 화면이 이 서버를 부르게(없으면 화면은 목업 응답을 쓴다)
 *   USEB_CLIENT_ID=...  USEB_CLIENT_SECRET=...        ← 유스비 계정으로 조회한 client_id · client_secret(채팅 · 깃에 올리지 않는다). 없으면 계좌실명조회만 꺼진다
 *   토스 키 · 유스비 키 가운데 하나만 있어도 서버는 뜬다(없는 쪽 주소는 501).
 * 배포 사이트(정적)에는 이 서버가 없다 — 실서비스는 백엔드가 같은 두 API 를 맡는다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.TOSS_SERVER_PORT) || 4010;
const API = 'https://api.tosspayments.com';

/** .env.local → .env 순서로 KEY=VALUE 읽기(이미 환경 변수에 있으면 그것) */
function envOf(name) {
  if (process.env[name]) return process.env[name];
  for (const f of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] === name && m[2]) return m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const SECRET = envOf('TOSS_SECRET_KEY');
if (SECRET && !SECRET.startsWith('test_sk_')) console.warn('[toss] 테스트 시크릿 키(test_sk_)가 아닙니다 — 실제 결제가 일어날 수 있습니다.');
const AUTH = 'Basic ' + Buffer.from(`${SECRET}:`).toString('base64');

/* ── 유스비(useB) 계좌실명조회 — 문서 https://doc.useb.co.kr (1원계좌인증 › 1.[오픈뱅킹]계좌실명조회) ──
 *  토큰: POST https://auth.useb.co.kr/oauth/token  (Authorization: Basic base64(client_id:client_secret)) → jwt
 *  조회: POST https://openapi.useb.co.kr/realname  (Authorization: Bearer jwt)
 *        { bank_code, account_num, account_holder_info_type: '6'(사업자등록번호), account_holder_info } → data.account_holder_name
 *  오류: RN001 은행코드 · RN002 값 빠짐 · RN003 자리수 · RN004 계좌번호 또는 사업자등록번호 불일치 · RN013 은행 점검 시간 */
const USEB_ID = envOf('USEB_CLIENT_ID');
const USEB_SECRET = envOf('USEB_CLIENT_SECRET');
const usebReady = () => !!USEB_ID && !!USEB_SECRET;
let usebJwt = '';
let usebJwtAt = 0;

// 토스 키 · 유스비 키 가운데 하나는 있어야 한다(둘 다 없으면 이 서버가 할 일이 없다)
if (!SECRET && !usebReady()) {
  console.error('[toss] .env.local 에 TOSS_SECRET_KEY=test_sk_... (결제) 또는 USEB_CLIENT_ID · USEB_CLIENT_SECRET (계좌실명조회)를 넣어 주세요.');
  process.exit(1);
}

async function usebToken(force) {
  // 토큰은 30분만 다시 쓴다(만료 시각 형식에 기대지 않는다). 401 이면 force 로 새로 받는다
  if (!force && usebJwt && Date.now() - usebJwtAt < 30 * 60 * 1000) return usebJwt;
  const r = await fetch('https://auth.useb.co.kr/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${USEB_ID}:${USEB_SECRET}`).toString('base64') },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.jwt) {
    const e = new Error(d.message || `유스비 토큰 발급 실패 ${r.status}`);
    e.status = r.status;
    e.code = d.error_code || 'USEB_TOKEN';
    throw e;
  }
  usebJwt = d.jwt;
  usebJwtAt = Date.now();
  return usebJwt;
}

async function usebRealname(b) {
  const bankCode = String(b.bankCode || '');
  const account = String(b.accountNumber || '').replace(/-/g, '');
  const biz = String(b.businessNumber || '').replace(/\D/g, '');
  if (!/^\d{3}$/.test(bankCode) || !/^\d{8,20}$/.test(account) || !/^\d{10}$/.test(biz)) {
    return { status: 400, data: { code: 'BAD_REQUEST', message: '은행 코드(3자리) · 계좌번호 · 사업자등록번호(10자리)를 확인해 주세요' } };
  }
  const body = JSON.stringify({
    bank_code: bankCode,
    account_num: account,
    account_holder_info_type: '6', // 사업자등록번호로 확인(법인 · 사업자 계좌)
    account_holder_info: `${biz.slice(0, 3)}-${biz.slice(3, 5)}-${biz.slice(5)}`, // 문서 예시 532-87-00930
  });
  const call = async (force) =>
    fetch('https://openapi.useb.co.kr/realname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await usebToken(force)}` },
      body,
    });
  let r = await call(false);
  if (r.status === 401) r = await call(true); // 토큰 만료 — 한 번만 새로 받아 다시
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) {
    return { status: r.ok ? 502 : r.status, data: { code: d.error_code || 'USEB_ERROR', message: d.message || '유스비 조회 실패', detail: d.extra_message } };
  }
  return { status: 200, data: { holder: d.data?.account_holder_name ?? '', bankName: d.data?.bank_name ?? '' } };
}

/** 로컬 화면만 허용 — localhost · 127.0.0.1 의 아무 포트 */
const allowed = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');

async function toss(pathname, body) {
  const r = await fetch(API + pathname, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (allowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.writeHead(allowed(origin) ? 204 : 403).end();
  if (req.method !== 'POST' || !allowed(origin)) return res.writeHead(404).end();

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    let b = {};
    try {
      b = JSON.parse(raw || '{}');
    } catch {
      return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: '요청 본문이 JSON 이 아닙니다' }));
    }
    let out;
    try {
      if (req.url.startsWith('/billing/') && !SECRET) {
        out = { status: 501, data: { code: 'TOSS_NOT_CONFIGURED', message: '.env.local 에 TOSS_SECRET_KEY 가 없습니다' } };
      } else if (req.url === '/billing/issue') {
        // 빌링키 발급 — 토스 창이 돌려준 authKey · customerKey
        out = await toss('/v1/billing/authorizations/issue', { authKey: b.authKey, customerKey: b.customerKey });
      } else if (req.url === '/billing/charge') {
        // 결제 승인 — 빌링키로. 금액은 서버가 정한 값이어야 한다(실서비스는 주문 DB 에서 다시 읽는다)
        out = await toss(`/v1/billing/${encodeURIComponent(b.billingKey)}`, {
          customerKey: b.customerKey,
          amount: b.amount,
          orderId: b.orderId,
          orderName: b.orderName,
        });
      } else if (req.url === '/account/holder') {
        // 정산 계좌 예금주 조회 — 유스비 키가 없으면 501(화면은 데모 조회로 넘어간다)
        out = usebReady()
          ? await usebRealname(b)
          : { status: 501, data: { code: 'USEB_NOT_CONFIGURED', message: '.env.local 에 USEB_CLIENT_ID · USEB_CLIENT_SECRET 가 없습니다' } };
      } else {
        return res.writeHead(404).end();
      }
    } catch (e) {
      out =
        req.url === '/account/holder'
          ? { status: e.status || 502, data: { code: e.code || 'USEB_UNREACHABLE', message: e.code ? `유스비 토큰 발급 실패: ${e.message}` : `유스비에 연결하지 못했습니다: ${e.message}` } }
          : { status: 502, data: { message: `토스페이먼츠에 연결하지 못했습니다: ${e.message}` } };
    }
    // 계좌번호 · 예금주는 로그에 남기지 않는다
    console.log(`[${req.url === '/account/holder' ? 'useb' : 'toss'}] ${req.url} → ${out.status}${out.data.code ? ` ${out.data.code}` : ''}`);
    res.writeHead(out.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(out.data));
  });
});

server.listen(PORT, () => {
  console.log(`[toss] 로컬 결제 서버 http://localhost:${PORT} (${SECRET ? `시크릿 키 ${SECRET.slice(0, 8)}…` : '토스 시크릿 키 없음 — 결제는 꺼짐'})`);
  console.log(usebReady() ? '[useb] 계좌실명조회 켜짐 (/account/holder)' : '[useb] 계좌실명조회 꺼짐 — .env.local 에 USEB_CLIENT_ID · USEB_CLIENT_SECRET 를 넣으면 켜집니다(없으면 화면은 데모 조회)');
});
