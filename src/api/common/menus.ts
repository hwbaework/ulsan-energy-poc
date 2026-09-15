import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

export interface BackendMenu {
  id: number;
  menuCode: string;
  name: string;
  parentId?: number;
  sortOrder: number;
  isVisible: boolean;
}

export async function getMenus(): Promise<BackendMenu[]> {
  return getApiClient().get(ENDPOINTS.menus.list);
}
