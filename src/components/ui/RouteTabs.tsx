'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 화면 상단 탭 — 기존 라우트 링크형(doc 03 §5: depth2는 사이드바가 아닌 화면 탭). 라우트 변경 0.
export interface RouteTabItem {
  href: string;
  label: string;
  /** true면 pathname이 href로 시작해도 활성 처리 (하위 상세 포함) */
  prefix?: boolean;
}

export function RouteTabs({ items }: { items: RouteTabItem[] }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 border-b border-white/[0.06]">
      {items.map((t) => {
        const active = t.prefix ? pathname.startsWith(t.href) : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              active
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
