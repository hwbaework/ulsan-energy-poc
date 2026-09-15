'use client';

// 증빙 첨부 패널 (성과 4화면 공통) — B1 evidence 계약 배선.
// 업로드·목록·다운로드·삭제·zip export. owner_type별 컨텍스트 귀속.
// F-A 소유 route(performance)에 co-locate하여 tenants/finance/outreach가 재사용.

import { useRef, useState } from 'react';
import { Paperclip, Upload, Download, Trash2, FileArchive, Loader2 } from 'lucide-react';
import {
  useEvidences,
  useUploadEvidence,
  useDeleteEvidence,
  evidenceDownloadUrl,
  evidenceExportZipUrl,
  type EvidenceOwnerType,
  type EvidenceType,
} from '@/hooks/evidence/useEvidence';

interface EvidencePanelProps {
  ownerType: EvidenceOwnerType;
  ownerId: string;
  indicatorNo: number;
  year: number;
  evidenceType: EvidenceType;
  /** 업로더 userId (auth store) */
  uploadedBy?: string;
  /** 헤더 라벨 */
  title?: string;
}

function fmtSize(bytes: number): string {
  if (!bytes) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function EvidencePanel({
  ownerType,
  ownerId,
  indicatorNo,
  year,
  evidenceType,
  uploadedBy,
  title = '증빙 첨부',
}: EvidencePanelProps) {
  const listQ = useEvidences(indicatorNo, year);
  const uploadM = useUploadEvidence();
  const deleteM = useDeleteEvidence();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');

  const items = listQ.data ?? [];

  const onPick = () => fileRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadM.mutate(
      { file, ownerType, ownerId, indicatorNo, year, evidenceType, source, note, uploadedBy },
      {
        onSettled: () => {
          if (fileRef.current) fileRef.current.value = '';
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Paperclip size={14} /> {title}
          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-400">{items.length}건</span>
        </div>
        <a
          href={evidenceExportZipUrl(indicatorNo, year)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04]"
        >
          <FileArchive size={13} /> zip
        </a>
      </div>

      {/* 업로드 폼 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="출처(검수기관·한국에너지공단 등)"
          className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="비고(선택)"
          className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
        <button
          onClick={onPick}
          disabled={uploadM.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {uploadM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          파일 업로드
        </button>
        {uploadM.isError && <span className="text-xs text-rose-400">업로드 실패 — 다시 시도</span>}
      </div>

      {/* 목록 */}
      {listQ.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" /> 불러오는 중…
        </div>
      ) : listQ.isError ? (
        <div className="py-3 text-sm text-rose-400">증빙 목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="py-3 text-sm text-slate-500">첨부된 증빙이 없습니다.</div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {items.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-slate-200">{ev.fileName}</div>
                <div className="text-[11px] text-slate-500">
                  {ev.evidenceType} · {fmtSize(ev.fileSize)} · {ev.measuredAt || ev.uploadedAt?.slice(0, 10)}
                  {ev.source ? ` · ${ev.source}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={evidenceDownloadUrl(ev.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                  title="다운로드"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => deleteM.mutate(ev.id)}
                  disabled={deleteM.isPending}
                  className="rounded p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
