'use client';

import { usePathname } from 'next/navigation';
import { ToastContainer } from '@/components/ui/Toast';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // 회원가입은 칸이 많아 넓게 — 칸을 옆으로 놓아 스크롤 없이 한 화면에 들어오게 한다(2026-11-24 사용자)
  const wide = usePathname()?.startsWith('/signup');
  return (
    <div className="flex min-h-screen bg-surface-dark bg-[url('/images/bg.jpg')] bg-cover bg-fixed bg-center">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'}`}>{children}</div>
      </div>
      <ToastContainer />
    </div>
  );
}
