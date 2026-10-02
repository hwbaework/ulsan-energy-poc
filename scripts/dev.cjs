/**
 * npm run dev — 3030 이 비어 있으면 3030, 이미 쓰고 있으면 3031, 3032 … 순서로 빈 포트에서 개발 서버를 연다.
 * node scripts/dev.cjs 3031 처럼 포트를 주면 그 포트만 쓴다(3030 은 다른 저장소 서버용으로 비워 둘 때).
 * 두 번째 서버부터는 빌드 폴더를 따로(.next-3031 등) 쓴다 — 같은 .next 를 두 서버가 함께 쓰면 서로 청크를 덮어써 500 이 난다.
 */
const net = require('net');
const { spawn } = require('child_process');

const FORCED = Number(process.argv[2]) || 0;
const PORTS = FORCED ? [FORCED] : [3030, 3031, 3032, 3033];

function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port); // 호스트 생략 = IPv6(::) 듀얼스택 — next dev 가 쓰는 주소와 같아야 사용 중을 제대로 잡는다
  });
}

(async () => {
  let port;
  for (const p of PORTS) {
    if (await isFree(p)) {
      port = p;
      break;
    }
  }
  if (!port) {
    console.error(`[dev] ${PORTS.join(', ')} 포트가 모두 사용 중입니다.`);
    process.exit(1);
  }
  const env = { ...process.env };
  if (port !== 3030) {
    env.NEXT_DEV_DIST = `.next-${port}`;
    console.log(`[dev] ${port} 포트로 엽니다 (빌드 폴더 ${env.NEXT_DEV_DIST})`);
  }
  const nextBin = require.resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(port)], { stdio: 'inherit', env });
  child.on('exit', (code) => process.exit(code ?? 0));
})();
