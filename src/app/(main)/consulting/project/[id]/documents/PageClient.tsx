'use client';

import { Suspense, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Download, Trash2, Loader2, File, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import type { ConsultationOrigin } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useReports, useApproveReport, useRejectReport } from '@/hooks/consulting/useConsultations';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { uploadReportFile, getDownloadUrl, getViewUrl } from '@/api/common/files';
import { useQueryClient } from '@tanstack/react-query';

const DOC_TYPE_LABELS: Record<string, string> = {
  DIRECTION: '방향 보고서',
  STRATEGY: '전략 보고서',
  FINAL: '최종안',
  REPORT: '보고서',
  SITE_REPORT: '현장 방문 보고서',
  PROPOSAL: '전략 제안서',
  CONTRACT: '계약서',
  CONTRACT_DRAFT: '계약서 초안',
  CONTRACT_FINAL: '최종 계약서',
  INSPECTION: '검수 보고서',
  ETC: '기타',
};

const DOC_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '초안', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
  REVIEW: { label: '검토중', color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
  APPROVED: { label: '승인', color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
};

const UPLOAD_TYPE_OPTIONS = [
  { value: 'DIRECTION', label: '방향 보고서 (초안)' },
  { value: 'STRATEGY', label: '전략 보고서 (중간)' },
  { value: 'FINAL', label: '최종 보고서' },
  { value: 'SITE_REPORT', label: '현장 방문 보고서' },
  { value: 'REPORT', label: '기타 보고서' },
];

interface DocItem {
  id: number;
  name: string;
  type: string;
  fileId: number | null;
  fileName: string | null;
  fileSize: number | null;
  authorName?: string;
  uploadedAt?: string;
  status?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const { id } = useParams();
  const consultationId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = (searchParams.get('origin') as ConsultationOrigin) || 'marketplace';
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.add);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: apiReports = [], isLoading } = useReports(consultationId);

  const documents: DocItem[] = useMemo(
    () =>
      (apiReports as any[]).map((r: any) => ({
        id: r.id,
        name: r.fileName || DOC_TYPE_LABELS[r.reportType] || r.reportType || '문서',
        type: r.reportType ?? 'ETC',
        fileId: r.fileId ?? null,
        fileName: r.fileName ?? null,
        fileSize: r.fileSize ?? null,
        authorName: r.authorName,
        uploadedAt: r.updatedAt ?? r.createdAt,
        status: r.status,
      })),
    [apiReports],
  );

  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [uploadType, setUploadType] = useState('REPORT');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);

  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const isConsultant = searchParams.get('role') === 'consultant';

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    blobUrlRef.current = blobUrl;
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleSelectDoc = useCallback(
    async (doc: DocItem) => {
      if (!doc.fileId) {
        toast('info', '파일이 아직 첨부되지 않은 문서입니다');
        return;
      }
      setSelectedDoc(doc);
      setFullscreen(false);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        setBlobUrl(null);
      }
      setPdfLoading(true);
      try {
        const res = await fetch(getViewUrl(doc.fileId), { credentials: 'include' });
        if (!res.ok) throw new Error(`${res.status}`);
        const blob = await res.blob();
        setBlobUrl(URL.createObjectURL(blob));
      } catch {
        toast('error', 'PDF를 불러올 수 없습니다');
        setBlobUrl(null);
      } finally {
        setPdfLoading(false);
      }
    },
    [toast],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast('error', 'PDF 파일만 업로드 가능합니다');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast('error', '파일 크기는 50MB 이하여야 합니다');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPendingFile(file);
    setUploadType('REPORT');
    setTypeSelectOpen(true);
  };

  const handleUploadConfirm = async () => {
    if (!pendingFile) return;
    setTypeSelectOpen(false);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      await uploadReportFile(consultationId, formData, uploadType, user?.id ?? 1);
      toast('success', `${DOC_TYPE_LABELS[uploadType] || '문서'}가 업로드되었습니다`);
      queryClient.invalidateQueries({ queryKey: ['consultations', 'detail', consultationId, 'reports'] });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast('error', err?.message || '업로드에 실패했습니다');
    } finally {
      setUploading(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/v1/consultations/reports/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast('success', '문서가 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: ['consultations', 'detail', consultationId, 'reports'] });
      if (selectedDoc?.id === deleteTarget.id) {
        setSelectedDoc(null);
      }
    } catch {
      toast('error', '삭제에 실패했습니다');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDownload = (doc: DocItem) => {
    if (!doc.fileId) return;
    window.open(getDownloadUrl(doc.fileId), '_blank');
  };

  const previewUrl = blobUrl;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Fullscreen PDF viewer
  if (fullscreen && previewUrl && selectedDoc) {
    return (
      <div className="fixed inset-0 z-[70] bg-black flex flex-col">
        <div className="flex items-center justify-between bg-[#111] px-4 py-2 shrink-0">
          <span className="text-sm text-white font-medium truncate">{selectedDoc.name}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => handleDownload(selectedDoc)}>
              <Download size={13} className="mr-1" /> 다운로드
            </Button>
            <button
              onClick={() => setFullscreen(false)}
              className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <iframe src={previewUrl} className="flex-1 w-full bg-white" title={selectedDoc.name} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-6xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '프로젝트', path: `/consulting/project/${id}?origin=${origin}` },
              { label: '문서 작업실' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">문서 작업실</h1>
            <p className="mt-0.5 text-xs text-slate-400">프로젝트 문서를 PDF로 열람합니다</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            {isConsultant && (
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <Loader2 size={13} className="animate-spin mr-1.5" />
                ) : (
                  <Upload size={13} className="mr-1.5" />
                )}
                PDF 업로드
              </Button>
            )}
            <button
              onClick={() => router.push(`/consulting/project/${id}?origin=${origin}`)}
              className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="닫기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col xl:flex-row gap-5">
            {/* Document List — always visible */}
            <div className="xl:w-72 shrink-0 space-y-1.5">
              <p className="text-xs text-slate-500 font-medium px-1 mb-2">문서 목록 ({documents.length})</p>
              <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
                {documents.length === 0 ? (
                  <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-6 text-center">
                    <FileText size={24} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500">문서가 없습니다</p>
                    <p className="text-[10px] text-slate-600 mt-1">PDF를 업로드하세요</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectDoc(doc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleSelectDoc(doc);
                      }}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left ring-1 transition-all group cursor-pointer',
                        selectedDoc?.id === doc.id
                          ? 'bg-primary/10 ring-primary/30'
                          : doc.fileId
                            ? 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]'
                            : 'bg-white/[0.01] ring-white/[0.04] opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                            doc.fileId ? 'bg-red-500/10' : 'bg-white/[0.04]',
                          )}
                        >
                          <File size={12} className={doc.fileId ? 'text-red-400' : 'text-slate-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500">{DOC_TYPE_LABELS[doc.type] || doc.type}</span>
                            {(() => {
                              const st = doc.status ? DOC_STATUS_LABELS[doc.status] : null;
                              return st ? (
                                <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                  {st.label}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {doc.fileSize && (
                              <span className="text-[10px] text-slate-600">{formatFileSize(doc.fileSize)}</span>
                            )}
                            {doc.uploadedAt && (
                              <span className="text-[10px] text-slate-600">
                                {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isConsultant && doc.fileId && doc.status === 'APPROVED' && (
                            <span className="text-[10px] text-emerald-400 px-1">✓ 승인됨</span>
                          )}
                          {!isConsultant && doc.fileId && doc.status !== 'APPROVED' && rejectingId !== doc.id && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveReport.mutate(doc.id, {
                                    onSuccess: () => {
                                      toast('success', `${DOC_TYPE_LABELS[doc.type] || '보고서'}를 승인했습니다`);
                                      queryClient.invalidateQueries({
                                        queryKey: ['consultations', 'detail', consultationId, 'reports'],
                                      });
                                    },
                                    onError: () => toast('error', '승인에 실패했습니다'),
                                  });
                                }}
                                disabled={approveReport.isPending}
                                className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                              >
                                승인
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectingId(doc.id);
                                  setRejectReason('');
                                }}
                                className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 transition-colors"
                              >
                                반려
                              </button>
                            </>
                          )}
                          {isConsultant && doc.fileId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(doc);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.06] text-slate-500 hover:text-red-400 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {!isConsultant && rejectingId === doc.id && (
                        <div
                          className="mt-2 pt-2 border-t border-white/[0.06] space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="수정 요청 사유를 입력하세요"
                            className="w-full rounded-md bg-[#0d1520] ring-1 ring-white/[0.1] px-3 py-1.5 text-[10px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                              className="flex-1 py-1.5 rounded text-[10px] text-slate-400 ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-colors"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              disabled={!rejectReason.trim() || rejectReport.isPending}
                              onClick={() => {
                                rejectReport.mutate(
                                  { reportId: doc.id, reason: rejectReason.trim() },
                                  {
                                    onSuccess: () => {
                                      toast('success', '수정 요청을 보냈습니다');
                                      setRejectingId(null);
                                      setRejectReason('');
                                      queryClient.invalidateQueries({
                                        queryKey: ['consultations', 'detail', consultationId, 'reports'],
                                      });
                                    },
                                    onError: () => toast('error', '수정 요청에 실패했습니다'),
                                  },
                                );
                              }}
                              className="flex-1 py-1.5 rounded text-[10px] font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                            >
                              {rejectReport.isPending ? (
                                <Loader2 size={10} className="animate-spin inline mr-1" />
                              ) : null}
                              보내기
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PDF Viewer — always visible */}
            <div className="flex-1 min-w-0">
              {selectedDoc ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white truncate">{selectedDoc.name}</h2>
                    <div className="flex items-center gap-1 shrink-0">
                      {previewUrl && (
                        <Button size="sm" variant="ghost" onClick={() => setFullscreen(true)}>
                          <Maximize2 size={13} className="mr-1" /> 전체화면
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(selectedDoc)}>
                        <Download size={13} className="mr-1" /> 다운로드
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white overflow-hidden" style={{ height: 'min(65vh, 600px)' }}>
                    {pdfLoading ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <Loader2 className="animate-spin text-slate-400" size={28} />
                      </div>
                    ) : previewUrl ? (
                      <iframe src={previewUrl} className="w-full h-full" title={selectedDoc.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <p className="text-sm text-slate-400">PDF를 불러올 수 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] flex flex-col items-center justify-center"
                  style={{ height: 'min(65vh, 600px)' }}
                >
                  <FileText size={28} className="text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">
                    {documents.length === 0
                      ? isConsultant
                        ? 'PDF를 업로드하면 여기에서 열람할 수 있습니다'
                        : '아직 등록된 문서가 없습니다'
                      : '문서를 선택하면 미리보기가 표시됩니다'}
                  </p>
                  {documents.length === 0 && isConsultant && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-3"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload size={13} className="mr-1.5" /> PDF 업로드
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 문서 유형 선택 모달 */}
      {typeSelectOpen && pendingFile && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setTypeSelectOpen(false);
              setPendingFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">문서 유형 선택</h3>
            <p className="text-xs text-slate-400">
              <span className="text-white font-medium">{pendingFile.name}</span>의 문서 유형을 선택하세요.
            </p>
            <div className="space-y-2">
              {UPLOAD_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUploadType(opt.value)}
                  className={cn(
                    'w-full rounded-lg px-4 py-3 text-left ring-1 transition-all text-sm',
                    uploadType === opt.value
                      ? 'bg-primary/10 ring-primary/40 text-white'
                      : 'bg-white/[0.02] ring-white/[0.06] text-slate-300 hover:ring-white/[0.12]',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTypeSelectOpen(false);
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                취소
              </Button>
              <Button size="sm" variant="primary" onClick={handleUploadConfirm}>
                <Upload size={13} className="mr-1.5" /> 업로드
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="문서 삭제"
        message={`'${deleteTarget?.name}' 문서를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        variant="danger"
      />
    </div>
  );
}
