'use client';

import { useSyncExternalStore } from 'react';

/**
 * 지금 주소의 ?뒤(search)를 읽고, 주소가 바뀌면 다시 읽는다.
 *
 * 왜 필요한가: 상세 화면(…/view?id=6)에 있을 때 다른 알림을 눌러 같은 화면의 다른 건(…/view?id=20)으로 가면
 * 화면이 새로 그려지지 않아 처음 읽은 id 그대로 남았다(2026-11-17 사용자: "다른 알림 눌러도 다른 페이지로 안 가?").
 * useSearchParams 는 정적 내보내기에서 Suspense 로 감싸야 해서, 주소 바뀜(pushState · replaceState · 뒤로 가기)을 직접 듣는다.
 */
let patched = false;
function patchHistory() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = window.history[m].bind(window.history);
    window.history[m] = ((...args: Parameters<History['pushState']>) => {
      orig(...args);
      // 주소를 바꾸는 중에 화면을 다시 그리지 않도록 한 박자 뒤에 알린다
      queueMicrotask(() => window.dispatchEvent(new Event('locationchange')));
    }) as History['pushState'];
  }
}

function subscribe(cb: () => void) {
  patchHistory();
  window.addEventListener('locationchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('locationchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

export function useLocationSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
}
