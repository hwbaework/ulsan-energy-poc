import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Notice, CreateNoticeRequest, PageResponse } from '@/types';

export async function getNotices(params?: object): Promise<PageResponse<Notice>> {
  return getApiClient().get(ENDPOINTS.notices.list, params);
}

export async function getNotice(id: number): Promise<Notice> {
  return getApiClient().get(ENDPOINTS.notices.detail(id));
}

export async function createNotice(data: CreateNoticeRequest, authorId: number): Promise<Notice> {
  return getApiClient().post(`${ENDPOINTS.notices.list}?authorId=${authorId}`, data);
}

export async function updateNotice(id: number, data: CreateNoticeRequest): Promise<Notice> {
  return getApiClient().put(ENDPOINTS.notices.detail(id), data);
}

export async function deleteNotice(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.notices.detail(id));
}
