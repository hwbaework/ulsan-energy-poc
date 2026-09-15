'use client';

// 증빙 원장(evidence) — energy-backend /api/v1/evidence 배선 (F-A, 스펙 09 §3.0 / B1 계약).
// 다형 원장: ownerType ∈ {performance_actual, support_activity, finance_settlement}.
// edmEndpoints.ts/endpoints.ts 수정 금지(F-A 소유권) → 경로 상수는 본 파일 로컬에 둔다(게이트에서 병합).
// 미가동/빈결과 시 호출부에서 empty/에러 처리.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';

const api = () => getApiClient();

// 로컬 경로 상수 (공유 endpoints.ts 미수정 정책)
const EVIDENCE = {
  base: '/evidence',
  detail: (id: string) => `/evidence/${id}`,
  download: (id: string) => `/api/v1/evidence/${id}/download`,
  exportZip: '/api/v1/evidence/export.zip',
} as const;

export type EvidenceOwnerType = 'performance_actual' | 'support_activity' | 'finance_settlement';

export type EvidenceType =
  | 'INSTALL_INSPECTION'
  | 'SITE_PHOTO'
  | 'SUPPLY_CONFIRM'
  | 'SALES_STATEMENT'
  | 'REC_ISSUE'
  | 'BUILD_PROGRESS_REPORT'
  | 'RESULT_REPORT'
  | 'PROMO_MATERIAL'
  | 'SANDBOX_APPLICATION'
  | 'MODEL_DOC'
  | 'SETTLEMENT_STATEMENT'
  | 'DIVIDEND_RESOLUTION';

export interface Evidence {
  id: string;
  ownerType: EvidenceOwnerType;
  ownerId: string;
  indicatorNo: number | null;
  year: number;
  measuredAt: string;
  evidenceType: EvidenceType;
  source: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedBy: string;
  uploadedAt: string;
  note: string | null;
}

export interface UploadEvidenceInput {
  file: File;
  ownerType: EvidenceOwnerType;
  ownerId: string;
  indicatorNo?: number | null;
  year: number;
  measuredAt?: string;
  evidenceType: EvidenceType;
  source?: string;
  note?: string;
  uploadedBy?: string;
}

/** 지표·연차별 증빙 목록(심사 열람 계약) — GET /evidence?indicatorNo=&year= */
export function useEvidences(indicatorNo?: number, year?: number) {
  return useQuery({
    queryKey: ['evidence', 'indicator', indicatorNo, year],
    queryFn: async () => await api().get<Evidence[]>(EVIDENCE.base, { indicatorNo, year }),
    enabled: indicatorNo != null && !!year,
    retry: false,
  });
}

/** 소유 컨텍스트별 증빙 목록 — GET /evidence?ownerType=&ownerId= */
export function useEvidencesByOwner(ownerType?: EvidenceOwnerType, ownerId?: string) {
  return useQuery({
    queryKey: ['evidence', 'owner', ownerType, ownerId],
    queryFn: async () => await api().get<Evidence[]>(EVIDENCE.base, { ownerType, ownerId }),
    enabled: !!ownerType && !!ownerId,
    retry: false,
  });
}

/** 증빙 업로드(multipart) — POST /evidence */
export function useUploadEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadEvidenceInput) => {
      const fd = new FormData();
      fd.append('file', input.file);
      fd.append('ownerType', input.ownerType);
      fd.append('ownerId', input.ownerId);
      if (input.indicatorNo != null) fd.append('indicatorNo', String(input.indicatorNo));
      fd.append('year', String(input.year));
      if (input.measuredAt) fd.append('measuredAt', input.measuredAt);
      fd.append('evidenceType', input.evidenceType);
      if (input.source) fd.append('source', input.source);
      if (input.note) fd.append('note', input.note);
      if (input.uploadedBy) fd.append('uploadedBy', input.uploadedBy);
      return api().post<Evidence>(EVIDENCE.base, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evidence'] }),
  });
}

/** 증빙 삭제 — DELETE /evidence/{id} */
export function useDeleteEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().delete<void>(EVIDENCE.detail(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evidence'] }),
  });
}

/** 원본 다운로드 URL(서명 URL 프록시) — <a href> 직접 사용 */
export function evidenceDownloadUrl(id: string): string {
  return EVIDENCE.download(id);
}

/** 지표·연차 증빙 일괄 zip URL — <a href> 직접 사용 */
export function evidenceExportZipUrl(indicatorNo?: number, year?: number): string {
  const params = new URLSearchParams();
  if (indicatorNo != null) params.set('indicatorNo', String(indicatorNo));
  if (year != null) params.set('year', String(year));
  const qs = params.toString();
  return qs ? `${EVIDENCE.exportZip}?${qs}` : EVIDENCE.exportZip;
}
