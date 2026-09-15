'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body className="bg-surface-dark text-white font-sans">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-xl font-bold">시스템 오류가 발생했습니다</h2>
          <p className="text-sm text-slate-400">문제가 지속되면 관리자에게 문의해 주세요.</p>
          {error.digest && <p className="text-xs text-slate-500">오류 코드: {error.digest}</p>}
          <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
