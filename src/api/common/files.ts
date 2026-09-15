import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { FileInfo } from '@/types';

export async function uploadFile(formData: FormData): Promise<FileInfo> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Upload failed: ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

export async function uploadReportFile(
  consultationId: number,
  formData: FormData,
  reportType: string,
  authorId: number,
): Promise<unknown> {
  const params = new URLSearchParams({ reportType, authorId: String(authorId) });
  const res = await fetch(`/api/v1/consultations/${consultationId}/reports/upload?${params}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`업로드 실패 (${res.status}): ${text || res.statusText}`);
  }
  return res.json().then((j) => j.data ?? j);
}

export async function getFileInfo(id: number): Promise<FileInfo> {
  return getApiClient().get(ENDPOINTS.files.detail(id));
}

export async function deleteFile(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.files.detail(id));
}

export function getDownloadUrl(id: number): string {
  return `/api/v1${ENDPOINTS.files.download(id)}`;
}

export function getViewUrl(id: number): string {
  return `/api/files/${id}/view`;
}
