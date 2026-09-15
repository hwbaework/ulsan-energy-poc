export interface Notice {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  targetType?: string;
  viewCount: number;
  authorName: string;
  createdAt: string;
}

export interface CreateNoticeRequest {
  title: string;
  content: string;
  pinned?: boolean;
  targetType?: string;
  targetRoleId?: number;
  targetCompanyId?: number;
}
