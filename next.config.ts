import type { NextConfig } from 'next';

/**
 * ulsan-energy-poc — 정적 export (백엔드·DB 없음).
 * `next build` 결과가 ./out 에 생성되며 Cloudflare Workers(정적 에셋)로 배포한다.
 */
const nextConfig: NextConfig = {
  output: 'export',
  // 개발 서버(.next)와 배포 빌드(.next-build)를 분리 — 빌드가 켜져 있는 dev 서버의 청크를 덮어써 500 이 나던 것 방지
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  trailingSlash: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
