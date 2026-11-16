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
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
