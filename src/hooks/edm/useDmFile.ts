'use client';

// 데이터셋 파일 첨부 (format='FILE') — 업로드(판매자 위저드 §1.4)·다운로드(구매 게이팅). 설계 12 §1.4.
// 골든 템플릿: usePayments.ts 의 try-catch 낙관 폴백(가짜 성공 금지·isLive 명시) + onSuccess invalidate 패턴 복제.
// 업로드는 multipart(FormData), 다운로드는 blob 스트림 — api client(JSON 전용)가 지원 못 하므로 axios 직접 사용
//   (client.ts 와 동일하게 withCredentials:true 로 세션 쿠키 전송).
//
// ═══ MinIO 전환 지점 (FE) ═══
// 다운로드는 로컬 경로가 아니라 서버 경유 스트리밍 엔드포인트(downloadFile)를 호출한다.
// MinIO 로 옮겨도 BE 내부만 getObject/서명URL 로 교체되고 이 훅의 계약(엔드포인트·blob 반환)은 불변.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/edmEndpoints';
import { dmKeys } from '@/api/edmQueryKeys';

const api = () => getApiClient();
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

// ── 파일 목록 (메타만 — 저장참조 미노출) ──
export interface DatasetFileRow {
  id: number;
  datasetId: number;
  originalName: string;
  contentType: string | null;
  sizeBytes: number;
}

export function useDatasetFiles(datasetId?: number, enabled = true) {
  const q = useQuery({
    queryKey: [...dmKeys.all, 'files', datasetId] as const,
    queryFn: async () =>
      await api().get<DatasetFileRow[]>(ENDPOINTS.datamarket.datasetFiles(datasetId!)),
    enabled: !!datasetId && enabled,
    retry: false,
  });
  // 설계 22: 실데이터/빈/오류 정확 노출.
  return {
    data: (q.data ?? []) as DatasetFileRow[],
    isLive: q.isSuccess,
    isError: q.isError,
    isLoading: q.isLoading,
  };
}

// ── 업로드 ──
export interface UploadDatasetFileInput {
  datasetId: number;
  file: File;
  companyId?: number; // 판매자(소유) 검증용
  uploadedBy?: number;
}
export interface UploadDatasetFileResult {
  id: number;
  datasetId: number;
  originalName: string;
  sizeBytes: number;
  isLive: boolean;
  mock?: boolean;
}
interface ApiDatasetFile {
  id?: number;
  datasetId?: number;
  originalName?: string;
  contentType?: string | null;
  sizeBytes?: number;
}

export function useUploadDatasetFile() {
  const qc = useQueryClient();
  return useMutation<UploadDatasetFileResult, unknown, UploadDatasetFileInput>({
    mutationFn: async (input) => {
      const form = new FormData();
      form.append('file', input.file);
      const url = `${API_BASE_URL}${ENDPOINTS.datamarket.datasetFiles(input.datasetId).replace('/api/v1', '')}`;
      const params: Record<string, number> = {};
      if (input.companyId != null) params.companyId = input.companyId;
      if (input.uploadedBy != null) params.uploadedBy = input.uploadedBy;
      try {
        // ApiResponse 봉투: { success, data }. multipart 는 Content-Type 을 브라우저가 boundary 와 함께 설정.
        const res = await axios.post<{ data?: ApiDatasetFile }>(url, form, {
          params,
          withCredentials: true,
        });
        const d = res.data?.data ?? {};
        return {
          id: d.id ?? -1,
          datasetId: d.datasetId ?? input.datasetId,
          originalName: d.originalName ?? input.file.name,
          sizeBytes: d.sizeBytes ?? input.file.size,
          isLive: true,
        };
      } catch {
        // BE 미가동/권한거부 — 낙관 폴백(가짜 성공 금지: isLive:false 명시)
        return {
          id: -1,
          datasetId: input.datasetId,
          originalName: input.file.name,
          sizeBytes: input.file.size,
          isLive: false,
          mock: true,
        };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.all }),
  });
}

// ── 다운로드 (구매 게이팅·서버 경유 스트리밍) ──
export interface DownloadDatasetFileInput {
  fileId: number;
  fileName: string;
  companyId?: number; // 구매자(주문) 또는 판매자(소유) 검증용
}
export interface DownloadResult {
  ok: boolean;
  forbidden?: boolean;
}

export function useDownloadDatasetFile() {
  return useMutation<DownloadResult, unknown, DownloadDatasetFileInput>({
    mutationFn: async (input) => {
      const url = `${API_BASE_URL}${ENDPOINTS.datamarket.downloadFile(input.fileId).replace('/api/v1', '')}`;
      try {
        const res = await axios.get<Blob>(url, {
          params: input.companyId != null ? { companyId: input.companyId } : {},
          responseType: 'blob',
          withCredentials: true,
        });
        // 브라우저 다운로드 트리거 (blob → object URL → anchor click)
        const objectUrl = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = input.fileName || 'dataset-file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
        return { ok: true };
      } catch (e) {
        // 403 = 구매/소유 게이트 미통과 (BE: DM_DOWNLOAD_FORBIDDEN)
        const err = e as { response?: { status?: number } };
        return { ok: false, forbidden: err?.response?.status === 403 };
      }
    },
  });
}
