import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Notification, PageResponse } from '@/types';

export interface NotificationSettingDto {
  eventKey: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationEventCatalogItem {
  eventKey: string;
  label: string;
  domain: string;
}

// 이벤트 카탈로그 경로 — 공유 endpoints.ts 미수정 정책. list 경로에서 V1 base 파생(sibling 경로).
const EVENT_CATALOG_PATH = `${ENDPOINTS.notifications.list}/event-catalog`;

export async function getNotificationEventCatalog(): Promise<NotificationEventCatalogItem[]> {
  return getApiClient().get(EVENT_CATALOG_PATH);
}

export async function getNotifications(params?: object): Promise<PageResponse<Notification>> {
  return getApiClient().get(ENDPOINTS.notifications.list, params);
}

export async function getUnreadCount(): Promise<number> {
  return getApiClient().get(ENDPOINTS.notifications.unreadCount);
}

export async function markRead(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.notifications.markRead(id));
}

export async function markAllRead(): Promise<void> {
  return getApiClient().patch(ENDPOINTS.notifications.markAllRead);
}

export async function getNotificationSettings(): Promise<NotificationSettingDto[]> {
  return getApiClient().get(ENDPOINTS.notifications.settings);
}

export async function saveNotificationSettings(settings: NotificationSettingDto[]): Promise<void> {
  return getApiClient().put(ENDPOINTS.notifications.settings, settings);
}
