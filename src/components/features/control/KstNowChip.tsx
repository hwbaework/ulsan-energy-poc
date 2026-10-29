'use client';

import { useEffect, useState } from 'react';
import { kst } from '@/lib/dx';

/**
 * 제목 줄 오른쪽 끝 테두리 한 줄 — 지금 시각(KST, 분 단위)과 표시 기준(연계 문서 v1.1 7장).
 * 이 화면에 1초마다 바뀌는 값은 없어서(측정 1분 조회 · 안전지수 5분 · Health 1시간) 초는 보이지 않는다.
 * 값마다 산출 시각이 붙고, 갱신이 멈춘 값은 회색이라는 것을 화면에서 바로 보이게 한다.
 */
export function KstNowChip() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(kst(Date.now()).slice(11, 16));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="ml-auto inline-flex items-center gap-2.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-emerald-400/50">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      <span className="text-base font-bold tabular-nums text-emerald-300">현재 {now ?? '--:--'} KST</span>
      <span className="text-slate-400">·</span>
      모든 값에 산출 시각
      <span className="text-slate-400">·</span>
      <span className="text-slate-300">갱신 지연 시 회색</span>
    </span>
  );
}
