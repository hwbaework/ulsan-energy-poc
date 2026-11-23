/**
 * 배포 사이트 앞단 — 화면 데이터 파일(.txt) 주소로 페이지가 통째 이동했을 때 원래 화면 주소로 돌려보낸다.
 *
 * 왜 필요한가: 정적 내보내기(output: 'export')에서 화면을 옮길 때 Next 는 그 화면의 데이터 파일(/platform/companies.txt)을 받아 온다.
 * 사이트를 열어 둔 사이에 새 배포가 올라가면 받아 온 파일의 빌드 번호가 열려 있는 화면과 달라서,
 * Next 가 페이지를 통째로 다시 불러오는데 이때 주소를 화면이 아니라 받아 온 파일(.txt)로 잡는다(next fetch-server-response: doMpaNavigation(res.url)).
 * 그러면 화면 대신 글자만 가득한 파일이 보인다(2026-11-16 알림을 눌렀더니 /platform/companies.txt 가 뜸).
 *
 * 하는 일: 주소가 .txt 로 끝나고 "페이지를 여는 요청"(Sec-Fetch-Dest: document)일 때만 .txt 를 뗀 주소로 보낸다.
 * 화면이 데이터로 받아 가는 요청(Sec-Fetch-Dest: empty)은 그대로 파일을 준다. wrangler.jsonc 에서 .txt 주소에만 이 코드가 돈다.
 */
/**
 * 기상특보 — /api/weather/warnings. 기상청 API허브 특보현황 조회(wrn_now_data.php)에서 울산동부(L1082800) · 울산서부(L1082900)에 지금 발효 중인 특보만 돌려준다.
 * 키(KMA_AUTH_KEY, wrangler secret)는 주소에 들어가므로 화면이 기상청을 직접 부르지 않고 여기를 거친다. 5분 동안 같은 답을 쓴다(기상청 응답이 느릴 때가 있다).
 * 로컬은 scripts/toss-server.cjs 의 /weather/warnings 가 같은 일을 한다(응답 모양 같음).
 */
const KMA_ZONES = ['L1082800', 'L1082900'];
async function weatherWarnings(request, env, ctx) {
  const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', ...extra } });
  if (!env.KMA_AUTH_KEY) return json({ code: 'KMA_NOT_CONFIGURED', message: 'KMA_AUTH_KEY 가 없습니다' }, 501);
  const cacheKey = new Request(new URL('/api/weather/warnings', request.url).toString());
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;
  let all;
  try {
    const r = await fetch('https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=e&tm=&disp=1&help=0&authKey=' + encodeURIComponent(env.KMA_AUTH_KEY));
    if (!r.ok) return json({ code: 'KMA_ERROR', message: '기상청 응답 ' + r.status }, 502);
    all = await r.json();
  } catch (e) {
    return json({ code: 'KMA_UNREACHABLE', message: '기상청에 연결하지 못했습니다' }, 502);
  }
  const t = (v) => String(v ?? '').trim();
  const res = json(
    {
      checkedAt: new Date().toISOString(),
      total: all.length,
      warnings: all
        .filter((x) => KMA_ZONES.includes(t(x.REG_ID)))
        .map((x) => ({ regId: t(x.REG_ID), regName: t(x.REG_KO), wrn: t(x.WRN), lvl: t(x.LVL), cmd: t(x.CMD), tmFc: t(x.TM_FC), tmEf: t(x.TM_EF), edTm: t(x.ED_TM) })),
    },
    200,
    { 'Cache-Control': 'public, max-age=300' },
  );
  ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/weather/warnings') return weatherWarnings(request, env, ctx);
    if (url.pathname.endsWith('.txt') && request.headers.get('sec-fetch-dest') === 'document') {
      // /a/b.txt → /a/b , /index.txt → / , /a/index.txt → /a
      const page = url.pathname.replace(/\/index\.txt$/, '/').replace(/\.txt$/, '') || '/';
      url.pathname = page;
      url.searchParams.delete('_rsc');
      return Response.redirect(url.toString(), 302);
    }
    return env.ASSETS.fetch(request);
  },
};
