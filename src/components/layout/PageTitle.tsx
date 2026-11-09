'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * 뒤로 가기 버튼 — 앱 전체 하나로 통일(가이드 규칙: 상세·하위 화면은 제목 왼쪽에 ← 아이콘 버튼, 글자 없음).
 * href 가 있으면 그 목록으로, onClick 이 있으면 그 동작, 둘 다 없으면 브라우저 뒤로.
 * ‹ › (날짜·연도·페이지 넘기기)와는 다른 버튼이다.
 */
export function BackButton({ href, onClick, label = '뒤로' }: { href?: string; onClick?: () => void; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={onClick ?? (() => (href ? router.push(href) : router.back()))}
      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
      aria-label={label}
      title={label}
    >
      <ArrowLeft size={18} />
    </button>
  );
}

/** 메뉴 첫 화면 제목(기업 정보 · 설정 · 내 계정) — 메뉴에서 바로 여는 화면이라 뒤로 가기 없음. 상세 · 하위 화면은 제목 왼쪽에 BackButton 을 따로 둔다 */
export function PageTitle({ title }: { title: string }) {
  return <h1 className="text-2xl font-bold text-white">{title}</h1>;
}
