'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      router.replace('/');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen bg-[#0d1520] flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center animate-[fadeIn_400ms_ease-out]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <AlertCircle size={36} className="text-red-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-white">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm text-slate-400">요청하신 페이지가 존재하지 않거나 이동되었습니다</p>
        <p className="mt-2 text-xs text-slate-500">{countdown}초 후 홈으로 이동합니다</p>
        <button
          onClick={() => router.replace('/')}
          className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Home size={16} />
          홈으로 이동
        </button>
      </div>
    </div>
  );
}
