import type { NextConfig } from 'next';

/**
 * ulsan-energy-poc — 정적 export (백엔드·DB 없음).
 * `next build` 결과가 ./out 에 생성되며 Cloudflare Workers(정적 에셋)로 배포한다.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
