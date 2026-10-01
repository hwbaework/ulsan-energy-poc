import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * ulsan-energy-poc — 정적 export (백엔드·DB 없음).
 * `next build` 결과(정적 html)는 ./.next-build 에 떨어지고 Cloudflare Workers(정적 에셋)로 배포한다.
 *
 * 주의: output:'export' 일 때 next build 는 중간 산출물을 항상 ./.next 에 쓰고(next 내부에서 distDir 을 '.next' 로 강제)
 * distDir 은 export 결과 폴더로만 쓰인다. 즉 dev 서버(.next)와 빌드가 같은 폴더를 공유하므로
 * **dev 서버가 켜진 채로 next build 를 돌리면 dev 가 500(청크 손상)이 난다. 빌드는 dev 를 끄고, 한 번에 하나만.**
 */
export default function config(phase: string): NextConfig {
  return {
    output: 'export',
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-build',
    trailingSlash: false,
    images: { unoptimized: true },
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: false },
  };
}
