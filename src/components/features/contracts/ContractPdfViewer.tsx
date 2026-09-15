'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { getViewUrl, getDownloadUrl } from '@/api/common/files';

/* 계약서 PDF 뷰어 — fetch 로 PDF를 blob 으로 받아 blob: URL 을 iframe 에 렌더
 * (서버 X-Frame-Options/인증 영향 없이 same-origin blob 으로 표시) */
export function ContractPdfViewer({
  fileId,
  fileName,
  height = 'h-[46vh]',
}: {
  fileId: number;
  fileName?: string;
  height?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const res = await fetch(getViewUrl(fileId), { credentials: 'include' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  return (
    <div className="rounded-lg ring-1 ring-white/[0.08] bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-white/[0.02]">
        <span className="flex items-center gap-1.5 text-xs text-slate-300 min-w-0">
          <FileText size={13} className="text-slate-400 shrink-0" />
          <span className="truncate">{fileName || '계약서.pdf'}</span>
        </span>
        <a
          href={getDownloadUrl(fileId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
        >
          <Download size={12} /> 다운로드
        </a>
      </div>
      {loading ? (
        <div className={`${height} flex items-center justify-center bg-white/[0.02]`}>
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : error || !blobUrl ? (
        <div className={`${height} flex flex-col items-center justify-center gap-2 text-center px-4`}>
          <FileText size={24} className="text-slate-500" />
          <p className="text-xs text-slate-400">PDF 미리보기를 불러올 수 없습니다.</p>
          <a
            href={getDownloadUrl(fileId)}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary hover:underline"
          >
            다운로드로 열기
          </a>
        </div>
      ) : (
        <iframe src={blobUrl} title="계약서" className={`w-full ${height} bg-white`} />
      )}
    </div>
  );
}
