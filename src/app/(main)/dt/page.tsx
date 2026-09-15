'use client';

// DT 홈 — 로그인 역할에 따라 진입 화면을 라우팅.
//  · 발전사(POWER_OPERATOR·PPA_MANAGER) → /dt?focus=haniltube (한일튜브 트윈+모니터링 정보 착지)
//  · 수용가(CONSUMER_MANAGER) → /dt/simulation (내 건물 수익 시뮬)
//  · 관리자(SYSTEM_ADMIN·COMPANY_ADMIN)·컨설턴트(CONSULTANT)·SPC(SPC_OPERATOR) → /dt/scout (입지 스카우팅)
//  · 그 외(VIEWER·VPP_TRADER 등) → LOD 맵 세계
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/useAuthStore';

const GENERATOR_ROLES = new Set(['POWER_OPERATOR', 'PPA_MANAGER']); // 발전사 → 한일튜브 자산 뷰
const SIM_ROLES = new Set(['CONSUMER_MANAGER']); // 수용가 → 수익 시뮬
const SCOUT_ROLES = new Set(['SYSTEM_ADMIN', 'COMPANY_ADMIN', 'CONSULTANT', 'SPC_OPERATOR']);

const DtWorld = dynamic(() => import('./next/DtWorld'), {
  ssr: false,
  loading: () => <Splash />,
});

function Splash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#060a14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-slate-400">DT 로딩 중...</span>
      </div>
    </div>
  );
}

export default function DTPage() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    // 이미 focus/preset 파라미터가 있으면(발전사 착지 후 등) 재라우팅하지 않고 그대로 렌더
    if (params.get('focus') || params.get('p') || params.get('t')) {
      setResolved(true);
      return;
    }
    const roles = user?.roles ?? [];
    const target = roles.some((r) => GENERATOR_ROLES.has(r))
      ? '/dt?focus=haniltube'
      : roles.some((r) => SIM_ROLES.has(r))
        ? '/dt/simulation'
        : roles.some((r) => SCOUT_ROLES.has(r))
          ? '/dt/scout'
          : null;
    if (target) router.replace(target);
    else setResolved(true); // 매핑 역할 없음 → LOD 월드
  }, [user, router, params]);

  if (!resolved) return <Splash />;
  return (
    <Suspense>
      <DtWorld />
    </Suspense>
  );
}
