/**
 * 로컬 결제 서버 — 토스페이먼츠 자동결제(빌링)의 서버 쪽 두 가지를 실제로 부른다. 시크릿 키는 여기서만 읽는다(브라우저로 보내지 않는다).
 *   POST /billing/issue   { authKey, customerKey }                              → 토스 POST /v1/billing/authorizations/issue (빌링키 발급)
 *   POST /billing/charge  { billingKey, customerKey, amount, orderId, orderName } → 토스 POST /v1/billing/{billingKey} (결제 승인)
 *
 * 실행: npm run toss   (기본 포트 4010)
 * 설정(.env.local):
 *   TOSS_SECRET_KEY=test_sk_...                       ← 토스 개발자센터 › API 키 › API 개별 연동 키의 시크릿 키(채팅 · 깃에 올리지 않는다)
 *   NEXT_PUBLIC_TOSS_SERVER_URL=http://localhost:4010  ← 화면이 이 서버를 부르게(없으면 화면은 목업 응답을 쓴다)
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
if (!SECRET) {
  console.error('[toss] .env.local 에 TOSS_SECRET_KEY=test_sk_... 를 넣어 주세요(토스 개발자센터 › API 키 › API 개별 연동 키 · 시크릿 키).');
  process.exit(1);
}
if (!SECRET.startsWith('test_sk_')) console.warn('[toss] 테스트 시크릿 키(test_sk_)가 아닙니다 — 실제 결제가 일어날 수 있습니다.');
const AUTH = 'Basic ' + Buffer.from(`${SECRET}:`).toString('base64');

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
      if (req.url === '/billing/issue') {
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
      } else {
        return res.writeHead(404).end();
      }
    } catch (e) {
      out = { status: 502, data: { message: `토스페이먼츠에 연결하지 못했습니다: ${e.message}` } };
    }
    console.log(`[toss] ${req.url} → ${out.status}${out.data.code ? ` ${out.data.code}` : ''}`);
    res.writeHead(out.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(out.data));
  });
});

server.listen(PORT, () => console.log(`[toss] 로컬 결제 서버 http://localhost:${PORT} (시크릿 키 ${SECRET.slice(0, 8)}…)`));
