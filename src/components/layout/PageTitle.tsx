'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * 상세·하위 화면 제목. 가이드 규칙: 제목 왼쪽에 ← ghost 아이콘 버튼으로 뒤로 간다.
 * 오른쪽에 '목록으로' 텍스트 버튼을 두지 않는다.
 */
export function PageTitle({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.back()}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        aria-label="뒤로"
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-xl font-bold text-white">{title}</h1>
    </div>
  );
}
